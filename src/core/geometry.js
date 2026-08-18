/* =============================================================================
   Kubikar · núcleo de geometría
   -----------------------------------------------------------------------------
   Geometría plana pura, en milímetros, sin librerías externas, sin React y sin
   DOM. El área se calcula con la fórmula del área de Gauss.

   El eje Y crece hacia abajo en pantalla. Eso invierte el signo del área de
   Gauss respecto de la convención matemática, y no importa: el área publicada
   se toma en valor absoluto y el centroide es independiente del signo.

   Regla dura de este archivo: ninguna función divide por cero. Todo divisor se
   valida antes y toda función degenerada devuelve un valor neutro explícito.
   ============================================================================ */

/**
 * @typedef {Object} Vertice
 * @property {string} id
 * @property {number} x   milímetros
 * @property {number} y   milímetros
 */

/**
 * @typedef {Object} Segmento
 * @property {number} indice           índice del vértice inicial
 * @property {Vertice} a               vértice inicial
 * @property {Vertice} b               vértice final
 * @property {number} largoMm
 * @property {{x:number,y:number}} medio  punto medio, para colgar la cota
 * @property {number} angulo           radianes, atan2(dy, dx)
 */

/** Tolerancia numérica para comparaciones de área y de colinealidad. */
const EPS = 1e-9

/**
 * @param {*} n
 * @returns {number}
 */
function num(n) {
  const v = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(v) ? v : 0
}

/**
 * Arreglo de vértices saneado: descarta lo que no sea un punto legible.
 * @param {Vertice[]|null|undefined} vertices
 * @returns {Vertice[]}
 */
function lista(vertices) {
  if (!Array.isArray(vertices)) return []
  const out = []
  for (let i = 0; i < vertices.length; i += 1) {
    const v = vertices[i]
    if (v && typeof v === 'object') out.push(v)
  }
  return out
}

/**
 * Área con signo por la fórmula del área de Gauss:
 * A = Σ (x_i · y_{i+1} − x_{i+1} · y_i) / 2
 * El signo indica el sentido de recorrido. Devuelve 0 con menos de 3 vértices.
 * @param {Vertice[]} vertices
 * @returns {number} mm²
 */
export function areaFirmadaMm2(vertices) {
  const vs = lista(vertices)
  const n = vs.length
  if (n < 3) return 0
  let suma = 0
  for (let i = 0; i < n; i += 1) {
    const a = vs[i]
    const b = vs[(i + 1) % n]
    suma += num(a.x) * num(b.y) - num(b.x) * num(a.y)
  }
  return suma / 2
}

/**
 * Área del polígono, siempre positiva. 0 si hay menos de 3 vértices.
 * @param {Vertice[]} vertices
 * @returns {number} mm²
 */
export function areaMm2(vertices) {
  return Math.abs(areaFirmadaMm2(vertices))
}

/**
 * Perímetro: suma de los largos de los segmentos. Si el polígono está cerrado
 * incluye el segmento de retorno del último vértice al primero.
 * @param {Vertice[]} vertices
 * @param {boolean} [cerrado]
 * @returns {number} mm
 */
export function perimetroMm(vertices, cerrado = true) {
  const vs = lista(vertices)
  const n = vs.length
  if (n < 2) return 0
  let total = 0
  const ultimo = cerrado ? n : n - 1
  for (let i = 0; i < ultimo; i += 1) {
    total += distancia(vs[i], vs[(i + 1) % n])
  }
  return total
}

/**
 * Rectángulo envolvente. Con el arreglo vacío devuelve todo en cero, nunca
 * Infinity, para que el encuadre del lienzo no reciba basura.
 * @param {Vertice[]} vertices
 * @returns {{minX:number,minY:number,maxX:number,maxY:number,ancho:number,alto:number}}
 */
export function boundingBox(vertices) {
  const vs = lista(vertices)
  if (vs.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, ancho: 0, alto: 0 }
  }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let i = 0; i < vs.length; i += 1) {
    const x = num(vs[i].x)
    const y = num(vs[i].y)
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY, ancho: maxX - minX, alto: maxY - minY }
}

