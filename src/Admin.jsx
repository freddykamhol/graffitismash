import { useEffect, useState } from 'react'
import './System.css'

const money = cents => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100)

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
  return <main className="system-shell login-shell"><form className="system-card login-card" onSubmit={async event => {
    event.preventDefault(); setError('')
    const data = new FormData(event.currentTarget)
    try { onLogin(await request('/api/admin/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(data)) })) } catch (e) { setError(e.message) }
  }}>
    <img src="/graffiti-smash-logo.svg" alt="Graffiti Smash"/>
    <p className="system-kicker">GESCHÜTZTER BEREICH</p><h1>System Login</h1>
    <label>E-Mail<input name="email" type="email" autoComplete="username" required/></label>
    <label>Passwort<input name="password" type="password" autoComplete="current-password" required/></label>
    {error && <p className="system-error" role="alert">{error}</p>}
    <button className="system-primary">Sicher anmelden</button>
  </form></main>
}

export default function Admin() {
  const [auth, setAuth] = useState(null), [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('orders'), [orders, setOrders] = useState([]), [users, setUsers] = useState([])
  const [integrations, setIntegrations] = useState({}), [message, setMessage] = useState('')
  const load = async session => {
    const current = session || auth
    if (!current) return
    setOrders(await request('/api/admin/orders'))
    if (current.user.role === 'admin') {
      setUsers(await request('/api/admin/users'))
      const rows = await request('/api/admin/integrations')
      setIntegrations(Object.fromEntries(rows.map(row => [row.type, row])))
    }
  }
  useEffect(() => { request('/api/admin/session').then(data => { setAuth(data); return load(data) }).catch(() => {}).finally(() => setLoading(false)) }, [])
  if (loading) return <div className="system-loading">System wird geladen …</div>
  if (!auth?.user) return <Login onLogin={data => { setAuth(data); load(data) }}/>
  const mutateOrder = async (id, status, minutes) => {
    await request(`/api/admin/orders/${id}`, { method: 'PATCH', body: JSON.stringify({ status, minutes }) }, auth.csrf); await load()
  }
  const saveIntegration = async (type, event) => {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget))
    const secret = type === 'smtp' ? 'password' : 'botToken'
    const config = { ...values, secure: values.secure === 'on' }
    if (!config[secret]) delete config[secret]
    await request(`/api/admin/integrations/${type}`, { method: 'PUT', body: JSON.stringify({ enabled: values.enabled === 'on', config }) }, auth.csrf)
    setMessage(`${type.toUpperCase()} gespeichert`); await load()
  }
  return <div className="system-shell">
    <header className="system-header"><a href="/"><img src="/graffiti-smash-logo.svg" alt="Graffiti Smash"/></a><div><b>{auth.user.name}</b><button onClick={async()=>{ await request('/api/admin/logout',{method:'POST',body:'{}'},auth.csrf);setAuth(null)}}>Abmelden</button></div></header>
    <nav className="system-tabs"><button className={tab==='orders'?'active':''} onClick={()=>setTab('orders')}>Bestellungen</button>{auth.user.role==='admin'&&<><button className={tab==='users'?'active':''} onClick={()=>setTab('users')}>Benutzer</button><button className={tab==='integrations'?'active':''} onClick={()=>setTab('integrations')}>Schnittstellen</button></>}</nav>
    {message&&<div className="system-toast">{message}</div>}
    <main className="system-content">
      {tab==='orders'&&<section><div className="system-title"><p>LIVE ORDER DESK</p><h1>Bestellungen</h1><button onClick={()=>load()}>Aktualisieren</button></div><div className="order-grid">{orders.map(order=><article className={`order-card ${order.status}`} key={order.id}><header><b>{order.public_id}</b><span>{order.status}</span></header><h2>{order.customer_name}</h2><p><a href={`tel:${order.customer_phone}`}>{order.customer_phone}</a> · {order.pickup_at||'Schnellstmöglich'}</p><ul>{order.items.map(item=><li key={item.id}><b>{item.quantity}×</b> {item.name}<span>{money(item.priceCents*item.quantity)}</span></li>)}</ul><div className="order-total"><span>{order.payment_status==='paid'?'BEZAHLT':'NICHT BEZAHLT'}</span><b>{money(order.total_cents)}</b></div>{order.notes&&<blockquote>{order.notes}</blockquote>}{order.status==='pending'&&<div className="order-actions"><select defaultValue="20" aria-label="Zubereitungszeit"><option>10</option><option>15</option><option>20</option><option>30</option><option>45</option><option>60</option></select><button onClick={e=>mutateOrder(order.id,'accepted',e.currentTarget.parentElement.querySelector('select').value)}>Annehmen</button><button className="reject" onClick={()=>mutateOrder(order.id,'rejected')}>Ablehnen</button></div>}</article>)}</div></section>}
      {tab==='users'&&<section><div className="system-title"><p>ACCESS CONTROL</p><h1>Benutzer</h1></div><div className="system-card"><table><thead><tr><th>Name</th><th>E-Mail</th><th>Rolle</th><th>Status</th><th>Aktion</th></tr></thead><tbody>{users.map(user=><tr key={user.id}><td>{user.name}</td><td>{user.email}</td><td>{user.role}</td><td>{user.active?'Aktiv':'Gesperrt'}</td><td><button onClick={async()=>{await request(`/api/admin/users/${user.id}`,{method:'PATCH',body:JSON.stringify({active:!user.active,role:user.role})},auth.csrf);await load()}}>{user.active?'Sperren':'Aktivieren'}</button></td></tr>)}</tbody></table></div><form className="system-card system-form" onSubmit={async event=>{event.preventDefault();await request('/api/admin/users',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(event.currentTarget)))},auth.csrf);event.currentTarget.reset();await load()}}><h2>Benutzer anlegen</h2><label>Name<input name="name" required/></label><label>E-Mail<input name="email" type="email" required/></label><label>Rolle<select name="role"><option value="staff">Mitarbeiter</option><option value="admin">Administrator</option></select></label><label>Startpasswort<input name="password" type="password" minLength="14" required/></label><button className="system-primary">Anlegen</button></form></section>}
      {tab==='integrations'&&<section><div className="system-title"><p>CONNECTION HUB</p><h1>Schnittstellen</h1></div><div className="integration-grid">
        <form className="system-card system-form" onSubmit={e=>saveIntegration('smtp',e)}><h2>SMTP / E-Mail</h2><label className="check"><input name="enabled" type="checkbox" defaultChecked={integrations.smtp?.enabled===1}/> Aktiv</label><label>SMTP-Host<input name="host" defaultValue={integrations.smtp?.config.host||''}/></label><label>Port<input name="port" type="number" defaultValue={integrations.smtp?.config.port||587}/></label><label className="check"><input name="secure" type="checkbox" defaultChecked={integrations.smtp?.config.secure}/> TLS direkt</label><label>Benutzer<input name="user" defaultValue={integrations.smtp?.config.user||''}/></label><label>Passwort<input name="password" type="password" placeholder="Unverändert lassen"/></label><label>Absender<input name="from" defaultValue={integrations.smtp?.config.from||''}/></label><label>Empfänger<input name="to" type="email" defaultValue={integrations.smtp?.config.to||'info@graffitismash.de'}/></label><button className="system-primary">SMTP speichern</button></form>
        <form className="system-card system-form" onSubmit={e=>saveIntegration('telegram',e)}><h2>Telegram Bot</h2><label className="check"><input name="enabled" type="checkbox" defaultChecked={integrations.telegram?.enabled===1}/> Aktiv</label><label>Bot Token<input name="botToken" type="password" placeholder="Unverändert lassen"/></label><label>Chat ID<input name="chatId" defaultValue={integrations.telegram?.config.chatId||''}/></label><button className="system-primary">Telegram speichern</button></form>
      </div></section>}
    </main>
  </div>
}
