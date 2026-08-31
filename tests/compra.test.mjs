/* =============================================================================
   Kubikar · pruebas del escalón de compra
   -----------------------------------------------------------------------------
   Dos cosas se fijan acá, y la segunda es la que importa en terreno.

   La primera es la aritmética del escalón: siempre hacia arriba, con una compra
   chica abajo y un paso fijo por sobre ella.

   La segunda es DÓNDE se aplica. El escalón es del proyecto, no del recinto:
   tres recintos de 18 tornillos son 54 tornillos y una sola visita a la
   ferretería, así que se piden 100. Aplicarlo en cada recinto daría 50 + 50 + 50
   = 150, que es material comprado de más por redondear tres veces lo que se
   compra una. Esa es la regresión que estas pruebas existen para impedir.
   ========================================================================== */

import test from 'node:test'
import assert from 'node:assert/strict'

import { aplicarEscalon, elEscalonMueve, normalizarEscalon } from '../src/core/compra.js'
import { consolidarProyecto } from '../src/state/useConsolidado.js'

const TORNILLO = { minimo: 50, paso: 100 }

/* -----------------------------------------------------------------------------
   La aritmética
   -------------------------------------------------------------------------- */

test('bajo la compra chica se lleva la compra chica', () => {
  assert.equal(aplicarEscalon(1, TORNILLO), 50)
  assert.equal(aplicarEscalon(28, TORNILLO), 50)
  assert.equal(aplicarEscalon(49, TORNILLO), 50)
})

test('desde la compra chica se sube al paso siguiente', () => {
  // Los casos que pidió el usuario, uno por uno.
  assert.equal(aplicarEscalon(50, TORNILLO), 100)
  assert.equal(aplicarEscalon(65, TORNILLO), 100)
  assert.equal(aplicarEscalon(101, TORNILLO), 200)
  assert.equal(aplicarEscalon(358, TORNILLO), 400)
  assert.equal(aplicarEscalon(1150, TORNILLO), 1200)
})

test('el múltiplo exacto no gasta un escalón de más', () => {
  // Subir 100 a 200 sería regalar cien unidades por un redondeo que no tenía
  // nada que redondear.
  assert.equal(aplicarEscalon(100, TORNILLO), 100)
  assert.equal(aplicarEscalon(400, TORNILLO), 400)
  assert.equal(elEscalonMueve(100, TORNILLO), false)
  assert.equal(elEscalonMueve(101, TORNILLO), true)
})

test('el ruido de coma flotante no dispara una centena entera', () => {
  // 99,999999… sumado a punta de floats es 100, no 101. Sin el microlímite esto
  // devolvería 200 y la lista de compra pediría el doble.
  assert.equal(aplicarEscalon(99.9999999, TORNILLO), 100)
  // Pero una diferencia de verdad sí sube: 100,5 no cabe en 100.
  assert.equal(aplicarEscalon(100.5, TORNILLO), 200)
})

test('sin escalón declarado la cantidad pasa intacta', () => {
  // Es el caso de casi todas las líneas: una plancha se compra por unidad.
  for (const sinEscalon of [null, undefined, {}, { paso: 0 }, { paso: -100 }, 'basura', 7]) {
    assert.equal(aplicarEscalon(37, sinEscalon), 37)
  }
})

test('un escalón sin mínimo sube desde el primero', () => {
  // Hay materiales que se piden de a cien sin compra chica. El mínimo ausente es
  // legítimo y vale 0, no un valor inventado.
  assert.deepEqual(normalizarEscalon({ paso: 100 }), { minimo: 0, paso: 100 })
  assert.equal(aplicarEscalon(1, { paso: 100 }), 100)
})

test('el escalón nunca lanza ni devuelve basura', () => {
  assert.equal(aplicarEscalon(0, TORNILLO), 0)
  assert.equal(aplicarEscalon(-5, TORNILLO), -5)
  assert.equal(aplicarEscalon('no es número', TORNILLO), 0)
  assert.equal(aplicarEscalon(Number.NaN, TORNILLO), 0)
  assert.equal(aplicarEscalon(Number.POSITIVE_INFINITY, TORNILLO), 0)
  assert.equal(normalizarEscalon(null), null)
})

/* -----------------------------------------------------------------------------
   Dónde se aplica: el proyecto, no el recinto
   -------------------------------------------------------------------------- */

const PUNTA_BROCA = {
  id: 'mat-punta-broca',
  tipo: 'pieza',
  nombre: 'Tornillo punta broca cabeza lenteja 8 × ½"',
  uso: 'fijacion_metal',
  precioUnitario: null,
}

const OMEGA = {
  id: 'mat-omega',
  tipo: 'barra',
  nombre: 'Perfil Omega 38 × 3000 mm',
  largoBarraMm: 3000,
  traslapoMm: 150,
  retazoMinimoMm: 500,
  precioUnitario: null,
}

