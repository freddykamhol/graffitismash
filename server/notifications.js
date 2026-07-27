import nodemailer from 'nodemailer'
import sharp from 'sharp'
import { decrypt } from './security.js'

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

export function integrationConfig(row) {
  if (!row) return {}
  const config = JSON.parse(row.config_json || '{}')
  for (const field of ['password', 'botToken']) if (config[field]) config[field] = decrypt(config[field])
  return config
}

export async function sendEmail(config, order, links) {
  if (!config.host || !config.to) return
  const transport = nodemailer.createTransport({
    host: config.host, port: Number(config.port || 587), secure: Boolean(config.secure),
    auth: config.user ? { user: config.user, pass: config.password } : undefined,
  })
  const items = order.items.map(item => `${item.quantity}× ${item.name} – ${(item.priceCents * item.quantity / 100).toFixed(2)} €`).join('\n')
  await transport.sendMail({
    from: config.from || config.user, to: config.to,
    subject: `Neue Bestellung ${order.public_id}`,
    text: `Neue Bestellung ${order.public_id}\n\n${items}\n\nGesamt: ${(order.total_cents / 100).toFixed(2)} €\nKunde: ${order.customer_name}\nTelefon: ${order.customer_phone}\nAbholung: ${order.pickup_at || 'schnellstmöglich'}\n\nAnnehmen: ${links.accept}\nAblehnen: ${links.reject}`,
  })
}

function orderSvg(order) {
  const lines = order.items.slice(0, 12).map((item, i) =>
    `<text x="55" y="${300 + i * 48}" font-size="30" font-family="monospace">${escape(item.quantity)}x ${escape(item.name).slice(0, 24)}</text>`
  ).join('')
  const height = Math.max(760, 410 + order.items.length * 48)
  return `<svg width="900" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="900" height="${height}" fill="#f7f1df"/><rect x="22" y="22" width="856" height="${height - 44}" fill="none" stroke="#111" stroke-width="5" stroke-dasharray="16 8"/>
  <text x="450" y="92" text-anchor="middle" font-size="54" font-weight="900" font-family="sans-serif">GRAFFITI SMASH</text>
  <text x="450" y="150" text-anchor="middle" font-size="34" font-family="monospace">ORDER ${escape(order.public_id)}</text>
  <path d="M55 190H845" stroke="#111" stroke-width="4"/>
  <text x="55" y="240" font-size="29" font-family="monospace">${escape(order.customer_name)} · ${escape(order.customer_phone)}</text>
  ${lines}<path d="M55 ${height - 160}H845" stroke="#111" stroke-width="4"/>
  <text x="55" y="${height - 100}" font-size="38" font-weight="bold" font-family="monospace">TOTAL ${(order.total_cents / 100).toFixed(2)} EUR</text>
  <text x="55" y="${height - 55}" font-size="27" font-family="monospace">${order.payment_status === 'paid' ? 'BEZAHLT' : 'NICHT BEZAHLT'} · ${escape(order.pickup_at || 'ASAP')}</text></svg>`
}

export async function sendTelegram(config, order, links) {
  if (!config.botToken || !config.chatId) return
  const api = `https://api.telegram.org/bot${config.botToken}`
  const caption = `🍔 Neue Bestellung ${order.public_id}\n${order.customer_name} · ${(order.total_cents / 100).toFixed(2)} €\n${order.payment_status === 'paid' ? '✅ Bezahlt' : '⚠️ Nicht bezahlt'}`
  const keyboard = { inline_keyboard: [[
    { text: '✅ Annehmen', url: links.accept },
    { text: '❌ Ablehnen', url: links.reject },
  ]] }
  const png = await sharp(Buffer.from(orderSvg(order))).png().toBuffer()
  const form = new FormData()
  form.set('chat_id', String(config.chatId))
  form.set('caption', caption)
  form.set('reply_markup', JSON.stringify(keyboard))
  form.set('photo', new Blob([png], { type: 'image/png' }), `order-${order.public_id}.png`)
  const response = await fetch(`${api}/sendPhoto`, { method: 'POST', body: form })
  if (!response.ok) throw new Error(`Telegram: ${response.status}`)
}

export async function sendTelegramAccepted(config, order) {
  if (!config.botToken || !config.chatId) return
  const form = new FormData()
  const png = await sharp(Buffer.from(orderSvg(order))).png().toBuffer()
  form.set('chat_id', String(config.chatId))
  form.set('caption', `✅ Bestellung ${order.public_id} angenommen · ${order.accepted_minutes} Minuten\n${order.payment_status === 'paid' ? 'BEZAHLT' : 'NICHT BEZAHLT'}`)
  form.set('photo', new Blob([png], { type: 'image/png' }), `accepted-${order.public_id}.png`)
  const response = await fetch(`https://api.telegram.org/bot${config.botToken}/sendPhoto`, { method: 'POST', body: form })
  if (!response.ok) throw new Error(`Telegram: ${response.status}`)
}
