import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

if (process.platform !== 'darwin') {
  throw new Error('Haired icon generation requires macOS qlmanage, sips, and iconutil.')
}

const desktopRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const assetsDirectory = join(desktopRoot, 'assets')
const sourceIcon = join(assetsDirectory, 'icon.svg')
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'haired-icons-'))

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(`${command} failed:\n${result.stderr || result.stdout}`)
  }
}

function resizePng(source, destination, size) {
  run('sips', ['-z', String(size), String(size), source, '--out', destination])
}

function writeIco(pngPaths, destination) {
  const images = pngPaths.map(({ path, size }) => ({ data: readFileSync(path), size }))
  const headerSize = 6 + images.length * 16
  const header = Buffer.alloc(headerSize)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)

  let imageOffset = headerSize
  for (const [index, image] of images.entries()) {
    const entryOffset = 6 + index * 16
    header.writeUInt8(image.size === 256 ? 0 : image.size, entryOffset)
    header.writeUInt8(image.size === 256 ? 0 : image.size, entryOffset + 1)
    header.writeUInt8(0, entryOffset + 2)
    header.writeUInt8(0, entryOffset + 3)
    header.writeUInt16LE(1, entryOffset + 4)
    header.writeUInt16LE(32, entryOffset + 6)
    header.writeUInt32LE(image.data.length, entryOffset + 8)
    header.writeUInt32LE(imageOffset, entryOffset + 12)
    imageOffset += image.data.length
  }

  writeFileSync(destination, Buffer.concat([header, ...images.map((image) => image.data)]))
}

try {
  mkdirSync(assetsDirectory, { recursive: true })
  run('qlmanage', ['-t', '-s', '1024', '-o', temporaryDirectory, sourceIcon])

  const masterPng = join(temporaryDirectory, 'icon.svg.png')
  copyFileSync(masterPng, join(assetsDirectory, 'icon.png'))

  const iconsetDirectory = join(temporaryDirectory, 'icon.iconset')
  mkdirSync(iconsetDirectory)
  for (const [fileName, size] of [
    ['icon_16x16.png', 16],
    ['icon_16x16@2x.png', 32],
    ['icon_32x32.png', 32],
    ['icon_32x32@2x.png', 64],
    ['icon_128x128.png', 128],
    ['icon_128x128@2x.png', 256],
    ['icon_256x256.png', 256],
    ['icon_256x256@2x.png', 512],
    ['icon_512x512.png', 512],
    ['icon_512x512@2x.png', 1024]
  ]) {
    resizePng(masterPng, join(iconsetDirectory, fileName), size)
  }
  run('iconutil', ['-c', 'icns', iconsetDirectory, '-o', join(assetsDirectory, 'icon.icns')])

  const icoImages = [16, 24, 32, 48, 64, 128, 256].map((size) => {
    const path = join(temporaryDirectory, `icon-${size}.png`)
    resizePng(masterPng, path, size)
    return { path, size }
  })
  writeIco(icoImages, join(assetsDirectory, 'icon.ico'))
} finally {
  rmSync(temporaryDirectory, { force: true, recursive: true })
}
