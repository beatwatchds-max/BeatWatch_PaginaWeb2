import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const srcRoot = path.join(root, 'src')

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name)
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath]
  })
}

const sourceFiles = listFiles(srcRoot).filter((file) => /\.(js|jsx|mjs)$/.test(file))
const sourceEntries = sourceFiles.map((file) => ({
  file,
  relative: path.relative(root, file),
  content: fs.readFileSync(file, 'utf8'),
}))

function matches(pattern) {
  return sourceEntries.filter(({ content }) => pattern.test(content))
}

test('no production backend URL is hardcoded in source code', () => {
  const offenders = matches(/https:\/\/backend-beatwatch\.onrender\.com/i)
  assert.deepEqual(offenders.map((item) => item.relative), [])
})

test('legacy and duplicate auth storage keys are removed', () => {
  const offenders = matches(/bookstack-auth|auth_token|mock-jwt-token/i)
  assert.deepEqual(offenders.map((item) => item.relative), [])
})

test('fetch is only used by the centralized HTTP client', () => {
  const offenders = matches(/\bfetch\s*\(/).filter(
    ({ relative }) => relative.replaceAll('\\', '/') !== 'src/api/client.js',
  )
  assert.deepEqual(offenders.map((item) => item.relative), [])
})

test('components do not define backend endpoint paths', () => {
  const offenders = sourceEntries.filter(
    ({ relative, content }) =>
      relative.replaceAll('\\', '/').startsWith('src/components/') && /['"`]\/api\//.test(content),
  )
  assert.deepEqual(offenders.map((item) => item.relative), [])
})

test('frontend never captures or sends raw card PAN/CVV fields', () => {
  const forbidden = /(NumeroTarjeta\s*:|['\"]NumeroTarjeta['\"]\s*:|cardNumber|name=['\"]cvv['\"]|form\.cvv|\bcvv\s*:|['\"]Cvv['\"]\s*:|\bCvv\s*:)/
  const offenders = matches(forbidden)
  assert.deepEqual(offenders.map((item) => item.relative), [])
})

test('source does not log payloads with console.log', () => {
  const offenders = matches(/console\.log\s*\(/)
  assert.deepEqual(offenders.map((item) => item.relative), [])
})

test('auth session uses a single BeatWatch sessionStorage key', () => {
  const authStore = fs.readFileSync(path.join(srcRoot, 'store/authStore.js'), 'utf8')
  assert.match(authStore, /AUTH_STORAGE_KEY\s*=\s*['"]beatwatch-auth['"]/)
  assert.match(authStore, /createJSONStorage\(\(\)\s*=>\s*sessionStorage\)/)
})

test('domain services exist for auth, users, devices, licenses and reports', () => {
  for (const name of [
    'authService.js',
    'registrationService.js',
    'usersService.js',
    'devicesService.js',
    'licensesService.js',
    'reportsService.js',
  ]) {
    assert.ok(fs.existsSync(path.join(srcRoot, 'services', name)), `${name} is required`)
  }
})


test('mobile access tokens are masked by default and require explicit admin disclosure', () => {
  const usersView = fs.readFileSync(path.join(srcRoot, 'components/dashboard/UsersView.jsx'), 'utf8')
  const usersService = fs.readFileSync(path.join(srcRoot, 'services/usersService.js'), 'utf8')
  assert.match(usersView, /user\.tokenMovil/)
  assert.doesNotMatch(usersService, /token-movil/)
  assert.match(usersView, /'••• ••• •••'/)
  assert.match(usersView, /EyeOff/)
  assert.match(usersView, /Eye/)
  assert.match(usersView, /toggleTokenVisibility/)
  assert.match(usersView, /toggleTokenPanel/)
  assert.doesNotMatch(usersView, /navigator\.clipboard/)
})

test('users dashboard route requires administrator role', () => {
  const app = fs.readFileSync(path.join(srcRoot, 'App.jsx'), 'utf8')
  assert.match(app, /path="usuarios"[\s\S]*allowedRoles=\{\[['"]administrador['"]\]\}/)
})

test('JWT validation rejects malformed or non-expiring tokens', () => {
  const authStore = fs.readFileSync(path.join(srcRoot, 'store/authStore.js'), 'utf8')
  assert.match(authStore, /parts\.length !== 3/)
  assert.match(authStore, /Number\.isFinite\(exp\)/)
  assert.match(authStore, /exp <= nowSeconds/)
})

test('device identifiers are masked before rendering', () => {
  const devicesView = fs.readFileSync(path.join(srcRoot, 'components/dashboard/DevicesView.jsx'), 'utf8')
  assert.match(devicesView, /maskIdentifier\(uuid\)/)
  assert.doesNotMatch(devicesView, />UUID:\s*\{uuid\}</)
})

test('registration does not retain obsolete fiscal fields', () => {
  const registration = fs.readFileSync(path.join(srcRoot, 'components/registration/StepPersonalData.jsx'), 'utf8')
  assert.doesNotMatch(registration, /empresaOrganizacion|\brfc\b|\bdireccion\b|ciudadEstado/)
})

test('HTTP client does not expose raw backend error payloads', () => {
  const client = fs.readFileSync(path.join(srcRoot, 'api/client.js'), 'utf8')
  assert.doesNotMatch(client, /payload\.message|payload\.mensaje|payload\.error|error\.payload/)
  assert.match(client, /publicMessages/)
})


test('environment files are ignored while .env.example remains versionable', () => {
  const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8')
  assert.match(gitignore, /^\.env$/m)
  assert.match(gitignore, /^\.env\.\*$/m)
  assert.match(gitignore, /^!\.env\.example$/m)
})


test('global patient discovery is administrator-only in analytics UI', () => {
  const analytics = fs.readFileSync(path.join(srcRoot, 'components/dashboard/AnalyticsView.jsx'), 'utf8')
  assert.match(analytics, /normalizedRole !== ['"]administrador['"]/)
  assert.match(analytics, /getSessionAuthorizedPatients\(authUser\)/)
  assert.match(analytics, /analyticsService\.getPacientesEstadisticas\(\)/)
})
