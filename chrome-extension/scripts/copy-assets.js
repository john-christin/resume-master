/**
 * Copies manifest.json and icons into dist/ after the Vite builds.
 */
import { copyFileSync, cpSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const dist = resolve(root, 'dist')

mkdirSync(dist, { recursive: true })

// manifest
copyFileSync(resolve(root, 'manifest.json'), resolve(dist, 'manifest.json'))
console.log('✓ manifest.json')

// icons
const iconsSrc = resolve(root, 'public/icons')
const iconsDst = resolve(dist, 'icons')
if (existsSync(iconsSrc)) {
  cpSync(iconsSrc, iconsDst, { recursive: true })
  console.log('✓ icons/')
} else {
  console.warn('⚠  public/icons not found — run `node scripts/generate-icons.js` first')
}
