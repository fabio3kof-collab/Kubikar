/**
 * Kubikar · archivos que entran y salen
 * -----------------------------------------------------------------------------
 * Lo que cubre esta prueba es el viaje de ida y vuelta: que un archivo guardado
 * por Kubikar se pueda volver a abrir con Kubikar. Es la única parte del
 * producto donde un error no se ve —el archivo se genera bien, se guarda bien y
 * el problema aparece semanas después, en otro computador, cuando ya no hay de
 * dónde recuperar el trabajo—.
 *
 * También fija los rechazos. Un archivo que Kubikar no entiende tiene que
 * rebotar con un motivo escrito en español, no abrirse a medias: media planta
 * cubicada es peor que ninguna, porque se ve completa.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  FORMATO,
  FORMATO_BIBLIOTECA,
  nuevoMaterial,
  nuevoProyecto,
  nuevoRecinto,
  validarBibliotecaImportada,
  validarProyectoImportado,
} from '../src/data/schema.js'
import {
  jsonDeBiblioteca,
  jsonDeProyecto,
  nombreArchivoJson,
  nombreArchivoJsonBiblioteca,
} from '../src/export/json.js'

/* =============================================================================
   Ayudantes
   ========================================================================== */

/** Material de prueba con nombre propio, para reconocerlo al otro lado. */
function material(tipo, nombre) {
  const m = nuevoMaterial(tipo)
  m.nombre = nombre
  return m
}

/** Proyecto de una sala rectangular con una línea de material cubicada. */
function proyectoDePrueba(plancha) {
  const proyecto = nuevoProyecto('Casa Los Aromos')
  const recinto = nuevoRecinto('Living')
  recinto.verticesMm = [
    { id: 'v1', x: 0, y: 0 },
    { id: 'v2', x: 4000, y: 0 },
    { id: 'v3', x: 4000, y: 3000 },
    { id: 'v4', x: 0, y: 3000 },
  ]
  recinto.cerrado = true
  recinto.areaMm2 = 12_000_000
  recinto.perimetroMm = 14_000
  recinto.parametros = { plancha: plancha.id }
  recinto.lineas = [
    {
      clave: 'plancha',
      nombre: plancha.nombre,
      materialId: plancha.id,
      unidad: 'un',
      cantidadTeorica: 3.33,
      desperdicioPct: 10,
      cantidadFinal: 4,
      nota: 'Área neta 12,00 m² / área útil 3,60 m²',
      precioUnitario: null,
      subtotal: null,
      codigoMaterial: null,
      partida: null,
    },
  ]
  proyecto.recintos = [recinto]
  return proyecto
}

/* =============================================================================
   Proyecto: ida y vuelta
   ========================================================================== */

test('el proyecto guardado se vuelve a abrir con su geometría intacta', () => {
  const plancha = material('plancha', 'Volcanita 15 · 1200 x 3000')
  const proyecto = proyectoDePrueba(plancha)

  const abierto = validarProyectoImportado(jsonDeProyecto(proyecto, [plancha]))

  assert.equal(abierto.ok, true)
  assert.equal(abierto.proyecto.nombre, 'Casa Los Aromos')
  assert.equal(abierto.proyecto.recintos.length, 1)

  const recinto = abierto.proyecto.recintos[0]
  assert.equal(recinto.cerrado, true)
  // La geometría viaja en milímetros y vuelve idéntica: ni redondeada ni
  // escalada por la unidad de lectura.
  assert.deepEqual(
    recinto.verticesMm.map((v) => [v.x, v.y]),
    [
      [0, 0],
      [4000, 0],
      [4000, 3000],
      [0, 3000],
    ],
  )
  assert.equal(recinto.lineas.length, 1)
  assert.equal(recinto.lineas[0].cantidadFinal, 4)
  assert.equal(recinto.lineas[0].materialId, plancha.id)
})

test('el archivo de proyecto lleva solo los materiales que el proyecto usa', () => {
  const plancha = material('plancha', 'Volcanita 15')
  const suelto = material('barra', 'Omega 38 que nadie usa')
  const proyecto = proyectoDePrueba(plancha)

  const abierto = validarProyectoImportado(jsonDeProyecto(proyecto, [plancha, suelto]))

  assert.equal(abierto.ok, true)
  assert.deepEqual(
    abierto.biblioteca.map((m) => m.nombre),
    ['Volcanita 15'],
  )
})

