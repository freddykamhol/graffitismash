import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const key = process.env.APP_MASTER_KEY
  ? createHash('sha256').update(process.env.APP_MASTER_KEY).digest()
  : null

export function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })
  return `scrypt$32768$${salt.toString('base64url')}$${hash.toString('base64url')}`
}

export function verifyPassword(password, stored) {
  try {
    const [, cost, salt, expected] = stored.split('$')
    const actual = scryptSync(password, Buffer.from(salt, 'base64url'), 64, { N: Number(cost), r: 8, p: 1, maxmem: 64 * 1024 * 1024 })
    return timingSafeEqual(actual, Buffer.from(expected, 'base64url'))
  } catch {
    return false
  }
}

export function token() {
  return randomBytes(32).toString('base64url')
}

export function digest(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function encrypt(value) {
  if (!value) return ''
  if (!key) throw new Error('APP_MASTER_KEY fehlt')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString('base64url')).join('.')
}

export function decrypt(value) {
  if (!value) return ''
  if (!key) throw new Error('APP_MASTER_KEY fehlt')
  const [iv, tag, encrypted] = value.split('.').map(part => Buffer.from(part, 'base64url'))
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

export function secureEqual(a, b) {
  const left = Buffer.from(String(a))
  const right = Buffer.from(String(b))
  return left.length === right.length && timingSafeEqual(left, right)
}
