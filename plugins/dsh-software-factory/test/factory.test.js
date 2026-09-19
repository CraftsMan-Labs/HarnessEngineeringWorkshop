import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  assertTransition,
  canApprove,
  createFactory,
  unresolvedQuestions,
  validateWhys,
  writeAtomic,
} from '../src/factory.js'

function factory(t) {
  const root = mkdtempSync(join(tmpdir(), 'factory-'))
  const workspace = mkdtempSync(join(tmpdir(), 'ws-'))
  t.after?.(() => {})
  return createFactory({
    root,
    workspace,
    gateCommands: ['node -e "process.exit(0)"'],
    mutationTools: ['write', 'bash'],
  })
}

test('atomic persist replaces dest', () => {
  const dir = mkdtempSync(join(tmpdir(), 'atomic-'))
  const file = join(dir, 'a.json')
  writeAtomic(file, '{"n":1}\n')
  writeAtomic(file, '{"n":2}\n')
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).n, 2)
  assert.equal(existsSync(file + '.tmp.' + process.pid), false)
})

test('legal and illegal transitions', () => {
  assert.doesNotThrow(() => assertTransition('aligning', 'approved'))
  assert.doesNotThrow(() => assertTransition('validating', 'pr_ready'))
  assert.throws(() => assertTransition('aligning', 'done'), /illegal transition/)
  assert.throws(() => assertTransition('done', 'aligning'), /illegal transition/)
})

test('unresolved questions block approval', () => {
  const epic = {
    questions: [
      { id: 'q1', status: 'answered', answer: 'yes' },
      { id: 'q2', status: 'pending' },
    ],
  }
  assert.equal(unresolvedQuestions(epic).length, 1)
  assert.equal(canApprove(epic), false)
  epic.questions[1].status = 'answered'
  assert.equal(canApprove(epic), true)
})

test('Three Whys are bounded to exactly 3 non-empty answers', () => {
  assert.deepEqual(validateWhys(['a', 'b', 'c']), ['a', 'b', 'c'])
  assert.throws(() => validateWhys(['a', 'b']), /exactly 3/)
  assert.throws(() => validateWhys(['a', 'b', 'c', 'd']), /exactly 3/)
  assert.throws(() => validateWhys(['a', ' ', 'c']), /why 2 is empty/)
})

test('Grill Me is one question at a time and approve waits', (t) => {
  const f = factory(t)
  const epic = f.createEpic({ title: 'Sessions', vision: '100 concurrent sign-ins stay available' })
  const first = f.askQuestion(epic.id, { prompt: 'Pool size?', recommended: 'size to peak + headroom' })
  assert.throws(
    () => f.askQuestion(epic.id, { prompt: 'next', recommended: 'x' }),
    /one question at a time/,
  )
  assert.throws(() => f.approveEpic(epic.id), /unresolved/)
  f.answerQuestion(epic.id, first.question.id, first.question.recommended)
  const approved = f.approveEpic(epic.id)
  assert.equal(approved.ticket.state, 'approved')
})

test('full slice: approved ticket reaches pr_ready and learns from an incident', (t) => {
  const f = factory(t)
  const epic = f.createEpic({ title: 'Login pool', vision: 'hold 100 concurrent sessions' })
  const q = f.askQuestion(epic.id, { prompt: 'Capacity model?', recommended: 'pool + load test' })
  f.answerQuestion(epic.id, q.question.id, 'pool + load test')
  const { ticket } = f.approveEpic(epic.id)
  f.startImplementation(ticket.id)
  f.runGates(ticket.id)
  f.reviewTicket(ticket.id, { reviewer: 'rishub', verdict: 'approved' })
  const ready = f.transitionTicket(ticket.id, 'pr_ready')
  assert.equal(ready.state, 'pr_ready')
  assert.ok(existsSync(join(f.config.root, 'tickets', `${ticket.id}.md`)))

  const incident = f.createIncident({
    title: 'system unavailable',
    classification: 'database',
    ticketId: ticket.id,
  })
  assert.throws(() => f.closeIncident(incident.id), /Three Whys/)
  f.recordWhys(incident.id, [
    'sessions exhausted',
    'pool undersized or leak',
    'no capacity model or concurrency test',
  ])
  const closed = f.closeIncident(incident.id, { knowledge: 'add load test + saturation alert' })
  assert.equal(closed.incident.status, 'closed')
  assert.ok(existsSync(join(f.config.root, closed.knowledge)))
  assert.ok(f.history().some((row) => row.event === 'ticket.transition'))
})

