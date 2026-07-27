import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('./dist/', import.meta.url))
const port = Number(process.env.PORT) || 4173

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
}

if (!existsSync(join(root, 'index.html'))) {
  console.error('Der Build fehlt. Bitte zuerst "npm run build" ausführen.')
  process.exit(1)
}

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
  const requestedPath = normalize(pathname).replace(/^([/\\])+/, '')
  let filePath = join(root, requestedPath)

  if (!filePath.startsWith(root) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(root, 'index.html')
  }

  response.writeHead(200, {
    'Content-Type': contentTypes[extname(filePath).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
  })

  createReadStream(filePath).on('error', () => {
    response.writeHead(500)
    response.end('Interner Serverfehler')
  }).pipe(response)
}).listen(port, () => {
  console.log(`Graffiti Smash läuft auf http://localhost:${port}`)
})
