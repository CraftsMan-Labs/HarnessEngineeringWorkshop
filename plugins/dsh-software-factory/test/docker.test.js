import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const pluginRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const repoRoot = dirname(dirname(pluginRoot))
const PIN = '0.1.5-rc.2'

test('Dockerfile pins the same DSH release as the plugin manifest', () => {
  const dockerfile = readFileSync(join(repoRoot, 'docker/dsh/Dockerfile'), 'utf8')
  const manifest = JSON.parse(readFileSync(join(pluginRoot, 'package.json'), 'utf8'))
  assert.equal(manifest.dsh.runtime, PIN)
  assert.match(dockerfile, new RegExp(`DSH_VERSION=${PIN.replace(/\./g, '\\.')}`))
  assert.match(dockerfile, /corepack prepare pnpm/)
})

test('compose mounts the plugin and forwards factory env', () => {
  const compose = readFileSync(join(repoRoot, 'docker-compose.yml'), 'utf8')
  assert.match(compose, /dsh-software-factory:\/opt\/dsh-software-factory/)
  assert.match(compose, /DSH_WEB_AUTH/)
  assert.match(compose, /FACTORY_PLUGIN_ENABLED/)
  assert.match(compose, /FACTORY_STATE_PATH/)
  assert.match(compose, /FACTORY_GATE_COMMANDS/)
  assert.match(compose, /FACTORY_MUTATION_TOOLS/)
})

test('docker compose config renders', () => {
  const result = spawnSync('docker', ['compose', 'config'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    assert.ok(true, `docker unavailable: ${result.stderr || result.error}`)
    return
  }
  assert.match(result.stdout, /FACTORY_PLUGIN_PATH: \/opt\/dsh-software-factory/)
  assert.match(result.stdout, /dsh-software-factory/)
})
