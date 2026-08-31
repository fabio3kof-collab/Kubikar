/* =============================================================================
   Kubikar · pruebas del módulo Cielo
   -----------------------------------------------------------------------------
   Fijan que la PERFILERÍA sale de la planta y no de una división del área, y que
   los metros que se compran coinciden con los ejes que el lienzo dibuja.

   La PLANCHA va al revés y también se fija acá: se cubica por los metros
   cuadrados que cubre, porque contar posiciones de la retícula cobraba entera una
   que entraba cinco centímetros. La retícula se sigue dibujando como replanteo,
   así que dibujo y cantidad divergen a propósito: eso también se prueba.

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
      tornillosPlanchaActivo: false,
      tornillosMetalActivo: false,
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

test('la plancha se cubica por los metros cuadrados que cubre', () => {
  const plancha = linea(calcular(contextoRectangulo(4000, 2600)), 'cielo.plancha')
  // 10,40 m² de recinto ÷ 2,88 m² útiles por plancha = 3,61 un; con 8% de
  // desperdicio son 3,90 y se compran 4. Contando posiciones eran 9.
  assert.equal(plancha.cantidadTeorica, 10.4 / 2.88)
  assert.equal(plancha.cantidadFinal, 4)
  assert.match(plancha.nota, /2,88 m² útiles por plancha/)
})

test('el traslapo de la plancha resta área útil y sube la cantidad', () => {
  const conTraslapo = [
    ...BIBLIOTECA.filter((m) => m.id !== PLANCHA.id),
    { ...PLANCHA, traslapoMm: 200 },
  ]
  const ctx = contextoRectangulo(4000, 2600)
  const plancha = linea(calcular({ ...ctx, biblioteca: conTraslapo }), 'cielo.plancha')
  // 1,00 × 2,20 = 2,20 m² útiles en vez de 2,88.
  assert.equal(plancha.cantidadTeorica, 10.4 / 2.2)
  assert.match(plancha.nota, /2,20 m² útiles por plancha/)
})

test('la retícula que se dibuja es replanteo, no la cantidad que se compra', () => {
  const ctx = contextoRectangulo(4000, 2600)
  const plancha = linea(calcular(ctx), 'cielo.plancha')
  const capa = trazar(ctx).find((c) => c.clave === 'cielo.plancha')
  assert.ok(capa, 'falta la capa de planchas')
  // 8 posiciones dibujadas contra 4 planchas compradas: la diferencia es el
  // recorte que en obra se reaprovecha, y es a propósito.
  assert.equal(capa.rectangulos.length, 8)
  assert.ok(
    capa.rectangulos.length > plancha.cantidadFinal,
    'el replanteo debería mostrar más posiciones que planchas compradas',
  )
})

test('el hueco de la planta no se cubica ni se dibuja', () => {
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
      tornillosPlanchaActivo: false,
      tornillosMetalActivo: false,
      colgantesActivo: false,
      descuentoM2: 0,
    },
    biblioteca: BIBLIOTECA,
  }

  const plancha = linea(calcular(ctx), 'cielo.plancha')
  // 6,00 × 4,80 menos el hueco de 3,40 × 2,50 son 20,30 m² netos: el área de
  // Gauss ya descuenta el hueco, así que la cubicación no lo paga.
  assert.equal(plancha.cantidadTeorica, 20.3 / 2.88)
  assert.equal(plancha.cantidadFinal, 8)

  // Retícula de 5 × 2 = 10 posiciones; la tercera de la fila de arriba cae
  // entera dentro del hueco y no se dibuja.
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

/* -----------------------------------------------------------------------------
   Accesorios
   -----------------------------------------------------------------------------
   Los dos tornillos de un cielo no son intercambiables y no se cuentan igual: el
   punta fina va sobre los metros lineales de perfilería, donde se atornilla la
   plancha, y el punta broca va por punto de unión metal-metal.
   -------------------------------------------------------------------------- */

const PUNTA_FINA = {
  id: 'mat-punta-fina',
  tipo: 'pieza',
  nombre: 'Tornillo drywall punta fina 6 × 1"',
  uso: 'fijacion_plancha',
  precioUnitario: null,
}

const PUNTA_BROCA = {
  id: 'mat-punta-broca',
  tipo: 'pieza',
  nombre: 'Tornillo punta broca cabeza lenteja 8 × ½"',
  uso: 'fijacion_metal',
  precioUnitario: null,
}

const ALAMBRE = {
  id: 'mat-alambre',
  tipo: 'pieza',
  nombre: 'Alambre galvanizado #14',
  uso: 'colgante',
  precioUnitario: null,
}

/**
 * Contexto con los tres accesorios encendidos y sus materiales cargados.
 * @param {Object} [parametros]
 */
