/* =============================================================================
   Kubikar · pruebas de las primitivas de geometría
   -----------------------------------------------------------------------------
   Fijan el recorte de una recta contra la planta y el toque de un rectángulo
   contra la planta, que son las dos operaciones de las que sale la cubicación
   desde que dejó de dividir el área.

   Los casos de borde son el objetivo real de este archivo: el primer eje de
   perfilería nace justo sobre el borde del rectángulo envolvente, así que la
   convención de cruce se prueba explícitamente en vez de darse por buena.

   Se fijan además los DETENTES del trazado. Son la única geometría que el
   usuario siente con la mano, y su orden importa: si el imán a la grilla corre
   después del angular, el punto se sale del ángulo recién imantado.
   ========================================================================== */

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  aplicarDetentes,
  contienePunto,
  imantarAngulo,
  recortarLineaEnPoligono,
  rectanguloTocaPoligono,
} from '../src/core/geometry.js'

/** Rectángulo de 4000 × 2600 mm con origen en (0,0). */
const RECT = [
  { id: 'a', x: 0, y: 0 },
  { id: 'b', x: 4000, y: 0 },
  { id: 'c', x: 4000, y: 2600 },
  { id: 'd', x: 0, y: 2600 },
]

/**
 * U con la boca hacia arriba: caja de 3000 × 4000 con el hueco de x 1000 a 2000
 * y de y 0 a 3000. Una recta horizontal bajo el fondo del hueco corta la figura
 * en dos corridas, que es el caso que el método por área no sabe ver.
 */
const U = [
  { id: 'a', x: 0, y: 0 },
  { id: 'b', x: 1000, y: 0 },
  { id: 'c', x: 1000, y: 3000 },
  { id: 'd', x: 2000, y: 3000 },
  { id: 'e', x: 2000, y: 0 },
  { id: 'f', x: 3000, y: 0 },
  { id: 'g', x: 3000, y: 4000 },
  { id: 'h', x: 0, y: 4000 },
]

/* -----------------------------------------------------------------------------
   recortarLineaEnPoligono
   -------------------------------------------------------------------------- */

test('una recta interior devuelve el ancho completo del rectángulo', () => {
  const tramos = recortarLineaEnPoligono(RECT, { x1: -1000, y1: 1300, x2: 5000, y2: 1300 })
  assert.equal(tramos.length, 1)
  assert.equal(tramos[0].largoMm, 4000)
  assert.equal(tramos[0].x1, 0)
  assert.equal(tramos[0].x2, 4000)
})

test('un polígono en U devuelve dos corridas en el mismo eje', () => {
  const tramos = recortarLineaEnPoligono(U, { x1: -100, y1: 1000, x2: 3100, y2: 1000 })
  assert.equal(tramos.length, 2)
  assert.deepEqual(
    tramos.map((t) => [t.x1, t.x2, t.largoMm]),
    [
      [0, 1000, 1000],
      [2000, 3000, 1000],
    ],
  )
})

test('sobre el fondo del hueco la corrida vuelve a ser una sola', () => {
  const tramos = recortarLineaEnPoligono(U, { x1: -100, y1: 3500, x2: 3100, y2: 3500 })
  assert.equal(tramos.length, 1)
  assert.equal(tramos[0].largoMm, 3000)
})

test('una recta vertical se recorta igual que una horizontal', () => {
  const tramos = recortarLineaEnPoligono(RECT, { x1: 2000, y1: -500, x2: 2000, y2: 5000 })
  assert.equal(tramos.length, 1)
  assert.equal(tramos[0].largoMm, 2600)
})

test('una recta oblicua también se recorta', () => {
  // Pendiente 0,5 entrando por el costado izquierdo en y = 500 y saliendo por el
  // derecho en y = 2500, sin pasar por ningún vértice: √(4000² + 2000²) = 4472,1…
  const tramos = recortarLineaEnPoligono(RECT, { x1: -1000, y1: 0, x2: 5000, y2: 3000 })
  assert.equal(tramos.length, 1)
  assert.equal(Math.round(tramos[0].largoMm), 4472)
})

