import {
  GameRuleError,
  createGameSession,
  gameButton,
  assertGameUser,
  presentGame,
  runGameCommand,
  updateGame
} from './sessions.js'

const FUNCTIONS = {
  sqrt: { arity: 1, fn: Math.sqrt },
  abs: { arity: 1, fn: Math.abs },
  sin: { arity: 1, fn: value => Math.sin(value * Math.PI / 180) },
  cos: { arity: 1, fn: value => Math.cos(value * Math.PI / 180) },
  tan: { arity: 1, fn: value => Math.tan(value * Math.PI / 180) },
  ln: { arity: 1, fn: Math.log },
  log: { arity: 1, fn: Math.log10 },
  floor: { arity: 1, fn: Math.floor },
  ceil: { arity: 1, fn: Math.ceil },
  round: { arity: 1, fn: Math.round },
  pow: { arity: 2, fn: Math.pow }
}

function tokenize(source) {
  const input = source
    .replace(/[×✕]/g, '*')
    .replace(/[÷]/g, '/')
    .replace(/[−–—]/g, '-')
    .replace(/π/g, ' pi ')
    .replace(/√/g, ' sqrt ')
    .replace(/\s+/g, '')
  if (!input || input.length > 180) throw new GameRuleError('Escribe una expresión de entre 1 y 180 caracteres.')
  const tokens = []
  let index = 0
  while (index < input.length) {
    const rest = input.slice(index)
    const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i.exec(rest)
    if (number) {
      tokens.push({ type: 'number', value: Number(number[0]) })
      index += number[0].length
      continue
    }
    const identifier = /^[a-z]+/i.exec(rest)
    if (identifier) {
      tokens.push({ type: 'identifier', value: identifier[0].toLowerCase() })
      index += identifier[0].length
      continue
    }
    if ('+-*/%^(),'.includes(input[index])) {
      tokens.push({ type: input[index], value: input[index] })
      index += 1
      continue
    }
    throw new GameRuleError(`El carácter «${input[index]}» no es válido.`)
  }
  return tokens
}

export function evaluateExpression(source) {
  const tokens = tokenize(String(source || ''))
  let cursor = 0
  const peek = type => tokens[cursor]?.type === type
  const take = type => {
    if (!peek(type)) throw new GameRuleError('La expresión está incompleta o tiene un formato inválido.')
    return tokens[cursor++]
  }

  function primary() {
    if (peek('number')) return tokens[cursor++].value
    if (peek('identifier')) {
      const name = tokens[cursor++].value
      if (name === 'pi') return Math.PI
      if (name === 'e') return Math.E
      const definition = FUNCTIONS[name]
      if (!definition) throw new GameRuleError(`Función desconocida: ${name}.`)
      take('(')
      const args = [expression()]
      while (peek(',')) {
        cursor += 1
        args.push(expression())
      }
      take(')')
      if (args.length !== definition.arity) throw new GameRuleError(`${name}() necesita ${definition.arity} argumento(s).`)
      return definition.fn(...args)
    }
    take('(')
    const value = expression()
    take(')')
    return value
  }

  function unary() {
    if (peek('+')) {
      cursor += 1
      return unary()
    }
    if (peek('-')) {
      cursor += 1
      return -unary()
    }
    return power()
  }

  function power() {
    let value = primary()
    if (peek('^')) {
      cursor += 1
      value = Math.pow(value, unary())
    }
    return value
  }

  function term() {
    let value = unary()
    while (['*', '/', '%'].includes(tokens[cursor]?.type)) {
      const operator = tokens[cursor++].type
      const right = unary()
      if ((operator === '/' || operator === '%') && right === 0) throw new GameRuleError('No se puede dividir entre cero.')
      value = operator === '*' ? value * right : operator === '/' ? value / right : value % right
    }
    return value
  }

  function expression() {
    let value = term()
    while (['+', '-'].includes(tokens[cursor]?.type)) {
      const operator = tokens[cursor++].type
      const right = term()
      value = operator === '+' ? value + right : value - right
    }
    return value
  }

  const result = expression()
  if (cursor !== tokens.length) throw new GameRuleError('Revisa los paréntesis y operadores de la expresión.')
  if (!Number.isFinite(result)) throw new GameRuleError('El resultado no es un número finito.')
  if (Math.abs(result) > 1e100) throw new GameRuleError('El resultado es demasiado grande para mostrarlo.')
  return Number(result.toPrecision(12))
}

export function formatNumber(value) {
  if (Object.is(value, -0)) return '0'
  return String(Number(value.toPrecision(12)))
}

function calculatorText(expression, value) {
  return `🧮 *Calculadora*\n\nExpresión: \`${expression}\`\nResultado: *${formatNumber(value)}*\n\nFunciones: sqrt(), sin(), cos(), tan(), abs(), ln(), log(), round(), pow().\nEjemplo: *.calc sqrt(81) + 2^3*`
}

function controls(session) {
  return [
    gameButton(session, 'square', 'x²'),
    gameButton(session, 'sqrt', '√x'),
    gameButton(session, 'inverse', '1/x')
  ]
}

export async function calculatorCommand(ctx, argsText = '') {
  return runGameCommand(ctx, async () => {
    const expression = argsText.trim() || ctx.quoted?.text?.trim() || ctx.quotedText?.trim()
    if (!expression) {
      return ctx.reply('🧮 *Calculadora*\n\nUso: *.calc 2 + 2*\nTambién puedes responder a un mensaje que contenga una operación.\n\nOperadores: `+ - * / % ^` y paréntesis.')
    }
    const value = evaluateExpression(expression)
    const session = createGameSession('calculator', ctx, { expression, value })
    return presentGame(ctx, session, calculatorText(expression, value), controls(session))
  })
}

export async function calculatorAction(ctx, session, action) {
  assertGameUser(ctx, session)
  const previous = Number(session.state.value)
  let expression = ''
  let value = previous
  if (action === 'square') {
    expression = `(${formatNumber(previous)})^2`
    value = previous ** 2
  } else if (action === 'sqrt') {
    expression = `sqrt(${formatNumber(previous)})`
    value = Math.sqrt(previous)
  } else if (action === 'inverse') {
    if (previous === 0) throw new GameRuleError('No se puede dividir entre cero.')
    expression = `1/(${formatNumber(previous)})`
    value = 1 / previous
  } else {
    throw new GameRuleError('Acción de calculadora desconocida.')
  }
  if (!Number.isFinite(value)) throw new GameRuleError('El resultado no es un número finito.')
  value = Number(value.toPrecision(12))
  session.state = { expression, value }
  return updateGame(ctx, session, calculatorText(expression, value))
}
