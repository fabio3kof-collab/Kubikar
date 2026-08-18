# Cubicación por corridas reales, acceso al consolidado e impresión

Fecha: 2026-08-18 · Estado: aprobado por el usuario

## 1. El problema

Tres hallazgos de terreno, uno de fondo y dos de interfaz.

**El número está corto.** Hoy `src/modules/cielo.js` cubica la perfilería como
`área neta ÷ separación ÷ largo de barra`. Esa cuenta supone que los metros
lineales se empalman libremente de una corrida a otra, es decir, que **cada
barra rinde su largo completo**. En terreno no ocurre: con corridas de 2,60 m y
barras de 3,00 m, cada barra entrega una sola pieza y los 0,40 m sobrantes son
un retazo demasiado corto para traslapar. El rendimiento real es 86,7 % y el 5 %
de desperdicio no alcanza a cubrir el 13,3 % perdido. El proyecto San Vicente
cubica 21 barras de omega de 3 m y en obra queda en déficit.

El mismo defecto está en el perfil perimetral, que divide el perímetro completo
por el largo de barra como si los muros fueran un solo tramo continuo, y en la
plancha, que divide el área neta por el área útil como si los recortes de un
borde sirvieran en el otro.

**El acceso al consolidado no se ve.** Es una de las funciones principales del
producto y hoy es un botón sin filete, con rótulo de 11 px en tinta terciaria,
al pie de la clave del margen izquierdo. Pesa menos que cualquier fila de
recinto.

**No se puede imprimir.** No hay una sola regla `@media print` en el proyecto.
El consolidado es la lista de compra y no hay forma de llevarla al papel.

## 2. Decisiones tomadas

| # | Decisión | Alternativas descartadas |
|---|---|---|
| 1 | La cantidad sale de las **corridas y posiciones reales sobre la planta** | Un parámetro de largo de corrida declarado a mano; un factor de aprovechamiento a ojo |
| 2 | El umbral de retazo y el traslapo de empalme son **propiedad del material** | Parámetros del módulo, ajustables por recinto |
| 3 | Las **planchas** se corrigen con el mismo criterio, en el mismo cambio | Dejarlas por área; postergarlas a otro commit |
| 4 | El consolidado gana peso como **bloque de cierre de la clave** | Cabeza de la clave; salida en la barra superior; botón primario naranja |
| 5 | Se imprime el **consolidado y el recinto** | Solo el consolidado |

Dos consecuencias que se dan por acordadas porque el proyecto ya las declara y
esta decisión no las contradice:

- **El retazo se aprovecha dentro del recinto, nunca entre recintos.**
  `src/state/useConsolidado.js:20` ya lo fija: en obra cada recinto se corta
  aparte, así que el sobrante de uno no cubre al siguiente. El consolidado
  sigue sumando cantidades finales ya redondeadas por recinto.
- **Sigue sin haber optimización de cortes.** Es una cuenta de piezas de largo
  conocido contra barras de largo conocido, con una heurística declarada. No se
  resuelve un problema de empaquetado, no se mezclan materiales distintos y no
  se numeran los cortes.

## 3. Fuera de alcance

- Lista de cortes numerada, plano de despiece o rotulado de piezas.
- Optimización entre recintos o entre materiales.
- Cualquier cambio en los módulos anunciados como próximamente.
- Precios, moneda o costo: no se toca nada de eso.

## 4. Arquitectura

### 4.1 Primitivas de geometría · `src/core/geometry.js`

Tres funciones nuevas, puras, sin dependencias, en milímetros de mundo.