/**
 * Centroide de área del polígono. Cuando el área es cero (polígono degenerado,
 * dos vértices, todos colineales) cae al promedio aritmético de los vértices,
 * que sigue siendo un punto razonable donde colgar una etiqueta.
 * @param {Vertice[]} vertices
 * @returns {{x:number,y:number}}
 */
export function centroide(vertices) {
  const vs = lista(vertices)
  const n = vs.length
  if (n === 0) return { x: 0, y: 0 }

  const promedio = () => {
    let sx = 0
    let sy = 0
    for (let i = 0; i < n; i += 1) {
      sx += num(vs[i].x)
      sy += num(vs[i].y)
    }
    return { x: sx / n, y: sy / n }
  }

  if (n < 3) return promedio()

  const a = areaFirmadaMm2(vs)
  if (Math.abs(a) <= EPS) return promedio()

  let cx = 0
  let cy = 0
  for (let i = 0; i < n; i += 1) {
    const p = vs[i]
    const q = vs[(i + 1) % n]
    const px = num(p.x)
    const py = num(p.y)
    const qx = num(q.x)
    const qy = num(q.y)
    const cruz = px * qy - qx * py
    cx += (px + qx) * cruz
    cy += (py + qy) * cruz
  }
  return { x: cx / (6 * a), y: cy / (6 * a) }
}

/**
 * Descompone el polígono en segmentos con su largo, su punto medio y su ángulo.
 * Con menos de 2 vértices devuelve un arreglo vacío.
 * @param {Vertice[]} vertices
 * @param {boolean} [cerrado]
 * @returns {Segmento[]}
 */
export function segmentos(vertices, cerrado = true) {
  const vs = lista(vertices)
  const n = vs.length
  if (n < 2) return []
  const total = cerrado ? n : n - 1
  const out = []
  for (let i = 0; i < total; i += 1) {
    const a = vs[i]
    const b = vs[(i + 1) % n]
    const ax = num(a.x)
    const ay = num(a.y)
    const bx = num(b.x)
    const by = num(b.y)
    out.push({
      indice: i,
      a,
      b,
      largoMm: Math.hypot(bx - ax, by - ay),
      medio: { x: (ax + bx) / 2, y: (ay + by) / 2 },
      angulo: Math.atan2(by - ay, bx - ax),
    })
  }
  return out
}

/**
 * Producto cruz de (b−a) × (c−a). El signo dice de qué lado del segmento ab
 * queda el punto c.
 * @param {{x:number,y:number}} a
 * @param {{x:number,y:number}} b
 * @param {{x:number,y:number}} c
 * @returns {number}
 */
function cruz(a, b, c) {
  return (
    (num(b.x) - num(a.x)) * (num(c.y) - num(a.y)) - (num(b.y) - num(a.y)) * (num(c.x) - num(a.x))
  )
}

/**
 * Escala de tolerancia proporcional al TAMAÑO de los segmentos comparados: un
 * umbral absoluto se vuelve inútil cuando se trabaja en milímetros y las
 * coordenadas llegan a las decenas de miles.
 *
 * La escala se mide contra un origen común —el primer punto—, no contra el
 * cero del mundo. Con coordenadas absolutas, una figura chica lejos del origen
 * produce una tolerancia enorme, todos los productos cruz caen bajo ella, los
 * cuatro signos se aplanan a 0 y un cuadrado perfecto se declara traslapado.
 * Restando el origen, la tolerancia depende de lo que mide la figura y no de
 * dónde está puesta.
 *
 * @param {{x:number,y:number}} p1
 * @param {{x:number,y:number}} p2
 * @param {{x:number,y:number}} p3
 * @param {{x:number,y:number}} p4
 * @returns {number}
 */
function toleranciaCruz(p1, p2, p3, p4) {
  const ox = num(p1.x)
  const oy = num(p1.y)
  const escala = Math.max(
    Math.abs(num(p2.x) - ox),
    Math.abs(num(p2.y) - oy),
    Math.abs(num(p3.x) - ox),
    Math.abs(num(p3.y) - oy),
    Math.abs(num(p4.x) - ox),
    Math.abs(num(p4.y) - oy),
    1,
  )
  return escala * escala * 1e-9
}

