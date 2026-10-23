/**
 * Utilidades para inspeccionar y reparar `config.js`.
 *
 * El caso típico en Termux es pegar comandos de shell dentro del editor
 * (`nano config.js`) y guardar el archivo con líneas como `npm start` antes del
 * comentario. Eso rompe el módulo con:
 *   SyntaxError: Unexpected identifier 'start'
 *
 * Aquí solo se elimina ese "ruido" de shell, sin tocar el resto del archivo.
 */

const SHELL_COMMANDS = new Set([
  'npm', 'npx', 'pnpm', 'yarn', 'bun', 'node', 'nodemon', 'pm2',
  'pkg', 'apt', 'apt-get', 'sudo', 'su', 'git', 'cd', 'cp', 'mv', 'rm',
  'mkdir', 'touch', 'chmod', 'chown', 'curl', 'wget', 'echo', 'export',
  'ls', 'cat', 'nano', 'vim', 'vi', 'clear', 'exit', 'source', 'bash', 'sh',
  'screen', 'tmux', 'termux-wake-lock', 'unzip', 'tar',
])

const PROMPT_PREFIX = /^\s*(?:\$|>|#|~[^\s]*\s*[$#])\s+/
const SHELL_STATEMENT = /^\s*([a-zA-Z][\w.-]*)([\s\S]*)$/

/** ¿La línea empieza con un comando de shell y no con código JS válido? */
export function isShellNoiseLine(line = '') {
  const trimmed = String(line).replace(PROMPT_PREFIX, '').trim()
  if (!trimmed) return false
  if (/^(?:\/\/|\/\*|\*|import\b|export\b|const\b|let\b|var\b|global\.|await\b|if\s*\(|function\b|class\b|;|\}|\))/.test(trimmed)) return false
  const match = trimmed.match(SHELL_STATEMENT)
  if (!match) return false
  return SHELL_COMMANDS.has(match[1].toLowerCase())
}

/**
 * Recorta un prefijo de shell pegado a código válido, por ejemplo:
 *   "npm start/* comentario" -> "/* comentario"
 *   "$ npm start"            -> ""
 */
export function stripShellPrefix(line = '') {
  const original = String(line)
  const unquoted = original.replace(PROMPT_PREFIX, (match) => ' '.repeat(match.length))
  const trimmedStart = unquoted.search(/\S/)
  if (trimmedStart < 0) return original
  const body = unquoted.slice(trimmedStart)
  const match = body.match(SHELL_STATEMENT)
  if (!match || !SHELL_COMMANDS.has(match[1].toLowerCase())) return original

  // Busca dónde termina el comando y empieza código real (comentario, import…).
  const boundary = body.search(/(?:\/\*|\*\/|\/\/|\b(?:import|export|const|let|var|global|await)\b)/)
  if (boundary < 0) return ''
  const rest = body.slice(boundary)
  // Si lo que sigue es otra instrucción de shell ("npm start && cd .."), se descarta.
  if (isShellNoiseLine(rest) && !/^(?:\/\*|\/\/)/.test(rest)) return ''
  return ' '.repeat(trimmedStart) + rest
}

/**
 * Devuelve el contenido reparado. Solo modifica líneas identificadas como ruido
 * de shell; si no hay nada que reparar devuelve el mismo texto.
 */
export function repairConfigSource(source = '') {
  const text = String(source).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const lines = text.split('\n')
  let changed = false
  let inBlockComment = false
  const repaired = lines.map((line) => {
    // Dentro de un comentario de bloque no se toca nada: líneas como
    // "cp config.example.js config.js" son documentación, no ruido.
    const fixed = inBlockComment ? line : stripShellPrefix(line)
    if (fixed !== line) changed = true
    inBlockComment = nextBlockCommentState(line, inBlockComment)
    if (fixed !== line) inBlockComment = nextBlockCommentState(fixed, false)
    return fixed
  })
  if (!changed) return { changed: false, source: text }
  return { changed: true, source: repaired.join('\n').replace(/^\n+/, '') }
}

