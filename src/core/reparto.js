/* =============================================================================
   Kubikar · reparto de barras
   -----------------------------------------------------------------------------
   Cuántas barras hay que comprar para cubrir una lista de corridas de largo
   conocido. Es la cuenta que hace un jefe de obra con la huincha: de esta barra
   sale una corrida, sobran cuarenta centímetros, y esos cuarenta no sirven para
   nada más.

   Lo que este archivo NO es: no es una optimización de cortes. No empaqueta a
   la perfección, no mezcla materiales distintos, no numera piezas y no reutiliza
   nada entre recintos. Es una heurística declarada —de mayor a menor, primera
   barra que calce— elegida porque es la que se puede reconstruir a mano.

   Puro: sin React, sin navegador, sin unidad activa. Entra y sale en milímetros,
   salvo los totales de lectura, que salen en metros porque así se compran.
   ========================================================================== */

/** Tolerancia de coma flotante al comparar largos, en mm. */
const TOL_MM = 1e-6

/** Bajo este largo una pieza no es una pieza. */
const MIN_PIEZA_MM = 1

/**
 * Tope de seguridad de piezas tras partir las corridas largas. Una sola corrida
 * que pidiera más barras que esto es entrada absurda, no un recinto.
 */
const MAX_PIEZAS = 100_000

/**
 * @typedef {Object} BarraDeReparto
 * @property {number} largoBarraMm    largo comercial de la barra
 * @property {number} traslapoMm      lo que consume cada empalme; 0 si va a tope
 * @property {number} retazoMinimoMm  bajo ese sobrante la barra se cierra
 */

/**
 * @typedef {Object} Reparto
 * @property {number} barras          barras que hay que comprar
 * @property {number} piezas          piezas cortadas, ya partidas las corridas largas
 * @property {number} empalmes        traslapos consumidos
 * @property {number} mlPedidos       suma de las corridas pedidas, en metros
 * @property {number} mlDescartados   sobrante total de las barras compradas, en metros
 * @property {{largoMm:number,veces:number}[]} grupos  corridas resumidas por largo
 */

/**
 * @param {*} n
 * @returns {number}
 */
function num(n) {
  const v = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(v) ? v : 0
}

/**
 * Reparte una lista de corridas sobre barras de largo fijo.
 *
 * Cuatro reglas, en orden:
 *
 *  1. Se valida. Entrada imposible devuelve `null`; esta función nunca lanza.
 *  2. Una corrida más larga que la barra se parte en tramos empalmados. Con
 *     traslapo `t`, `k` tramos cubren `(k−1)(B−t) + B`, de donde sale
 *     `k = ceil((L − t) / (B − t))`: barras enteras y un resto.
 *  3. Las piezas se ordenan de mayor a menor y cada una entra en la primera
 *     barra abierta donde quepa; si no cabe en ninguna, se abre otra.
 *  4. Cuando a una barra le queda menos que el retazo mínimo, esa barra se
 *     CIERRA: el sobrante es descarte y no vuelve al pozo. Con retazo mínimo 0
 *     no se cierra nunca y el resultado converge al de suponer la barra entera,
 *     que es lo que hacía la cubicación por área.
 *
 * @param {number[]} corridasMm
 * @param {BarraDeReparto} barra
 * @returns {Reparto|null}
 */
export function repartirBarras(corridasMm, barra) {
  if (!Array.isArray(corridasMm)) return null
  if (!barra || typeof barra !== 'object') return null

  const largoBarra = num(barra.largoBarraMm)
  const traslapo = num(barra.traslapoMm)
  const retazoPedido = num(barra.retazoMinimoMm)

  if (!(largoBarra > 0)) return null
  if (traslapo < 0 || traslapo >= largoBarra) return null

  // Un retazo mínimo mayor que la barra significa que ningún sobrante sirve.
  // Se acota en vez de rechazarse: la intención se entiende y es válida.
  const retazoMinimo = Math.min(Math.max(retazoPedido, 0), largoBarra)

  // --- Corridas pedidas -----------------------------------------------------
  const corridas = []
  for (let i = 0; i < corridasMm.length; i += 1) {
    const largo = num(corridasMm[i])
    if (largo >= MIN_PIEZA_MM) corridas.push(largo)
  }

  const mlPedidos = corridas.reduce((suma, largo) => suma + largo, 0) / 1000

  // Resumen por largo, redondeado al milímetro: el recorte contra la planta
  // devuelve flotantes y agrupar por el valor crudo daría un grupo por corrida.
  const cuenta = new Map()
  for (let i = 0; i < corridas.length; i += 1) {
    const clave = Math.round(corridas[i])
    cuenta.set(clave, (cuenta.get(clave) || 0) + 1)
  }
  const grupos = [...cuenta.entries()]
    .map(([largoMm, veces]) => ({ largoMm, veces }))
    .sort((a, b) => b.largoMm - a.largoMm)

  if (corridas.length === 0) {
    return { barras: 0, piezas: 0, empalmes: 0, mlPedidos: 0, mlDescartados: 0, grupos: [] }
  }

  // --- Partir las corridas más largas que la barra ---------------------------
  const piezas = []
  let empalmes = 0
  const avance = largoBarra - traslapo

  for (let i = 0; i < corridas.length; i += 1) {
    const largo = corridas[i]
    if (largo <= largoBarra + TOL_MM) {
      piezas.push(Math.min(largo, largoBarra))
      continue
    }
    const tramos = Math.ceil((largo - traslapo) / avance)
    if (!Number.isFinite(tramos) || tramos < 1) return null
    if (piezas.length + tramos > MAX_PIEZAS) return null
    for (let k = 0; k < tramos - 1; k += 1) piezas.push(largoBarra)
    // El resto siempre cae en (traslapo, largoBarra] por construcción; se acota
    // igual para que un arrastre de coma flotante no produzca una pieza mayor
    // que la barra de la que se corta.
    const resto = Math.min(Math.max(largo - (tramos - 1) * avance, MIN_PIEZA_MM), largoBarra)
    piezas.push(resto)
    empalmes += tramos - 1
  }

  // --- Repartir de mayor a menor sobre las barras abiertas -------------------
  piezas.sort((a, b) => b - a)

  /** Lo que queda vivo en cada barra abierta, en mm. */
  const abiertas = []
  let barras = 0
  let sobranteMm = 0

  for (let i = 0; i < piezas.length; i += 1) {
    const pieza = piezas[i]
    let donde = -1
    for (let k = 0; k < abiertas.length; k += 1) {
      if (abiertas[k] + TOL_MM >= pieza) {
        donde = k
        break
      }
    }
    if (donde === -1) {
      barras += 1
      abiertas.push(largoBarra)
      donde = abiertas.length - 1
    }
    abiertas[donde] -= pieza
    if (abiertas[donde] < retazoMinimo) {
      sobranteMm += Math.max(abiertas[donde], 0)
      abiertas.splice(donde, 1)
    }
  }

  for (let i = 0; i < abiertas.length; i += 1) sobranteMm += Math.max(abiertas[i], 0)

  return {
    barras,
    piezas: piezas.length,
    empalmes,
    mlPedidos,
    mlDescartados: sobranteMm / 1000,
    grupos,
  }
}

export default repartirBarras
