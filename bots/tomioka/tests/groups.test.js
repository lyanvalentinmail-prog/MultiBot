import test from 'node:test'
import assert from 'node:assert/strict'
import {
  adminJids,
  digitsOf,
  fetchParticipants,
  isAdmin,
  isGroupJid,
  isParticipant,
  isParticipantAdmin,
  mentionOf,
  requireBotAdmin,
  requireSenderAdmin,
  resolveTargetJid
} from '../../../lib/wa/groups.js'

const BOT = '59890000000@s.whatsapp.net'
const ADMIN = '59891111111@s.whatsapp.net'
const USER = '59892222222@s.whatsapp.net'

const parts = [
  { id: BOT, admin: 'admin' },
  { id: ADMIN, admin: 'superadmin' },
  { id: USER },
  { id: '59893333333:12@s.whatsapp.net', admin: 'admin' }
]

test('digitsOf normaliza JIDs y LIDs', () => {
  assert.equal(digitsOf('59891111111@s.whatsapp.net'), '59891111111')
  assert.equal(digitsOf('59891111111:12@s.whatsapp.net'), '59891111111')
  assert.equal(digitsOf('12345@lid'), '12345')
  assert.equal(digitsOf(''), '')
})

test('isGroupJid detecta grupos', () => {
  assert.equal(isGroupJid('120363000@g.us'), true)
  assert.equal(isGroupJid('59891111111@s.whatsapp.net'), false)
})

test('admins por rol y por dígitos (cubre @lid)', () => {
  assert.equal(isParticipantAdmin({ admin: 'admin' }), true)
  assert.equal(isParticipantAdmin({ admin: 'superadmin' }), true)
  assert.equal(isParticipantAdmin({}), false)
  assert.deepEqual(adminJids(parts).length, 3)
  assert.equal(isAdmin(parts, ADMIN), true)
  assert.equal(isAdmin(parts, '59891111111@lid'), true)
  assert.equal(isAdmin(parts, USER), false)
  assert.equal(isParticipant(parts, USER), true)
  assert.equal(isParticipant(parts, '59890000001@s.whatsapp.net'), false)
})

test('resolveTargetJid: mención > citado > número', () => {
  assert.equal(resolveTargetJid({ mentions: [USER], quotedParticipant: ADMIN, argsText: '59890000001' }), USER)
  assert.equal(resolveTargetJid({ mentions: [], quotedParticipant: ADMIN, argsText: '1' }), ADMIN)
  assert.equal(resolveTargetJid({ argsText: '59899123456' }), '59899123456@s.whatsapp.net')
  assert.equal(resolveTargetJid({ argsText: 'hola' }), null)
  assert.equal(resolveTargetJid({ argsText: '123' }), null)
  assert.equal(mentionOf(ADMIN), '@59891111111')
})

test('requireSenderAdmin/requireBotAdmin lanzan errores claros', () => {
  assert.throws(() => requireSenderAdmin({ participants: parts, senderJid: USER }), /administradores/)
  requireSenderAdmin({ participants: parts, senderJid: ADMIN })
  requireSenderAdmin({ participants: parts, senderJid: USER, isOwner: true })
  assert.throws(() => requireBotAdmin({ participants: parts, botJid: USER }), /ser admin/)
  requireBotAdmin({ participants: parts, botJid: BOT })
})

test('fetchParticipants exige grupo y lista válida', async () => {
  const sock = { groupMetadata: async () => ({ subject: 'G', participants: parts }) }
  const { participants } = await fetchParticipants(sock, '120363000@g.us')
  assert.equal(participants.length, 4)

  await assert.rejects(fetchParticipants(sock, '59891111111@s.whatsapp.net'), /solo funciona en grupos/)
  const empty = { groupMetadata: async () => ({}) }
  await assert.rejects(fetchParticipants(empty, '120363000@g.us'), /lista del grupo/)
})
