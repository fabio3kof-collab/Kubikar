/* =============================================================================
   Kubikar · núcleo de unidades
   -----------------------------------------------------------------------------
   La unidad base interna es el MILÍMETRO. Toda la geometría se almacena en mm y
   cambiar la unidad activa jamás altera un solo dato guardado: la unidad activa
   es una lente de lectura y de entrada, nada más.

   Este archivo es puro: no importa React, no toca el DOM y no tiene estado.
   ============================================================================ */

export const UNIDAD_BASE = 'mm'

/**
 * @typedef {Object} Unidad
 * @property {string} id            identificador estable ('mm' | 'cm' | 'm')
 * @property {string} label         abreviatura visible
 * @property {string} nombre        nombre completo en español
 * @property {number} mmPorUnidad   cuántos milímetros vale una unidad
 * @property {number} decimales     decimales con que se muestra una longitud
 * @property {number} pasoGrilla    paso de grilla por defecto, en esa unidad
 */

/** @type {Unidad[]} */
export const UNIDADES = [
  { id: 'mm', label: 'mm', nombre: 'milímetros', mmPorUnidad: 1, decimales: 0, pasoGrilla: 100 },
  { id: 'cm', label: 'cm', nombre: 'centímetros', mmPorUnidad: 10, decimales: 1, pasoGrilla: 10 },
  { id: 'm', label: 'm', nombre: 'metros', mmPorUnidad: 1000, decimales: 3, pasoGrilla: 1 },
]

/** Unidad usada cuando llega un id desconocido. */
const UNIDAD_FALLBACK = UNIDADES[0]

/**
 * Devuelve la definición de unidad de un id. Nunca devuelve undefined: ante un
 * id desconocido cae a la unidad base, de modo que ninguna cuenta se rompe.
 * @param {string} unidadId
 * @returns {Unidad}
 */
export function obtenerUnidad(unidadId) {
  for (let i = 0; i < UNIDADES.length; i += 1) {
    if (UNIDADES[i].id === unidadId) return UNIDADES[i]
  }
  return UNIDAD_FALLBACK
}

/**
 * Número finito o cero. Evita que un NaN se propague por toda la cadena.
 * @param {*} n
 * @returns {number}
 */
function num(n) {
  const v = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(v) ? v : 0
}

/**
 * Convierte un valor almacenado en milímetros a la unidad pedida.
 * @param {number} valorMm
 * @param {string} unidadId
 * @returns {number}
 */
export function aUnidad(valorMm, unidadId) {
  const u = obtenerUnidad(unidadId)
  const factor = u.mmPorUnidad > 0 ? u.mmPorUnidad : 1
  return num(valorMm) / factor
}

/**
 * Convierte un valor expresado en la unidad indicada a milímetros.
 * @param {number} valor
 * @param {string} unidadId
 * @returns {number}
 */
export function aMilimetros(valor, unidadId) {
  const u = obtenerUnidad(unidadId)
  const factor = u.mmPorUnidad > 0 ? u.mmPorUnidad : 1
  return num(valor) * factor
}

/**
 * Caché de formateadores: crear un Intl.NumberFormat por celda de tabla es caro.
 * @type {Map<string, Intl.NumberFormat>}
 */
const formateadores = new Map()

/**
 * @param {number} decimales
 * @returns {Intl.NumberFormat}
 */
function formateador(decimales) {
  const d = Math.max(0, Math.min(20, Math.trunc(num(decimales))))
  const clave = String(d)
  let f = formateadores.get(clave)
  if (!f) {
    f = new Intl.NumberFormat('es-CL', {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
      useGrouping: true,
    })
    formateadores.set(clave, f)
  }
  return f
}

/**
 * Formato numérico chileno: punto de miles, coma decimal. '1.234,5'
 * Devuelve cadena vacía si el valor no es un número utilizable.
 * @param {number|null|undefined} n
 * @param {number} [decimales]
 * @returns {string}
 */
export function formatearNumero(n, decimales = 0) {
  if (n === null || n === undefined) return ''
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v)) return ''
  // -0 se imprime como '-0' y eso no significa nada en una cubicación.
  const limpio = v === 0 ? 0 : v
  return formateador(decimales).format(limpio)
}

/**
 * Formatea una longitud almacenada en mm expresándola en la unidad activa, con
 * los decimales propios de esa unidad.
 * @param {number} valorMm
 * @param {string} unidadId
 * @param {{conUnidad?: boolean}} [opciones]
 * @returns {string}
 */
