import { cpSync, copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const distRoot = join(projectRoot, 'dist')

if (!existsSync(join(distRoot, 'index.html'))) {
  console.error('[build] dist/index.html fehlt')
  process.exit(1)
}

for (const entry of readdirSync(distRoot)) {
  const source = join(distRoot, entry)
  const target = join(projectRoot, entry)

  if (statSync(source).isDirectory()) {
    mkdirSync(target, { recursive: true })
    cpSync(source, target, { recursive: true, force: true })
  } else {
    copyFileSync(source, target)
  }
}

console.log(`[build] Statischer Root veröffentlicht: ${basename(projectRoot)}`)