// La convención de cruce es semiabierta, así que un borde da corrida y el
// opuesto no. Es asimétrico a propósito y queda fijado acá porque es la razón
// exacta por la que el módulo desplaza 1 mm hacia adentro un eje que cae sobre
// un muro. Si alguien "arregla" la asimetría, esta prueba lo avisa.
test('el borde de arranque devuelve corrida y el borde opuesto no', () => {
  const arranque = recortarLineaEnPoligono(RECT, { x1: -100, y1: 0, x2: 4100, y2: 0 })
  assert.equal(arranque.length, 1)
  assert.equal(arranque[0].largoMm, 4000)

  const opuesto = recortarLineaEnPoligono(RECT, { x1: -100, y1: 2600, x2: 4100, y2: 2600 })
  assert.equal(opuesto.length, 0)
})

test('fuera del polígono no hay corrida', () => {
  assert.deepEqual(recortarLineaEnPoligono(RECT, { x1: -100, y1: 9000, x2: 4100, y2: 9000 }), [])
})

test('entrada basura devuelve arreglo vacío y no lanza', () => {
  assert.deepEqual(recortarLineaEnPoligono(null, null), [])
  assert.deepEqual(recortarLineaEnPoligono([{ x: 0, y: 0 }], { x1: 0, y1: 0, x2: 1, y2: 0 }), [])
  assert.deepEqual(recortarLineaEnPoligono(RECT, { x1: 10, y1: 10, x2: 10, y2: 10 }), [])
})

/* -----------------------------------------------------------------------------
   contienePunto y rectanguloTocaPoligono
   -------------------------------------------------------------------------- */

test('contienePunto distingue dentro de fuera', () => {
  assert.equal(contienePunto(RECT, { x: 2000, y: 1300 }), true)
  assert.equal(contienePunto(RECT, { x: 9000, y: 1300 }), false)
  assert.equal(contienePunto(U, { x: 1500, y: 1000 }), false) // el hueco de la U
  assert.equal(contienePunto(U, { x: 1500, y: 3500 }), true)
})

test('rectanguloTocaPoligono cubre los cuatro modos de solapamiento', () => {
  // Rectángulo enteramente dentro de la planta.
  assert.equal(rectanguloTocaPoligono(RECT, { x: 100, y: 100, ancho: 200, alto: 200 }), true)
  // Enteramente fuera.
  assert.equal(rectanguloTocaPoligono(RECT, { x: 9000, y: 9000, ancho: 200, alto: 200 }), false)
  // A caballo del borde: parte dentro, parte fuera.
  assert.equal(rectanguloTocaPoligono(RECT, { x: 3900, y: 100, ancho: 400, alto: 200 }), true)
  // El rectángulo contiene la planta entera: ninguna esquina suya está dentro,
  // pero todos los vértices de la planta están dentro de él.
  assert.equal(rectanguloTocaPoligono(RECT, { x: -1000, y: -1000, ancho: 9000, alto: 9000 }), true)
})

test('un rectángulo metido en el hueco de la U no toca la planta', () => {
  assert.equal(rectanguloTocaPoligono(U, { x: 1200, y: 500, ancho: 400, alto: 400 }), false)
})

test('un rectángulo que atraviesa un brazo de la U toca solo por las aristas', () => {
  // Banda horizontal que cruza el brazo izquierdo de lado a lado: sus cuatro
  // esquinas caen fuera de la planta (dos a la izquierda, dos en el hueco) y
  // ningún vértice de la planta cae dentro de ella. El único contacto es el
  // cruce de aristas, que es el tercer modo del detector.
  assert.equal(rectanguloTocaPoligono(U, { x: -100, y: 1000, ancho: 1200, alto: 200 }), true)
})

test('rectanguloTocaPoligono con entrada basura devuelve false y no lanza', () => {
  assert.equal(rectanguloTocaPoligono(null, null), false)
  assert.equal(rectanguloTocaPoligono(RECT, { x: 0, y: 0, ancho: 0, alto: 0 }), false)
})
/* -----------------------------------------------------------------------------
   Detentes del trazado
   -------------------------------------------------------------------------- */

const ORIGEN = { x: 0, y: 0 }

/** Ángulo del trazo en grados, para leer las aserciones como se leen en obra. */
function grados(desde, hasta) {
  return (Math.atan2(hasta.y - desde.y, hasta.x - desde.x) * 180) / Math.PI
}

