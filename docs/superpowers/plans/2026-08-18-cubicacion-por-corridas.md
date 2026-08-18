# Cubicación por corridas reales · plan de implementación

> **Para quien ejecute:** las tareas van en orden y cada una termina en commit con
> el ciclo completo de `CLAUDE.md`. Los pasos usan casillas (`- [ ]`).

**Goal:** que la cantidad de material salga de las corridas y posiciones reales
sobre la planta, con el retazo corto descartado; que el consolidado se vea; y que
las dos vistas se puedan imprimir.

**Architecture:** dos primitivas de geometría nuevas (recorte de recta en
polígono, toque de rectángulo) alimentan un repartidor de barras puro en
`src/core/reparto.js`. `src/modules/cielo.js` deja de dividir el área y consume
un único reparto compartido por `calcular` y `trazar`. La interfaz suma el bloque
de cierre del consolidado y un documento de impresión aparte.

**Tech Stack:** React 19, Tailwind 4, Vite 8, `node --test` (sin dependencias
nuevas).

**Spec:** `docs/superpowers/specs/2026-08-18-cubicacion-por-corridas-design.md`

---

## Consecuencia conocida y aceptada · planchas

Contar posiciones de retícula es el extremo **pesimista**, igual que dividir el
área es el extremo optimista. Un recinto de 4000 × 2600 con planchas de
1200 × 2400 da 4 columnas × 2 filas = 8 posiciones, cuando por área daban 4: la
segunda fila usa 200 mm de cada plancha y bota 2200 mm que en obra sí se
reaprovechan, porque un recorte de plancha grande se reusa y un retazo de omega
de 40 cm no.

Se implementa como se acordó, y para que la diferencia sea auditable la nota
distingue **posiciones completas de posiciones parciales**. Queda anotado como
lo primero a revisar contra un proyecto real.

---

## Task 1 · Campos nuevos de la barra

**Files:**
- Modify: `src/data/schema.js:77` (typedef), `:312` y `:315` (`nuevoMaterial`), `:361` y `:363` (`normalizarMaterial`)
- Modify: `src/data/seed.js:51-70`
- Modify: `src/components/FormularioMaterial.jsx` (estado, validación, guardado, sección de barra)

No cambia ningún número: los campos existen y todavía no los lee nadie.

- [ ] **1.1** En `schema.js`, el typedef `Material`: `traslapoMm` pasa a
  «`plancha` (resta área útil) y `barra` (lo que consume cada empalme)», y se
  suma `@property {number|null} retazoMinimoMm  solo 'barra'`.

- [ ] **1.2** En `nuevoMaterial`: `traslapoMm: t === 'plancha' || t === 'barra' ? 0 : null`
  y `retazoMinimoMm: t === 'barra' ? 500 : null`.

- [ ] **1.3** En `normalizarMaterial`:

```js
traslapoMm: tipo === 'plancha' || tipo === 'barra' ? numeroO(fuente.traslapoMm, 0) : null,
// …
retazoMinimoMm: tipo === 'barra' ? numeroO(fuente.retazoMinimoMm, 500) : null,
```

  El defecto de 500 es deliberado: un material guardado antes de este cambio
  entra con descarte y su cifra sube. La memoria de cálculo imprime el umbral.

- [ ] **1.4** En `seed.js`, las tres barras: omega de 3000 y de 6000 con
  `traslapoMm: 150, retazoMinimoMm: 500`; ángulo perimetral con
  `traslapoMm: 0, retazoMinimoMm: 500`.

- [ ] **1.5** En `FormularioMaterial.jsx`: dos estados nuevos junto a
  `largoBarra` (`traslapoBarra`, `retazoMinimo`), su reinicio en el cambio de
  tipo, su validación y su guardado.

  Validación dentro de `if (tipo === 'barra')`:

```js
if (traslapoBarra !== null && traslapoBarra < 0) {
  fallas.traslapoBarra = 'El traslapo no puede ser negativo. Deja 0 si las barras se unen a tope.'
} else if (esPositivo(largoBarra) && traslapoBarra !== null && traslapoBarra >= largoBarra) {
  fallas.traslapoBarra =
    'El traslapo tiene que ser menor que el largo de la barra: con este valor un empalme no avanza nada. Ingresa un traslapo menor.'
}
if (retazoMinimo !== null && retazoMinimo < 0) {
  fallas.retazoMinimo = 'El retazo mínimo no puede ser negativo. Deja 0 si aprovechas cualquier sobrante.'
}
```

  Guardado: `traslapoMm: tipo === 'barra' ? (aMm(cuantizar(traslapoBarra, dec), u.id) ?? 0) : (tipo === 'plancha' ? … )`
  y `retazoMinimoMm: tipo === 'barra' ? (aMm(cuantizar(retazoMinimo, dec), u.id) ?? 0) : null`.