```js
/**
 * Recorta una recta contra el polígono y devuelve los tramos que quedan dentro.
 * Barrido por paridad: se calculan los cruces de la recta con cada arista, se
 * ordenan por su parámetro sobre la recta y se aparean. Un recinto en L
 * devuelve dos corridas en el mismo eje.
 *
 * @param {Vertice[]} vertices
 * @param {{x1:number,y1:number,x2:number,y2:number}} linea
 * @returns {{x1:number,y1:number,x2:number,y2:number,largoMm:number}[]}
 */
export function recortarLineaEnPoligono(vertices, linea)

/**
 * Punto dentro del polígono, por paridad de rayo.
 * @param {Vertice[]} vertices
 * @param {{x:number,y:number}} punto
 * @returns {boolean}
 */
export function contienePunto(vertices, punto)

/**
 * ¿El rectángulo toca la planta? Verdadero si una esquina del rectángulo cae
 * dentro del polígono, si un vértice del polígono cae dentro del rectángulo, o
 * si alguna arista cruza alguna arista. Se descarta antes por bounding box.
 * @param {Vertice[]} vertices
 * @param {{x:number,y:number,ancho:number,alto:number}} rect
 * @returns {boolean}
 */
export function rectanguloTocaPoligono(vertices, rect)
```

Detalles que importan y que las pruebas fijan:

- La condición de cruce es `(sA <= 0) !== (sB <= 0)` sobre el lado de cada
  extremo respecto de la recta. Es semiabierta a propósito: un vértice que cae
  exactamente sobre la recta se cuenta una sola vez, y una arista **colineal**
  con la recta no aporta cruces. Sin eso, el primer eje —que cae justo sobre el
  borde del rectángulo envolvente— saldría con largo cero o duplicado.
- `recortarLineaEnPoligono` acepta cualquier dirección, no solo los ejes
  ortogonales que emite Cielo hoy. Los módulos que vienen la van a necesitar.
- Los tramos de menos de 1 mm se descartan: son ruido de coma flotante en un
  vértice, no una corrida.
- Un polígono auto-intersectante no rompe nada: la paridad sigue devolviendo
  tramos. El aviso de advertencia que ya emite el módulo sigue siendo el que
  declara que el resultado puede no representar la superficie real.

### 4.2 Reparto de barras · `src/core/reparto.js` (archivo nuevo)

Puro, sin React, sin navegador, sin unidad activa. Lo van a reutilizar los
módulos de tabiquería y pisos, así que vive en `core` y no dentro de Cielo.

```js
/**
 * @param {number[]} piezasMm  largos pedidos, en mm
 * @param {{largoBarraMm:number, traslapoMm:number, retazoMinimoMm:number}} barra
 * @returns {{
 *   barras:number,           barras que hay que comprar
 *   piezas:number,           piezas pedidas después de partir las largas
 *   mlPedidos:number,        suma de los largos pedidos, en metros
 *   mlDescartados:number,    retazo que se pierde, en metros
 *   empalmes:number,         cuántos traslapos se consumieron
 *   grupos:{largoMm:number, veces:number}[]  para escribir la memoria
 * }|null}
 */
export function repartirBarras(piezasMm, barra)
```

Reglas, en orden:

1. **Validación.** `largoBarraMm > 0`, `traslapoMm >= 0`, `traslapoMm <
   largoBarraMm`, `retazoMinimoMm >= 0`. Entrada inválida devuelve `null`; no
   lanza nunca. Quien llama convierte el `null` en aviso con nombre y salida.
   `retazoMinimoMm` mayor que el largo de barra se acota al largo de barra.
2. **Partir las piezas largas.** Una pieza de largo `L > B` necesita
   `k = ceil((L − t) / (B − t))` tramos empalmados: `k − 1` barras enteras más
   un resto de `L − (k − 1)(B − t)`. Cada empalme consume el traslapo `t`.
3. **Repartir.** Las piezas se ordenan de mayor a menor y se van sacando de las
   barras abiertas, tomando la primera que calce; si ninguna calza, se abre una
   barra nueva.
4. **Descartar el retazo.** Cuando a una barra le quedan menos de
   `retazoMinimoMm`, esa barra **se cierra**: el sobrante es descarte y no
   vuelve al pozo. Ahí entra el caso del omega: de una barra de 3,00 m sale una
   corrida de 2,60 m y los 0,40 m restantes se pierden.

