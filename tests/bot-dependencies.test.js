import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { ensureBotDependencies } from '../scripts/ensure-bot-dependencies.js'

function writePackage(root, dependencies) {
  mkdirSync(root, { recursive: true })
  writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'test-package', dependencies }))
}

function installDummyPackages(root) {
  const manifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
  for (const name of Object.keys(manifest.dependencies || {})) {
    const packageDir = path.join(root, 'node_modules', ...name.split('/'))
    mkdirSync(packageDir, { recursive: true })
    writeFileSync(path.join(packageDir, 'package.json'), JSON.stringify({ name, main: 'index.js' }))
    writeFileSync(path.join(packageDir, 'index.js'), 'module.exports = {}\n')
  }
}

test('boot installs shared repo dependencies even when the bot has its own Baileys copy', (t) => {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'multibot-deps-'))
  t.after(() => rmSync(tempRoot, { recursive: true, force: true }))

  const repoRoot = tempRoot
  const botRoot = path.join(repoRoot, 'bots', 'izuku-bot')
  writePackage(repoRoot, { '@whiskeysockets/baileys': '6.7.24', 'node-webpmux': '^3.2.1' })
  writePackage(botRoot, { '@whiskeysockets/baileys': '6.7.24', pino: '^9.6.0' })
  installDummyPackages(botRoot)

  const installs = []
  const logger = { log() {}, error() {} }
  const ready = ensureBotDependencies({
    botRoot,
    repoRoot,
    logger,
    runInstall(root) {
      installs.push(root)
      installDummyPackages(root)
      return { status: 0 }
    }
  })

  assert.equal(ready, true)
  assert.deepEqual(installs, [repoRoot], 'shared libraries resolve from the repository root')
})

test('boot stops when npm cannot install missing bot dependencies', () => {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'multibot-deps-fail-'))
  try {
    const repoRoot = tempRoot
    const botRoot = path.join(repoRoot, 'bots', 'izuku-bot')
    writePackage(repoRoot, { '@whiskeysockets/baileys': '6.7.24' })
    writePackage(botRoot, { pino: '^9.6.0' })

    const ready = ensureBotDependencies({
      botRoot,
      repoRoot,
      logger: { log() {}, error() {} },
      runInstall() { return { status: 1 } }
    })

    assert.equal(ready, false)
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
})
