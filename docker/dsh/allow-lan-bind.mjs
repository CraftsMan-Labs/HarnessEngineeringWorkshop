#!/usr/bin/env node
// Windows Docker Desktop does not support network_mode: host, so this stack
// uses normal bridge networking + published ports instead. That requires dsh
// to bind 0.0.0.0 *inside the container* (Docker's NAT can't forward a
// published port to a process bound to loopback). dsh's CLI refuses
// `--host 0.0.0.0` outright as an RCE-exposure safety check; gate that check
// on DSH_ALLOW_ALL_INTERFACES instead of removing it, so the guard still
// applies to anyone running dsh outside this container. The compose-level
// `127.0.0.1:PORT:PORT` published-port binding is what actually keeps this
// off the LAN, equivalent to what the safety check itself was protecting.
import { readFileSync, writeFileSync } from 'node:fs'

const target =
  '/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-web-app/lib/startup.js'
const needle =
  'if (options.host === "0.0.0.0") program.error("error: --host 0.0.0.0 is intentionally not supported yet for safety: it would expose remote code execution to the network; use 127.0.0.1 instead");'
const insert =
  'if (options.host === "0.0.0.0" && process.env.DSH_ALLOW_ALL_INTERFACES !== "1") program.error("error: --host 0.0.0.0 is intentionally not supported yet for safety: it would expose remote code execution to the network; use 127.0.0.1 instead");'
const src = readFileSync(target, 'utf8')
if (src.includes('DSH_ALLOW_ALL_INTERFACES')) process.exit(0)
if (!src.includes(needle)) {
  throw new Error(`allow-lan-bind: --host 0.0.0.0 guard missing in ${target}`)
}
writeFileSync(target, src.replace(needle, insert))
console.log(`allow-lan-bind: patched ${target}`)