Propiedad deliberada: con `retazoMinimoMm = 0` nada se descarta y el resultado
converge al de hoy. El usuario que no quiera el descarte lo apaga en la ficha
del material, y la memoria de cálculo lo dice.

### 4.3 El módulo Cielo · `src/modules/cielo.js`

`calcular` deja de dividir el área. Las piezas de cada línea salen de la planta:

| línea | piezas |
|---|---|
| Perfil soportante | los ejes de la retícula, recortados contra el polígono |
| Perfil perimetral | los lados reales del polígono, uno por muro |
| Plancha | las posiciones de la retícula que tocan el polígono |
| Accesorios | sin cambios: densidad por metro cuadrado de área neta |

**El reparto se calcula una sola vez, en una función compartida**, y la usan
`calcular` y `trazar`. Es el punto central del diseño: hoy son dos cuentas
paralelas que pueden divergir, y a partir de este cambio el número que se compra
y la retícula que se dibuja son literalmente el mismo dato. La firma:

```js
/**
 * Reparto del módulo sobre la planta: ejes, corridas y posiciones de plancha.
 * No decide tinta, grosor ni presentación; devuelve milímetros de mundo.
 * @param {ContextoCalculo} ctx
 * @returns {{
 *   plancha: {material, pasoX, pasoY, columnas, filas, posiciones:Rect[]} | null,
 *   perfil:  {material, direccion, ejes:Linea[], corridas:number[]} | null
 * } | null}
 */
function repartoDelRecinto(ctx)
```

`trazar` toma de ahí sus rectángulos y sus líneas. Dos consecuencias buenas: las
posiciones de plancha que no tocan la planta ya no se emiten —hoy se emiten y el
`clipPath` las borra—, y los ejes se pueden seguir dibujando completos contra el
rectángulo envolvente, porque el recorte visual lo sigue haciendo el compositor.
El `clipPath` del lienzo no cambia.

**Cantidades.** El porcentaje de desperdicio se conserva y se aplica encima del
conteo. Deja de cargar con el retazo: ahora cubre rotura, error de corte y
merma, que es lo que siempre debió cubrir. La ayuda del parámetro lo dice.

```
PERFIL      corridas = recorte de cada eje contra el polígono
            teórica  = repartirBarras(corridas, perfil).barras
PERIMETRAL  piezas   = largo de cada lado del polígono
            teórica  = repartirBarras(piezas, perimetral).barras
PLANCHA     teórica  = posiciones de la retícula que tocan el polígono
final = techo(teórica × (1 + desperdicio/100))
```

`cantidadTeorica` pasa a ser un entero en las tres líneas. Es correcto: la
teórica es la cantidad antes del desperdicio y del redondeo, y acá el conteo ya
es discreto. La columna sigue existiendo y sigue siendo auditable.

**Topes de cálculo.** Los topes actuales (`MAX_PIEZAS_TRAZADO` 1500,
`MAX_EJES_TRAZADO` 400) son de dibujo: pasado el tope la capa no se pinta porque
sería una mancha. El cálculo necesita topes propios y mucho más altos, porque un
recinto grande igual tiene que entregar su número: `MAX_CORRIDAS_CALCULO`
20 000 y `MAX_POSICIONES_CALCULO` 50 000. Superarlos **no devuelve un número
malo**: emite aviso de error en esa línea y la deja fuera, igual que hoy hace la
separación en 0.

### 4.4 Memoria de cálculo

La nota deja de ser una división y pasa a ser el conteo.

> **Enmienda de implementación, 2026-08-18.** Se descartaron los dos formatos de
> perfil que este documento proponía —uno para corridas iguales y otro para
> corridas mixtas— y quedó **uno solo**, con el descarte declarado en metros
> lineales. Dos formatos eran dos caminos de código que había que mantener de
> acuerdo entre sí para decir lo mismo, y el agregado `descarte X,XX ml` deja el
> retazo perdido igual de visible que la frase larga. Los ejemplos de abajo son
> los que imprime el producto.

Formatos:

**Perfil** —resumen por grupos de largo, los tres mayores y el resto como
«y N largos más»:

