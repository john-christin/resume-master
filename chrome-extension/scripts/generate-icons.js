/**
 * Generates PNG icons for the Chrome extension.
 * Uses a simple branded SVG (purple background + white lightning bolt)
 * that renders reliably without display-p3 color space dependencies.
 */
import { Resvg } from '@resvg/resvg-js'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(__dirname, '../public/icons')
mkdirSync(outDir, { recursive: true })

// Brand purple background + white lightning bolt (same path as favicon, simplified)
function makeSvg(size) {
  const r = Math.round(size * 0.22) // corner radius
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="#863bff"/>
  <svg x="${size * 0.12}" y="${size * 0.1}" width="${size * 0.76}" height="${size * 0.8}" viewBox="0 0 48 46">
    <path fill="white" d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"/>
  </svg>
</svg>`
}

for (const size of [16, 48, 128]) {
  const resvg = new Resvg(makeSvg(size), { fitTo: { mode: 'width', value: size } })
  const png = resvg.render().asPng()
  writeFileSync(resolve(outDir, `icon${size}.png`), png)
  console.log(`✓ icon${size}.png (${size}×${size})`)
}
