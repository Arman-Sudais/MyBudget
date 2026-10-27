import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

await mkdir('public/icons', { recursive: true })
for (const size of [192, 512]) {
  await sharp('public/icon.svg').resize(size, size).png().toFile(`public/icons/icon-${size}.png`)
}
await sharp('public/icon.svg')
  .resize(410, 410)
  .extend({ top: 51, bottom: 51, left: 51, right: 51, background: '#154c43' })
  .png()
  .toFile('public/icons/maskable-512.png')
console.log('Generated 192×192, 512×512, and maskable icons.')