/**
 * Recinto de 2,00 × 1,00 m con ejes cada 40 cm: 3 corridas de 2,00 m. Solo se
 * enciende el tornillo metal-metal, que se cuenta con aritmética entera
 * —3 corridas × 2 extremos × 3 un = 18 un— para que la prueba mida el escalón y
 * no el redondeo de una división.
 *
 * @param {string} id
 * @param {string} nombre
 */
function recintoDe18Tornillos(id, nombre) {
  return {
    id,
    nombre,
    moduloId: 'cielo',
    cerrado: true,
    verticesMm: [
      { id: `${id}-a`, x: 0, y: 0 },
      { id: `${id}-b`, x: 2000, y: 0 },
      { id: `${id}-c`, x: 2000, y: 1000 },
      { id: `${id}-d`, x: 0, y: 1000 },
    ],
    parametros: {
      planchaId: null,
      perfilId: OMEGA.id,
      separacionCm: 40,
      perfilDireccion: 'x',
      perfilDesperdicio: 0,
      perimetralActivo: false,
      tornillosPlanchaActivo: false,
      tornillosMetalActivo: true,
      tornillosMetalId: PUNTA_BROCA.id,
      tornillosMetalPorEncuentro: 3,
      colgantesActivo: false,
      descuentoM2: 0,
    },
  }
}

/**
 * @param {number} cuantos
 * @param {Array} [biblioteca]
 */
function proyectoDe(cuantos, biblioteca = [OMEGA, PUNTA_BROCA]) {
  const recintos = []
  for (let i = 0; i < cuantos; i += 1) {
    recintos.push(recintoDe18Tornillos(`r${i}`, `Recinto ${i + 1}`))
  }
  return consolidarProyecto({ id: 'p1', nombre: 'Proyecto', recintos }, biblioteca)
}

/**
 * @param {Object} consolidado
 * @param {string} materialId
 */
function grupo(consolidado, materialId) {
  const hallado = consolidado.grupos.find((g) => g.materialId === materialId)
  assert.ok(hallado, `no se encontró el grupo de ${materialId} en el consolidado`)
  return hallado
}

test('el recinto solo aporta su cantidad exacta', () => {
  const tornillos = grupo(proyectoDe(1), PUNTA_BROCA.id)
  assert.equal(tornillos.detalle.length, 1)
  // 3 corridas × 2 extremos × 3 un. Lo que se instala en esa pieza, sin redondear.
  assert.equal(tornillos.detalle[0].cantidadFinal, 18)
  assert.equal(tornillos.cantidadSumada, 18)
  // Y la lista de compra sí redondea: 18 un no se piden en el mesón.
  assert.equal(tornillos.cantidadFinal, 50)
})

test('tres recintos suman 54 y se compran 100, no 150', () => {
  // Es el caso que motivó el cambio. Redondear en cada recinto daría
  // 50 + 50 + 50 = 150 tornillos para una obra que ocupa 54.
  const tornillos = grupo(proyectoDe(3), PUNTA_BROCA.id)
  assert.deepEqual(
    tornillos.detalle.map((a) => a.cantidadFinal),
    [18, 18, 18],
  )
  assert.equal(tornillos.cantidadSumada, 54)
  assert.equal(tornillos.cantidadFinal, 100)
  assert.notEqual(tornillos.cantidadFinal, 150)
})

test('el escalón viaja desde la línea del módulo hasta el grupo', () => {
  // La lista de compra no sabe qué es un tornillo: aplica lo que la línea declara.
  assert.deepEqual(grupo(proyectoDe(3), PUNTA_BROCA.id).compra, { minimo: 50, paso: 100 })
})

test('el material sin escalón se suma y no se redondea', () => {
  // El omega se compra por barra: 3 corridas de 2,00 m por recinto, y la suma es
  // la suma. Si el escalón se aplicara a todo, la lista pediría 100 barras.
  const perfil = grupo(proyectoDe(3), OMEGA.id)
  assert.equal(perfil.compra, null)
  assert.equal(perfil.cantidadFinal, perfil.cantidadSumada)
  assert.ok(perfil.cantidadFinal > 0 && perfil.cantidadFinal < 50)
})

test('el costo se cobra sobre lo que se compra, no sobre lo que se instala', () => {
  // Si la fila pide 100 un, la boleta dice 100 un. Sumar los subtotales de cada
  // recinto dejaría el total bajo la cantidad de la fila de al lado, que es la
  // clase de diferencia que aparece cuando ya se pagó.
  const conPrecio = [OMEGA, { ...PUNTA_BROCA, precioUnitario: 12 }]
  const tornillos = grupo(proyectoDe(3, conPrecio), PUNTA_BROCA.id)
  assert.equal(tornillos.cantidadFinal, 100)
  assert.equal(tornillos.subtotal, 100 * 12)
})