test('failed gate stays off pr_ready', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'factory-'))
  const workspace = mkdtempSync(join(tmpdir(), 'ws-'))
  const f = createFactory({
    root,
    workspace,
    gateCommands: ['node -e "process.exit(1)"'],
  })
  const epic = f.createEpic({ title: 'x', vision: 'y' })
  const { ticket } = f.approveEpic(epic.id)
  f.startImplementation(ticket.id)
  f.runGates(ticket.id)
  f.reviewTicket(ticket.id, { reviewer: 'rishub', verdict: 'approved' })
  assert.throws(() => f.transitionTicket(ticket.id, 'pr_ready'), /failed/)
})

test('epic and ticket CRUD', (t) => {
  const f = factory(t)
  const epic = f.createEpic({ title: 'A', vision: 'one' })
  const ticket = f.createTicket(epic.id, { title: 'T1', body: 'do it' })
  assert.equal(f.getEpic(epic.id).title, 'A')
  assert.equal(f.listEpics().length, 1)
  assert.equal(f.getTicket(ticket.id).title, 'T1')
  assert.equal(f.listTickets(epic.id).length, 1)
  f.updateEpic(epic.id, { title: 'B' })
  f.updateTicket(ticket.id, { title: 'T1b' })
  assert.equal(f.getEpic(epic.id).title, 'B')
  assert.equal(f.getTicket(ticket.id).title, 'T1b')
  f.deleteTicket(ticket.id)
  assert.equal(f.listTickets(epic.id).length, 0)
  f.createTicket(epic.id, { title: 'T2', body: 'more' })
  f.deleteEpic(epic.id)
  assert.equal(f.listEpics().length, 0)
  assert.equal(f.listTickets().length, 0)
})

test('create, select, and move epic/ticket state', (t) => {
  const f = factory(t)
  const epic = f.createEpic({ title: 'Sessions', vision: 'hold 100 logins' })
  assert.equal(f.snapshot().currentEpicId, epic.id)
  f.updateEpic(epic.id, { title: 'Session pool' })
  const ticket = f.createTicket(epic.id, { title: 'Size the pool', body: 'add concurrency test' })
  assert.equal(f.snapshot().currentTicketId, ticket.id)
  const other = f.createTicket(epic.id, { title: 'Alerts', body: 'saturation page' })
  f.selectTicket(ticket.id)
  assert.equal(f.snapshot().currentTicketId, ticket.id)
  const approved = f.approveTicket(ticket.id)
  assert.equal(approved.ticket.state, 'approved')
  f.selectTicket(other.id)
  assert.equal(f.snapshot().tickets.find((row) => row.id === other.id).state, 'aligning')
  f.approveTicket(other.id)
  f.startImplementation(other.id)
  assert.deepEqual(f.snapshot().nextStates, ['validating'])
})

test('tool failures attach to a run and do not auto-open incidents', (t) => {
  const f = factory(t)
  const epic = f.createEpic({ title: 'x', vision: 'y' })
  const { ticket } = f.approveEpic(epic.id)
  const run = f.recordToolResult({ ticketId: ticket.id, tool: 'bash', isError: true, detail: 'boom' })
  assert.equal(run.failures, 1)
  assert.equal(f.snapshot().incidents.length, 0)
})
