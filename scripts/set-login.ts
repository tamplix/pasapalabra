/**
 * Define el usuario y la contraseña de acceso. No guarda ninguno de los dos:
 * solo escribe en `.env.local` (ignorado por git) la sal y la huella derivada.
 * Uso: npm run set-login
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import readline from 'node:readline'
import { DEFAULT_ITERATIONS, hashCredentials, randomSaltHex } from '../src/app/authHash'

const target = process.env.LOGIN_ENV_FILE ?? resolve(import.meta.dirname, '../.env.local')

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) })
let muted = false
const rlAny = rl as unknown as { _writeToOutput: (s: string) => void }
const write = rlAny._writeToOutput.bind(rl)
rlAny._writeToOutput = (s) => { if (!muted) write(s) }

const lines: string[] = []
const waiting: Array<(line: string) => void> = []
rl.on('line', (line) => (waiting.shift() ?? ((l: string) => lines.push(l)))(line))

function ask(question: string, hidden = false): Promise<string> {
  process.stdout.write(question)
  muted = hidden
  return new Promise((done) => {
    const finish = (line: string) => {
      muted = false
      if (hidden) process.stdout.write('\n')
      done(line)
    }
    const queued = lines.shift()
    if (queued !== undefined) finish(queued)
    else waiting.push(finish)
  })
}

const user = (await ask('Usuario: ')).trim()
const password = await ask('Contraseña: ', true)
const repeat = await ask('Repite la contraseña: ', true)
rl.close()

if (!user || !password) fail('El usuario y la contraseña no pueden estar vacíos.')
if (password !== repeat) fail('Las contraseñas no coinciden. No se ha cambiado nada.')
if (password.length < 8) console.warn('Aviso: una contraseña corta es fácil de adivinar a partir de la huella.')

const salt = randomSaltHex()
const hash = await hashCredentials(user, password, salt, DEFAULT_ITERATIONS)

const keep = existsSync(target)
  ? readFileSync(target, 'utf8').split('\n').filter((l) => l.trim() && !l.startsWith('VITE_LOGIN_'))
  : []
writeFileSync(
  target,
  [...keep, `VITE_LOGIN_SALT=${salt}`, `VITE_LOGIN_ITERATIONS=${DEFAULT_ITERATIONS}`, `VITE_LOGIN_HASH=${hash}`, ''].join('\n'),
)
console.log(`\nListo: huella guardada en ${target}\nSi el servidor de desarrollo está en marcha, se reinicia solo al detectar el cambio.`)

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}