/**
 * Proyección escalar de un punto sobre la dirección de un segmento. Sirve para
 * medir traslapes entre segmentos colineales sin dividir por su largo.
 * @param {{x:number,y:number}} p
 * @param {{x:number,y:number}} dir
 * @returns {number}
 */
function proyeccion(p, dir) {
  return num(p.x) * num(dir.x) + num(p.y) * num(dir.y)
}

/**
 * ¿Se cruzan de verdad dos segmentos? Cruce propio (cada segmento pasa de un
 * lado al otro del contrario) o traslape colineal de largo no nulo.
 *
 * El contacto en un solo punto NO cuenta: dos segmentos que apenas se tocan en
 * un vértice compartido o duplicado son un caso corriente mientras se dibuja y
 * no justifican levantar una advertencia.
 * @param {{x:number,y:number}} p1
 * @param {{x:number,y:number}} p2
 * @param {{x:number,y:number}} p3
 * @param {{x:number,y:number}} p4
 * @returns {boolean}
 */
function seCruzan(p1, p2, p3, p4) {
  const tol = toleranciaCruz(p1, p2, p3, p4)

  const d1 = cruz(p3, p4, p1)
  const d2 = cruz(p3, p4, p2)
  const d3 = cruz(p1, p2, p3)
  const d4 = cruz(p1, p2, p4)

  const s1 = Math.abs(d1) <= tol ? 0 : Math.sign(d1)
  const s2 = Math.abs(d2) <= tol ? 0 : Math.sign(d2)
  const s3 = Math.abs(d3) <= tol ? 0 : Math.sign(d3)
  const s4 = Math.abs(d4) <= tol ? 0 : Math.sign(d4)

  if (s1 !== 0 && s2 !== 0 && s3 !== 0 && s4 !== 0) {
    return s1 !== s2 && s3 !== s4
  }

  // Todo colineal: se mide el traslape proyectando sobre la dirección común.
  if (s1 === 0 && s2 === 0 && s3 === 0 && s4 === 0) {
    const dx = num(p2.x) - num(p1.x)
    const dy = num(p2.y) - num(p1.y)
    const largo = Math.hypot(dx, dy)
    if (largo <= EPS) return false
    const dir = { x: dx / largo, y: dy / largo }

    const a1 = proyeccion(p1, dir)
    const a2 = proyeccion(p2, dir)
    const b1 = proyeccion(p3, dir)
    const b2 = proyeccion(p4, dir)

    const inicio = Math.max(Math.min(a1, a2), Math.min(b1, b2))
    const fin = Math.min(Math.max(a1, a2), Math.max(b1, b2))
    const traslape = fin - inicio
    return traslape > largo * 1e-6
  }

  // Contacto en un punto (un extremo apoyado sobre el otro segmento): tolerado.
  return false
}

/**
 * ¿El polígono se cruza a sí mismo? Prueba cada par de segmentos NO adyacentes.
 * En un polígono cerrado el primer y el último segmento también son adyacentes.
 * @param {Vertice[]} vertices
 * @param {boolean} [cerrado]
 * @returns {boolean}
 */
export function esAutoIntersectante(vertices, cerrado = true) {
  const segs = segmentos(vertices, cerrado)
  const n = segs.length
  if (n < 4) return false

  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const adyacente = j === i + 1 || (cerrado && i === 0 && j === n - 1)
      if (adyacente) continue
      const s = segs[i]
      const t = segs[j]
      if (seCruzan(s.a, s.b, t.a, t.b)) return true
    }
  }
  return false
}

/**
 * Elimina vértices duplicados dentro de epsMm y, con ello, los segmentos de
 * largo cero. Preserva el orden de recorrido y conserva siempre el primer
 * vértice de cada racimo de duplicados. También descarta el último vértice si
 * coincide con el primero: el cierre es implícito, no un vértice repetido.
 * @param {Vertice[]} vertices
 * @param {number} [epsMm]
 * @returns {Vertice[]}
 */
