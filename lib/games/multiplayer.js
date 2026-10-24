import {
  GamePermissionError,
  GameRuleError,
  assertGameUser,
  createGameSession,
  deleteGameSession,
  findGameSession,
  gameButton,
  getGameContext,
  presentGame,
  runGameCommand,
  sameUser,
  updateGame
} from './sessions.js'

function integer(value, label, min, max) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new GameRuleError(`${label} debe ser un número entero entre ${min} y ${max}.`)
  return parsed
}

function newPlayer(ctx) {
  const { senderJid, senderName } = getGameContext(ctx)
  return { jid: senderJid, name: senderName, position: 0, rolls: 0 }
}

function lobbyControls(session) {
  return [
    gameButton(session, 'join', '➕ Unirme'),
    gameButton(session, 'start', '▶️ Iniciar'),
    gameButton(session, 'cancel', '🚫 Cancelar')
  ]
}

function raceControls(session) {
  return [
    gameButton(session, 'roll', '🎲 Tirar'),
    gameButton(session, 'scores', '📊 Posiciones'),
    gameButton(session, 'settings', '⚙️ Ajustes')
  ]
}

function overControls(session) {
  return [gameButton(session, 'rematch', '🔄 Revancha'), gameButton(session, 'scores', '📊 Posiciones')]
}

function controlsFor(session) {
  if (session.status === 'lobby') return lobbyControls(session)
  if (session.status === 'active') return raceControls(session)
  return overControls(session)
}

function raceBar(position, target) {
  const filled = Math.min(10, Math.round(position / target * 10))
  return `${'🟩'.repeat(filled)}${'⬛'.repeat(10 - filled)} ${position}/${target}`
}

export function renderMultiplayer(session) {
  const state = session.state
  const lines = [
    `🎲 *Carrera de dados multijugador*`,
    `👥 ${state.players.length}/${state.maxPlayers} jugadores · 🎯 Meta: ${state.target} · 🎲 Dados por turno: ${state.dice}`,
    ''
  ]
  if (session.status === 'lobby') {
    lines.push('📋 *Sala de espera*')
    state.players.forEach((player, index) => lines.push(`${index + 1}. ${player.name}${sameUser(player.jid, session.ownerJid) ? ' 👑' : ''}`))
    lines.push('', 'Todos pueden pulsar «Unirme». El creador inicia la carrera con 2 o más jugadores.')
  } else {
    lines.push('🏁 *Posiciones*')
    state.players.forEach((player, index) => {
      const turn = session.status === 'active' && index === state.turn ? '▶️ ' : ''
      const winner = state.winner && sameUser(player.jid, state.winner) ? '🏆 ' : ''
      lines.push(`${turn}${winner}${player.name}\n${raceBar(player.position, state.target)}`)
    })
    if (state.lastRoll?.length) lines.push('', `🎲 Última tirada: ${state.lastRoll.join(' + ')} = ${state.lastRoll.reduce((a, b) => a + b, 0)}`)
    if (session.status === 'active') lines.push(`Turno de *${state.players[state.turn]?.name}*.`)
    if (session.status === 'over') lines.push(state.winner ? `🏆 Ganador: *${state.players.find(player => sameUser(player.jid, state.winner))?.name || 'Jugador'}*.` : `🏁 ${state.result || 'Partida terminada.'}`)
  }
  lines.push('', '⌨️ Texto: *.multi unirme*, *.multi iniciar*, *.multi tirar*, *.multi salir*.', '⚙️ Editar: *.multi editar jugadores 6*, *.multi editar meta 40*, *.multi editar dados 2*.')
  return lines.join('\n')
}

export function advanceRace(state, random = Math.random) {
  if (!state.players || state.players.length < 2) throw new GameRuleError('Se necesitan al menos 2 jugadores.')
  const next = {
    ...state,
    players: state.players.map(player => ({ ...player })),
    lastRoll: Array.from({ length: state.dice }, () => 1 + Math.floor(random() * 6))
  }
  const player = next.players[next.turn]
  const total = next.lastRoll.reduce((sum, value) => sum + value, 0)
  player.position = Math.min(next.target, player.position + total)
  player.rolls += 1
  let winner = null
  if (player.position >= next.target) {
    next.winner = player.jid
    winner = player.jid
  } else {
    next.turn = (next.turn + 1) % next.players.length
  }
  return { state: next, winner, playerJid: player.jid, total }
}

