const { createRequire } = require('node:module')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const desktopRequire = createRequire(path.join(root, 'apps/desktop/package.json'))
const builderRequire = createRequire(desktopRequire.resolve('electron-builder/package.json'))
const packagerRequire = createRequire(builderRequire.resolve('app-builder-lib/package.json'))
const asar = packagerRequire('@electron/asar')
const output = path.resolve(process.argv[2])
const archive = path.join(output, 'win-unpacked/resources/app.asar')
if (asar.listPackage(archive).some(file => file.endsWith('.map'))) throw new Error('Packaged source maps found')
if (/sk-proj-|sk-ant-|AIzaSy|whsec_/.test(fs.readFileSync(archive).toString('utf8'))) throw new Error('Secret-like material found')
const expected = JSON.parse(fs.readFileSync(path.join(root, 'apps/desktop/package.json'))).version
const packaged = JSON.parse(asar.extractFile(archive, 'package.json')).version
if (packaged !== expected) throw new Error('Packaged application version differs from source')
for (const file of ['win-unpacked/Haired.exe', 'win-unpacked/resources/app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node']) {
  const data = fs.readFileSync(path.join(output, file))
  const peOffset = data.readUInt32LE(0x3c)
  if (data.subarray(peOffset, peOffset + 4).toString() !== 'PE\0\0' || data.readUInt16LE(peOffset + 4) !== 0x8664) throw new Error(`Not a Windows x64 executable: ${file}`)
}
console.log('Archive, version, and Windows x64 native binary checks passed')
