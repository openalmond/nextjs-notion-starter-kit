import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'

const require = createRequire(import.meta.url)
const nextPkg = require('next/package.json')
const nextBin = require.resolve('next/dist/bin/next')

const major = Number.parseInt(String(nextPkg.version).split('.')[0] || '0', 10)
const args = process.argv.slice(2)

if (
  major >= 16 &&
  !args.includes('--webpack') &&
  !args.includes('--turbopack')
) {
  args.push('--webpack')
}

const result = spawnSync(process.execPath, [nextBin, ...args], {
  stdio: 'inherit',
  env: process.env
})

if (result.error) {
  throw result.error
}

process.exit(result.status ?? 1)
