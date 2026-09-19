import { createServer } from 'node:http'
import { createFactory, resolveConfig } from './factory.js'

export const name = 'software-factory'
export const inject = ['tools', 'skills']

const SKILLS = {
  'grill-me': {
    description: 'Align a human and the agent on one epic before any ticket is approved.',
    whenToUse: 'When an epic, feature, or ticket still has unresolved product judgment.',
    content: `Ask exactly one Grill Me question at a time. Always include a recommended answer.

Create the epic first with factory_epic action=create. Use factory_align action=ask to record the question, then ask the human (ask_user_question if available, otherwise wait for the Factory dashboard). Record the answer with factory_align action=answer.

Do not call factory_ticket action=approve while any Grill Me question is pending. After alignment, create tickets with factory_ticket action=create and move state with action=transition. Stay in the DSH conversation for code work.`,
  },
  'three-whys': {
    description: 'Bound incident learning to exactly three whys, then write a knowledge artifact.',
    whenToUse: 'When a classified incident needs a root cause without an unbounded rabbit hole.',
    content: `Classify the incident (database|application|infrastructure|security|ux) with factory_learn action=open.

Ask exactly three whys:
1. What directly failed?
2. Why could it fail?
3. Why did the system allow it?

Record them with factory_learn action=whys (exactly 3 strings). Close with action=close and a short knowledge/runbook note. Do not invent extra whys.`,
  },
}

function text(value) {
  return [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }]
}

function jsonTool(name, description, properties, required, execute) {
  return {
    name,
    description,
    parameters: { type: 'object', properties, required, additionalProperties: false },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => text(value),
    },
    async execute(args) {
      return execute(args)
    },
  }
}

function dispatch(factory, kind, args) {
  const action = args.action
  if (kind === 'epic') {
    if (action === 'create') return factory.createEpic(args)
    if (action === 'get') return factory.getEpic(args.epicId)
    if (action === 'list') return factory.listEpics()
    if (action === 'update') return factory.updateEpic(args.epicId, args)
    if (action === 'delete') return factory.deleteEpic(args.epicId)
    if (action === 'select') return factory.selectEpic(args.epicId)
    throw new Error('factory_epic action must be create|get|list|update|delete|select')
  }
  if (kind === 'align') {
    if (action === 'ask') return factory.askQuestion(args.epicId, args)
    if (action === 'answer') return factory.answerQuestion(args.epicId, args.questionId, args.answer)
    throw new Error('factory_align action must be ask|answer')
  }
  if (kind === 'ticket') {
    if (action === 'create') return factory.createTicket(args.epicId, args)
    if (action === 'get') return factory.getTicket(args.ticketId)
    if (action === 'list') return factory.listTickets(args.epicId)
    if (action === 'update') return factory.updateTicket(args.ticketId, args)
    if (action === 'delete') return factory.deleteTicket(args.ticketId)
    if (action === 'select') return factory.selectTicket(args.ticketId)
    if (action === 'approve') {
      return args.ticketId ? factory.approveTicket(args.ticketId) : factory.approveEpic(args.epicId)
    }
    if (action === 'implement') return factory.startImplementation(args.ticketId)
    if (action === 'transition') return factory.transitionTicket(args.ticketId, args.state, args)
    if (action === 'review') return factory.reviewTicket(args.ticketId, args)
    throw new Error('factory_ticket action must be create|get|list|update|delete|select|approve|implement|transition|review')
  }
  if (kind === 'evidence') {
    if (action === 'submit') return factory.submitEvidence(args.ticketId, args)
    if (action === 'run') return factory.runGates(args.ticketId)
    throw new Error('factory_evidence action must be submit|run')
  }
  if (kind === 'learn') {
    if (action === 'open') return factory.createIncident(args)
    if (action === 'whys') {
      const whys = Array.isArray(args.whys)
        ? args.whys
        : [args.why1, args.why2, args.why3].filter((w) => w !== undefined)
      return factory.recordWhys(args.incidentId, whys)
    }
    if (action === 'close') return factory.closeIncident(args.incidentId, args)
    throw new Error('factory_learn action must be open|whys|close')
  }
  throw new Error(`unknown factory kind: ${kind}`)
}

