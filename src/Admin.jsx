import { useCallback, useEffect, useRef, useState } from 'react'
import './System.css'

const money = cents => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100)
const statusLabel = { pending: 'Neu', accepted: 'Angenommen', rejected: 'Abgelehnt', cancelled: 'Storniert' }

async function request(path, options = {}, csrf = '') {
  const response = await fetch(path, {
    ...options,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...options.headers },
  })
  const type = response.headers.get('content-type') || ''
  if (!type.includes('application/json')) throw new Error('API nicht erreichbar. Bitte den vollständigen Server mit „npm run dev“ starten.')
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Anfrage fehlgeschlagen')
  return data
}

function Login({ onLogin }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return <main className="system-shell login-shell">
    <div className="login-atmosphere" aria-hidden="true"><i/><i/><i/></div>
    <form className="system-card login-card" onSubmit={async event => {
      event.preventDefault(); setError(''); setBusy(true)
      try {
        const data = new FormData(event.currentTarget)
        onLogin(await request('/api/admin/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(data)) }))
      } catch (failure) { setError(failure.message) } finally { setBusy(false) }
    }}>
      <img src="/graffiti-smash-logo.svg" alt="Graffiti Smash"/>
      <div><p className="system-kicker">SECURE ORDER CONTROL</p><h1>System<br/><em>Login</em></h1></div>
      <label>E-Mail<input name="email" type="email" autoComplete="username" required placeholder="name@restaurant.de"/></label>
      <label>Passwort<input name="password" type="password" autoComplete="current-password" required placeholder="••••••••••••"/></label>
      {error && <p className="system-error" role="alert">{error}</p>}
      <button className="system-primary" disabled={busy}>{busy ? 'Wird geprüft …' : 'Sicher anmelden →'}</button>
      <small>Geschützte Verbindung · Sitzung endet automatisch</small>
    </form>
  </main>
}

function OrderCard({ order, mutate }) {
  const [minutes, setMinutes] = useState(20)
  const created = new Date(`${order.created_at.replace(' ', 'T')}Z`)
  return <article className={`order-card ${order.status}`}>
    <header><div><span className="order-status"><i/>{statusLabel[order.status]}</span><b>{order.public_id}</b></div><time>{created.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</time></header>
    <div className="order-customer"><div><small>KUNDE</small><h2>{order.customer_name}</h2><a href={`tel:${order.customer_phone}`}>{order.customer_phone}</a></div><div><small>ABHOLUNG</small><strong>{order.pickup_at ? new Date(order.pickup_at).toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit' }) : 'ASAP'}</strong></div></div>
    <ul>{order.items.map(item => <li key={item.id}><b>{item.quantity}<small>×</small></b><span>{item.name}</span><strong>{money(item.priceCents * item.quantity)}</strong></li>)}</ul>
    {order.notes && <blockquote><small>ANMERKUNG</small>{order.notes}</blockquote>}
    <div className="order-total"><span className={order.payment_status === 'paid' ? 'paid' : 'unpaid'}>{order.payment_status === 'paid' ? '✓ BEZAHLT' : 'ZAHLUNG BEI ABHOLUNG'}</span><b>{money(order.total_cents)}</b></div>
    {order.status === 'pending' && <div className="order-actions">
      <label><span>Zeit</span><select value={minutes} onChange={event => setMinutes(event.target.value)} aria-label="Zubereitungszeit">{[10,15,20,30,45,60].map(value=><option key={value} value={value}>{value} min</option>)}</select></label>
      <button className="accept" onClick={() => mutate(order.id, 'accepted', minutes)}>Annehmen <span>→</span></button>
      <button className="reject" onClick={() => mutate(order.id, 'rejected')} aria-label={`Bestellung ${order.public_id} ablehnen`}>×</button>
    </div>}
    {order.status === 'accepted' && <div className="decision-note">Fertig in ca. <b>{order.accepted_minutes} Minuten</b></div>}
  </article>
}

export default function Admin() {
  const [auth, setAuth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('orders')
  const [filter, setFilter] = useState('active')
  const [orders, setOrders] = useState([])
  const [users, setUsers] = useState([])
  const [integrations, setIntegrations] = useState({})
  const [notice, setNotice] = useState('')
  const [connection, setConnection] = useState('loading')
  const [lastSync, setLastSync] = useState(null)
  const [seconds, setSeconds] = useState(10)
  const loadingRef = useRef(false)
  const authRef = useRef(null)

  useEffect(() => { authRef.current = auth }, [auth])

  const load = useCallback(async (session, silent = false) => {
    const current = session || authRef.current
    if (!current?.user || loadingRef.current) return
    loadingRef.current = true
    if (!silent) setConnection('loading')
    try {
      const nextOrders = await request('/api/admin/orders')
      setOrders(nextOrders)
      if (current.user.role === 'admin') {
        const [nextUsers, rows] = await Promise.all([request('/api/admin/users'), request('/api/admin/integrations')])
        setUsers(nextUsers)
        setIntegrations(Object.fromEntries(rows.map(row => [row.type, row])))
      }
      setConnection('online'); setLastSync(new Date()); setSeconds(10)
    } catch (failure) {
      setConnection('offline')
      if (!silent) setNotice(failure.message)
    } finally { loadingRef.current = false }
  }, [])

  useEffect(() => {
    request('/api/admin/session')
      .then(data => { setAuth(data); return load(data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [load])

  useEffect(() => {
    if (!auth) return
    const tick = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      setSeconds(value => {
        if (value <= 1) { load(auth, true); return 10 }
        return value - 1
      })
    }, 1000)
    const visible = () => document.visibilityState === 'visible' && load(auth, true)
    document.addEventListener('visibilitychange', visible)
    return () => { window.clearInterval(tick); document.removeEventListener('visibilitychange', visible) }
  }, [auth, load])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 3500)
    return () => window.clearTimeout(timer)
  }, [notice])

  if (loading) return <div className="system-loading"><div className="loading-mark"/><span>Order Desk wird geladen …</span></div>
  if (!auth?.user) return <Login onLogin={data => { setAuth(data); load(data) }}/>

  const mutateOrder = async (id, status, minutes) => {
    try {
      await request(`/api/admin/orders/${id}`, { method: 'PATCH', body: JSON.stringify({ status, minutes }) }, auth.csrf)
      setNotice(status === 'accepted' ? `Bestellung angenommen · ${minutes} Minuten` : 'Bestellung abgelehnt')
      await load(auth, true)
    } catch (failure) { setNotice(failure.message) }
  }
  const saveIntegration = async (type, event) => {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    const secret = type === 'smtp' ? 'password' : 'botToken'
    const config = { ...values, secure: values.secure === 'on' }
    if (!config[secret]) delete config[secret]
    try {
      await request(`/api/admin/integrations/${type}`, { method: 'PUT', body: JSON.stringify({ enabled: values.enabled === 'on', config }) }, auth.csrf)
      setNotice(`${type.toUpperCase()} gespeichert`); await load(auth, true)
    } catch (failure) { setNotice(failure.message) }
  }
  const pending = orders.filter(order => order.status === 'pending').length
  const accepted = orders.filter(order => order.status === 'accepted').length
  const revenue = orders.filter(order => order.status === 'accepted').reduce((sum, order) => sum + order.total_cents, 0)
  const visibleOrders = orders.filter(order => filter === 'all' || (filter === 'active' ? ['pending','accepted'].includes(order.status) : order.status === filter))

  return <div className="system-shell">
    <header className="system-header">
      <a className="system-brand" href="/"><img src="/graffiti-smash-logo.svg" alt="Graffiti Smash"/><span>ORDER<br/>CONTROL</span></a>
      <div className="system-live"><i className={connection}/><span>{connection === 'online' ? 'LIVE' : connection === 'offline' ? 'OFFLINE' : 'SYNC'}</span><small>{lastSync ? `${seconds}s` : '…'}</small></div>
      <div className="system-profile"><span><small>ANGEMELDET ALS</small><b>{auth.user.name}</b></span><button onClick={async()=>{await request('/api/admin/logout',{method:'POST',body:'{}'},auth.csrf);setAuth(null)}}>Abmelden</button></div>
    </header>
    <nav className="system-tabs">
      <button className={tab==='orders'?'active':''} onClick={()=>setTab('orders')}><span>01</span>Bestellungen{pending>0&&<b>{pending}</b>}</button>
      {auth.user.role==='admin'&&<><button className={tab==='users'?'active':''} onClick={()=>setTab('users')}><span>02</span>Benutzer</button><button className={tab==='integrations'?'active':''} onClick={()=>setTab('integrations')}><span>03</span>Schnittstellen</button></>}
    </nav>
    {notice && <button className="system-toast" onClick={()=>setNotice('')}><span>✓</span>{notice}</button>}
    <main className="system-content">
      {tab==='orders'&&<section>
        <div className="system-hero"><div><p>LIVE ORDER DESK</p><h1>Bestellungen<span>.</span></h1><small>Automatische Aktualisierung alle 10 Sekunden</small></div><button onClick={()=>load(auth)} className="refresh-button"><span>↻</span> Jetzt aktualisieren</button></div>
        <div className="system-stats"><article><small>NEUE ORDERS</small><b>{pending}</b><i>Action needed</i></article><article><small>ANGENOMMEN</small><b>{accepted}</b><i>Heute im System</i></article><article><small>ORDER VALUE</small><b>{money(revenue)}</b><i>Angenommene Orders</i></article></div>
        <div className="order-toolbar"><div>{[['active','Aktiv'],['pending','Neu'],['accepted','Angenommen'],['all','Alle']].map(([value,label])=><button className={filter===value?'active':''} key={value} onClick={()=>setFilter(value)}>{label}</button>)}</div><span>{visibleOrders.length} Bestellungen</span></div>
        {visibleOrders.length ? <div className="order-grid">{visibleOrders.map(order=><OrderCard order={order} mutate={mutateOrder} key={order.id}/>)}</div> : <div className="empty-orders"><div>✓</div><h2>Alles erledigt.</h2><p>Keine Bestellungen in dieser Ansicht.</p></div>}
      </section>}
      {tab==='users'&&<section>
        <div className="system-hero"><div><p>ACCESS CONTROL</p><h1>Benutzer<span>.</span></h1><small>Zugänge und Berechtigungen verwalten</small></div></div>
        <div className="user-list">{users.map(user=><article className="user-card" key={user.id}><div className="user-avatar">{user.name.slice(0,2).toUpperCase()}</div><div><b>{user.name}</b><span>{user.email}</span></div><mark>{user.role}</mark><button onClick={async()=>{await request(`/api/admin/users/${user.id}`,{method:'PATCH',body:JSON.stringify({active:!user.active,role:user.role})},auth.csrf);await load(auth,true)}}>{user.active?'Aktiv':'Gesperrt'} <i/></button></article>)}</div>
        <form className="system-card system-form user-form" onSubmit={async event=>{event.preventDefault();try{await request('/api/admin/users',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(event.currentTarget)))},auth.csrf);event.currentTarget.reset();setNotice('Benutzer angelegt');await load(auth,true)}catch(failure){setNotice(failure.message)}}}><div><p>NEUER ZUGANG</p><h2>Benutzer anlegen</h2></div><div className="form-grid"><label>Name<input name="name" required/></label><label>E-Mail<input name="email" type="email" required/></label><label>Rolle<select name="role"><option value="staff">Mitarbeiter</option><option value="admin">Administrator</option></select></label><label>Startpasswort<input name="password" type="password" minLength="14" required/></label></div><button className="system-primary">Zugang erstellen →</button></form>
      </section>}
      {tab==='integrations'&&<section>
        <div className="system-hero"><div><p>CONNECTION HUB</p><h1>Schnittstellen<span>.</span></h1><small>Benachrichtigungen sicher verbinden</small></div></div>
        <div className="integration-grid">
          <form className="system-card system-form integration-card" onSubmit={event=>saveIntegration('smtp',event)}><header><div className="integration-icon">✉</div><div><p>E-MAIL DELIVERY</p><h2>SMTP</h2></div><label className="toggle"><input name="enabled" type="checkbox" defaultChecked={integrations.smtp?.enabled===1}/><span/></label></header><div className="form-grid"><label>SMTP-Host<input name="host" defaultValue={integrations.smtp?.config.host||''}/></label><label>Port<input name="port" type="number" defaultValue={integrations.smtp?.config.port||587}/></label><label>Benutzer<input name="user" defaultValue={integrations.smtp?.config.user||''}/></label><label>Passwort<input name="password" type="password" placeholder="Gespeichertes Passwort behalten"/></label><label>Absender<input name="from" defaultValue={integrations.smtp?.config.from||''}/></label><label>Empfänger<input name="to" type="email" defaultValue={integrations.smtp?.config.to||'info@graffitismash.de'}/></label></div><label className="inline-check"><input name="secure" type="checkbox" defaultChecked={integrations.smtp?.config.secure}/> Direkte TLS-Verbindung verwenden</label><button className="system-primary">SMTP speichern →</button></form>
          <form className="system-card system-form integration-card" onSubmit={event=>saveIntegration('telegram',event)}><header><div className="integration-icon telegram">➤</div><div><p>INSTANT ORDER ALERTS</p><h2>Telegram</h2></div><label className="toggle"><input name="enabled" type="checkbox" defaultChecked={integrations.telegram?.enabled===1}/><span/></label></header><label>Bot Token<input name="botToken" type="password" placeholder="Gespeicherten Token behalten"/></label><label>Chat ID<input name="chatId" defaultValue={integrations.telegram?.config.chatId||''}/></label><div className="integration-info"><b>Order-Zettel inklusive</b><span>Neue Bestellungen erscheinen mit Annehmen- und Ablehnen-Button direkt im Chat.</span></div><button className="system-primary">Telegram speichern →</button></form>
        </div>
      </section>}
    </main>
    <nav className="system-mobile-nav"><button className={tab==='orders'?'active':''} onClick={()=>setTab('orders')}><i>▤</i><span>Orders</span>{pending>0&&<b>{pending}</b>}</button>{auth.user.role==='admin'&&<><button className={tab==='users'?'active':''} onClick={()=>setTab('users')}><i>♙</i><span>Benutzer</span></button><button className={tab==='integrations'?'active':''} onClick={()=>setTab('integrations')}><i>⌁</i><span>Connect</span></button></>}</nav>
  </div>
}