export function limpiarVertices(vertices, epsMm = 1) {
  const vs = lista(vertices)
  if (vs.length === 0) return []
  const eps = Number.isFinite(epsMm) && epsMm > 0 ? epsMm : 0

  const out = []
  for (let i = 0; i < vs.length; i += 1) {
    const v = vs[i]
    const previo = out.length > 0 ? out[out.length - 1] : null
    if (previo && cercaDe(previo, v, eps)) continue
    out.push(v)
  }

  while (out.length > 1 && cercaDe(out[0], out[out.length - 1], eps)) {
    out.pop()
  }

  return out
}

/**
 * Mueve un vértice por id. Devuelve SIEMPRE un arreglo nuevo; si el id no
 * existe, el arreglo nuevo es una copia sin cambios.
 * @param {Vertice[]} vertices
 * @param {string} id
 * @param {number} x
 * @param {number} y
 * @returns {Vertice[]}
 */
export function moverVertice(vertices, id, x, y) {
  const vs = lista(vertices)
  return vs.map((v) => (v.id === id ? { ...v, x: num(x), y: num(y) } : v))
}

/**
 * Fija el largo de un segmento: el vértice `a` queda clavado donde está y el
 * vértice `b` se desplaza sobre la dirección actual del segmento hasta el largo
 * pedido. Si el segmento tiene largo 0 no hay dirección que seguir, así que
 * devuelve el arreglo original sin tocar nada.
 * @param {Vertice[]} vertices
 * @param {number} indice        índice del segmento (= índice del vértice `a`)
 * @param {number} nuevoLargoMm
 * @param {boolean} [cerrado]
 * @returns {Vertice[]}
 */
export function fijarLargoSegmento(vertices, indice, nuevoLargoMm, cerrado = true) {
  const vs = lista(vertices)
  const n = vs.length
  if (n < 2) return vertices

  const i = Math.trunc(num(indice))
  const total = cerrado ? n : n - 1
  if (i < 0 || i >= total) return vertices

  const largo = typeof nuevoLargoMm === 'number' ? nuevoLargoMm : Number(nuevoLargoMm)
  if (!Number.isFinite(largo) || largo <= 0) return vertices

  const iB = (i + 1) % n
  const a = vs[i]
  const b = vs[iB]
  const dx = num(b.x) - num(a.x)
  const dy = num(b.y) - num(a.y)
  const actual = Math.hypot(dx, dy)
  if (actual <= EPS) return vertices

  const ux = dx / actual
  const uy = dy / actual
  const destino = { ...b, x: num(a.x) + ux * largo, y: num(a.y) + uy * largo }

  const out = vs.slice()
  out[iB] = destino
  return out
}

/**
 * Imán a la grilla. Con paso no positivo o no finito devuelve el valor tal cual:
 * el imán apagado no debe deformar la coordenada.
 * @param {number} valor
 * @param {number} pasoMm
 * @returns {number}
 */
export function ajustarAGrilla(valor, pasoMm) {
  const v = num(valor)
  const paso = typeof pasoMm === 'number' ? pasoMm : Number(pasoMm)
  if (!Number.isFinite(paso) || paso <= 0) return v
  return Math.round(v / paso) * paso
}

/**
 * Modo ortogonal: restringe el punto de llegada al eje dominante respecto del
 * punto de partida, de modo que el trazo quede horizontal o vertical.
 * @param {{x:number,y:number}} desde
 * @param {{x:number,y:number}} hasta
 * @returns {{x:number,y:number}}
 */
export function restringirOrtogonal(desde, hasta) {
  const ax = num(desde && desde.x)
  const ay = num(desde && desde.y)
  const bx = num(hasta && hasta.x)
  const by = num(hasta && hasta.y)
  const dx = Math.abs(bx - ax)
  const dy = Math.abs(by - ay)
  return dx >= dy ? { x: bx, y: ay } : { x: ax, y: by }
}

/**
 * Distancia euclidiana entre dos puntos, en mm.
 * @param {{x:number,y:number}} a
 * @param {{x:number,y:number}} b
 * @returns {number}
 */
export function distancia(a, b) {
  if (!a || !b) return 0
  return Math.hypot(num(b.x) - num(a.x), num(b.y) - num(a.y))
}

/**
 * ¿Dos puntos están dentro de la tolerancia dada? Con tolerancia 0 exige
 * coincidencia exacta.
 * @param {{x:number,y:number}} a
 * @param {{x:number,y:number}} b
 * @param {number} tolMm
 * @returns {boolean}
 */
