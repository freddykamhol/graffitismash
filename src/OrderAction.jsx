import { useEffect, useState } from 'react'
import './System.css'

export default function OrderAction() {
  const token = new URLSearchParams(location.search).get('token')
  const [order,setOrder]=useState(null),[error,setError]=useState(''),[done,setDone]=useState(false),[minutes,setMinutes]=useState(20)
  useEffect(()=>{fetch(`/api/order-action?token=${encodeURIComponent(token||'')}`).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);setOrder(d)}).catch(e=>setError(e.message))},[token])
  if(error)return <main className="action-page"><div className="action-ticket"><h1>Link nicht verfügbar</h1><p>{error}</p></div></main>
  if(!order)return <div className="system-loading">Bestellung wird geladen …</div>
  if(done)return <main className="action-page"><div className="action-ticket"><p>BESTELLUNG {order.public_id}</p><h1>{order.action==='accept'?'Angenommen!':'Abgelehnt'}</h1><a href="/system/admin">Zum Order Desk</a></div></main>
  return <main className="action-page"><div className="action-ticket"><p>ORDER {order.public_id}</p><h1>{order.action==='accept'?'Bestellung annehmen':'Bestellung ablehnen'}</h1><div className="action-facts"><b>{order.customer_name}</b><strong>{(order.total_cents/100).toFixed(2)} €</strong><mark>{order.payment_status==='paid'?'BEREITS BEZAHLT':'NOCH NICHT BEZAHLT'}</mark></div>{order.action==='accept'&&<label>Zubereitungszeit<select value={minutes} onChange={e=>setMinutes(e.target.value)}><option>10</option><option>15</option><option>20</option><option>30</option><option>45</option><option>60</option></select><span>Minuten</span></label>}<button className={order.action==='accept'?'accept-button':'danger-button'} onClick={async()=>{const r=await fetch('/api/order-action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,minutes})});const d=await r.json();if(!r.ok)setError(d.error);else setDone(true)}}>{order.action==='accept'?`${minutes} MIN · JETZT ANNEHMEN`:'BESTELLUNG ABLEHNEN'}</button></div></main>
}
