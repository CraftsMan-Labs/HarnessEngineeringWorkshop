import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createFactory } from '../src/factory.js'

const workspace = mkdtempSync(join(tmpdir(), 'factory-smoke-ws-'))
writeFileSync(join(workspace, 'package.json'), '{"name":"fixture","private":true}\n')
const factory = createFactory({
  root: mkdtempSync(join(tmpdir(), 'factory-smoke-')),
  workspace,
  gateCommands: ['node -e "process.exit(0)"'],
})

const epic = factory.createEpic({
  title: 'Hold 100 concurrent sign-ins',
  vision: 'Login stays available when 100 people authenticate at once.',
})
const q = factory.askQuestion(epic.id, {
  prompt: 'What capacity control belongs in this ticket?',
  recommended: 'Size the session pool and add a concurrency test.',
})
factory.answerQuestion(epic.id, q.question.id, q.question.recommended)
const { ticket } = factory.approveEpic(epic.id)
factory.startImplementation(ticket.id)
factory.runGates(ticket.id)
factory.reviewTicket(ticket.id, { reviewer: 'smoke', verdict: 'approved' })
const ready = factory.transitionTicket(ticket.id, 'pr_ready')
if (ready.state !== 'pr_ready') throw new Error('expected pr_ready')

const incident = factory.createIncident({
  title: 'system unavailable under 100 logins',
  classification: 'database',
  ticketId: ticket.id,
})
factory.recordWhys(incident.id, [
  'database sessions exhausted',
  'pool undersized or sessions leak',
  'no capacity model and no concurrency test',
])
const learned = factory.closeIncident(incident.id, {
  knowledge: 'Tune pool, add load test, alert on saturation.',
})
if (learned.incident.status !== 'closed') throw new Error('expected closed incident')
console.log(JSON.stringify({ ok: true, ticket: ready.id, state: ready.state, knowledge: learned.knowledge }))