export function createApi(factory) {
  return {
    snapshot: () => factory.snapshot(),
    history: (limit) => factory.history(limit),
    createEpic: (args) => factory.createEpic(args),
    epic: (args) => dispatch(factory, 'epic', args),
    align: (args) => dispatch(factory, 'align', args),
    ticket: (args) => dispatch(factory, 'ticket', args),
    evidence: (args) => dispatch(factory, 'evidence', args),
    learn: (args) => dispatch(factory, 'learn', args),
    act(body) {
      const { type, ...rest } = body
      if (type === 'snapshot') return factory.snapshot()
      if (type === 'createEpic' || type === 'epic') return dispatch(factory, 'epic', type === 'createEpic' ? { action: 'create', ...rest } : rest)
      if (type === 'align') return dispatch(factory, 'align', rest)
      if (type === 'ticket') return dispatch(factory, 'ticket', rest)
      if (type === 'evidence') return dispatch(factory, 'evidence', rest)
      if (type === 'learn') return dispatch(factory, 'learn', rest)
      throw new Error(`unknown action: ${type}`)
    },
  }
}

export function startApiServer(api, port) {
  const server = createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'content-type')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }
    const send = (code, value) => {
      res.writeHead(code, { 'content-type': 'application/json' })
      res.end(JSON.stringify(value))
    }
    if (req.method === 'GET' && req.url === '/snapshot') {
      send(200, api.snapshot())
      return
    }
    if (req.method === 'GET' && req.url === '/history') {
      send(200, api.history())
      return
    }
    if (req.method === 'POST' && req.url === '/action') {
      let raw = ''
      req.on('data', (chunk) => {
        raw += chunk
        if (raw.length > 1_000_000) req.destroy()
      })
      req.on('end', () => {
        try {
          send(200, { ok: true, value: api.act(JSON.parse(raw || '{}')) })
        } catch (error) {
          send(400, { ok: false, error: String(error.message || error) })
        }
      })
      return
    }
    send(404, { ok: false, error: 'not found' })
  })
  // Bind every interface inside the container: under bridge networking (the
  // Docker Desktop-on-Windows-compatible mode), a published port cannot reach
  // a process bound to the container's own loopback. The "127.0.0.1 only"
  // boundary this used to provide is instead enforced one layer out, by
  // publishing this port as 127.0.0.1:PORT:PORT in docker-compose.yml.
  const bindHost = process.env.FACTORY_API_BIND_HOST || '0.0.0.0'
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, bindHost, () => {
      server.unref()
      resolve(server)
    })
  })
}

function approvedWorkExists(factory) {
  return factory.snapshot().tickets.some((ticket) => ticket.state !== 'aligning')
}

export function mutationGuard(factory, exec) {
  const name = exec?.name
  if (!name || name.startsWith('factory_')) return undefined
  if (!factory.config.mutationTools.includes(name)) return undefined
  if (approvedWorkExists(factory)) return undefined
  return 'software factory: mutating tools blocked until a ticket is approved'
}

