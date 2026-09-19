import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { apply, createApi, mutationGuard, startApiServer } from '../src/index.js'
import { createFactory } from '../src/factory.js'

function mockCtx() {
  const tools = []
  const guards = []
  const skills = []
  const listeners = {}
  const disposers = []
  return {
    provided: {},
    tools: {
      register(def) {
        tools.push(def)
        return () => {
          const i = tools.indexOf(def)
          if (i >= 0) tools.splice(i, 1)
        }
      },
      guard(fn) {
        guards.push(fn)
        return () => {
          const i = guards.indexOf(fn)
          if (i >= 0) guards.splice(i, 1)
        }
      },
    },
    skills: {
      register(skill) {
        skills.push(skill)
        return () => {
          const i = skills.indexOf(skill)
          if (i >= 0) skills.splice(i, 1)
        }
      },
    },
    on(event, fn) {
      listeners[event] = listeners[event] || []
      listeners[event].push(fn)
      return () => {
        listeners[event] = (listeners[event] || []).filter((x) => x !== fn)
      }
    },
    emit(event, ...args) {
      for (const fn of listeners[event] || []) fn(...args)
    },
    provide(name, value) {
      this.provided[name] = value
    },
    effect(fn) {
      const dispose = fn()
      if (typeof dispose === 'function') disposers.push(dispose)
    },
    logger() {
      return { info() {}, error() {} }
    },
    _tools: tools,
    _guards: guards,
    _skills: skills,
    _disposers: disposers,
  }
}

function tempFactory() {
  return createFactory({
    root: mkdtempSync(join(tmpdir(), 'pf-')),
    workspace: mkdtempSync(join(tmpdir(), 'pw-')),
    gateCommands: ['node -e "process.exit(0)"'],
    mutationTools: ['write', 'bash'],
    apiPort: 0,
  })
}

test('apply registers tools, skills, guard, and disposes them', async () => {
  const ctx = mockCtx()
  const root = mkdtempSync(join(tmpdir(), 'plug-'))
  const workspace = mkdtempSync(join(tmpdir(), 'pws-'))
  const { factory, getServer } = apply(ctx, {
    root,
    workspace,
    apiPort: 0,
    gateCommands: ['node -e "process.exit(0)"'],
    mutationTools: ['write'],
  })
  const started = Date.now()
  while (!getServer() && Date.now() - started < 1000) {
    await new Promise((r) => setTimeout(r, 10))
  }
  assert.equal(ctx._tools.length, 6)
  assert.deepEqual(
    ctx._tools.map((t) => t.name).sort(),
    ['factory_align', 'factory_context', 'factory_epic', 'factory_evidence', 'factory_learn', 'factory_ticket'],
  )
  assert.equal(ctx._skills.length, 2)
  assert.ok(ctx._skills.some((s) => s.name === 'grill-me'))
  assert.equal(ctx._guards.length, 1)
  assert.ok(ctx.provided.softwareFactory)

  const server = getServer()
  for (const dispose of ctx._disposers) dispose()
  assert.equal(ctx._tools.length, 0)
  assert.equal(ctx._skills.length, 0)
  assert.equal(ctx._guards.length, 0)
  if (server) {
    await new Promise((resolve) => server.close(resolve))
  }
  assert.ok(factory)
})

test('guard blocks writes before approval and allows them after', () => {
  const f = tempFactory()
  assert.match(mutationGuard(f, { name: 'write' }), /blocked/)
  assert.equal(mutationGuard(f, { name: 'read' }), undefined)
  const epic = f.createEpic({ title: 'x', vision: 'y' })
  f.approveEpic(epic.id)
  assert.equal(mutationGuard(f, { name: 'write' }), undefined)
})

test('session tool failures attach evidence without opening an incident', async () => {
  const ctx = mockCtx()
  const root = mkdtempSync(join(tmpdir(), 'ev-'))
  const { factory, getServer } = apply(ctx, {
    root,
    workspace: root,
    apiPort: 0,
    gateCommands: ['true'],
  })
  const epic = factory.createEpic({ title: 'x', vision: 'y' })
  factory.approveEpic(epic.id)
  ctx.emit('tools/result', { name: 'bash' }, { isError: true, error: 'boom' })
  const snap = factory.snapshot()
  assert.equal(snap.incidents.length, 0)
  const ticket = snap.tickets[0]
  assert.ok(ticket.runId)
  for (const dispose of ctx._disposers) dispose()
  const server = getServer()
  if (server) await new Promise((resolve) => server.close(resolve))
})

test('Host–Client RPC snapshot and actions', async () => {
  const factory = tempFactory()
  const api = createApi(factory)
  const server = await startApiServer(api, 0)
  const port = server.address().port
  const created = await fetch(`http://127.0.0.1:${port}/action`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'epic', action: 'create', title: 'RPC', vision: 'round trip' }),
  })
  const epicBody = await created.json()
  assert.equal(epicBody.ok, true)
  const epic = epicBody.value
  const res = await fetch(`http://127.0.0.1:${port}/snapshot`)
  const snap = await res.json()
  assert.equal(snap.epics[0].id, epic.id)
  const posted = await fetch(`http://127.0.0.1:${port}/action`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'ticket', action: 'approve', epicId: epic.id }),
  })
  const body = await posted.json()
  assert.equal(body.ok, true)
  assert.equal(body.value.ticket.state, 'approved')
  await new Promise((resolve) => server.close(resolve))
})

test('client bundle registers the module factory id', async () => {
  const { readFileSync } = await import('node:fs')
  const { fileURLToPath } = await import('node:url')
  const src = readFileSync(fileURLToPath(new URL('../src/client.js', import.meta.url)), 'utf8')
  assert.match(src, /__ModuleLoader__/)
  assert.match(src, /id: 'dsh-software-factory'/)
  assert.match(src, /sidebar\.footer\.action/)
})