- [ ] **1.6** Dos `CampoNumero` en la sección «Medidas de la barra», con ayuda:
  traslapo → «Lo que se pierde en cada empalme cuando la corrida es más larga
  que la barra. 0 si se unen a tope.»; retazo mínimo → «Bajo este largo, el
  sobrante de una barra es descarte y no se reutiliza en otra corrida.»

- [ ] **1.7** Ciclo y commit

```sh
npm run build && npm run design:check
git add -A && git commit -m "Suma a la barra el traslapo de empalme y el retazo minimo porque el corte real los necesita"
git push
```

---

## Task 2 · Recorte de recta en polígono

**Files:**
- Create: `tests/geometry.test.mjs`
- Modify: `src/core/geometry.js`
- Modify: `package.json` (script `test`)

- [ ] **2.1** `package.json`: `"test": "node --test tests/"`.

- [ ] **2.2** Escribir la prueba que falla, `tests/geometry.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { recortarLineaEnPoligono } from '../src/core/geometry.js'

/** Rectángulo de 4000 × 2600 mm con origen en (0,0). */
const RECT = [
  { id: 'a', x: 0, y: 0 },
  { id: 'b', x: 4000, y: 0 },
  { id: 'c', x: 4000, y: 2600 },
  { id: 'd', x: 0, y: 2600 },
]

/** U abierta hacia abajo: el hueco va de x 1000 a 2000, de y 0 a 3000. */
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

test('sobre el hueco de la U la corrida vuelve a ser una sola', () => {
  const tramos = recortarLineaEnPoligono(U, { x1: -100, y1: 3500, x2: 3100, y2: 3500 })
  assert.equal(tramos.length, 1)
  assert.equal(tramos[0].largoMm, 3000)
})

test('una recta vertical se recorta igual que una horizontal', () => {
  const tramos = recortarLineaEnPoligono(RECT, { x1: 2000, y1: -500, x2: 2000, y2: 5000 })
  assert.equal(tramos.length, 1)
  assert.equal(tramos[0].largoMm, 2600)
})

// La convención de cruce es semiabierta (`<=`), así que un borde da corrida y el
// opuesto no. Es asimétrico a propósito y está fijado acá porque es la razón por
// la que el módulo desplaza 1 mm hacia adentro un eje que cae sobre un muro.
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
})
```

- [ ] **2.3** Correr y ver que falla: `npm test` → `SyntaxError` o
  `recortarLineaEnPoligono is not a function`.

- [ ] **2.4** Implementar en `src/core/geometry.js`. Barrido por paridad sobre la
  recta `P + t·D`: para cada arista se calcula de qué lado cae cada extremo con
  el producto cruz; hay cruce cuando `(sA <= 0) !== (sB <= 0)`; se guarda el
  parámetro `t` del punto de cruce; se ordena y se aparea. Tramos de menos de
  1 mm se descartan.

- [ ] **2.5** `npm test` en verde. Sin commit todavía: la tarea 3 va en el mismo.

---

## Task 3 · Toque de rectángulo contra la planta

**Files:**
- Modify: `tests/geometry.test.mjs`
- Modify: `src/core/geometry.js`

- [ ] **3.1** Sumar a `tests/geometry.test.mjs`:

