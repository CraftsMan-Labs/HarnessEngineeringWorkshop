import { spawnSync } from 'node:child_process'
import {
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
  existsSync,
  appendFileSync,
  unlinkSync,
} from 'node:fs'
import { dirname, join } from 'node:path'

export const STATES = Object.freeze([
  'aligning',
  'approved',
  'implementing',
  'validating',
  'pr_ready',
  'done',
])

export const TRANSITIONS = Object.freeze({
  aligning: ['approved'],
  approved: ['implementing'],
  implementing: ['validating'],
  validating: ['implementing', 'pr_ready'],
  pr_ready: ['done', 'implementing'],
  done: [],
})

export const CLASSIFICATIONS = Object.freeze([
  'database',
  'application',
  'infrastructure',
  'security',
  'ux',
])

const INDEX = 'index.json'
const HISTORY = 'history.jsonl'

export function now() {
  return new Date().toISOString()
}

export function id(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function writeAtomic(file, text) {
  mkdirSync(dirname(file), { recursive: true })
  const tmp = `${file}.tmp.${process.pid}`
  writeFileSync(tmp, text)
  renameSync(tmp, file)
}

export function assertState(state) {
  if (!STATES.includes(state)) throw new Error(`unknown state: ${state}`)
}

export function assertTransition(from, to) {
  assertState(from)
  assertState(to)
  if (!TRANSITIONS[from].includes(to)) {
    throw new Error(`illegal transition: ${from} → ${to}`)
  }
}

export function validateWhys(whys) {
  if (!Array.isArray(whys) || whys.length !== 3) {
    throw new Error('Three Whys require exactly 3 answers')
  }
  for (const [i, why] of whys.entries()) {
    if (typeof why !== 'string' || !why.trim()) {
      throw new Error(`why ${i + 1} is empty`)
    }
  }
  return whys.map((w) => w.trim())
}

export function unresolvedQuestions(epic) {
  return (epic.questions || []).filter((q) => q.status !== 'answered')
}

export function canApprove(epic) {
  return unresolvedQuestions(epic).length === 0
}

function first(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value
  }
}

export function resolveConfig(raw = {}) {
  const split = (value, sep) =>
    String(value)
      .split(sep)
      .map((s) => s.trim())
      .filter(Boolean)
  const mutation = first(
    Array.isArray(raw.mutationTools) ? raw.mutationTools.join(',') : raw.mutationTools,
    process.env.FACTORY_MUTATION_TOOLS,
    'write,edit,bash,shell,apply_patch,str_replace,write_file,edit_file,run_terminal_cmd',
  )
  const gates = first(
    Array.isArray(raw.gateCommands) ? raw.gateCommands.join('|') : raw.gateCommands,
    process.env.FACTORY_GATE_COMMANDS,
    'npm test',
  )
  return {
    root: first(raw.root, process.env.FACTORY_STATE_PATH, '/workspace/.factory'),
    workspace: first(raw.workspace, process.env.FACTORY_WORKSPACE, '/workspace'),
    apiPort: Number(first(raw.apiPort, process.env.FACTORY_API_PORT, 13081)),
    mutationTools: split(mutation, ','),
    gateCommands: split(gates, '|'),
    incidentFailureThreshold: Number(
      first(raw.incidentFailureThreshold, process.env.FACTORY_INCIDENT_THRESHOLD, 3),
    ),
    enabled: first(raw.enabled, process.env.FACTORY_PLUGIN_ENABLED, '1') !== '0' && raw.enabled !== false,
  }
}

function emptyIndex() {
  return {
    version: 1,
    epics: [],
    tickets: [],
    incidents: [],
    runs: [],
    currentEpicId: null,
    currentTicketId: null,
  }
}

