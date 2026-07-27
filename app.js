import 'dotenv/config'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { db, auditSafeOrder } from './server/db.js'
import { digest, encrypt, hashPassword, secureEqual, token, verifyPassword } from './server/security.js'
import { integrationConfig, sendEmail, sendTelegram, sendTelegramAccepted } from './server/notifications.js'

const root = fileURLToPath(new URL('./dist/', import.meta.url))
const port = Number(process.env.PORT) || 80
const production = process.env.NODE_ENV === 'production'
const publicUrl = (process.env.PUBLIC_URL || 'http://localhost').replace(/\/$/, '')
const privacyVersion = '2026-07-orders-v1'
const sessionHours = 8
const loginAttempts = new Map()

const catalog = {
  'burger-1': { name: 'Chicken Burger', priceCents: 800 },
  'burger-2': { name: '7mo Rolle', priceCents: 800 },
  'burger-3': { name: 'Graffiti Burger', priceCents: 1000 },
  'burger-4': { name: 'Smash Burger', priceCents: 850 },
  'burger-5': { name: 'Classic Burger', priceCents: 750 },
  'fries-7': { name: 'Mushroom', priceCents: 700 },
  'fries-8': { name: 'Onion', priceCents: 600 },
  'fries-9': { name: 'Delicious', priceCents: 700 },
  'fries-10': { name: 'Sausage', priceCents: 700 },
  'fries-11': { name: 'Fried Chicken', priceCents: 750 },
  'fries-12': { name: 'Classic Fries', priceCents: 500 },
  'side-6': { name: 'Fried Chicken Box', priceCents: 750 },
  'drink-water': { name: 'Wasser', priceCents: 150 },
  'drink-fanta': { name: 'Fanta', priceCents: 250 },
  'drink-sprite': { name: 'Sprite', priceCents: 250 },
  'drink-cola': { name: 'Coca Cola', priceCents: 250 },
  'drink-pepsi': { name: 'Pepsi', priceCents: 250 },
  'drink-redbull': { name: 'RedBull', priceCents: 300 },
}

const contentTypes = {
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.webp': 'image/webp',
}
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob: https://*.basemaps.cartocdn.com; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https://*.basemaps.cartocdn.com; font-src 'self'; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  ...(production ? { 'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload' } : {}),
}

function json(res, status, body, headers = {}) {
  res.writeHead(status, { ...securityHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers })
  res.end(JSON.stringify(body))
}
async function body(req) {
  const chunks = []; let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 128 * 1024) throw Object.assign(new Error('Payload zu groß'), { status: 413 })
    chunks.push(chunk)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString() || '{}') } catch { throw Object.assign(new Error('Ungültiges JSON'), { status: 400 }) }
}
function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(value => value.trim().split(/=(.*)/s).slice(0, 2).map(decodeURIComponent)))
}
function session(req) {
  const raw = cookies(req).gs_session
  if (!raw) return null
  return db.prepare(`SELECT s.*,u.email,u.name,u.role,u.active FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.expires_at>datetime('now') AND u.active=1`).get(digest(raw)) || null
}
function requireSession(req, res, role) {
  const found = session(req)
  if (!found) { json(res, 401, { error: 'Nicht angemeldet' }); return null }
  if (role && found.role !== role) { json(res, 403, { error: 'Keine Berechtigung' }); return null }
  if (!['GET', 'HEAD'].includes(req.method) && !secureEqual(req.headers['x-csrf-token'] || '', found.csrf_token)) {
    json(res, 403, { error: 'Sicherheitsprüfung fehlgeschlagen' }); return null
  }
  db.prepare("UPDATE sessions SET last_seen_at=CURRENT_TIMESTAMP WHERE id=?").run(found.id)
  return found
}
function clean(value, max = 250) { return String(value || '').trim().split('').filter(char => char >= ' ').join('').slice(0, max) }
function orderLinks(orderId) {
  const expires = new Date(Date.now() + 24 * 3600_000).toISOString()
  const make = action => {
    const raw = token()
    db.prepare('INSERT INTO action_tokens(order_id,action,token_hash,expires_at) VALUES(?,?,?,?)').run(orderId, action, digest(raw), expires)
    return `${publicUrl}/system/order-action?token=${raw}`
  }
  return { accept: make('accept'), reject: make('reject') }
}
async function notify(order) {
  const links = orderLinks(order.id)
  const integrations = db.prepare('SELECT * FROM integrations WHERE enabled=1').all()
  const jobs = integrations.map(row => {
    const config = integrationConfig(row)
    if (row.type === 'smtp') return sendEmail(config, order, links)
    if (row.type === 'telegram') return sendTelegram(config, order, links)
  }).filter(Boolean)
  const results = await Promise.allSettled(jobs)
  results.filter(result => result.status === 'rejected').forEach(result => console.error('Benachrichtigung fehlgeschlagen:', result.reason))
}

