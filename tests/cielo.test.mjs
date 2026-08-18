/* =============================================================================
   Kubikar · pruebas del módulo Cielo
   -----------------------------------------------------------------------------
   Fijan que la cubicación sale de la planta y no de una división del área, y que
   el número que se compra coincide con la retícula que el lienzo dibuja.

   Recinto de referencia: 4,00 × 2,60 m, perfiles cada 40 cm corriendo en X,
   omega de 3 m y plancha de 1,20 × 2,40 m. Es el caso que en obra quedaba corto.
   ========================================================================== */

import test from 'node:test'
import assert from 'node:assert/strict'

import { calcular, trazar } from '../src/modules/cielo.js'
import { areaMm2, boundingBox, perimetroMm } from '../src/core/geometry.js'

const OMEGA = {
  id: 'mat-omega',
  tipo: 'barra',
  nombre: 'Perfil Omega 38 × 3000 mm',
  largoBarraMm: 3000,
  traslapoMm: 150,
  retazoMinimoMm: 500,
  precioUnitario: null,
}

const ANGULO = {
  id: 'mat-angulo',
  tipo: 'barra',
  nombre: 'Ángulo perimetral 25 × 25 × 3000 mm',
  largoBarraMm: 3000,
  traslapoMm: 0,
  retazoMinimoMm: 500,
  precioUnitario: null,
}

const PLANCHA = {
  id: 'mat-plancha',
  tipo: 'plancha',
  nombre: 'Plancha de yeso-cartón 1200 × 2400 mm',
  anchoMm: 1200,
  largoMm: 2400,
  traslapoMm: 0,
  precioUnitario: null,
}

const BIBLIOTECA = [OMEGA, ANGULO, PLANCHA]

/**
 * Contexto de cálculo de un rectángulo con origen en (0,0).
 * @param {number} anchoMm
 * @param {number} altoMm
 * @param {Object} [parametros]
 */
function contextoRectangulo(anchoMm, altoMm, parametros = {}) {
  const vertices = [
    { id: 'a', x: 0, y: 0 },
    { id: 'b', x: anchoMm, y: 0 },
    { id: 'c', x: anchoMm, y: altoMm },
    { id: 'd', x: 0, y: altoMm },
  ]
  return {
    geometria: {
      vertices,
      cerrado: true,
      areaMm2: areaMm2(vertices),
      perimetroMm: perimetroMm(vertices, true),
      bbox: boundingBox(vertices),
      autoIntersectante: false,
    },
    parametros: {
      planchaId: PLANCHA.id,
      planchaDesperdicio: 8,
      perfilId: OMEGA.id,
      separacionCm: 40,
      perfilDireccion: 'x',
      perfilDesperdicio: 5,
      perimetralActivo: true,
      perimetralId: ANGULO.id,
      perimetralDesperdicio: 5,
      tornillosActivo: false,
      colgantesActivo: false,
      descuentoM2: 0,
      ...parametros,
    },
    biblioteca: BIBLIOTECA,
  }
}

/** @param {{lineas:Array}} resultado @param {string} clave */
function linea(resultado, clave) {
  const encontrada = resultado.lineas.find((l) => l.clave === clave)
  assert.ok(encontrada, `falta la línea ${clave}`)
  return encontrada
}

/* -----------------------------------------------------------------------------
   Perfilería
   -------------------------------------------------------------------------- */

test('el perfil se cubica por corridas reales, no por área dividida', () => {
  const resultado = calcular(contextoRectangulo(4000, 2600))
  const perfil = linea(resultado, 'cielo.perfil')

  // 7 ejes cada 40 cm sobre 2,60 m de travesía, cada uno con una corrida de
  // 4,00 m. Cada corrida se empalma en 3000 + 1150 y el reparto pide 11 barras.
  assert.equal(perfil.cantidadTeorica, 11)
  assert.equal(perfil.cantidadFinal, 12)

  // El método por área daba 10,40 m² ÷ 0,40 = 26 ml ÷ 3 = 8,67 → 10 unidades.
  assert.ok(perfil.cantidadFinal > 10)
})

test('la nota del perfil deja ver las corridas, la barra y el retazo', () => {
  const perfil = linea(calcular(contextoRectangulo(4000, 2600)), 'cielo.perfil')
  assert.match(perfil.nota, /7 corridas/)
  assert.match(perfil.nota, /3,00 m/)
  assert.match(perfil.nota, /retazo mínimo 0,50 m/)
  assert.match(perfil.nota, /12 un$/)
})

test('un eje que cae justo sobre el muro opuesto igual entrega su corrida', () => {
  // 2400 de travesía con ejes cada 400: el séptimo eje cae exactamente en 2400,
  // que es el borde donde el recorte por paridad no devuelve nada. El módulo lo
  // desplaza 1 mm hacia adentro; sin eso se perdería una corrida entera.
  const resultado = calcular(contextoRectangulo(4000, 2400))
  const perfil = linea(resultado, 'cielo.perfil')
  assert.match(perfil.nota, /7 corridas/)
})

test('el perimetral se cubica con los lados reales del polígono', () => {
  const perimetral = linea(calcular(contextoRectangulo(4000, 2600)), 'cielo.perimetral')
  // Lados de 4,00 (empalmado en 3000 + 1000) y de 2,60: 5 barras.
  assert.equal(perimetral.cantidadTeorica, 5)
  assert.equal(perimetral.cantidadFinal, 6)
  assert.match(perimetral.nota, /4 lados/)
})

