/* =============================================================================
   Kubikar · pruebas del reparto de barras
   -----------------------------------------------------------------------------
   La primera prueba es el caso que motivó todo el cambio: corridas de 2,6 m
   cortadas de barras de 3 m. El método por área daba 8,67 barras porque suponía
   que cada barra rinde entera; en terreno cada barra entrega una sola corrida y
   los 40 cm restantes son descarte.
   ========================================================================== */

import test from 'node:test'
import assert from 'node:assert/strict'

import { repartirBarras } from '../src/core/reparto.js'

/** Omega de 3 m: se empalma encajando 15 cm y bajo 50 cm el retazo es descarte. */
const OMEGA = { largoBarraMm: 3000, traslapoMm: 150, retazoMinimoMm: 500 }

test('el caso de terreno: 12 corridas de 2,6 m piden 12 barras de 3 m', () => {
  const r = repartirBarras(Array(12).fill(2600), OMEGA)
  assert.equal(r.barras, 12)
  assert.equal(r.empalmes, 0)
  assert.equal(r.mlPedidos, 31.2)
  // 12 retazos de 0,40 m que no vuelven al pozo.
  assert.equal(Math.round(r.mlDescartados * 100) / 100, 4.8)
  assert.deepEqual(r.grupos, [{ largoMm: 2600, veces: 12 }])
})

test('el retazo bajo el mínimo cierra la barra; con mínimo 0 se reutiliza', () => {
  const conDescarte = repartirBarras([2600, 400], OMEGA)
  assert.equal(conDescarte.barras, 2)

  const sinDescarte = repartirBarras([2600, 400], { ...OMEGA, retazoMinimoMm: 0 })
  assert.equal(sinDescarte.barras, 1)
  assert.equal(sinDescarte.mlDescartados, 0)
})

test('una corrida más larga que la barra se empalma consumiendo el traslapo', () => {
  // k = ceil((4500 − 150) / (3000 − 150)) = 2 → una barra entera más 1650 mm.
  const r = repartirBarras([4500], OMEGA)
  assert.equal(r.barras, 2)
  assert.equal(r.empalmes, 1)
  assert.equal(r.piezas, 2)
  // Los metros pedidos son los de la corrida, no los del material que la arma.
  assert.equal(r.mlPedidos, 4.5)
})

test('las piezas se acomodan de mayor a menor en las barras abiertas', () => {
  // 1800 abre barra y deja 1200 vivo; 900 entra ahí y deja 300, bajo el mínimo.
  const r = repartirBarras([1800, 900], OMEGA)
  assert.equal(r.barras, 1)
  assert.equal(Math.round(r.mlDescartados * 100) / 100, 0.3)
})

test('el orden de entrada no cambia el resultado', () => {
  const a = repartirBarras([900, 2600, 1800, 400], OMEGA)
  const b = repartirBarras([2600, 400, 1800, 900], OMEGA)
  assert.equal(a.barras, b.barras)
})

test('entrada inválida devuelve null y nunca lanza', () => {
  assert.equal(repartirBarras([1000], { ...OMEGA, largoBarraMm: 0 }), null)
  assert.equal(repartirBarras([1000], { ...OMEGA, traslapoMm: 3000 }), null)
  assert.equal(repartirBarras([1000], null), null)
  assert.equal(repartirBarras(null, OMEGA), null)
})

test('sin piezas el reparto es cero, no null', () => {
  const r = repartirBarras([], OMEGA)
  assert.equal(r.barras, 0)
  assert.equal(r.piezas, 0)
  assert.equal(r.mlPedidos, 0)
  assert.deepEqual(r.grupos, [])
})

test('las piezas de largo cero o basura se ignoran', () => {
  const r = repartirBarras([2600, 0, -100, NaN, null, '2600'], OMEGA)
  assert.equal(r.barras, 2)
  assert.equal(r.piezas, 2)
})

test('un retazo mínimo mayor que la barra se acota y nada se reutiliza', () => {
  const r = repartirBarras([1000, 1000], { ...OMEGA, retazoMinimoMm: 99999 })
  assert.equal(r.barras, 2)
})

test('los grupos resumen las corridas por largo, de mayor a menor', () => {
  const r = repartirBarras([900, 2600, 900, 1800, 2600, 2600], OMEGA)
  assert.deepEqual(r.grupos, [
    { largoMm: 2600, veces: 3 },
    { largoMm: 1800, veces: 1 },
    { largoMm: 900, veces: 2 },
  ])
})
