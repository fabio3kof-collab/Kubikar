/* =============================================================================
   Kubikar · deshacer y rehacer
   -----------------------------------------------------------------------------
   Pila genérica de instantáneas inmutables. No sabe nada de geometría ni de
   React: recibe un valor cualquiera, lo congela y lo apila.

   Modelo: `pasado` es una pila donde la CIMA es el presente. Empujar apila un
   presente nuevo y borra el futuro. Deshacer devuelve la cima al futuro y
   entrega la instantánea que queda debajo. Por eso hace falta más de una
   entrada en `pasado` para poder deshacer.

   La forma del historial es { pasado, futuro }, la misma que declara el estado
   de la aplicación. Toda operación devuelve objetos nuevos: nada se muta.
   ============================================================================ */

/** Profundidad máxima de la pila. Al pasarse se descarta lo más antiguo. */
export const LIMITE_HISTORIAL = 60

/**
 * @template T
 * @typedef {Object} Historial
 * @property {T[]} pasado   pila de instantáneas; la última es el presente
 * @property {T[]} futuro   instantáneas deshechas, disponibles para rehacer
 */

/**
 * @template T
 * @typedef {Object} ResultadoHistorial
 * @property {Historial<T>} historial   historial resultante
 * @property {T|null} instantanea       instantánea que debe restaurarse
 * @property {boolean} cambio           false si la operación no era posible
 */

/**
 * Congela en profundidad una instantánea para que nadie la modifique después de
 * apilada. Recorre objetos y arreglos planos, que es todo lo que guardamos.
 * @template T
 * @param {T} valor
 * @param {WeakSet<object>} [vistos]
 * @returns {T}
 */
function congelar(valor, vistos) {
  if (valor === null || typeof valor !== 'object') return valor
  const marca = vistos || new WeakSet()
  if (marca.has(valor)) return valor
  marca.add(valor)

  if (Array.isArray(valor)) {
    for (let i = 0; i < valor.length; i += 1) congelar(valor[i], marca)
  } else {
    const claves = Object.keys(valor)
    for (let i = 0; i < claves.length; i += 1) congelar(valor[claves[i]], marca)
  }

  return Object.isFrozen(valor) ? valor : Object.freeze(valor)
}

/**
 * Crea un historial vacío, o con una instantánea inicial ya apilada como
 * presente. Conviene pasar el estado inicial: sin él, la primera acción no
 * tiene a qué volver.
 * @template T
 * @param {T} [instantaneaInicial]
 * @returns {Historial<T>}
 */
export function crearHistorial(instantaneaInicial) {
  if (instantaneaInicial === undefined) return { pasado: [], futuro: [] }
  return { pasado: [congelar(instantaneaInicial)], futuro: [] }
}

/**
 * Apila una instantánea nueva como presente y descarta el futuro: rehacer deja
 * de tener sentido apenas se toma un camino distinto.
 * Si la instantánea es exactamente la misma referencia que el presente, el
 * historial se devuelve intacto.
 * @template T
 * @param {Historial<T>} historial
 * @param {T} instantanea
 * @returns {Historial<T>}
 */
export function empujar(historial, instantanea) {
  const h = normalizar(historial)
  if (instantanea === undefined) return h

  const presente = h.pasado.length > 0 ? h.pasado[h.pasado.length - 1] : undefined
  if (presente !== undefined && presente === instantanea && h.futuro.length === 0) return h

  const pasado = h.pasado.concat([congelar(instantanea)])
  const exceso = pasado.length - LIMITE_HISTORIAL
  return {
    pasado: exceso > 0 ? pasado.slice(exceso) : pasado,
    futuro: [],
  }
}

/**
 * Retrocede un paso. Devuelve el historial nuevo y la instantánea que hay que
 * restaurar. Si no se puede deshacer, devuelve el historial intacto,
 * `instantanea: null` y `cambio: false`.
 * @template T
 * @param {Historial<T>} historial
 * @returns {ResultadoHistorial<T>}
 */
export function deshacer(historial) {
  const h = normalizar(historial)
  if (!puedeDeshacer(h)) return { historial: h, instantanea: null, cambio: false }

  const pasado = h.pasado.slice(0, -1)
  const deshecha = h.pasado[h.pasado.length - 1]
  const futuro = [deshecha].concat(h.futuro)
  return {
    historial: { pasado, futuro: futuro.slice(0, LIMITE_HISTORIAL) },
    instantanea: pasado[pasado.length - 1],
    cambio: true,
  }
}

/**
 * Avanza un paso sobre lo deshecho.
 * @template T
 * @param {Historial<T>} historial
 * @returns {ResultadoHistorial<T>}
 */
export function rehacer(historial) {
  const h = normalizar(historial)
  if (!puedeRehacer(h)) return { historial: h, instantanea: null, cambio: false }

  const recuperada = h.futuro[0]
  const futuro = h.futuro.slice(1)
  const pasado = h.pasado.concat([recuperada])
  const exceso = pasado.length - LIMITE_HISTORIAL
  return {
    historial: { pasado: exceso > 0 ? pasado.slice(exceso) : pasado, futuro },
    instantanea: recuperada,
    cambio: true,
  }
}

/**
 * @param {Historial<*>} historial
 * @returns {boolean}
 */
export function puedeDeshacer(historial) {
  const h = normalizar(historial)
  return h.pasado.length > 1
}

/**
 * @param {Historial<*>} historial
 * @returns {boolean}
 */
export function puedeRehacer(historial) {
  const h = normalizar(historial)
  return h.futuro.length > 0
}

/**
 * Instantánea vigente, o null si el historial está vacío.
 * @template T
 * @param {Historial<T>} historial
 * @returns {T|null}
 */
export function presente(historial) {
  const h = normalizar(historial)
  return h.pasado.length > 0 ? h.pasado[h.pasado.length - 1] : null
}

/**
 * Acepta un historial malformado o ausente sin reventar. Devuelve el mismo
 * objeto cuando ya está bien formado, para no romper comparaciones por
 * referencia en el reductor.
 * @template T
 * @param {Historial<T>|null|undefined} historial
 * @returns {Historial<T>}
 */
function normalizar(historial) {
  if (historial && Array.isArray(historial.pasado) && Array.isArray(historial.futuro)) {
    return historial
  }
  return {
    pasado: historial && Array.isArray(historial.pasado) ? historial.pasado : [],
    futuro: historial && Array.isArray(historial.futuro) ? historial.futuro : [],
  }
}
