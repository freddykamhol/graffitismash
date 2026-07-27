import { copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = fileURLToPath(new URL('../index.source.html', import.meta.url))
const target = fileURLToPath(new URL('../index.html', import.meta.url))

copyFileSync(source, target)
console.log('[build] Quell-index.html vorbereitet')