```js
import { contienePunto, rectanguloTocaPoligono } from '../src/core/geometry.js'

test('contienePunto distingue dentro de fuera', () => {
  assert.equal(contienePunto(RECT, { x: 2000, y: 1300 }), true)
  assert.equal(contienePunto(RECT, { x: 9000, y: 1300 }), false)
  assert.equal(contienePunto(U, { x: 1500, y: 1000 }), false) // el hueco de la U
  assert.equal(contienePunto(U, { x: 1500, y: 3500 }), true)
})

test('rectanguloTocaPoligono cubre los cuatro modos de solapamiento', () => {
  // dentro
  assert.equal(rectanguloTocaPoligono(RECT, { x: 100, y: 100, ancho: 200, alto: 200 }), true)
  // fuera
  assert.equal(rectanguloTocaPoligono(RECT, { x: 9000, y: 9000, ancho: 200, alto: 200 }), false)
  // a caballo del borde
  assert.equal(rectanguloTocaPoligono(RECT, { x: 3900, y: 100, ancho: 400, alto: 200 }), true)
  // el rectángulo contiene al polígono entero
  assert.equal(rectanguloTocaPoligono(RECT, { x: -1000, y: -1000, ancho: 9000, alto: 9000 }), true)
  // dentro del hueco de la U: no toca
  assert.equal(rectanguloTocaPoligono(U, { x: 1200, y: 500, ancho: 400, alto: 400 }), false)
})
```

- [ ] **3.2** `npm test` → falla.

- [ ] **3.3** Implementar. `contienePunto` por paridad de rayo con la misma
  convención semiabierta. `rectanguloTocaPoligono`: descarte rápido por bounding
  box; luego esquina del rectángulo dentro del polígono, vértice del polígono
  dentro del rectángulo, o cruce de aristas.

- [ ] **3.4** `npm test` en verde.

- [ ] **3.5** Ciclo y commit

```sh
npm run build && npm test && npm run design:check
git add -A && git commit -m "Agrega el recorte de recta y el toque de rectangulo porque la cubicacion pasa a leer la planta"
git push
```

---

## Task 4 · Repartidor de barras

**Files:**
- Create: `src/core/reparto.js`, `tests/reparto.test.mjs`

- [ ] **4.1** Escribir `tests/reparto.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { repartirBarras } from '../src/core/reparto.js'

const OMEGA = { largoBarraMm: 3000, traslapoMm: 150, retazoMinimoMm: 500 }

test('el caso de terreno: 12 corridas de 2,6 m piden 12 barras de 3 m', () => {
  const r = repartirBarras(Array(12).fill(2600), OMEGA)
  assert.equal(r.barras, 12)
  assert.equal(r.empalmes, 0)
  assert.equal(r.mlPedidos, 31.2)
  // 12 retazos de 0,40 m que no se reutilizan
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
  // k = ceil((4500 − 150) / (3000 − 150)) = 2 → una barra entera + 1650 mm
  const r = repartirBarras([4500], OMEGA)
  assert.equal(r.barras, 2)
  assert.equal(r.empalmes, 1)
  assert.equal(r.piezas, 2)
  assert.equal(r.mlPedidos, 4.5)
})

test('las piezas se acomodan de mayor a menor en las barras abiertas', () => {
  // 1800 abre barra y deja 1200 vivo; 900 entra ahí y deja 300, bajo el mínimo
  const r = repartirBarras([1800, 900], OMEGA)
  assert.equal(r.barras, 1)
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
  assert.equal(r.mlPedidos, 0)
})

test('un retazo mínimo mayor que la barra se acota y nada se reutiliza', () => {
  const r = repartirBarras([1000, 1000], { ...OMEGA, retazoMinimoMm: 99999 })
  assert.equal(r.barras, 2)
})
```

- [ ] **4.2** `npm test` → falla.

- [ ] **4.3** Implementar `src/core/reparto.js` con la firma y las cuatro reglas
  del spec §4.2. Validar y devolver `null`; nunca lanzar.

- [ ] **4.4** `npm test` en verde.

- [ ] **4.5** Ciclo y commit

```sh
npm run build && npm test && npm run design:check
git add -A && git commit -m "Agrega el repartidor de barras que descarta el retazo corto en vez de suponer que la barra rinde entera"
git push
```

---

## Task 5 · Cielo cubica sobre la planta

**Files:**
- Create: `tests/cielo.test.mjs`
- Modify: `src/modules/cielo.js`

- [ ] **5.1** Escribir `tests/cielo.test.mjs` con un recinto de 4000 × 2600 mm,
  omega de 3000 y plancha de 1200 × 2400, y fijar:
  - la línea `cielo.perfil` con `cantidadTeorica === 11` (7 corridas de 4,00 m,
    cada una empalmada en 3000 + 1150, repartidas en 11 barras), contra las 8,67
    que daba el método por área;
  - la línea `cielo.plancha` con `cantidadTeorica === 8` (retícula de 4 × 2);
  - que el conteo de plancha coincide con la cantidad de rectángulos que emite
    `trazar` para el rol `pieza`;
  - que `calcular` y `trazar` no lanzan con contexto basura (`{}`, `null`).

