import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('./dist/', import.meta.url))
const port = Number(process.env.PORT) || 80

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

const indexPath = join(root, 'index.html')

if (!existsSync(indexPath)) {
  console.error('Der Build fehlt. Bitte zuerst "npm run build" ausführen.')
  process.exit(1)
}

const indexHtml = readFileSync(indexPath, 'utf8')
const assetPaths = [...indexHtml.matchAll(/(?:src|href)="\/(assets\/[^"]+)"/g)].map(match => match[1])
const missingAssets = assetPaths.filter(assetPath => !existsSync(join(root, assetPath)))

if (missingAssets.length > 0) {
  console.error(`Build unvollständig. Fehlende Assets: ${missingAssets.join(', ')}`)
  process.exit(1)
}

console.log(`Frontend geprüft: ${indexPath}`)

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
  const requestedPath = normalize(pathname).replace(/^([/\\])+/, '')
  let filePath = join(root, requestedPath)

  if (!filePath.startsWith(root)) {
    response.writeHead(403)
    response.end('Zugriff verweigert')
    return
  }

  const fileExists = existsSync(filePath) && !statSync(filePath).isDirectory()

  if (!fileExists && (pathname.startsWith('/assets/') || extname(pathname))) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end(`Asset nicht gefunden: ${pathname}`)
    return
  }

  if (!fileExists) {
    filePath = indexPath
  }

  response.writeHead(200, {
    'Content-Type': contentTypes[extname(filePath).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
  })

  createReadStream(filePath).on('error', () => {
    response.writeHead(500)
    response.end('Interner Serverfehler')
  }).pipe(response)
}).listen(port, '0.0.0.0', () => {
  console.log(`Graffiti Smash läuft auf http://localhost:${port}`)
})