async function api(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/catalog') return json(res, 200, catalog)
  if (req.method === 'POST' && url.pathname === '/api/orders') {
    const data = await body(req)
    if (data.website) return json(res, 202, { ok: true })
    if (!data.consent) return json(res, 400, { error: 'Datenschutzhinweis muss bestätigt werden' })
    const name = clean(data.name, 100), email = clean(data.email, 160).toLowerCase(), phone = clean(data.phone, 40)
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone.length < 6) return json(res, 400, { error: 'Bitte Kontaktdaten prüfen' })
    if (!Array.isArray(data.items) || !data.items.length || data.items.length > 30) return json(res, 400, { error: 'Warenkorb ist leer oder ungültig' })
    const items = data.items.map(entry => {
      const product = catalog[entry.id], quantity = Math.max(1, Math.min(20, Number(entry.quantity) || 0))
      if (!product) throw Object.assign(new Error('Unbekannter Artikel'), { status: 400 })
      return { id: entry.id, name: product.name, priceCents: product.priceCents, quantity }
    })
    const total = items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0)
    const publicId = `GS-${Date.now().toString(36).toUpperCase()}-${token().slice(0, 4).toUpperCase()}`
    const result = db.prepare(`INSERT INTO orders(public_id,customer_name,customer_email,customer_phone,pickup_at,notes,items_json,subtotal_cents,total_cents,payment_method,payment_status,consent_at,privacy_version)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(publicId, name, email, phone, clean(data.pickupAt, 40) || null, clean(data.notes, 800), JSON.stringify(items), total, total, 'pickup', 'unpaid', new Date().toISOString(), privacyVersion)
    const order = auditSafeOrder(db.prepare('SELECT * FROM orders WHERE id=?').get(result.lastInsertRowid))
    notify(order).catch(console.error)
    return json(res, 201, { ok: true, orderId: publicId })
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/login') {
    const ip = digest(req.socket.remoteAddress || 'unknown'), now = Date.now()
    const attempts = (loginAttempts.get(ip) || []).filter(time => now - time < 15 * 60_000)
    if (attempts.length >= 8) return json(res, 429, { error: 'Zu viele Versuche. Bitte später erneut versuchen.' })
    const data = await body(req), user = db.prepare('SELECT * FROM users WHERE email=? AND active=1').get(clean(data.email, 160).toLowerCase())
    if (!user || !verifyPassword(String(data.password || ''), user.password_hash)) {
      attempts.push(now); loginAttempts.set(ip, attempts)
      return json(res, 401, { error: 'Anmeldung fehlgeschlagen' })
    }
    loginAttempts.delete(ip)
    const raw = token(), csrf = token(), expires = new Date(Date.now() + sessionHours * 3600_000)
    db.prepare('INSERT INTO sessions(user_id,token_hash,csrf_token,expires_at,ip_hash,user_agent) VALUES(?,?,?,?,?,?)')
      .run(user.id, digest(raw), csrf, expires.toISOString(), ip, clean(req.headers['user-agent'], 300))
    return json(res, 200, { user: { email: user.email, name: user.name, role: user.role }, csrf }, {
      'Set-Cookie': `gs_session=${encodeURIComponent(raw)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${sessionHours * 3600}${production ? '; Secure' : ''}`,
    })
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/logout') {
    const found = requireSession(req, res); if (!found) return
    db.prepare('DELETE FROM sessions WHERE id=?').run(found.id)
    return json(res, 200, { ok: true }, { 'Set-Cookie': `gs_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${production ? '; Secure' : ''}` })
  }
  if (req.method === 'GET' && url.pathname === '/api/admin/session') {
    const found = requireSession(req, res); if (!found) return
    return json(res, 200, { user: { email: found.email, name: found.name, role: found.role }, csrf: found.csrf_token })
  }
  if (req.method === 'GET' && url.pathname === '/api/admin/orders') {
    const found = requireSession(req, res); if (!found) return
    return json(res, 200, db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 200').all().map(auditSafeOrder))
  }
  const orderMatch = url.pathname.match(/^\/api\/admin\/orders\/(\d+)$/)
  if (req.method === 'PATCH' && orderMatch) {
    const found = requireSession(req, res); if (!found) return
    const data = await body(req), status = ['accepted', 'rejected', 'cancelled'].includes(data.status) ? data.status : null
    if (!status) return json(res, 400, { error: 'Ungültiger Status' })
    const minutes = status === 'accepted' ? Math.max(5, Math.min(180, Number(data.minutes) || 20)) : null
    db.prepare('UPDATE orders SET status=?,accepted_minutes=?,decision_at=CURRENT_TIMESTAMP,decided_by=? WHERE id=?').run(status, minutes, found.user_id, orderMatch[1])
    return json(res, 200, { ok: true })
  }
  if (req.method === 'GET' && url.pathname === '/api/admin/users') {
    const found = requireSession(req, res, 'admin'); if (!found) return
    return json(res, 200, db.prepare('SELECT id,email,name,role,active,created_at FROM users ORDER BY id').all())
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/users') {
    const found = requireSession(req, res, 'admin'); if (!found) return
    const data = await body(req), password = String(data.password || '')
    if (password.length < 14) return json(res, 400, { error: 'Passwort muss mindestens 14 Zeichen lang sein' })
    try {
      db.prepare('INSERT INTO users(email,name,password_hash,role) VALUES(?,?,?,?)').run(clean(data.email, 160).toLowerCase(), clean(data.name, 100), hashPassword(password), data.role === 'admin' ? 'admin' : 'staff')
      return json(res, 201, { ok: true })
    } catch { return json(res, 409, { error: 'Benutzer konnte nicht angelegt werden' }) }
  }
  const userMatch = url.pathname.match(/^\/api\/admin\/users\/(\d+)$/)
  if (req.method === 'PATCH' && userMatch) {
    const found = requireSession(req, res, 'admin'); if (!found) return
    const data = await body(req)
    if (Number(userMatch[1]) === found.user_id && data.active === false) return json(res, 400, { error: 'Eigenes Konto kann nicht deaktiviert werden' })
    db.prepare('UPDATE users SET active=?,role=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(data.active ? 1 : 0, data.role === 'admin' ? 'admin' : 'staff', userMatch[1])
    db.prepare('DELETE FROM sessions WHERE user_id=? AND ?=0').run(userMatch[1], data.active ? 1 : 0)
    return json(res, 200, { ok: true })
  }
  if (req.method === 'GET' && url.pathname === '/api/admin/integrations') {
    const found = requireSession(req, res, 'admin'); if (!found) return
    const rows = db.prepare('SELECT type,enabled,config_json,updated_at FROM integrations').all().map(row => {
      const config = JSON.parse(row.config_json); delete config.password; delete config.botToken
      return { ...row, config }
    })
    return json(res, 200, rows)
  }
  const integrationMatch = url.pathname.match(/^\/api\/admin\/integrations\/(smtp|telegram)$/)
  if (req.method === 'PUT' && integrationMatch) {
    const found = requireSession(req, res, 'admin'); if (!found) return
    const type = integrationMatch[1], data = await body(req)
    const old = db.prepare('SELECT config_json FROM integrations WHERE type=?').get(type)
    const config = { ...(old ? JSON.parse(old.config_json) : {}), ...(data.config || {}) }
    for (const field of ['password', 'botToken']) {
      if (data.config?.[field]) config[field] = encrypt(data.config[field])
      else if (data.config && field in data.config && !data.config[field]) delete config[field]
    }
    db.prepare(`INSERT INTO integrations(type,enabled,config_json,updated_by) VALUES(?,?,?,?)
      ON CONFLICT(type) DO UPDATE SET enabled=excluded.enabled,config_json=excluded.config_json,updated_at=CURRENT_TIMESTAMP,updated_by=excluded.updated_by`)
      .run(type, data.enabled ? 1 : 0, JSON.stringify(config), found.user_id)
    return json(res, 200, { ok: true })
  }
  if (req.method === 'GET' && url.pathname === '/api/order-action') {
    const row = db.prepare(`SELECT a.*,o.public_id,o.customer_name,o.pickup_at,o.total_cents,o.payment_status,o.status
      FROM action_tokens a JOIN orders o ON o.id=a.order_id WHERE a.token_hash=? AND a.expires_at>datetime('now') AND a.used_at IS NULL`).get(digest(url.searchParams.get('token') || ''))
    if (!row) return json(res, 404, { error: 'Link ist ungültig oder abgelaufen' })
    return json(res, 200, row)
  }
  if (req.method === 'POST' && url.pathname === '/api/order-action') {
    const data = await body(req), raw = String(data.token || '')
    const row = db.prepare(`SELECT a.*,o.status FROM action_tokens a JOIN orders o ON o.id=a.order_id
      WHERE a.token_hash=? AND a.expires_at>datetime('now') AND a.used_at IS NULL`).get(digest(raw))
    if (!row) return json(res, 404, { error: 'Link ist ungültig oder abgelaufen' })
    const status = row.action === 'accept' ? 'accepted' : 'rejected'
    const minutes = status === 'accepted' ? Math.max(5, Math.min(180, Number(data.minutes) || 20)) : null
    const transaction = db.transaction(() => {
      db.prepare('UPDATE orders SET status=?,accepted_minutes=?,decision_at=CURRENT_TIMESTAMP WHERE id=? AND status=?').run(status, minutes, row.order_id, 'pending')
      db.prepare('UPDATE action_tokens SET used_at=CURRENT_TIMESTAMP WHERE order_id=?').run(row.order_id)
    })
    transaction()
    if (status === 'accepted') {
      const order = auditSafeOrder(db.prepare('SELECT * FROM orders WHERE id=?').get(row.order_id))
      const telegram = db.prepare("SELECT * FROM integrations WHERE type='telegram' AND enabled=1").get()
      if (telegram) sendTelegramAccepted(integrationConfig(telegram), order).catch(console.error)
    }
    return json(res, 200, { ok: true, status })
  }
  return json(res, 404, { error: 'Nicht gefunden' })
}

const indexPath = join(root, 'index.html')
if (!existsSync(indexPath)) { console.error('Build fehlt. Bitte npm run build ausführen.'); process.exit(1) }
createServer(async (req, res) => {
  const url = new URL(req.url, publicUrl)
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url)
    const requestedPath = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '')
    let filePath = join(root, requestedPath)
    if (!filePath.startsWith(root)) { res.writeHead(403, securityHeaders); return res.end('Zugriff verweigert') }
    const fileExists = existsSync(filePath) && !statSync(filePath).isDirectory()
    if (!fileExists && (url.pathname.startsWith('/assets/') || extname(url.pathname))) { res.writeHead(404, securityHeaders); return res.end('Nicht gefunden') }
    if (!fileExists) filePath = indexPath
    res.writeHead(200, { ...securityHeaders, 'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream', 'Cache-Control': filePath === indexPath ? 'no-cache' : 'public, max-age=31536000, immutable' })
    createReadStream(filePath).pipe(res)
  } catch (error) {
    console.error(error)
    if (!res.headersSent) json(res, error.status || 500, { error: error.status ? error.message : 'Interner Serverfehler' })
  }
}).listen(port, '0.0.0.0', () => console.log(`Graffiti Smash läuft auf Port ${port}`))