export function cercaDe(a, b, tolMm) {
  if (!a || !b) return false
  const tol = typeof tolMm === 'number' && Number.isFinite(tolMm) && tolMm > 0 ? tolMm : 0
  return distancia(a, b) <= tol
}

/* =============================================================================
   Lectura de la planta para cubicar
   -----------------------------------------------------------------------------
   Estas tres funciones son las que permiten que la cantidad de material salga de
   la planta y no de una división del área. Son geometría pura igual que el
   resto del archivo: no saben qué es un perfil ni qué es una plancha.
   ========================================================================== */

/** Bajo este largo un tramo no es una corrida: es ruido de coma flotante. */
const MIN_CORRIDA_MM = 1

/**
 * Recorta una recta contra el polígono y devuelve los tramos que quedan DENTRO.
 *
 * Barrido por paridad: se mira de qué lado de la recta cae cada extremo de cada
 * arista, se anotan los cruces, se ordenan por su avance sobre la recta y se
 * aparean. Un polígono cóncavo devuelve varios tramos en la misma recta, que es
 * exactamente el caso que la división del área no sabe ver.
 *
 * La comparación de lado es SEMIABIERTA (`<= 0`), y de ahí sale una asimetría
 * que conviene conocer antes de usar la función: un vértice apoyado justo sobre
 * la recta se cuenta una sola vez y una arista colineal no aporta cruce, de modo
 * que una recta que coincide con el borde de arranque del polígono devuelve la
 * corrida completa y la que coincide con el borde opuesto no devuelve nada. No
 * es un defecto sino la única forma de que un vértice no cuente dos veces; quien
 * muestrea ejes sobre la planta desplaza el eje que cae sobre un muro.
 *
 * @param {Vertice[]} vertices
 * @param {{x1:number,y1:number,x2:number,y2:number}} linea  dos puntos cualesquiera de la recta
 * @returns {{x1:number,y1:number,x2:number,y2:number,largoMm:number}[]}
 */
export function recortarLineaEnPoligono(vertices, linea) {
  const pts = lista(vertices)
  if (pts.length < 3 || !linea || typeof linea !== 'object') return []

  const px = num(linea.x1)
  const py = num(linea.y1)
  const dx = num(linea.x2) - px
  const dy = num(linea.y2) - py
  const largoDir = Math.hypot(dx, dy)
  if (!(largoDir > EPS)) return []
  const ux = dx / largoDir
  const uy = dy / largoDir

  /** Producto cruz de la dirección por el vector al punto: de qué lado cae. */
  const lado = (p) => ux * (num(p.y) - py) - uy * (num(p.x) - px)

  /** Avance de cada cruce sobre la recta, en mm desde el punto de referencia. */
  const cortes = []
  for (let i = 0; i < pts.length; i += 1) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    const sa = lado(a)
    const sb = lado(b)
    if ((sa <= 0) === (sb <= 0)) continue
    // Los signos difieren, así que `sa - sb` nunca es cero: no hay división
    // por cero posible acá.
    const t = sa / (sa - sb)
    const x = num(a.x) + t * (num(b.x) - num(a.x))
    const y = num(a.y) + t * (num(b.y) - num(a.y))
    cortes.push((x - px) * ux + (y - py) * uy)
  }

  if (cortes.length < 2) return []
  cortes.sort((m, n) => m - n)

  const tramos = []
  for (let i = 0; i + 1 < cortes.length; i += 2) {
    const desde = cortes[i]
    const hasta = cortes[i + 1]
    const largoMm = hasta - desde
    if (!(largoMm >= MIN_CORRIDA_MM)) continue
    tramos.push({
      x1: px + ux * desde,
      y1: py + uy * desde,
      x2: px + ux * hasta,
      y2: py + uy * hasta,
      largoMm,
    })
  }
  return tramos
}

/**
 * ¿El punto cae dentro del polígono? Paridad de rayo hacia la derecha.
 * @param {Vertice[]} vertices
 * @param {{x:number,y:number}} punto
 * @returns {boolean}
 */