async function join(ctx, session) {
  if (session.status !== 'lobby') throw new GameRuleError('La carrera ya comenzó; espera a la próxima sala.')
  const player = newPlayer(ctx)
  if (session.state.players.some(item => sameUser(item.jid, player.jid))) throw new GameRuleError('Ya estás dentro de la sala.')
  if (session.state.players.length >= session.state.maxPlayers) throw new GameRuleError(`La sala está llena (${session.state.maxPlayers} jugadores).`)
  session.state.players.push(player)
  return updateGame(ctx, session, renderMultiplayer(session))
}

async function start(ctx, session) {
  assertGameUser(ctx, session)
  if (session.status !== 'lobby') throw new GameRuleError('La carrera ya comenzó.')
  if (session.state.players.length < 2) throw new GameRuleError('Se necesitan al menos 2 jugadores. Comparte el botón «Unirme».')
  session.status = 'active'
  session.state.turn = 0
  session.state.winner = null
  return updateGame(ctx, session, renderMultiplayer(session), raceControls(session))
}

async function roll(ctx, session) {
  if (session.status !== 'active') throw new GameRuleError('La carrera no está en curso.')
  const { senderJid } = getGameContext(ctx)
  const current = session.state.players[session.state.turn]
  if (!sameUser(current?.jid, senderJid)) throw new GamePermissionError(`No es tu turno. Ahora tira ${current?.name || 'el jugador actual'}.`)
  const result = advanceRace(session.state)
  session.state = result.state
  session.status = result.winner ? 'over' : 'active'
  return updateGame(ctx, session, renderMultiplayer(session), result.winner ? overControls(session) : [])
}

async function leave(ctx, session) {
  const { senderJid } = getGameContext(ctx)
  const index = session.state.players.findIndex(player => sameUser(player.jid, senderJid))
  if (index < 0) throw new GameRuleError('No estás participando en esta carrera.')
  const wasOwner = sameUser(session.ownerJid, senderJid)
  session.state.players.splice(index, 1)
  if (wasOwner && session.state.players.length) {
    session.ownerJid = session.state.players[0].jid
    session.ownerName = session.state.players[0].name
  }
  if (session.status === 'active') {
    if (index < session.state.turn) session.state.turn -= 1
    if (!session.state.players.length) {
      session.status = 'over'
      session.state.result = 'Todos los jugadores abandonaron.'
      session.state.turn = 0
    } else if (session.state.players.length < 2) {
      session.status = 'over'
      session.state.winner = session.state.players[0].jid
      session.state.turn = 0
    } else {
      session.state.turn %= session.state.players.length
    }
  } else if (session.status === 'lobby' && !session.state.players.length) {
    session.status = 'over'
    session.state.result = 'La sala quedó vacía.'
    session.state.turn = 0
  }
  return updateGame(ctx, session, renderMultiplayer(session), controlsFor(session))
}

async function edit(ctx, session, args) {
  assertGameUser(ctx, session)
  const setting = String(args[0] || '').toLowerCase()
  const value = args[1]
  if (['jugadores', 'players', 'cupos'].includes(setting)) {
    if (session.status !== 'lobby') throw new GameRuleError('La cantidad de jugadores solo se edita antes de iniciar.')
    const maxPlayers = integer(value, 'La cantidad de jugadores', 2, 8)
    if (maxPlayers < session.state.players.length) throw new GameRuleError(`Ya hay ${session.state.players.length} jugadores dentro; no puedes reducir más el cupo.`)
    session.state.maxPlayers = maxPlayers
  } else if (['meta', 'objetivo', 'target'].includes(setting)) {
    if (!['lobby', 'active'].includes(session.status)) throw new GameRuleError('La carrera ya terminó.')
    const target = integer(value, 'La meta', 10, 100)
    const highest = Math.max(0, ...session.state.players.map(player => player.position))
    if (target <= highest) throw new GameRuleError(`La meta debe ser mayor que la posición actual más alta (${highest}).`)
    session.state.target = target
  } else if (['dados', 'dice'].includes(setting)) {
    if (!['lobby', 'active'].includes(session.status)) throw new GameRuleError('La carrera ya terminó.')
    session.state.dice = integer(value, 'La cantidad de dados', 1, 3)
  } else {
    throw new GameRuleError('Ajuste desconocido. Usa jugadores, meta o dados.')
  }
  return updateGame(ctx, session, renderMultiplayer(session))
}