> 24 corridas (21 × 2,60 m + 3 × 1,30 m) = 58,50 ml · barra de 3,00 m, retazo
> mínimo 0,50 m → 23 barras · descarte 10,50 ml · +5 % desperdicio = 24,15
> → 25 un

Ese es el proyecto San Vicente real, el que motivó el cambio: cubicaba 21 barras
y en obra quedaba corto.

**Perimetral:**

> 6 lados (1 × 9,50 m + 1 × 8,40 m + 1 × 2,60 m y 2 largos más) = 24,20 ml de
> perímetro · barra de 3,00 m, retazo mínimo 0,50 m → 9 barras · descarte
> 2,80 ml · +5 % desperdicio = 9,45 → 10 un

**Plancha** —cuando todas las posiciones tocan, el conteo se dice una sola vez:

> retícula de 3 × 4 sobre la planta: 12 posiciones · 10 parciales · +5 %
> desperdicio = 12,60 → 13 un

> retícula de 5 × 2 sobre la planta: 9 de 10 posiciones tocan el recinto ·
> 4 parciales · +8 % desperdicio = 9,72 → 10 un

El ejemplo del perimetral tiene dos lados de 3,20 m que no caben en una barra de
3,00 m: cada uno se empalma. Cuando hay empalmes **y el traslapo del material es
mayor que 0**, la nota agrega el tramo `· 2 empalmes de 0,15 m` antes del conteo
de barras. Con traslapo 0 —el ángulo perimetral, que se une a tope— el tramo se
omite: escribir «2 empalmes de 0,00 m» sería ruido, igual que hoy se omite
«+0 % desperdicio». Todas las cifras pasan por `f2`/`fCorto`, que ya existen.

### 4.5 Avisos nuevos

Cada uno nombra el problema **y** la salida, como exige `DESIGN.md`:

- `traslapoMm >= largoBarraMm` → **error**: «El traslapo de empalme del perfil
  {nombre} ({t} m) debe ser menor que su largo de barra ({B} m). Corrígelo en la
  Biblioteca.»
- `retazoMinimoMm > largoBarraMm` → **advertencia**: se acota al largo de barra
  y se declara que ningún retazo se reutiliza.
- Ninguna corrida sobre la planta → **error**: «No se trazó ninguna corrida de
  perfilería sobre la planta. Revisa la separación entre ejes.»
- Tope de cálculo superado → **error** con el número que se pidió y el tope.

Los avisos actuales se conservan tal cual, incluido el de la plancha que cubre
el recinto completo, que ahora sale del conteo igual a 1.

### 4.6 Ficha del material · `src/data/schema.js`, `seed.js`, `FormularioMaterial.jsx`

La barra suma dos campos:

| campo | tipo | defecto al normalizar | significado |
|---|---|---|---|
| `retazoMinimoMm` | `number` | `500` | Bajo ese largo, el sobrante de una barra es descarte y no se reutiliza |
| `traslapoMm` | `number` | `0` | Largo que consume cada empalme cuando la corrida es más larga que la barra |

`traslapoMm` ya existe en el esquema pero hoy se normaliza a `null` para todo lo
que no sea plancha (`schema.js:361`). Pasa a admitirse también en la barra, con
su propio significado: en la plancha es el traslapo que resta área útil, en la
barra es el que consume el empalme.

**Compatibilidad.** Un material guardado sin estos campos se normaliza al
defecto. No sube `FORMATO_VERSION`: los archivos y el `localStorage` existentes
siguen abriendo. Sí cambian los números de un proyecto guardado, sin que el
usuario toque nada, porque `retazoMinimoMm` entra en 500. **Es deliberado**: los
números anteriores estaban cortos. Queda auditable porque la memoria de cálculo
de cada línea imprime el umbral que usó, y editable en la Biblioteca.

Valores de la semilla (`src/data/seed.js`):

| material | `retazoMinimoMm` | `traslapoMm` |
|---|---|---|
| Perfil Omega 38 × 3000 | 500 | 150 |
| Perfil Omega 38 × 6000 | 500 | 150 |
| Ángulo perimetral 25 × 25 × 3000 | 500 | 0 (se une a tope) |