export function apply(ctx, config = {}) {
  const resolved = resolveConfig(config)
  if (!resolved.enabled) {
    ctx.logger?.('software-factory')?.info('disabled by FACTORY_PLUGIN_ENABLED=0')
    return { factory: null }
  }

  const factory = createFactory(resolved)
  const api = createApi(factory)
  const disposers = []

  if (ctx.provide) ctx.provide('softwareFactory', api)

  if (ctx.tools?.register) {
    disposers.push(
      ctx.tools.register(
        jsonTool(
          'factory_context',
          'Read software-factory phase, artifacts, pending Grill Me question, and history.',
          { limit: { type: 'integer', description: 'history lines' } },
          [],
          (args) => ({ snapshot: api.snapshot(), history: api.history(args.limit) }),
        ),
      ),
      ctx.tools.register(
        jsonTool(
          'factory_epic',
          'CRUD for software-factory epics: create, get, list, update, delete, or select.',
          {
            action: { type: 'string', enum: ['create', 'get', 'list', 'update', 'delete', 'select'] },
            epicId: { type: 'string' },
            title: { type: 'string' },
            vision: { type: 'string' },
          },
          ['action'],
          (args) => api.epic(args),
        ),
      ),
      ctx.tools.register(
        jsonTool(
          'factory_align',
          'Grill Me: record one pending question with a recommended answer, or record the human decision.',
          {
            action: { type: 'string', enum: ['ask', 'answer'] },
            epicId: { type: 'string' },
            prompt: { type: 'string' },
            recommended: { type: 'string' },
            questionId: { type: 'string' },
            answer: { type: 'string' },
          },
          ['action', 'epicId'],
          async (args) => {
            if (args.action === 'ask' && ctx.userQuestions?.ask) {
              const recorded = api.align(args)
              try {
                const reply = await ctx.userQuestions.ask({
                  title: recorded.question.prompt,
                  questions: [
                    {
                      id: recorded.question.id,
                      prompt: recorded.question.prompt,
                      recommended: recorded.question.recommended,
                    },
                  ],
                })
                const answer = reply?.answer || reply?.answers?.[recorded.question.id] || reply
                if (answer && typeof answer === 'string') {
                  return api.align({
                    action: 'answer',
                    epicId: args.epicId,
                    questionId: recorded.question.id,
                    answer,
                  })
                }
              } catch {
                // ponytail: dashboard / later factory_align answer if ask_user fails
              }
              return recorded
            }
            return api.align(args)
          },
        ),
      ),
      ctx.tools.register(
        jsonTool(
          'factory_ticket',
          'CRUD plus state for factory tickets: create, get, list, update, delete, select, approve, implement, review, transition.',
          {
            action: { type: 'string', enum: ['create', 'get', 'list', 'update', 'delete', 'select', 'approve', 'implement', 'transition', 'review'] },
            epicId: { type: 'string' },
            ticketId: { type: 'string' },
            title: { type: 'string' },
            body: { type: 'string' },
            state: { type: 'string' },
            reviewer: { type: 'string' },
            verdict: { type: 'string', enum: ['approved', 'rejected'] },
          },
          ['action'],
          (args) => api.ticket(args),
        ),
      ),
      ctx.tools.register(
        jsonTool(
          'factory_evidence',
          'Submit quality-gate evidence or rerun configured gate commands.',
          {
            action: { type: 'string', enum: ['submit', 'run'] },
            ticketId: { type: 'string' },
            command: { type: 'string' },
            exitCode: { type: 'integer' },
            log: { type: 'string' },
          },
          ['action', 'ticketId'],
          (args) => api.evidence(args),
        ),
      ),
      ctx.tools.register(
        jsonTool(
          'factory_learn',
          'Open a classified incident, record exactly three whys, or close with a knowledge note.',
          {
            action: { type: 'string', enum: ['open', 'whys', 'close'] },
            incidentId: { type: 'string' },
            ticketId: { type: 'string' },
            title: { type: 'string' },
            classification: { type: 'string', enum: ['database', 'application', 'infrastructure', 'security', 'ux'] },
            why1: { type: 'string' },
            why2: { type: 'string' },
            why3: { type: 'string' },
            whys: { type: 'array', items: { type: 'string' } },
            knowledge: { type: 'string' },
          },
          ['action'],
          (args) => api.learn(args),
        ),
      ),
    )
  }

  if (ctx.tools?.guard) {
    disposers.push(ctx.tools.guard((exec) => mutationGuard(factory, exec)))
  }

  if (ctx.skills?.register) {
    for (const [skillName, skill] of Object.entries(SKILLS)) {
      disposers.push(
        ctx.skills.register({
          name: skillName,
          description: skill.description,
          whenToUse: skill.whenToUse,
          source: 'bundled',
          content: skill.content,
        }),
      )
    }
  }

  if (ctx.on) {
    disposers.push(
      ctx.on('tools/result', (exec, result) => {
        const isError = Boolean(result?.isError || result?.kind === 'failure')
        factory.recordToolResult({
          tool: exec?.name,
          isError,
          detail: result?.error || result?.reason || '',
        })
      }),
    )
  }

  let server
  const mount = async () => {
    server = await startApiServer(api, resolved.apiPort)
    ctx.logger?.('software-factory')?.info(`api on port ${resolved.apiPort} (published as 127.0.0.1 only)`)
  }

  if (ctx.effect) {
    ctx.effect(() => {
      mount().catch((error) => ctx.logger?.('software-factory')?.error(error))
      return () => {
        server?.close()
        for (const dispose of disposers) {
          if (typeof dispose === 'function') dispose()
        }
      }
    })
  } else {
    mount().catch(() => {})
  }

  return { factory, api, getServer: () => server }
}

export { createFactory, resolveConfig }
