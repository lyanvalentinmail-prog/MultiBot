import test from 'node:test'
import assert from 'node:assert/strict'
import { findCommand } from '../src/registry.js'

const CHAT = '120363000000000000@g.us'
const BOT = '59890000000@s.whatsapp.net'
const ADMIN = '59891111111@s.whatsapp.net'
const ADMIN2 = '59893333333@s.whatsapp.net'
const USER = '59892222222@s.whatsapp.net'

const baseParts = [{ id: BOT, admin: 'admin' }, { id: ADMIN, admin: 'admin' }, { id: ADMIN2, admin: 'admin' }, { id: USER }]

function groupCtx(commandName, options = {}) {
  const {
    senderJid = ADMIN,
    isOwner = false,
    mentionedJids = [],
    quotedParticipant = null,
    quotedText = null,
    argsText = '',
    participants = baseParts,
    metadata = {},
    addStatus = '200',
    chatJid = CHAT
  } = options
  const calls = { updates: [], settings: [], replies: [], mentions: [] }
  const sock = {
    groupMetadata: async () => ({ subject: 'Grupo Test', participants, ...metadata }),
    groupParticipantsUpdate: async (chat, jids, action) => {
      calls.updates.push({ chat, jids, action })
      return [{ status: addStatus, jid: jids[0] }]
    },
    groupSettingUpdate: async (chat, setting) => {
      calls.settings.push({ chat, setting })
    }
  }
  const ctx = {
    chatJid,
    senderJid,
    botJid: BOT,
    botNumber: '59890000000',
    isOwner,
    isGroup: true,
    mentionedJids,
    quotedParticipant,
    quoted: quotedText ? { text: quotedText } : null,
    argsText,
    prefix: '.',
    sock,
    reply: async (text) => calls.replies.push(text),
    sendMention: async (text, mentions) => calls.mentions.push({ text, mentions })
  }
  return { ctx, calls, run: () => findCommand(commandName).run(ctx) }
}

test('kick expulsa al mencionado', async () => {
  const { calls, run } = groupCtx('kick', { mentionedJids: [USER] })
  const result = await run()
  assert.equal(result, 'kick 59892222222')
  assert.deepEqual(calls.updates, [{ chat: CHAT, jids: [USER], action: 'remove' }])
  assert.equal(calls.mentions.length, 1)
  assert.ok(calls.mentions[0].text.includes('@59892222222'))
  assert.deepEqual(calls.mentions[0].mentions, [USER])
})

test('kick acepta citado o número, y valida todo', async () => {
  const quoted = groupCtx('kick', { quotedParticipant: USER })
  await quoted.run()
  assert.deepEqual(quoted.calls.updates[0].jids, [USER])

  const byNumber = groupCtx('kick', { argsText: '59892222222' })
  await byNumber.run()
  assert.deepEqual(byNumber.calls.updates[0].jids, ['59892222222@s.whatsapp.net'])

  await assert.rejects(groupCtx('kick', {}).run(), /Indica a quién/)
  await assert.rejects(groupCtx('kick', { senderJid: USER, mentionedJids: [ADMIN] }).run(), /administradores/)
  await assert.rejects(groupCtx('kick', { mentionedJids: [ADMIN2] }).run(), /otro admin/)
  await assert.rejects(groupCtx('kick', { mentionedJids: [BOT] }).run(), /mí mismo/)
  await assert.rejects(groupCtx('kick', { argsText: '59890000001' }).run(), /no está en el grupo/)
  await assert.rejects(
    groupCtx('kick', { mentionedJids: [USER], chatJid: '59891111111@s.whatsapp.net' }).run(),
    /solo funciona en grupos/
  )
  // Sin bot-admin no se puede
  const noBot = baseParts.map((p) => (p.id === BOT ? { id: BOT } : p))
  await assert.rejects(groupCtx('kick', { mentionedJids: [USER], participants: noBot }).run(), /ser admin/)
  // El dueño del bot puede expulsar admins
  const ownerKick = groupCtx('kick', { senderJid: USER, isOwner: true, mentionedJids: [ADMIN2] })
  await ownerKick.run()
  assert.deepEqual(ownerKick.calls.updates[0], { chat: CHAT, jids: [ADMIN2], action: 'remove' })
})

