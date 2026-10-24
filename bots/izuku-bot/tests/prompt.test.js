import test from 'node:test'
import assert from 'node:assert/strict'
import { isInteractive } from '../src/lib/prompt.js'

// La consola embebida de la terminal no es una TTY real (usa pipes), pero
// el usuario SÍ puede escribir ahí: IZUKU_CONSOLE=1 la marca interactiva
// para que el bot pregunte el número de pairing por la consola misma.
test('IZUKU_CONSOLE=1 marca la consola como interactiva', () => {
  const prev = process.env.IZUKU_CONSOLE
  process.env.IZUKU_CONSOLE = '1'
  try {
    assert.equal(isInteractive(), true)
  } finally {
    if (prev === undefined) delete process.env.IZUKU_CONSOLE
    else process.env.IZUKU_CONSOLE = prev
  }
})

test('sin TTY ni IZUKU_CONSOLE no es interactivo', () => {
  if (process.stdin.isTTY && process.stdout.isTTY) return // en una terminal real sí lo es
  const prev = process.env.IZUKU_CONSOLE
  delete process.env.IZUKU_CONSOLE
  try {
    assert.equal(isInteractive(), false)
  } finally {
    if (prev !== undefined) process.env.IZUKU_CONSOLE = prev
  }
})