function contextoConAccesorios(parametros = {}) {
  const ctx = contextoRectangulo(4000, 2600, {
    tornillosPlanchaActivo: true,
    tornillosPlanchaId: PUNTA_FINA.id,
    tornillosPlanchaSeparacionCm: 20,
    tornillosMetalActivo: true,
    tornillosMetalId: PUNTA_BROCA.id,
    tornillosMetalPorEncuentro: 2,
    colgantesActivo: true,
    colgantesId: ALAMBRE.id,
    colgantesPorM2: 1.5,
    ...parametros,
  })
  ctx.biblioteca = [...BIBLIOTECA, PUNTA_FINA, PUNTA_BROCA, ALAMBRE]
  return ctx
}

test('el tornillo de plancha se cuenta sobre los metros lineales de perfilería', () => {
  const tornillos = linea(calcular(contextoConAccesorios()), 'cielo.tornillosPlancha')
  // 7 corridas de 4,00 m = 28,00 ml ÷ 0,20 m entre tornillos.
  assert.equal(tornillos.cantidadTeorica, 140)
  // 140 un no se compran: se piden 200. La teórica queda intacta para auditar.
  assert.equal(tornillos.cantidadFinal, 200)
  assert.match(tornillos.nota, /28,00 ml de perfilería/)
  assert.match(tornillos.nota, /140 un · compra de tornillos → 200 un/)
})

test('abrir la separación entre ejes BAJA el tornillo de plancha', () => {
  // Es la razón de ser del cambio: con 15 un/m² sobre el área neta este número
  // no se movía ni un tornillo, y en obra sí se mueve. A 60 cm quedan 5 ejes en
  // vez de 7, o sea 20,00 ml de perfil en vez de 28,00.
  const a40 = linea(calcular(contextoConAccesorios()), 'cielo.tornillosPlancha')
  const a60 = linea(
    calcular(contextoConAccesorios({ separacionCm: 60 })),
    'cielo.tornillosPlancha',
  )
  assert.equal(a40.cantidadTeorica, 140)
  assert.equal(a60.cantidadTeorica, 100)
  // El redondeo de compra no puede tapar la caída: 200 un contra 100 un.
  assert.equal(a40.cantidadFinal, 200)
  assert.equal(a60.cantidadFinal, 100)
})

test('el tornillo metal-metal cuenta los encuentros trazados y los colgantes', () => {
  const resultado = calcular(contextoConAccesorios())
  const metal = linea(resultado, 'cielo.tornillosMetal')
  // 7 corridas × 2 extremos × 2 un = 28, más 16 colgantes a uno cada uno.
  assert.equal(metal.cantidadTeorica, 44)
  // 44 un no llega a la compra chica: se piden 50.
  assert.equal(metal.cantidadFinal, 50)
  assert.match(metal.nota, /7 corridas × 2 extremos × 2 un = 28 un/)
  assert.match(metal.nota, /16 colgantes × 1 un = 16 un/)
  assert.match(metal.nota, /44 un · compra de tornillos → 50 un/)
})

test('el tornillo del colgante usa el MISMO número que publica la línea de colgantes', () => {
  // Si se recalculara acá con otro redondeo, dos líneas del mismo listado
  // dirían cosas distintas del mismo colgante.
  const resultado = calcular(contextoConAccesorios({ colgantesPorM2: 1.7 }))
  const colgantes = linea(resultado, 'cielo.colgantes')
  const metal = linea(resultado, 'cielo.tornillosMetal')
  // 10,40 m² × 1,7 = 17,68 → 18 colgantes.
  assert.equal(colgantes.cantidadFinal, 18)
  assert.match(metal.nota, new RegExp(`${colgantes.cantidadFinal} colgantes × 1 un`))
  // La teórica es la que tiene que cuadrar: la final ya subió al escalón de compra.
  assert.equal(metal.cantidadTeorica, 28 + colgantes.cantidadFinal)
})

/* -----------------------------------------------------------------------------
   Redondeo de compra de los tornillos
   -----------------------------------------------------------------------------
   Un tornillo no se compra de a uno. La cifra que llega a la ferretería sube al
   escalón de compra, siempre hacia arriba, y la teórica queda intacta para poder
   reconstruir el número a mano.
   -------------------------------------------------------------------------- */

/**
 * Cantidad final de tornillos de plancha para una separación dada. Es la palanca
 * más directa sobre esa línea: 28,00 ml de perfilería ÷ el paso pedido.
 * @param {number} separacionTornilloCm
 */
function tornillosPlanchaCon(separacionTornilloCm) {
  const resultado = calcular(
    contextoConAccesorios({ tornillosPlanchaSeparacionCm: separacionTornilloCm }),
  )
  return linea(resultado, 'cielo.tornillosPlancha')
}

test('bajo 50 un el tornillo se compra de a 50', () => {
  // 28,00 ml ÷ 1,00 m = 28 un exactos. Nadie pide 28 tornillos.
  const pocos = tornillosPlanchaCon(100)
  assert.equal(pocos.cantidadTeorica, 28)
  assert.equal(pocos.cantidadFinal, 50)
  assert.match(pocos.nota, /28 un · compra de tornillos → 50 un/)
})

