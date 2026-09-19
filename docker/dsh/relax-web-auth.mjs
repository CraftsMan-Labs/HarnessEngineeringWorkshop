#!/usr/bin/env node
// ponytail: 0.1.5-rc.2 has no auth-off flag. Gate the cookie check on DSH_WEB_AUTH.
import { readFileSync, writeFileSync } from 'node:fs'

const target =
  '/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-connection/lib/index.js'
const needle = '\tisAuthenticated(request) {\n'
const insert = '\tisAuthenticated(request) {\n\t\tif (process.env.DSH_WEB_AUTH === "0") return true;\n'
const src = readFileSync(target, 'utf8')
if (src.includes('DSH_WEB_AUTH === "0"')) process.exit(0)
if (!src.includes(needle)) {
  throw new Error(`relax-web-auth: isAuthenticated() missing in ${target}`)
}
writeFileSync(target, src.replace(needle, insert))
console.log(`relax-web-auth: patched ${target}`)