export function formatearLongitud(valorMm, unidadId, opciones = {}) {
  const conUnidad = opciones.conUnidad === true
  const u = obtenerUnidad(unidadId)
  const texto = formatearNumero(aUnidad(valorMm, u.id), u.decimales)
  if (texto === '') return ''
  return conUnidad ? `${texto} ${u.label}` : texto
}

/**
 * El área SIEMPRE se informa en metros cuadrados con dos decimales, sea cual
 * sea la unidad activa: en obra la superficie se habla en m².
 * @param {number} areaMm2
 * @returns {string}
 */
export function formatearArea(areaMm2) {
  return formatearNumero(mm2ToM2(areaMm2), 2)
}

/**
 * El metraje lineal SIEMPRE se informa en ml con dos decimales.
 * @param {number} largoMm
 * @returns {string}
 */
export function formatearLineal(largoMm) {
  return formatearNumero(mmToM(largoMm), 2)
}

/**
 * Cantidad de material (unidades, m², ml) con los decimales pedidos.
 * @param {number|null|undefined} n
 * @param {number} [decimales]
 * @returns {string}
 */
export function formatearCantidad(n, decimales = 2) {
  return formatearNumero(n, decimales)
}

/**
 * Pesos chilenos sin decimales: '$ 12.450'.
 * Devuelve cadena VACÍA cuando no hay precio cargado. Nunca '$ 0': un precio
 * ausente y un precio cero son cosas distintas en una cubicación.
 * @param {number|null|undefined} valor
 * @returns {string}
 */
export function formatearCLP(valor) {
  if (valor === null || valor === undefined || valor === '') return ''
  const v = typeof valor === 'number' ? valor : Number(valor)
  if (!Number.isFinite(v)) return ''
  const magnitud = formatearNumero(Math.abs(v), 0)
  if (magnitud === '') return ''
  return v < 0 ? `-$ ${magnitud}` : `$ ${magnitud}`
}

/**
 * Milímetros cuadrados a metros cuadrados.
 * @param {number} areaMm2
 * @returns {number}
 */
export function mm2ToM2(areaMm2) {
  return num(areaMm2) / 1000000
}

/**
 * Milímetros a metros.
 * @param {number} largoMm
 * @returns {number}
 */
export function mmToM(largoMm) {
  return num(largoMm) / 1000
}

/**
 * Interpreta un número escrito a mano. Acepta el formato chileno '1.234,5' y
 * también el formato de máquina '1234.5', porque en un campo de obra entran
 * los dos. Tolera espacios, espacio duro, signo peso y signo porcentaje.
 * Devuelve null si el texto no describe un número.
 * @param {string|number|null|undefined} texto
 * @returns {number|null}
 */
export function parsearNumeroCL(texto) {
  if (texto === null || texto === undefined) return null
  if (typeof texto === 'number') return Number.isFinite(texto) ? texto : null

  let s = String(texto).trim()
  if (s === '') return null

  // Ruido tolerado: separadores de miles no rompibles, símbolos de moneda y %.
  s = s.replace(/[\s  ]/g, '').replace(/\$/g, '').replace(/%/g, '')
  if (s === '') return null

  let signo = 1
  if (s[0] === '+') {
    s = s.slice(1)
  } else if (s[0] === '-') {
    signo = -1
    s = s.slice(1)
  }
  if (s === '') return null
  if (!/^[0-9.,]+$/.test(s)) return null

  const tieneComa = s.indexOf(',') !== -1
  const tienePunto = s.indexOf('.') !== -1

  let normal
  if (tieneComa) {
    // Formato chileno: la coma manda como decimal, el punto es de miles.
    if (s.split(',').length > 2) return null
    normal = s.replace(/\./g, '').replace(',', '.')
  } else if (tienePunto) {
    // Un punto ambiguo: '1.234' es mil doscientos treinta y cuatro en es-CL,
    // pero '1.5' es un decimal de máquina. Se decide por la forma del grupo.
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
      normal = s.replace(/\./g, '')
    } else if (s.split('.').length > 2) {
      return null
    } else {
      normal = s
    }
  } else {
    normal = s
  }

  if (!/^\d*(\.\d*)?$/.test(normal)) return null
  if (!/\d/.test(normal)) return null

  const v = Number(normal)
  if (!Number.isFinite(v)) return null
  return signo * v
}