test('desde 50 un el tornillo sube a la centena siguiente', () => {
  // 28,00 ml ÷ 0,50 m = 56 un: el primer escalón después de la compra chica.
  const cincuentaYalgo = tornillosPlanchaCon(50)
  assert.equal(cincuentaYalgo.cantidadTeorica, 56)
  assert.equal(cincuentaYalgo.cantidadFinal, 100)

  // 28,00 ml ÷ 0,25 m = 112 un → 200.
  const cientoYalgo = tornillosPlanchaCon(25)
  assert.equal(cientoYalgo.cantidadTeorica, 112)
  assert.equal(cientoYalgo.cantidadFinal, 200)

  // 28,00 ml ÷ 0,08 m = 350 un → 400.
  const trescientos = tornillosPlanchaCon(8)
  assert.equal(trescientos.cantidadTeorica, 350)
  assert.equal(trescientos.cantidadFinal, 400)
})

test('la centena exacta no gasta un escalón de más', () => {
  // Con ejes a 60 cm son 5 corridas de 4,00 m = 20,00 ml ÷ 0,20 m = 100 un
  // clavados. Subirlo a 200 sería regalar cien tornillos por un redondeo que no
  // tenía nada que redondear. Y la nota se calla, porque "100 un → 100 un" es
  // ruido en una hoja que se lee en terreno.
  const justo = linea(
    calcular(contextoConAccesorios({ separacionCm: 60 })),
    'cielo.tornillosPlancha',
  )
  assert.equal(justo.cantidadTeorica, 100)
  assert.equal(justo.cantidadFinal, 100)
  assert.equal(/compra de tornillos/.test(justo.nota), false)
})

test('el redondeo de compra no toca al colgante ni a la perfilería', () => {
  // Es un redondeo de tornillo, no un redondeo general: el alambre se compra por
  // rollo y el omega por barra, y ninguno de los dos se pide de a cien.
  const resultado = calcular(contextoConAccesorios())
  assert.equal(linea(resultado, 'cielo.colgantes').cantidadFinal, 16)
  assert.equal(linea(resultado, 'cielo.perfil').cantidadFinal, 12)
})

test('el precio del tornillo se cobra sobre lo que se compra, no sobre lo que se usa', () => {
  // El subtotal tiene que cuadrar con la boleta de la ferretería: si la línea
  // dice 200 un, se pagaron 200.
  const ctx = contextoConAccesorios()
  ctx.biblioteca = ctx.biblioteca.map((m) =>
    m.id === PUNTA_FINA.id ? { ...m, precioUnitario: 12 } : m,
  )
  const tornillos = linea(calcular(ctx), 'cielo.tornillosPlancha')
  assert.equal(tornillos.cantidadFinal, 200)
  assert.equal(tornillos.subtotal, 200 * 12)
})

test('el colgante se sigue cubicando por superficie', () => {
  const colgantes = linea(calcular(contextoConAccesorios()), 'cielo.colgantes')
  // 10,40 m² × 1,5 = 15,60: esta cuenta no cambia con este trabajo.
  assert.equal(colgantes.cantidadFinal, 16)
})

test('sin perfilería trazada los tornillos salen del listado declarándolo', () => {
  // Sin separación entre ejes no hay corridas de dónde contar. El aviso tiene que
  // nombrar la causa: el usuario está mirando el listado, no el código.
  const resultado = calcular(contextoConAccesorios({ separacionCm: 0 }))
  assert.equal(
    resultado.lineas.some((l) => l.clave.startsWith('cielo.tornillos')),
    false,
  )
  assert.ok(
    resultado.avisos.some((a) => a.nivel === 'error' && /perfilería/i.test(a.mensaje)),
    'falta el aviso que explica por qué no hay tornillos',
  )
  // El colgante no depende de la perfilería y sigue cubicándose.
  assert.equal(linea(resultado, 'cielo.colgantes').cantidadFinal, 16)
})

test('que falte un tornillo no saca del listado al otro', () => {
  const ctx = contextoConAccesorios({ tornillosPlanchaId: null })
  const resultado = calcular(ctx)
  assert.equal(
    resultado.lineas.some((l) => l.clave === 'cielo.tornillosPlancha'),
    false,
  )
  assert.ok(linea(resultado, 'cielo.tornillosMetal'))
  assert.ok(
    resultado.avisos.some((a) => /Tornillo de plancha/.test(a.mensaje)),
    'falta el aviso que nombra el material ausente',
  )
})

test('un material de otro uso no sirve como tornillo: se trata como ausente', () => {
  // El selector filtra por uso, pero un proyecto guardado puede apuntar a
  // cualquier id. El cálculo no puede confiar en que la interfaz ya filtró.
  const ctx = contextoConAccesorios({ tornillosMetalId: OMEGA.id })
  const resultado = calcular(ctx)
  assert.equal(
    resultado.lineas.some((l) => l.clave === 'cielo.tornillosMetal'),
    false,
  )
})