test('el traslapo de empalme aparece en la nota solo si es mayor que 0', () => {
  const resultado = calcular(contextoRectangulo(4000, 2600))
  // El omega empalma con 15 cm de encaje.
  assert.match(linea(resultado, 'cielo.perfil').nota, /empalmes de 0,15 m/)
  // El ángulo se une a tope: escribir "de 0,00 m" sería ruido.
  assert.doesNotMatch(linea(resultado, 'cielo.perimetral').nota, /empalmes/)
})

/* -----------------------------------------------------------------------------
   Planchas
   -------------------------------------------------------------------------- */

test('la plancha se cubica contando posiciones de la retícula', () => {
  const plancha = linea(calcular(contextoRectangulo(4000, 2600)), 'cielo.plancha')
  // Retícula de 4 columnas × 2 filas; las 8 posiciones tocan la planta.
  assert.equal(plancha.cantidadTeorica, 8)
  assert.equal(plancha.cantidadFinal, 9)
  assert.match(plancha.nota, /4 × 2/)
})

test('el conteo de planchas es exactamente lo que dibuja el despiece', () => {
  const ctx = contextoRectangulo(4000, 2600)
  const plancha = linea(calcular(ctx), 'cielo.plancha')
  const capa = trazar(ctx).find((c) => c.clave === 'cielo.plancha')
  assert.ok(capa, 'falta la capa de planchas')
  assert.equal(capa.rectangulos.length, plancha.cantidadTeorica)
})

test('las posiciones que no tocan la planta no se cuentan ni se dibujan', () => {
  // U con la boca hacia arriba: el hueco de 3,40 × 2,50 m no lleva cielo, y es
  // lo bastante grande para tragarse una posición entera de la retícula. Sus
  // bordes no caen sobre la grilla a propósito: un hueco que coincide justo con
  // una posición es una coincidencia de medida nula, no el caso a probar.
  const vertices = [
    { id: 'a', x: 0, y: 0 },
    { id: 'b', x: 1300, y: 0 },
    { id: 'c', x: 1300, y: 2500 },
    { id: 'd', x: 4700, y: 2500 },
    { id: 'e', x: 4700, y: 0 },
    { id: 'f', x: 6000, y: 0 },
    { id: 'g', x: 6000, y: 4800 },
    { id: 'h', x: 0, y: 4800 },
  ]
  const ctx = {
    geometria: {
      vertices,
      cerrado: true,
      areaMm2: areaMm2(vertices),
      perimetroMm: perimetroMm(vertices, true),
      bbox: boundingBox(vertices),
      autoIntersectante: false,
    },
    parametros: {
      planchaId: PLANCHA.id,
      planchaDesperdicio: 0,
      perfilId: OMEGA.id,
      separacionCm: 40,
      perfilDireccion: 'x',
      perfilDesperdicio: 0,
      perimetralActivo: false,
      tornillosActivo: false,
      colgantesActivo: false,
      descuentoM2: 0,
    },
    biblioteca: BIBLIOTECA,
  }

  const plancha = linea(calcular(ctx), 'cielo.plancha')
  // Retícula de 5 × 2 = 10 posiciones; la tercera de la fila de arriba cae
  // entera dentro del hueco y queda fuera del conteo.
  assert.equal(plancha.cantidadTeorica, 9)
  assert.match(plancha.nota, /9 de 10 posiciones/)

  const capa = trazar(ctx).find((c) => c.clave === 'cielo.plancha')
  assert.equal(capa.rectangulos.length, 9)
})

/* -----------------------------------------------------------------------------
   Robustez del contrato
   -------------------------------------------------------------------------- */

test('el módulo nunca lanza con contexto basura', () => {
  for (const basura of [undefined, null, {}, { geometria: null }, { geometria: {}, parametros: 1 }]) {
    assert.doesNotThrow(() => calcular(basura))
    assert.doesNotThrow(() => trazar(basura))
  }
  assert.equal(calcular(null).calculable, false)
  assert.deepEqual(trazar(null), [])
})

test('un perfil con traslapo mayor que su barra se declara, no se cubica mal', () => {
  const ctx = contextoRectangulo(4000, 2600)
  ctx.biblioteca = [
    { ...OMEGA, traslapoMm: 4000 },
    ANGULO,
    PLANCHA,
  ]
  const resultado = calcular(ctx)
  assert.equal(
    resultado.lineas.some((l) => l.clave === 'cielo.perfil'),
    false,
  )
  assert.ok(
    resultado.avisos.some((a) => a.nivel === 'error' && /traslapo/i.test(a.mensaje)),
    'falta el aviso que nombra el traslapo',
  )
})

test('sin descuento por vanos el área neta sigue mandando en los accesorios', () => {
  const ctx = contextoRectangulo(4000, 2600, {
    tornillosActivo: true,
    tornillosId: 'mat-tornillo',
    tornillosPorM2: 15,
  })
  ctx.biblioteca = [
    ...BIBLIOTECA,
    { id: 'mat-tornillo', tipo: 'pieza', nombre: 'Tornillo', precioUnitario: null },
  ]
  const tornillos = linea(calcular(ctx), 'cielo.tornillos')
  // 10,40 m² × 15 = 156 unidades: los accesorios no cambian con este trabajo.
  assert.equal(tornillos.cantidadFinal, 156)
})