/** Sigue el estado de un comentario /* … *\/ ignorando cadenas de texto. */
function nextBlockCommentState(line, initialState) {
  let inComment = initialState
  let quote = ''
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]
    if (quote) {
      if (char === '\\') { index += 1; continue }
      if (char === quote) quote = ''
      continue
    }
    if (!inComment && (char === "'" || char === '"' || char === '`')) { quote = char; continue }
    if (!inComment && char === '/' && next === '/') return inComment
    if (!inComment && char === '/' && next === '*') { inComment = true; index += 1; continue }
    if (inComment && char === '*' && next === '/') { inComment = false; index += 1; continue }
  }
  return inComment
}

export const OWNER_PLACEHOLDER = /X{4,}|TU_LID_AQUI|XXXXXXXX/i

/** ¿La config sigue con el número de ejemplo sin editar? */
export function hasPlaceholderOwner(source = '') {
  const match = String(source).match(/global\.owner\s*=\s*\[([\s\S]*?)\]/)
  if (!match) return false
  return OWNER_PLACEHOLDER.test(match[1])
}

export default { isShellNoiseLine, stripShellPrefix, repairConfigSource, hasPlaceholderOwner, OWNER_PLACEHOLDER }

/** Normaliza un número de WhatsApp: solo dígitos (sin +, espacios ni guiones). */
export function normalizeOwnerPhone(value = '') {
  return String(value).replace(/\D/g, '').replace(/^0+/, '')
}

export function isValidOwnerPhone(value = '') {
  const digits = normalizeOwnerPhone(value)
  return digits.length >= 8 && digits.length <= 15
}

/**
 * Reescribe los bloques `global.owner` y `global.ownerLid` manteniendo el resto
 * del archivo (nombre del bot, APIs, canal…).
 */
export function applyOwnerSettings(source, { phone = '', name = 'MultiBot Owner', lid = '' } = {}) {
  const safeName = String(name || 'MultiBot Owner').replace(/['"\\\n]/g, ' ').trim().slice(0, 40) || 'MultiBot Owner'
  const digits = normalizeOwnerPhone(phone)
  const safeLid = String(lid || '').replace(/\D/g, '')
  const ownerBlock = `global.owner = [${digits ? `\n  ['${digits}', ${JSON.stringify(safeName)}, true],\n` : ''}]`
  const lidBlock = `global.ownerLid = [${safeLid ? `\n  ['${safeLid}', ${JSON.stringify(safeName)}, true],\n` : ''}]`

  let next = replaceArrayAssignment(String(source), 'owner', ownerBlock)
  next = replaceArrayAssignment(next, 'ownerLid', lidBlock)
  return next
}

/**
 * Reemplaza `global.<key> = [ ... ]` recorriendo corchetes con seguimiento de
 * comillas, para no cortar en el `]` interno de las filas del arreglo.
 */
function replaceArrayAssignment(source, key, replacement) {
  const pattern = new RegExp(`global\\.${key}\\s*=\\s*\\[`)
  const match = pattern.exec(source)
  if (!match) return source
  let depth = 0
  let quote = ''
  for (let index = match.index + match[0].length - 1; index < source.length; index += 1) {
    const char = source[index]
    if (quote) {
      if (char === '\\') { index += 1; continue }
      if (char === quote) quote = ''
      continue
    }
    if (char === "'" || char === '"' || char === '`') { quote = char; continue }
    if (char === '[') depth += 1
    else if (char === ']') {
      depth -= 1
      if (depth === 0) return `${source.slice(0, match.index)}${replacement}${source.slice(index + 1)}`
    }
  }
  return source
}

/** Lee el owner actual de la config (para usarlo como valor por defecto). */
export function readOwnerSettings(source = '') {
  const text = String(source)
  const ownerMatch = text.match(/global\.owner\s*=\s*\[([\s\S]*?)\]/)
  const lidMatch = text.match(/global\.ownerLid\s*=\s*\[([\s\S]*?)\]/)
  const pick = (block) => {
    const row = block?.match(/\[\s*['"]([^'"]*)['"]\s*,\s*['"]([^'"]*)['"]/)
    return row ? { id: row[1], name: row[2] } : null
  }
  const owner = pick(ownerMatch?.[1])
  const lid = pick(lidMatch?.[1])
  const values = (value) => (OWNER_PLACEHOLDER.test(String(value || '')) ? '' : String(value || ''))
  return {
    phone: values(owner?.id).replace(/\D/g, ''),
    name: values(owner?.name),
    lid: values(lid?.id).replace(/\D/g, ''),
  }
}