- [ ] **5.2** `npm test` → falla.

- [ ] **5.3** Extraer `repartoDelRecinto(ctx)` en `cielo.js` con la firma del
  spec §4.3, y hacer que `trazar` lo consuma. El desplazamiento de 1 mm hacia
  adentro cuando un eje cae exactamente sobre un muro vive acá, en
  `corridasDeEje`, con el comentario que explica por qué.

- [ ] **5.4** Reescribir en `calcular` las tres líneas: perfil desde
  `repartirBarras(corridas)`, perimetral desde los lados del polígono, plancha
  desde el conteo de posiciones que tocan. Notas del spec §4.4, avisos del §4.5,
  topes `MAX_CORRIDAS_CALCULO` 20 000 y `MAX_POSICIONES_CALCULO` 50 000.

- [ ] **5.5** Ajustar la ayuda del parámetro de desperdicio: ya no carga con el
  retazo, cubre rotura y error de corte.

- [ ] **5.6** `npm test` en verde y revisión a ojo en `npm run dev`.

- [ ] **5.7** Actualizar `PRODUCT.md` (restricción de cortes, campos nuevos de la
  biblioteca) y `CLAUDE.md` (`npm test` en el ciclo).

- [ ] **5.8** Ciclo y commit

```sh
npm run build && npm test && npm run design:check
git add -A && git commit -m "Cubica el cielo sobre las corridas y posiciones reales de la planta porque el metodo por area dejaba el material corto"
git push
```

---

## Task 6 · Bloque de cierre del consolidado

**Files:**
- Modify: `src/components/PanelRecintos.jsx:277-298`
- Modify: `DESIGN.md` (sección Navigation)

- [ ] **6.1** Reemplazar el botón por el bloque del spec §5: filete
  `rule-strong` de separación, `Cruz` en vez de `Sigma`, nombre en 15 px con
  tinta hierro, cifra de cierre en 17 px con `.kb-num`, escuadra de registro en
  `error-ink` cuando hay recintos fuera, y el conteo en el nombre accesible.
  La cifra sale de `useConsolidado(estado.proyecto, estado.biblioteca)`.

- [ ] **6.2** `DESIGN.md`: sumar el bloque a la sección Navigation, junto a la
  clave del margen.

- [ ] **6.3** Ciclo y commit

```sh
npm run build && npm test && npm run design:check
git add -A && git commit -m "Da peso al acceso del consolidado porque es una funcion principal con el registro mas debil de la pantalla"
git push
```

---

## Task 7 · Impresión

**Files:**
- Create: `src/styles/impresion.css`, `src/components/HojaImpresion.jsx`, `src/components/PlantaImpresa.jsx`
- Modify: `src/styles/base.css` (import), `src/App.jsx` (montaje), `src/components/VistaConsolidado.jsx` y `src/components/PestanaResultados.jsx` (botón)
- Modify: `DESIGN.md`, `PRODUCT.md`

- [ ] **7.1** `src/styles/impresion.css` con `@page`, el ocultamiento de la
  aplicación de pantalla, el apagado de `RulingLayer` y las reglas de corte de
  página. Importado al final de `base.css`.

- [ ] **7.2** `PlantaImpresa.jsx`: SVG estático con `viewBox` ajustado al
  rectángulo envolvente más margen; polígono, capas de `trazar`, cotas por
  segmento y área sobre el centroide.

- [ ] **7.3** `HojaImpresion.jsx` con `CabeceraHoja`, `HojaConsolidado` y
  `HojaRecinto` según el spec §6.

- [ ] **7.4** Montaje en `App.jsx` con `hidden print:block` y botón `Imprimir`
  (variante secundaria, icono `Printer`) en las dos cabeceras.

- [ ] **7.5** `DESIGN.md` sección de impresión; `PRODUCT.md` la suma al alcance.

- [ ] **7.6** Ciclo y commit

```sh
npm run build && npm test && npm run design:check
git add -A && git commit -m "Imprime el consolidado y el recinto porque la lista de compra se lleva en papel a la obra"
git push
```
