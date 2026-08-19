/* =============================================================================
   Kubikar · pruebas del uso de una pieza
   -----------------------------------------------------------------------------
   El uso de una pieza decide en qué parámetros se ofrece el material. Lo que se
   fija acá es lo que le pasa a una biblioteca guardada ANTES de que el campo
   existiera: tiene que entrar completa y seguir apareciendo en todos los
   selectores. Si esto se rompe, al usuario se le vacían los desplegables sin
   explicación y su proyecto queda sin materiales.
   ========================================================================== */

import test from 'node:test'
import assert from 'node:assert/strict'

import { USOS_PIEZA, USO_PIEZA_POR_DEFECTO, normalizarMaterial } from '../src/data/schema.js'
import { completarParametros, materialesDe } from '../src/modules/registry.js'
import { cielo } from '../src/modules/cielo.js'

/* -----------------------------------------------------------------------------
   Migración
   -------------------------------------------------------------------------- */

test('una pieza sin uso entra como comodín, no como error', () => {
  const material = normalizarMaterial({ tipo: 'pieza', nombre: 'Tornillo viejo' })
  assert.equal(material.uso, USO_PIEZA_POR_DEFECTO)
})

test('un uso desconocido cae al comodín en vez de esconder el material', () => {
  const material = normalizarMaterial({ tipo: 'pieza', nombre: 'Clavo', uso: 'inventado' })
  assert.equal(material.uso, USO_PIEZA_POR_DEFECTO)
})

test('el uso declarado se conserva tal cual', () => {
  for (const uso of USOS_PIEZA) {
    assert.equal(normalizarMaterial({ tipo: 'pieza', nombre: 'X', uso }).uso, uso)
  }
})

test('solo las piezas llevan uso: plancha y barra van en null', () => {
  assert.equal(normalizarMaterial({ tipo: 'plancha', uso: 'colgante' }).uso, null)
  assert.equal(normalizarMaterial({ tipo: 'barra', uso: 'colgante' }).uso, null)
})

test('el antiguo campo consumo se ignora sin romper la lectura del archivo', () => {
  const material = normalizarMaterial({ tipo: 'pieza', nombre: 'Tornillo', consumo: 'por_ml' })
  assert.equal(material.uso, USO_PIEZA_POR_DEFECTO)
  assert.equal(material.consumo, undefined)
})

/* -----------------------------------------------------------------------------
   Filtro del selector
   -------------------------------------------------------------------------- */

const BIBLIOTECA = [
  { id: 'p1', tipo: 'plancha', nombre: 'Plancha' },
  { id: 't1', tipo: 'pieza', nombre: 'Punta fina', uso: 'fijacion_plancha' },
  { id: 't2', tipo: 'pieza', nombre: 'Punta broca', uso: 'fijacion_metal' },
  { id: 'a1', tipo: 'pieza', nombre: 'Alambre', uso: 'colgante' },
  { id: 'v1', tipo: 'pieza', nombre: 'Pieza vieja', uso: 'general' },
  { id: 'v2', tipo: 'pieza', nombre: 'Pieza sin campo' },
]

/** @param {Object[]} lista */
function ids(lista) {
  return lista.map((m) => m.id)
}

test('sin uso declarado el parámetro ofrece todo su tipo', () => {
  const encontrados = materialesDe({ tipo: 'material', materialTipo: 'pieza' }, BIBLIOTECA)
  assert.deepEqual(ids(encontrados), ['t1', 't2', 'a1', 'v1', 'v2'])
})

test('con uso declarado el parámetro ofrece solo lo que calza, más los comodines', () => {
  const encontrados = materialesDe(
    { tipo: 'material', materialTipo: 'pieza', materialUso: 'fijacion_metal' },
    BIBLIOTECA,
  )
  // El punta broca porque calza; los dos comodines porque calzan con todo. El
  // alambre y el punta fina quedan fuera, que es el punto del filtro.
  assert.deepEqual(ids(encontrados), ['t2', 'v1', 'v2'])
})

test('el filtro por uso no cruza el tipo de material', () => {
  const encontrados = materialesDe(
    { tipo: 'material', materialTipo: 'plancha', materialUso: 'fijacion_plancha' },
    BIBLIOTECA,
  )
  assert.deepEqual(ids(encontrados), [])
})

test('el filtro tolera basura sin lanzar', () => {
  assert.deepEqual(materialesDe(null, BIBLIOTECA), [])
  assert.deepEqual(materialesDe({ tipo: 'numero' }, BIBLIOTECA), [])
  assert.deepEqual(materialesDe({ tipo: 'material', materialTipo: 'pieza' }, null), [])
})

/* -----------------------------------------------------------------------------
   Parámetros de un recinto guardado
   -----------------------------------------------------------------------------
   Un recinto guarda los parámetros del día que se cubicó. Si al abrirlo no se
   completan contra el esquema vigente, un booleano ausente se lee como falso y
   la línea se cae del listado sin decir nada.
   -------------------------------------------------------------------------- */

test('un recinto viejo recupera los parámetros que el módulo sumó después', () => {
  // Exactamente lo que quedó guardado antes de partir el tornillo en dos.
  const guardados = {
    planchaId: 'p1',
    separacionCm: 40,
    tornillosActivo: true,
    tornillosId: 't1',
    tornillosPorM2: 15,
  }
  const completos = completarParametros(cielo, guardados, BIBLIOTECA)

  // Las dos líneas de tornillo vuelven encendidas, con su material y su medida.
  assert.equal(completos.tornillosPlanchaActivo, true)
  assert.equal(completos.tornillosPlanchaSeparacionCm, 20)
  assert.equal(completos.tornillosPlanchaId, 't1')
  assert.equal(completos.tornillosMetalActivo, true)
  assert.equal(completos.tornillosMetalPorEncuentro, 2)
  assert.equal(completos.tornillosMetalId, 't2')
})

test('completar no pisa ninguna decisión ya guardada', () => {
  const guardados = { separacionCm: 60, perimetralActivo: false, colgantesPorM2: 3 }
  const completos = completarParametros(cielo, guardados, BIBLIOTECA)
  assert.equal(completos.separacionCm, 60)
  assert.equal(completos.perimetralActivo, false)
  assert.equal(completos.colgantesPorM2, 3)
})

test('sin nada que completar se devuelve el mismo objeto, no una copia', () => {
  const completos = completarParametros(cielo, {}, BIBLIOTECA)
  assert.equal(completarParametros(cielo, completos, BIBLIOTECA), completos)
})

test('completar tolera un módulo ausente y parámetros basura', () => {
  assert.deepEqual(completarParametros(null, null, BIBLIOTECA), {})
  assert.deepEqual(completarParametros(null, { a: 1 }, null), { a: 1 })
})