`FormularioMaterial.jsx` agrega los dos campos al bloque de la barra, siguiendo
la convención de los campos de largo que ya tiene, con su ayuda de campo.

## 5. Interfaz: bloque de cierre del consolidado

En `src/components/PanelRecintos.jsx`, la entrada del consolidado deja de ser un
rótulo suelto y pasa a bloque propio al pie de la clave:

- Separado del resto por un filete `rule-strong`, que es como esta edición marca
  un corte de zona.
- El nombre en registro de lectura de 15 px con tinta hierro, no en rótulo de
  11 px con tinta terciaria.
- La **cruz de registro** (`src/ui/Cruz.jsx`) en lugar del sigma: es la marca
  del sistema y acá cierra la clave que ella misma abre en la barra superior.
- A la derecha, la cifra de cierre en el registro de 17 px con `.kb-num`:
  recintos cubicados sobre el total. Es la salida del producto y le corresponde
  ese registro por la Regla del Registro Único de Compra.
- Cuando hay recintos fuera, la **escuadra de registro** de `.kb-detent` en
  `error-ink` en la esquina superior derecha, igual que la marca de avisos de la
  pestaña Resultados, con el conteo en el nombre accesible.
- La marca de selección no cambia: sigue siendo `.kb-key-mark[data-current]`,
  la misma barra de rúbrica que marca un recinto.

Gana peso por registro tipográfico, por filete y por cifra, que es como
`DESIGN.md` declara que se hace jerarquía en este sistema. No se usa elevación,
no se usa relleno naranja y no se le quita el naranja a «Agregar recinto», que
es la acción de edición de esa columna.

`DESIGN.md` suma el bloque a la sección de navegación.

## 6. Impresión

**Hoja dedicada, no un `@media print` sobre la pantalla.** La rejilla de la
aplicación apoya su alto en contenedores con `overflow-y-auto`, que en papel
recortan el documento a una página. Desarmarlos a la fuerza con `!important`
da un resultado impredecible y frágil. Se monta un documento aparte.

**`src/styles/impresion.css`**, importado al final de `base.css`:

- `@page { size: A4 portrait; margin: 14mm }`
- En `print`, la aplicación de pantalla se oculta y la hoja se muestra.
- `RulingLayer` se apaga: mide cajas en pantalla con `getBoundingClientRect` y
  en papel esa medida ya no vale. Es tinta decorativa y `aria-hidden`, así que
  apagarla no quita información.
- Reglas de corte: `break-inside: avoid` en cada fila con su nota,
  `break-after: avoid` en los títulos, y la cabecera de tabla repetida con
  `thead { display: table-header-group }`.

**`src/components/HojaImpresion.jsx`**, montado con `hidden print:block`
—Tailwind 4 trae la variante `print:` de fábrica—:

- `CabeceraHoja` — nombre del proyecto, título del documento, fecha de
  impresión y unidad activa. Se repite en las dos hojas.
- `HojaConsolidado` — recintos cubicados sobre el total; los recintos que
  quedaron fuera con su razón, arriba de la tabla como en pantalla; la tabla de
  materiales con su total; y la composición por recinto **en el flujo, bajo cada
  material**, porque en papel no hay margen de aparato medido.
- `HojaRecinto` — la planta, el listado de materiales del recinto y la memoria
  de cálculo de cada línea.

**`src/components/PlantaImpresa.jsx`** — SVG estático con `viewBox` ajustado al
rectángulo envolvente más un margen: polígono, capas de despiece que declara
`trazar`, cotas de cada segmento y área sobre el centroide. No comparte código
con `Lienzo.jsx` a propósito: `Lienzo` es una máquina de estados con vista,
zoom, arrastre, foco y teclado, y nada de eso existe en papel. Es el costo real
de este punto y se asume: un dibujo estático de una planta es corto, y meterle
un modo «solo lectura» al lienzo interactivo lo sería mucho menos.

