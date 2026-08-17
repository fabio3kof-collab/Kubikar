/**
 * Kubikar · exportación a CSV
 * -----------------------------------------------------------------------------
 * CSV pensado para abrirse en Excel con configuración regional chilena:
 *
 *   · separador de campos `;` (en es-CL la coma ya es el separador decimal),
 *   · decimales con coma, sin separador de miles para que la celda quede
 *     numérica y no como texto,
 *   · BOM UTF-8 al inicio, sin el cual Excel rompe las tildes y la ñ,
 *   · fin de línea CRLF.
 *
 * El precio unitario y el subtotal quedan VACÍOS cuando el material no tiene
 * precio cargado. Nunca se escribe 0: un cero en una planilla de presupuesto se
 * suma y miente.
 *
 * Este archivo no depende de `core/units.js` a propósito: el formato de una
 * celda de planilla no es el mismo problema que el formato de una cifra en
 * pantalla, y mezclarlos obliga a elegir mal en algún lado.
 */

/** Marca de orden de bytes UTF-8. */
export const BOM_UTF8 = '\uFEFF'

/** Separador de campos. */
export const SEPARADOR = ';'

/** Fin de línea que Excel espera. */
const FIN_LINEA = '\r\n'

/** MIME del archivo generado. */
export const MIME_CSV = 'text/csv;charset=utf-8'

/**
 * Columnas exactas del archivo, en orden.
 * @type {string[]}
 */
export const COLUMNAS_CSV = [
  'Recinto',
  'Material',
  'Unidad',
  'Cantidad teórica',
  'Desperdicio %',
  'Cantidad final',
  'Precio unitario',
  'Subtotal',
  'Nota',
]

/**
 * Formatea un número para la celda: coma decimal, sin separador de miles.
 * Recorta los ceros de la derecha por sobre el mínimo pedido.
 * @param {number|null|undefined} n
 * @param {{min?:number, max?:number}} [opciones]
 * @returns {string} cadena vacía si no hay número
 */
export function numeroCsv(n, opciones = {}) {
  const min = opciones.min ?? 0
  const max = opciones.max ?? 2
  if (n === null || n === undefined) return ''
  const valor = Number(n)
  if (!Number.isFinite(valor)) return ''

  let texto = valor.toFixed(max)
  if (max > min && texto.includes('.')) {
    const [entera, decimal = ''] = texto.split('.')
    let recortada = decimal.replace(/0+$/, '')
    while (recortada.length < min) recortada += '0'
    texto = recortada.length > 0 ? `${entera}.${recortada}` : entera
  }
  return texto.replace('.', ',')
}

/**
 * Escapa un valor de celda: se envuelve en comillas dobles si contiene el
 * separador, comillas o saltos de línea, y las comillas internas se duplican.
 * @param {*} valor
 * @returns {string}
 */
export function escaparCsv(valor) {
  if (valor === null || valor === undefined) return ''
  const texto = String(valor)
  if (texto === '') return ''
  const necesitaComillas =
    texto.includes(SEPARADOR) ||
    texto.includes('"') ||
    texto.includes('\n') ||
    texto.includes('\r')
  if (!necesitaComillas) return texto
  return `"${texto.replace(/"/g, '""')}"`
}

/**
 * Arma una fila a partir de un arreglo de celdas ya en texto.
 * @param {Array<*>} celdas
 * @returns {string}
 */
function fila(celdas) {
  return celdas.map(escaparCsv).join(SEPARADOR)
}

/**
 * Convierte una línea de material en su fila de planilla.
 * @param {string} nombreRecinto
 * @param {Object} linea línea de material del módulo de cálculo
 * @returns {string[]} celdas sin escapar
 */
function celdasDeLinea(nombreRecinto, linea) {
  const hayPrecio = linea.precioUnitario !== null && linea.precioUnitario !== undefined
  return [
    nombreRecinto,
    linea.nombre,
    linea.unidad,
    numeroCsv(linea.cantidadTeorica, { min: 2, max: 2 }),
    numeroCsv(linea.desperdicioPct, { min: 0, max: 2 }),
    numeroCsv(linea.cantidadFinal, { min: 0, max: 2 }),
    hayPrecio ? numeroCsv(linea.precioUnitario, { min: 0, max: 2 }) : '',
    hayPrecio ? numeroCsv(linea.subtotal, { min: 0, max: 2 }) : '',
    linea.nota ?? '',
  ]
}

/**
 * Arma el CSV a partir de recintos con sus líneas ya calculadas.
 * @param {{nombre:string, lineas:Array<Object>}[]} recintos
 * @returns {string} contenido completo, con BOM
 */
export function armarCsv(recintos) {
  const lineas = [fila(COLUMNAS_CSV)]
  const lista = Array.isArray(recintos) ? recintos : []

  for (const recinto of lista) {
    const nombre = recinto && recinto.nombre ? recinto.nombre : 'Recinto'
    const materiales = Array.isArray(recinto && recinto.lineas) ? recinto.lineas : []
    for (const linea of materiales) {
      lineas.push(fila(celdasDeLinea(nombre, linea)))
    }
  }

  return BOM_UTF8 + lineas.join(FIN_LINEA) + FIN_LINEA
}

/**
 * CSV de un proyecto completo, usando las líneas congeladas de cada recinto.
 * @param {Object} proyecto
 * @returns {string}
 */
export function csvDeProyecto(proyecto) {
  const recintos = proyecto && Array.isArray(proyecto.recintos) ? proyecto.recintos : []
  return armarCsv(recintos.map((r) => ({ nombre: r.nombre, lineas: r.lineas })))
}

/**
 * Nombre de archivo sugerido: `kubikar-<proyecto>-<aaaa-mm-dd>.csv`.
 * @param {Object} proyecto
 * @param {Date} [fecha]
 * @returns {string}
 */
export function nombreArchivoCsv(proyecto, fecha = new Date()) {
  return `kubikar-${sufijoNombre(proyecto, fecha)}.csv`
}

/**
 * Sufijo compartido con la exportación JSON.
 * @param {Object} proyecto
 * @param {Date} fecha
 * @returns {string}
 */
export function sufijoNombre(proyecto, fecha = new Date()) {
  const nombre = proyecto && proyecto.nombre ? proyecto.nombre : 'proyecto'
  const limpio =
    nombre
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'proyecto'
  const dia = new Date(fecha)
  const aaaa = dia.getFullYear()
  const mm = String(dia.getMonth() + 1).padStart(2, '0')
  const dd = String(dia.getDate()).padStart(2, '0')
  return `${limpio}-${aaaa}-${mm}-${dd}`
}