test('promote/demote cambian el rol', async () => {
  const promote = groupCtx('promote', { mentionedJids: [USER] })
  await promote.run()
  assert.deepEqual(promote.calls.updates[0], { chat: CHAT, jids: [USER], action: 'promote' })
  assert.ok(promote.calls.mentions[0].text.includes('admin'))
  await assert.rejects(groupCtx('promote', { mentionedJids: [ADMIN2] }).run(), /Ya es admin/)

  const demote = groupCtx('demote', { mentionedJids: [ADMIN2] })
  await demote.run()
  assert.deepEqual(demote.calls.updates[0], { chat: CHAT, jids: [ADMIN2], action: 'demote' })
  await assert.rejects(groupCtx('demote', { mentionedJids: [USER] }).run(), /Ni siquiera es admin/)
  await assert.rejects(groupCtx('promote', { senderJid: USER, mentionedJids: [ADMIN2] }).run(), /administradores/)
})

test('add agrega números y explica cuando WhatsApp dice que no', async () => {
  const added = groupCtx('add', { argsText: '59899001122' })
  await added.run()
  assert.deepEqual(added.calls.updates[0], {
    chat: CHAT,
    jids: ['59899001122@s.whatsapp.net'],
    action: 'add'
  })
  assert.ok(added.calls.mentions[0].text.includes('@59899001122'))

  await assert.rejects(groupCtx('add', {}).run(), /código de país/)
  await assert.rejects(groupCtx('add', { mentionedJids: [USER] }).run(), /ya está en el grupo/)
  await assert.rejects(groupCtx('add', { argsText: '59899001122', addStatus: '403' }).run(), /no dejó agregar/)
})

test('tagall etiqueta a todos con el mensaje', async () => {
  const { calls, run } = groupCtx('tagall', { argsText: 'Reunión 20h' })
  const result = await run()
  assert.equal(result, 'tagall 4')
  assert.equal(calls.mentions.length, 1)
  assert.equal(calls.mentions[0].mentions.length, 4)
  assert.ok(calls.mentions[0].text.includes('Reunión 20h'))
  assert.ok(calls.mentions[0].text.includes('@59892222222'))

  const quoted = groupCtx('tagall', { quotedText: 'Lean esto' })
  await quoted.run()
  assert.ok(quoted.calls.mentions[0].text.includes('Lean esto'))

  await assert.rejects(groupCtx('tagall', { senderJid: USER }).run(), /administradores/)
})

test('open/close cambian los permisos del grupo', async () => {
  const opened = groupCtx('open', {})
  await opened.run()
  assert.deepEqual(opened.calls.settings, [{ chat: CHAT, setting: 'not_announcement' }])
  assert.ok(opened.calls.replies[0].includes('abierto'))

  const closed = groupCtx('close', {})
  await closed.run()
  assert.deepEqual(closed.calls.settings, [{ chat: CHAT, setting: 'announcement' }])
  assert.ok(closed.calls.replies[0].includes('cerrado'))

  await assert.rejects(groupCtx('close', { senderJid: USER }).run(), /administradores/)
})

test('infogrupo muestra los datos y lo puede usar cualquiera', async () => {
  const { calls, run } = groupCtx('infogrupo', {
    senderJid: USER,
    metadata: { subject: 'Familia', desc: 'El grupo de la familia', creation: 1700000000, owner: ADMIN }
  })
  const result = await run()
  assert.equal(result, 'infogrupo 4')
  const text = calls.replies[0]
  assert.ok(text.includes('Familia'))
  assert.ok(text.includes('Miembros: *4*'))
  assert.ok(text.includes('admins: *3*'))
  assert.ok(text.includes('Descripción:'))
  assert.ok(text.includes('@59891111111'))
})