test('el imán angular pega el trazo al múltiplo de 15 más cercano', () => {
  // 43° cae a 2° de los 45: entra en la tolerancia y sale exacto.
  const p = imantarAngulo(ORIGEN, { x: 1000, y: 932.5 })
  assert.ok(p, 'el trazo a 43° debería imantarse')
  assert.ok(Math.abs(grados(ORIGEN, p) - 45) < 1e-9)
})

test('el imán angular conserva el largo del trazo', () => {
  const p = imantarAngulo(ORIGEN, { x: 3000, y: 100 })
  assert.ok(p)
  assert.ok(Math.abs(Math.hypot(p.x, p.y) - Math.hypot(3000, 100)) < 1e-9)
})

test('fuera de la tolerancia el imán angular no toca nada: es imán, no jaula', () => {
  // 22° está a 7° de los 15 y a 8° de los 30: ningún detente lo alcanza.
  assert.equal(imantarAngulo(ORIGEN, { x: 1000, y: 404 }), null)
})

test('la horizontal y la vertical salen exactas, sin ruido de coma flotante', () => {
  const h = imantarAngulo(ORIGEN, { x: 3000, y: 12 })
  assert.deepEqual(h, { x: Math.hypot(3000, 12), y: 0 })
  const v = imantarAngulo(ORIGEN, { x: 12, y: 3000 })
  assert.equal(v.x, 0)
})

test('con paso de largo, el trazo se pega sobre el rayo y no a la grilla absoluta', () => {
  // Parte de un vértice FUERA de grilla, como el que deja una cota escrita a
  // mano: la horizontal tiene que seguir siendo horizontal.
  const desde = { x: 9530, y: 9530 }
  const p = imantarAngulo(desde, { x: 12480, y: 9560 }, { pasoLargoMm: 100 })
  assert.ok(p)
  assert.equal(p.y, desde.y, 'la horizontal debe conservar la Y del vértice anterior')
  assert.ok(Math.abs(p.x - (desde.x + 3000)) < 1e-9, 'el largo debe pegarse a 3000')
})

test('un largo que se pegaría a cero deja el trazo como venía', () => {
  const p = imantarAngulo(ORIGEN, { x: 10, y: 0 }, { pasoLargoMm: 1000 })
  assert.deepEqual(p, { x: 10, y: 0 })
})

test('el imán angular nunca lanza y descarta el trazo de largo cero', () => {
  assert.equal(imantarAngulo(null, null), null)
  assert.equal(imantarAngulo(ORIGEN, ORIGEN), null)
  assert.equal(imantarAngulo(ORIGEN, { x: 100, y: 0 }, { pasoGrados: 0 }), null)
})

test('el ortogonal manda sobre el angular: un rectángulo no puede salir torcido', () => {
  // 43° se imantaría a 45, pero con el ortogonal puesto tiene que salir plano.
  const p = aplicarDetentes(ORIGEN, { x: 1000, y: 932.5 }, {
    imanGrilla: true,
    ortogonal: true,
    pasoMm: 100,
  })
  assert.equal(p.y, 0)
})

test('sin imán no hay detente alguno: el punto queda donde lo dejó el puntero', () => {
  const crudo = { x: 1234.5, y: 987.6 }
  assert.deepEqual(aplicarDetentes(ORIGEN, crudo, { imanGrilla: false, pasoMm: 100 }), crudo)
})

test('sin ángulo imantado el imán vuelve a pegar x e y por separado', () => {
  // 22° no alcanza ningún detente: manda la grilla, como toda la vida.
  const p = aplicarDetentes(ORIGEN, { x: 1010, y: 408 }, { imanGrilla: true, pasoMm: 100 })
  assert.deepEqual(p, { x: 1000, y: 400 })
})

test('sin punto de partida —un vértice arrastrado— solo corre el imán a la grilla', () => {
  const p = aplicarDetentes(null, { x: 1010, y: 408 }, { imanGrilla: true, pasoMm: 100 })
  assert.deepEqual(p, { x: 1000, y: 400 })
})

test('aplicarDetentes tolera basura sin lanzar', () => {
  assert.deepEqual(aplicarDetentes(null, null, null), { x: 0, y: 0 })
})