export function contienePunto(vertices, punto) {
  const pts = lista(vertices)
  if (pts.length < 3 || !punto || typeof punto !== 'object') return false

  const x = num(punto.x)
  const y = num(punto.y)
  let dentro = false

  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
    const xi = num(pts[i].x)
    const yi = num(pts[i].y)
    const xj = num(pts[j].x)
    const yj = num(pts[j].y)
    // Semiabierto por arriba, igual que el recorte: un vértice a la altura
    // exacta del rayo pertenece a una sola de sus dos aristas.
    if (yi > y === yj > y) continue
    const corte = xi + ((y - yi) / (yj - yi)) * (xj - xi)
    if (x < corte) dentro = !dentro
  }

  return dentro
}

/**
 * ¿El rectángulo toca la planta? Se responde en tres modos, en orden de costo:
 * una esquina del rectángulo dentro del polígono, un vértice del polígono dentro
 * del rectángulo —el caso de un rectángulo que se lo traga entero— o el cruce de
 * alguna arista con alguna. Antes de todo eso se descarta por rectángulo
 * envolvente, que resuelve la enorme mayoría de las posiciones de una retícula.
 *
 * Un rectángulo degenerado (sin ancho o sin alto) no toca nada: no es una
 * posición de material, es una línea.
 *
 * @param {Vertice[]} vertices
 * @param {{x:number,y:number,ancho:number,alto:number}} rect
 * @returns {boolean}
 */
export function rectanguloTocaPoligono(vertices, rect) {
  const pts = lista(vertices)
  if (pts.length < 3 || !rect || typeof rect !== 'object') return false

  const x = num(rect.x)
  const y = num(rect.y)
  const ancho = num(rect.ancho)
  const alto = num(rect.alto)
  if (!(ancho > 0) || !(alto > 0)) return false

  const x2 = x + ancho
  const y2 = y + alto

  const caja = boundingBox(pts)
  if (x2 < caja.minX || x > caja.maxX || y2 < caja.minY || y > caja.maxY) return false

  const esquinas = [
    { x, y },
    { x: x2, y },
    { x: x2, y: y2 },
    { x, y: y2 },
  ]

  for (let i = 0; i < esquinas.length; i += 1) {
    if (contienePunto(pts, esquinas[i])) return true
  }

  for (let i = 0; i < pts.length; i += 1) {
    const vx = num(pts[i].x)
    const vy = num(pts[i].y)
    if (vx >= x && vx <= x2 && vy >= y && vy <= y2) return true
  }

  for (let i = 0; i < pts.length; i += 1) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    for (let k = 0; k < 4; k += 1) {
      if (seCruzan(a, b, esquinas[k], esquinas[(k + 1) % 4])) return true
    }
  }

  return false
}

/**
 * ¿El rectángulo cabe ENTERO dentro del polígono? Es la pregunta complementaria
 * de `rectanguloTocaPoligono` y sirve para separar una posición de material que
 * se aprovecha completa de una que va a salir cortada.
 *
 * Se responde con las cuatro esquinas dentro y ninguna arista del polígono
 * cruzando el rectángulo. Lo segundo no es redundante: un polígono cóncavo puede
 * meter una muesca por el medio sin tocar ninguna esquina.
 *
 * @param {Vertice[]} vertices
 * @param {{x:number,y:number,ancho:number,alto:number}} rect
 * @returns {boolean}
 */
export function rectanguloDentroDePoligono(vertices, rect) {
  const pts = lista(vertices)
  if (pts.length < 3 || !rect || typeof rect !== 'object') return false

  const x = num(rect.x)
  const y = num(rect.y)
  const ancho = num(rect.ancho)
  const alto = num(rect.alto)
  if (!(ancho > 0) || !(alto > 0)) return false

  const x2 = x + ancho
  const y2 = y + alto
  const esquinas = [
    { x, y },
    { x: x2, y },
    { x: x2, y: y2 },
    { x, y: y2 },
  ]

  for (let i = 0; i < esquinas.length; i += 1) {
    if (!contienePunto(pts, esquinas[i])) return false
  }

  for (let i = 0; i < pts.length; i += 1) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    for (let k = 0; k < 4; k += 1) {
      if (seCruzan(a, b, esquinas[k], esquinas[(k + 1) % 4])) return false
    }
  }

  return true
}