export function createFactory(config = {}) {
  const cfg = resolveConfig(config)
  mkdirSync(cfg.root, { recursive: true })

  const loadIndex = () => {
    const file = join(cfg.root, INDEX)
    if (!existsSync(file)) return emptyIndex()
    return JSON.parse(readFileSync(file, 'utf8'))
  }

  const saveIndex = (index) => writeAtomic(join(cfg.root, INDEX), JSON.stringify(index, null, 2) + '\n')

  const audit = (event, payload) => {
    appendFileSync(
      join(cfg.root, HISTORY),
      JSON.stringify({ at: now(), event, ...payload }) + '\n',
    )
  }

  const readJson = (rel) => JSON.parse(readFileSync(join(cfg.root, rel), 'utf8'))

  const writeArtifact = (rel, data, md) => {
    const jsonPath = join(cfg.root, rel)
    writeAtomic(jsonPath, JSON.stringify(data, null, 2) + '\n')
    if (md) writeAtomic(jsonPath.replace(/\.json$/, '.md'), md)
    return rel
  }

  const removeArtifact = (rel) => {
    for (const file of [join(cfg.root, rel), join(cfg.root, rel.replace(/\.json$/, '.md'))]) {
      if (existsSync(file)) unlinkSync(file)
    }
  }

  const epicRel = (epicId) => join('epics', `${epicId}.json`)
  const ticketRel = (ticketId) => join('tickets', `${ticketId}.json`)
  const runRel = (runId) => join('runs', `${runId}.json`)
  const incidentRel = (incidentId) => join('incidents', `${incidentId}.json`)

  const loadEpic = (epicId) => readJson(epicRel(epicId))
  const loadTicket = (ticketId) => readJson(ticketRel(ticketId))
  const loadIncident = (incidentId) => readJson(incidentRel(incidentId))

  const stamp = (record, action, extra = {}) => {
    record.history = record.history || []
    record.history.push({ at: now(), action, ...extra })
    record.updatedAt = now()
    return record
  }

  const mdEpic = (epic) =>
    `# ${epic.title}\n\n${epic.vision}\n\n## Questions\n${(epic.questions || [])
      .map((q) => `- ${q.prompt}\n  - recommended: ${q.recommended}\n  - answer: ${q.answer ?? '_pending_'}`)
      .join('\n')}\n`

  const mdTicket = (ticket) =>
    `# ${ticket.title}\n\nstate: \`${ticket.state}\`\nepic: \`${ticket.epicId}\`\n\n${ticket.body}\n`

  const mdIncident = (incident) =>
    `# ${incident.title}\n\nclassification: \`${incident.classification}\`\nstatus: \`${incident.status}\`\n\n${(incident.whys || [])
      .map((w, i) => `${i + 1}. ${w}`)
      .join('\n')}\n`

  const saveEpic = (epic) => writeArtifact(epicRel(epic.id), epic, mdEpic(epic))
  const saveTicket = (ticket) => writeArtifact(ticketRel(ticket.id), ticket, mdTicket(ticket))
  const saveIncident = (incident) =>
    writeArtifact(incidentRel(incident.id), incident, mdIncident(incident))

  const ensureTicket = (ticketId) => {
    const ticket = loadTicket(ticketId)
    if (!ticket) throw new Error(`unknown ticket: ${ticketId}`)
    return ticket
  }

  function createEpic({ title, vision }) {
    if (!title || !vision) throw new Error('epic needs title and vision')
    const epic = stamp(
      {
        id: id('epic'),
        title: String(title),
        vision: String(vision),
        questions: [],
        ticketIds: [],
        createdAt: now(),
      },
      'created',
    )
    const index = loadIndex()
    index.epics.push(epic.id)
    index.currentEpicId = epic.id
    saveEpic(epic)
    saveIndex(index)
    audit('epic.created', { epicId: epic.id })
    return epic
  }

  function updateEpic(epicId, { title, vision }) {
    const epic = loadEpic(epicId)
    if (title) epic.title = String(title)
    if (vision) epic.vision = String(vision)
    stamp(epic, 'updated')
    saveEpic(epic)
    audit('epic.updated', { epicId })
    return epic
  }

  function getEpic(epicId) {
    return loadEpic(epicId)
  }

  function listEpics() {
    return loadIndex().epics.map((epicId) => loadEpic(epicId))
  }

  function selectEpic(epicId) {
    loadEpic(epicId)
    const index = loadIndex()
    index.currentEpicId = epicId
    const epic = loadEpic(epicId)
    if (epic.ticketIds.length && !epic.ticketIds.includes(index.currentTicketId)) {
      index.currentTicketId = epic.ticketIds[0]
    }
    saveIndex(index)
    audit('epic.selected', { epicId })
    return { epic, currentTicketId: index.currentTicketId }
  }

  function askQuestion(epicId, { prompt, recommended }) {
    if (!prompt || !recommended) throw new Error('question needs prompt and recommended')
    const epic = loadEpic(epicId)
    if (unresolvedQuestions(epic).length) {
      throw new Error('Grill Me asks one question at a time')
    }
    const question = {
      id: id('q'),
      prompt: String(prompt),
      recommended: String(recommended),
      status: 'pending',
      askedAt: now(),
    }
    epic.questions.push(question)
    stamp(epic, 'asked', { questionId: question.id })
    saveEpic(epic)
    audit('grill.ask', { epicId, questionId: question.id })
    return { epic, question }
  }

  function answerQuestion(epicId, questionId, answer) {
    if (!answer || !String(answer).trim()) throw new Error('answer is empty')
    const epic = loadEpic(epicId)
    const question = epic.questions.find((q) => q.id === questionId)
    if (!question) throw new Error(`unknown question: ${questionId}`)
    if (question.status === 'answered') throw new Error('question already answered')
    question.answer = String(answer).trim()
    question.status = 'answered'
    question.answeredAt = now()
    stamp(epic, 'answered', { questionId })
    saveEpic(epic)
    audit('grill.answer', { epicId, questionId })
    return { epic, question }
  }

  function deleteTicket(ticketId) {
    const ticket = ensureTicket(ticketId)
    const epic = loadEpic(ticket.epicId)
    epic.ticketIds = epic.ticketIds.filter((id) => id !== ticketId)
    stamp(epic, 'ticket-deleted', { ticketId })
    saveEpic(epic)
    const index = loadIndex()
    index.tickets = index.tickets.filter((id) => id !== ticketId)
    if (index.currentTicketId === ticketId) {
      index.currentTicketId = epic.ticketIds[0] || null
    }
    saveIndex(index)
    removeArtifact(ticketRel(ticketId))
    audit('ticket.deleted', { ticketId, epicId: ticket.epicId })
    return { deleted: ticketId, currentTicketId: index.currentTicketId }
  }

  function deleteEpic(epicId) {
    const epic = loadEpic(epicId)
    for (const ticketId of [...epic.ticketIds]) deleteTicket(ticketId)
    const index = loadIndex()
    index.epics = index.epics.filter((id) => id !== epicId)
    if (index.currentEpicId === epicId) index.currentEpicId = index.epics.at(-1) || null
    saveIndex(index)
    removeArtifact(epicRel(epicId))
    audit('epic.deleted', { epicId })
    return { deleted: epicId, currentEpicId: index.currentEpicId }
  }

  function createTicket(epicId, { title, body }) {
    const epic = loadEpic(epicId)
    const ticket = stamp(
      {
        id: id('ticket'),
        epicId,
        title: title || epic.title,
        body: body || epic.vision,
        state: 'aligning',
        evidence: [],
        review: null,
        createdAt: now(),
      },
      'created',
    )
    epic.ticketIds.push(ticket.id)
    stamp(epic, 'ticket', { ticketId: ticket.id })
    const index = loadIndex()
    index.tickets.push(ticket.id)
    index.currentEpicId = epicId
    index.currentTicketId = ticket.id
    saveEpic(epic)
    saveTicket(ticket)
    saveIndex(index)
    audit('ticket.created', { ticketId: ticket.id, epicId })
    return ticket
  }

  function updateTicket(ticketId, { title, body }) {
    const ticket = ensureTicket(ticketId)
    if (title) ticket.title = String(title)
    if (body) ticket.body = String(body)
    stamp(ticket, 'updated')
    saveTicket(ticket)
    audit('ticket.updated', { ticketId })
    return ticket
  }

  function getTicket(ticketId) {
    return ensureTicket(ticketId)
  }

  function listTickets(epicId) {
    const tickets = loadIndex().tickets.map((ticketId) => loadTicket(ticketId))
    return epicId ? tickets.filter((ticket) => ticket.epicId === epicId) : tickets
  }

  function selectTicket(ticketId) {
    const ticket = ensureTicket(ticketId)
    const index = loadIndex()
    index.currentTicketId = ticketId
    index.currentEpicId = ticket.epicId
    saveIndex(index)
    audit('ticket.selected', { ticketId })
    return ticket
  }

  function approveTicket(ticketId) {
    const ticket = ensureTicket(ticketId)
    const epic = loadEpic(ticket.epicId)
    if (!canApprove(epic)) {
      throw new Error('cannot approve ticket while Grill Me questions are unresolved')
    }
    if (ticket.state !== 'aligning') throw new Error(`cannot approve from ${ticket.state}`)
    assertTransition(ticket.state, 'approved')
    ticket.state = 'approved'
    stamp(ticket, 'approved')
    saveTicket(ticket)
    const index = loadIndex()
    index.currentTicketId = ticket.id
    index.currentEpicId = ticket.epicId
    saveIndex(index)
    audit('ticket.approved', { ticketId, epicId: ticket.epicId })
    return { epic, ticket }
  }

  function approveEpic(epicId) {
    const epic = loadEpic(epicId)
    if (!canApprove(epic)) {
      throw new Error('cannot approve epic while Grill Me questions are unresolved')
    }
    const index = loadIndex()
    const preferred =
      index.currentTicketId && epic.ticketIds.includes(index.currentTicketId)
        ? loadTicket(index.currentTicketId)
        : null
    const aligning =
      preferred?.state === 'aligning'
        ? preferred
        : epic.ticketIds.map((id) => loadTicket(id)).find((t) => t.state === 'aligning')
    const ticket = aligning || (epic.ticketIds.length ? loadTicket(epic.ticketIds[0]) : createTicket(epicId, {}))
    if (ticket.state === 'aligning') return approveTicket(ticket.id)
    index.currentTicketId = ticket.id
    index.currentEpicId = epicId
    saveIndex(index)
    return { epic: loadEpic(epicId), ticket }
  }

  function transitionTicket(ticketId, to, extra = {}) {
    const ticket = ensureTicket(ticketId)
    assertTransition(ticket.state, to)
    if (to === 'pr_ready') assertPrReady(ticket)
    ticket.state = to
    stamp(ticket, 'transition', { to, ...extra })
    saveTicket(ticket)
    audit('ticket.transition', { ticketId, to })
    return ticket
  }

  function assertPrReady(ticket) {
    for (const command of cfg.gateCommands) {
      const pass = ticket.evidence.some((e) => e.command === command && e.exitCode === 0)
      if (!pass) throw new Error(`quality gate missing or failed: ${command}`)
    }
    if (ticket.review?.verdict !== 'approved') {
      throw new Error('pr_ready needs review evidence')
    }
  }

  function startImplementation(ticketId) {
    const ticket = ensureTicket(ticketId)
    if (ticket.state === 'approved') return transitionTicket(ticketId, 'implementing')
    if (ticket.state === 'implementing') return ticket
    throw new Error(`cannot start implementation from ${ticket.state}`)
  }

  function submitEvidence(ticketId, { command, exitCode, log }) {
    const ticket = ensureTicket(ticketId)
    if (ticket.state === 'implementing') {
      ticket.state = 'validating'
      stamp(ticket, 'validating')
    }
    ticket.evidence.push({
      command: String(command),
      exitCode: Number(exitCode),
      log: String(log || '').slice(0, 4000),
      at: now(),
    })
    stamp(ticket, 'evidence', { command, exitCode })
    saveTicket(ticket)
    audit('gate.evidence', { ticketId, command, exitCode })
    return ticket
  }

  function reviewTicket(ticketId, { reviewer, verdict }) {
    if (!['approved', 'rejected'].includes(verdict)) throw new Error('verdict must be approved|rejected')
    const ticket = ensureTicket(ticketId)
    ticket.review = { reviewer: String(reviewer || 'human'), verdict, at: now() }
    stamp(ticket, 'review', { verdict })
    if (verdict === 'rejected' && ['validating', 'pr_ready'].includes(ticket.state)) {
      ticket.state = 'implementing'
      stamp(ticket, 'transition', { to: 'implementing', reason: 'review rejected' })
    }
    saveTicket(ticket)
    audit('ticket.review', { ticketId, verdict })
    return ticket
  }

  function runGates(ticketId) {
    const ticket = ensureTicket(ticketId)
    if (!['implementing', 'validating', 'pr_ready'].includes(ticket.state)) {
      throw new Error(`cannot run gates from ${ticket.state}`)
    }
    let last = ticket
    for (const command of cfg.gateCommands) {
      const result = spawnSync(command, {
        shell: true,
        cwd: cfg.workspace,
        encoding: 'utf8',
        timeout: 120_000,
      })
      last = submitEvidence(ticketId, {
        command,
        exitCode: result.status ?? 1,
        log: `${result.stdout || ''}${result.stderr || ''}`,
      })
    }
    return last
  }

  function recordToolResult({ tool, isError, detail, ticketId }) {
    const index = loadIndex()
    const idTicket = ticketId || index.currentTicketId
    if (!idTicket) return null
    const ticket = loadTicket(idTicket)
    let run = ticket.runId ? readJson(runRel(ticket.runId)) : null
    if (!run) {
      run = {
        id: id('run'),
        ticketId: idTicket,
        events: [],
        failures: 0,
        createdAt: now(),
      }
      ticket.runId = run.id
      index.runs.push(run.id)
      saveIndex(index)
    }
    run.events.push({ at: now(), tool, isError: Boolean(isError), detail: String(detail || '').slice(0, 1000) })
    if (isError) run.failures += 1
    writeArtifact(runRel(run.id), run)
    saveTicket(stamp(ticket, 'run-event', { tool, isError }))
    audit('run.event', { runId: run.id, ticketId: idTicket, tool, isError })
    return run
  }

  function createIncident({ title, classification, ticketId }) {
    if (!CLASSIFICATIONS.includes(classification)) {
      throw new Error(`unknown classification: ${classification}`)
    }
    const incident = stamp(
      {
        id: id('inc'),
        title: String(title || 'incident'),
        classification,
        ticketId: ticketId || loadIndex().currentTicketId,
        whys: [],
        status: 'open',
        createdAt: now(),
      },
      'created',
    )
    const index = loadIndex()
    index.incidents.push(incident.id)
    saveIncident(incident)
    saveIndex(index)
    audit('incident.created', { incidentId: incident.id, classification })
    return incident
  }

  function recordWhys(incidentId, whys) {
    const incident = loadIncident(incidentId)
    incident.whys = validateWhys(whys)
    stamp(incident, 'whys')
    saveIncident(incident)
    audit('incident.whys', { incidentId })
    return incident
  }

  function closeIncident(incidentId, { knowledge } = {}) {
    const incident = loadIncident(incidentId)
    if (incident.whys.length !== 3) throw new Error('close needs Three Whys')
    incident.status = 'closed'
    stamp(incident, 'closed')
    saveIncident(incident)
    let knowledgeRel
    if (knowledge) {
      knowledgeRel = join('knowledge', `${incident.id}.md`)
      writeAtomic(
        join(cfg.root, knowledgeRel),
        `# ${incident.title}\n\n${knowledge}\n\n## Three Whys\n${incident.whys.map((w, i) => `${i + 1}. ${w}`).join('\n')}\n`,
      )
    }
    audit('incident.closed', { incidentId, knowledge: knowledgeRel })
    return { incident, knowledge: knowledgeRel }
  }

  function snapshot() {
    const index = loadIndex()
    const epics = index.epics.map((epicId) => loadEpic(epicId))
    const tickets = index.tickets.map((ticketId) => loadTicket(ticketId))
    const incidents = index.incidents.map((incidentId) => loadIncident(incidentId))
    const current = index.currentTicketId ? loadTicket(index.currentTicketId) : null
    const currentEpic = index.currentEpicId
      ? loadEpic(index.currentEpicId)
      : current
        ? loadEpic(current.epicId)
        : epics.at(-1) || null
    const pending = currentEpic ? unresolvedQuestions(currentEpic)[0] || null : null
    return {
      config: { root: cfg.root, gateCommands: cfg.gateCommands, mutationTools: cfg.mutationTools },
      phase: current?.state || (currentEpic ? 'aligning' : 'idle'),
      currentEpicId: currentEpic?.id || null,
      currentTicketId: index.currentTicketId,
      nextStates: current ? TRANSITIONS[current.state] : [],
      pendingQuestion: pending,
      epics,
      tickets,
      incidents,
      artifacts: {
        root: cfg.root,
        history: join(cfg.root, HISTORY),
      },
    }
  }

  function history(limit = 100) {
    const file = join(cfg.root, HISTORY)
    if (!existsSync(file)) return []
    return readFileSync(file, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .slice(-limit)
      .map((line) => JSON.parse(line))
  }

  return {
    config: cfg,
    createEpic,
    getEpic,
    listEpics,
    updateEpic,
    deleteEpic,
    selectEpic,
    askQuestion,
    answerQuestion,
    createTicket,
    getTicket,
    listTickets,
    updateTicket,
    deleteTicket,
    selectTicket,
    approveTicket,
    approveEpic,
    transitionTicket,
    startImplementation,
    submitEvidence,
    reviewTicket,
    runGates,
    recordToolResult,
    createIncident,
    recordWhys,
    closeIncident,
    snapshot,
    history,
    loadEpic,
    loadTicket,
    loadIncident,
    canApprove: (epicId) => canApprove(loadEpic(epicId)),
  }
}