**Botón.** `Imprimir`, variante secundaria, icono `Printer` de `lucide-react`,
en la cabecera de `VistaConsolidado` y de la pestaña Resultados. Llama a
`window.print()`. Es la única acción nueva.

`DESIGN.md` suma una sección de impresión y `PRODUCT.md` la declara en el
alcance funcional.

## 7. Pruebas

El cambio mueve toda cifra del producto y hoy el ciclo de respaldo no tiene
forma de probarlo. Entra `node --test`, que es del propio Node: **cero
dependencias nuevas**.

`npm test` → `node --test tests/`. Los archivos viven en `tests/` y no en
`src/`, para que no entren al `build` ni al recorrido de `design:check`.

| archivo | qué fija |
|---|---|
| `tests/geometry.test.mjs` | recorte de recta en rectángulo, en polígono cóncavo en L (dos corridas en un eje) y sobre el borde exacto; `rectanguloTocaPoligono` en los cuatro casos de solapamiento |
| `tests/reparto.test.mjs` | 2,6/3,0 con y sin descarte; piezas mixtas; empalme con traslapo; entrada inválida devuelve `null`; `retazoMinimoMm = 0` converge al conteo optimista |
| `tests/cielo.test.mjs` | el recinto de 2,6 m entrega más barras que el método por área; el conteo de planchas coincide con las posiciones que dibuja `trazar`; el módulo nunca lanza con entrada basura |

El ciclo de respaldo de `CLAUDE.md` pasa a ser `build` → `test` →
`design:check` → commit → push. Se actualiza el archivo en el commit que suma
las pruebas.

## 8. Documentos normativos que cambian

- **`PRODUCT.md`** · la restricción «No se implementa optimización de cortes. La
  cantidad de material sigue saliendo del área y de la longitud, nunca de un
  despiece resuelto pieza por pieza» pasa a: «La cantidad sale de las corridas y
  de las posiciones reales sobre la planta, con el retazo corto descartado según
  lo que declara el material. Sigue sin haber optimización de cortes: no se
  empaqueta, no se mezclan materiales y no se reutiliza retazo entre recintos.»
  Además suma la impresión al alcance funcional y los dos campos nuevos a la
  biblioteca.
- **`DESIGN.md`** · el bloque de cierre de la clave en la sección de navegación,
  y una sección de impresión.
- **`CLAUDE.md`** · `npm test` en el ciclo de respaldo.

## 9. Commits

Cuatro, cada uno con sentido propio y con el ciclo completo:

| # | commit | contenido |
|---|---|---|
| A | Campos nuevos de la barra | `schema.js`, `seed.js`, `FormularioMaterial.jsx`. No cambia ningún número: los campos existen y no los lee nadie todavía |
| B | Cubicación por corridas reales | `geometry.js`, `reparto.js`, `cielo.js`, `tests/`, `npm test`, `PRODUCT.md`, `CLAUDE.md` |
| C | Bloque de cierre del consolidado | `PanelRecintos.jsx`, `DESIGN.md` |
| D | Impresión | `impresion.css`, `HojaImpresion.jsx`, `PlantaImpresa.jsx`, botones, `DESIGN.md`, `PRODUCT.md` |

## 10. Riesgos

- **El número sube en todos los proyectos guardados.** Es el objetivo, pero
  conviene que el usuario revise San Vicente contra la realidad antes de
  confiar el resto. La memoria de cálculo de cada línea deja ver el umbral y el
  descarte que produjeron la diferencia.
- **El recorte de recta es el punto frágil.** Los casos de borde —eje sobre la
  arista, vértice exactamente sobre la recta, arista colineal— son justo los que
  ocurren siempre, porque el primer eje nace en el borde del rectángulo
  envolvente. Por eso son la primera prueba que se escribe.
- **`PlantaImpresa` duplica el dibujo de cotas.** Es duplicación conocida y
  acotada; la alternativa era un modo «solo lectura» dentro de `Lienzo.jsx`,
  que es peor.