test('el proyecto sin recintos también se puede abrir', () => {
  const abierto = validarProyectoImportado(jsonDeProyecto(nuevoProyecto('Vacío'), []))
  assert.equal(abierto.ok, true)
  assert.deepEqual(abierto.proyecto.recintos, [])
})

/* =============================================================================
   Proyecto: lo que se rechaza
   ========================================================================== */

test('un JSON que no es de Kubikar se rechaza nombrando el formato esperado', () => {
  const fallo = validarProyectoImportado('{"cosa":1}')
  assert.equal(fallo.ok, false)
  assert.match(fallo.error, new RegExp(FORMATO))
})

test('un archivo que no es JSON se rechaza sin lanzar', () => {
  const fallo = validarProyectoImportado('esto no es json {')
  assert.equal(fallo.ok, false)
  assert.match(fallo.error, /JSON válido/)
})

test('un archivo de una versión futura se rechaza y pide actualizar', () => {
  const fallo = validarProyectoImportado(
    JSON.stringify({ formato: FORMATO, version: 99, proyecto: { recintos: [] } }),
  )
  assert.equal(fallo.ok, false)
  assert.match(fallo.error, /Actualiza Kubikar/)
})

test('un archivo en otra unidad base se rechaza antes de deformar las medidas', () => {
  const fallo = validarProyectoImportado(
    JSON.stringify({
      formato: FORMATO,
      version: 1,
      unidadBase: 'cm',
      proyecto: { recintos: [] },
    }),
  )
  assert.equal(fallo.ok, false)
  assert.match(fallo.error, /unidad base/)
})

/* =============================================================================
   Biblioteca: ida y vuelta
   ========================================================================== */

test('la biblioteca guardada viaja completa, no solo lo que un proyecto usa', () => {
  const lista = [
    material('plancha', 'Volcanita 15'),
    material('barra', 'Omega 38 x 3000'),
    material('pieza', 'Tornillo drywall 6 x 1"'),
  ]

  const abierta = validarBibliotecaImportada(jsonDeBiblioteca(lista))

  assert.equal(abierta.ok, true)
  assert.deepEqual(
    abierta.biblioteca.map((m) => m.nombre),
    ['Volcanita 15', 'Omega 38 x 3000', 'Tornillo drywall 6 x 1"'],
  )
})

test('la biblioteca conserva las medidas y el precio de cada material', () => {
  const barra = material('barra', 'Omega 38 x 6000')
  barra.largoBarraMm = 6000
  barra.retazoMinimoMm = 400
  barra.precioUnitario = 3290

  const abierta = validarBibliotecaImportada(jsonDeBiblioteca([barra]))

  assert.equal(abierta.ok, true)
  assert.equal(abierta.biblioteca[0].largoBarraMm, 6000)
  assert.equal(abierta.biblioteca[0].retazoMinimoMm, 400)
  assert.equal(abierta.biblioteca[0].precioUnitario, 3290)
})

test('abrir la biblioteca acepta también un archivo de proyecto', () => {
  const plancha = material('plancha', 'Volcanita 15')
  const proyecto = proyectoDePrueba(plancha)

  const abierta = validarBibliotecaImportada(jsonDeProyecto(proyecto, [plancha]))

  assert.equal(abierta.ok, true)
  assert.deepEqual(
    abierta.biblioteca.map((m) => m.nombre),
    ['Volcanita 15'],
  )
})

test('un archivo de biblioteca no se cuela como proyecto', () => {
  const fallo = validarProyectoImportado(jsonDeBiblioteca([material('plancha', 'Volcanita 15')]))
  assert.equal(fallo.ok, false)
  assert.match(fallo.error, new RegExp(FORMATO_BIBLIOTECA))
})

/* =============================================================================
   Nombres de archivo
   ========================================================================== */

test('los tres archivos escriben la fecha igual, para que se ordenen juntos', () => {
  const fecha = new Date(2026, 7, 31)
  const plancha = material('plancha', 'Volcanita 15')

  assert.equal(
    nombreArchivoJson(proyectoDePrueba(plancha), fecha),
    'kubikar-casa-los-aromos-2026-08-31.json',
  )
  assert.equal(nombreArchivoJsonBiblioteca(fecha), 'kubikar-biblioteca-2026-08-31.json')
})