export async function multiplayerCommand(ctx, args = []) {
  return runGameCommand(ctx, async () => {
    const { isGroup } = getGameContext(ctx)
    if (!isGroup) throw new GamePermissionError('La carrera multijugador solo se puede usar en grupos.')
    const action = String(args[0] || '').toLowerCase()
    let session = findGameSession('multiplayer', ctx)
    if (action === 'unirme' || action === 'join') {
      if (!session || session.status === 'over') throw new GameRuleError('No hay una sala abierta. Crea una con .multi.')
      return join(ctx, session)
    }
    if (action === 'iniciar' || action === 'start') {
      if (!session) throw new GameRuleError('No hay una sala. Crea una con .multi.')
      return start(ctx, session)
    }
    if (action === 'tirar' || action === 'roll') {
      if (!session) throw new GameRuleError('No hay una carrera activa.')
      return roll(ctx, session)
    }
    if (action === 'salir' || action === 'leave') {
      if (!session) throw new GameRuleError('No hay una sala o carrera activa.')
      return leave(ctx, session)
    }
    if (action === 'editar' || action === 'edit') {
      if (!session) throw new GameRuleError('No hay una sala o carrera activa.')
      return edit(ctx, session, args.slice(1))
    }
    if (action === 'cancelar' || action === 'cancel') {
      if (!session) throw new GameRuleError('No hay una partida para cancelar.')
      return multiplayerAction(ctx, session, 'cancel')
    }
    if (action === 'revancha' || action === 'rematch') {
      if (!session) throw new GameRuleError('No hay una partida terminada para repetir.')
      return multiplayerAction(ctx, session, 'rematch')
    }
    if (action && !['estado', 'status', 'config', 'ajustes'].includes(action) && !/^\d+$/.test(action)) {
      throw new GameRuleError('Acción desconocida. Usa unirme, iniciar, tirar, salir, editar o cancelar.')
    }
    if (session && !['over', 'closed'].includes(session.status)) {
      return updateGame(ctx, session, renderMultiplayer(session), action === 'config' || action === 'ajustes' ? controlsFor(session) : [])
    }
    if (session) deleteGameSession(session)
    const maxPlayers = action && /^\d+$/.test(action) ? integer(action, 'La cantidad de jugadores', 2, 8) : 4
    const target = args[1] ? integer(args[1], 'La meta', 10, 100) : 30
    const player = newPlayer(ctx)
    session = createGameSession('multiplayer', ctx, {
      maxPlayers,
      target,
      dice: 1,
      players: [player],
      turn: 0,
      lastRoll: [],
      winner: null,
      result: ''
    }, { status: 'lobby' })
    return presentGame(ctx, session, renderMultiplayer(session), lobbyControls(session))
  })
}

export async function multiplayerAction(ctx, session, action) {
  if (action === 'join') return join(ctx, session)
  if (action === 'start') return start(ctx, session)
  if (action === 'roll') return roll(ctx, session)
  if (action === 'scores' || action === 'settings') return updateGame(ctx, session, renderMultiplayer(session))
  if (action === 'cancel') {
    assertGameUser(ctx, session)
    session.status = 'over'
    session.state.result = 'El creador canceló la partida.'
    session.state.winner = null
    return updateGame(ctx, session, renderMultiplayer(session))
  }
  if (action === 'rematch') {
    assertGameUser(ctx, session)
    if (session.state.players.length < 2) throw new GameRuleError('Se necesitan al menos 2 jugadores para la revancha.')
    session.state.players.forEach(player => { player.position = 0 })
    session.state.turn = 0
    session.state.lastRoll = []
    session.state.winner = null
    session.state.result = ''
    session.status = 'active'
    return updateGame(ctx, session, renderMultiplayer(session), raceControls(session))
  }
  throw new GameRuleError('Acción multijugador desconocida.')
}
