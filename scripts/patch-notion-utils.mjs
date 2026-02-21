import fs from 'node:fs'
import path from 'node:path'

const file = path.join(
  process.cwd(),
  'node_modules',
  'notion-utils',
  'build',
  'index.js'
)

if (!fs.existsSync(file)) {
  process.exit(0)
}

const source = fs.readFileSync(file, 'utf8')
const needle = 'var uuidToId = (uuid) => uuid.replaceAll("-", "");'
const replacement = 'var uuidToId = (uuid = "") => uuid.replaceAll("-", "");'

if (source.includes(replacement)) {
  process.exit(0)
}

if (!source.includes(needle)) {
  console.warn('[patch-notion-utils] target snippet not found')
  process.exit(0)
}

fs.writeFileSync(file, source.replace(needle, replacement), 'utf8')
console.log('[patch-notion-utils] applied')
