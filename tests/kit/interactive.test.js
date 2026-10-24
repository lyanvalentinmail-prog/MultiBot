import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BUTTON_LAYOUT,
  DEFAULT_MENU_BUTTONS,
  buildButtonsContent,
  normalizeButtons,
  readButtonSelection,
  readMenuButtons,
  resolveMenuButtons,
  sendButtonsMessage
} from '../../lib/wa/interactive.js'

test('el menú con botones trae Menu y Perfil por defecto', () => {
  const botones = resolveMenuButtons({})
  assert.equal(botones.enabled, true)
  assert.equal(botones.layout, BUTTON_LAYOUT.HORIZONTAL)
  assert.deepEqual(botones.options, [
    { id: 'menu', label: 'Menu' },
    { id: 'perfil', label: 'Perfil' }
  ])
  assert.deepEqual(DEFAULT_MENU_BUTTONS.map((b) => b.id), ['menu', 'perfil'])
})

test('el interruptor y el diseño se leen de la config del bot', () => {
  const apagado = resolveMenuButtons({ enabled: false })
  assert.equal(apagado.enabled, false)

  const vertical = resolveMenuButtons({ layout: 'vertical' })
  assert.equal(vertical.layout, BUTTON_LAYOUT.VERTICAL)

  // Cualquier diseño que no sea "vertical" es horizontal.
  assert.equal(resolveMenuButtons({ layout: 'raro' }).layout, BUTTON_LAYOUT.HORIZONTAL)
})

test('la llave vieja (menu.listMode) sigue mandando si no hay buttons.enabled', () => {
  assert.equal(resolveMenuButtons({ listMode: false }).enabled, false)
  assert.equal(resolveMenuButtons({ listMode: true }).enabled, true)
  // Si viene la nueva, la nueva gana.
  assert.equal(resolveMenuButtons({ listMode: false, enabled: true }).enabled, true)
})

test('readMenuButtons lee config.menu.buttons y acepta la llave vieja', () => {
  const nuevo = readMenuButtons({ menu: { buttons: { enabled: false, layout: 'vertical' } } })
  assert.equal(nuevo.enabled, false)
  assert.equal(nuevo.layout, BUTTON_LAYOUT.VERTICAL)

  const viejo = readMenuButtons({ menu: { listMode: false } })
  assert.equal(viejo.enabled, false)

  const porDefecto = readMenuButtons({})
  assert.equal(porDefecto.enabled, true)
})

test('los botones se limpian: ids únicos, etiquetas y sin vacíos', () => {
  const botones = normalizeButtons([
    { id: 'menu', label: 'Menu' },
    { id: 'MENU', label: 'Repetido' },
    { id: '', label: 'Sin id' },
    { id: 'perfil', label: '' },
    { id: 'perfil', label: 'Perfil' },
    null,
    'texto'
  ])
  assert.deepEqual(botones, [
    { id: 'menu', label: 'Menu' },
    { id: 'perfil', label: 'Perfil' }
  ])
})

test('buildButtonsContent arma buttonsMessage en horizontal y templateMessage en vertical', () => {
  const horizontal = buildButtonsContent({
    text: 'Hola',
    footer: 'Pie',
    buttons: [{ id: 'menu', label: 'Menu' }, { id: 'perfil', label: 'Perfil' }]
  })
  assert.equal(horizontal.text, 'Hola')
  assert.equal(horizontal.footer, 'Pie')
  assert.deepEqual(horizontal.buttons, [
    { id: 'menu', text: 'Menu' },
    { id: 'perfil', text: 'Perfil' }
  ])
  assert.equal(horizontal.templateButtons, undefined)

  const vertical = buildButtonsContent({
    text: 'Hola',
    buttons: [{ id: 'menu', label: 'Menu' }],
    layout: BUTTON_LAYOUT.VERTICAL
  })
  assert.deepEqual(vertical.templateButtons, [{ id: 'menu', text: 'Menu' }])
  assert.equal(vertical.buttons, undefined)
})

test('readButtonSelection lee el botón tocado (horizontal, vertical y nativo)', () => {
  const horizontal = {
    message: { buttonsResponseMessage: { selectedButtonId: 'perfil', selectedDisplayText: 'Perfil' } }
  }
  assert.deepEqual(readButtonSelection(horizontal), { id: 'perfil', label: 'Perfil' })

  const vertical = {
    message: { templateButtonReplyMessage: { selectedId: 'menu', selectedDisplayText: 'Menu' } }
  }
  assert.deepEqual(readButtonSelection(vertical), { id: 'menu', label: 'Menu' })

  const nativo = {
    message: {
      interactiveResponseMessage: {
        nativeFlowResponseMessage: { paramsJson: JSON.stringify({ id: 'menu', title: 'Menu' }) }
      }
    }
  }
  assert.deepEqual(readButtonSelection(nativo), { id: 'menu', label: 'Menu' })

  assert.equal(readButtonSelection({ message: { conversation: 'hola' } }), null)
  assert.equal(readButtonSelection(null), null)
})

test('sendButtonsMessage sin socket con relay cae al texto plano', async () => {
  const enviados = []
  const sock = {
    async sendMessage(jid, content, options) {
      enviados.push({ jid, content, options })
      return { key: { id: 'texto-1' } }
    }
  }
  const enviado = await sendButtonsMessage(sock, {
    chatJid: '59891111111@s.whatsapp.net',
    text: 'Hola',
    footer: 'Pie',
    buttons: [{ id: 'menu', label: 'Menu' }, { id: 'perfil', label: 'Perfil' }]
  })
  assert.ok(enviado)
  assert.equal(enviados.length, 1)
  assert.ok(enviados[0].content.text.includes('Hola'))
  assert.ok(enviados[0].content.text.includes('Menu'))
  assert.ok(enviados[0].content.text.includes('Perfil'))
})

test('sendButtonsMessage sin botones no manda nada', async () => {
  let llamadas = 0
  const sock = {
    async sendMessage() {
      llamadas += 1
      return {}
    }
  }
  const enviado = await sendButtonsMessage(sock, { chatJid: 'x', text: 'Hola', buttons: [] })
  assert.equal(enviado, null)
  assert.equal(llamadas, 0)
})
