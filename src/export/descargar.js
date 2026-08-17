/**
 * Kubikar · descarga de archivos
 * -----------------------------------------------------------------------------
 * Un solo helper: arma un Blob, lo publica como URL de objeto, dispara la
 * descarga y revoca la URL. Revocar importa: cada URL de objeto sin revocar
 * retiene su Blob en memoria mientras viva la pestaña, y una sesión larga de
 * cubicación exporta muchas veces.
 */

import { MIME_CSV, csvDeProyecto, nombreArchivoCsv } from './csv.js'
import { MIME_JSON, jsonDeProyecto, nombreArchivoJson } from './json.js'

/**
 * Descarga un contenido de texto como archivo.
 * @param {string} nombreArchivo
 * @param {string} contenido
 * @param {string} [mimeType]
 * @returns {void}
 */
export function descargarTexto(nombreArchivo, contenido, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([contenido], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')

  enlace.href = url
  enlace.download = nombreArchivo
  enlace.rel = 'noopener'
  enlace.style.display = 'none'

  document.body.appendChild(enlace)
  enlace.click()
  document.body.removeChild(enlace)

  // Se revoca en el siguiente turno: revocar en el mismo tick cancela la
  // descarga en algunos navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/**
 * Exporta el proyecto activo a CSV.
 * @param {Object} proyecto
 * @returns {string} nombre del archivo descargado
 */
export function descargarCsvDeProyecto(proyecto) {
  const nombre = nombreArchivoCsv(proyecto)
  descargarTexto(nombre, csvDeProyecto(proyecto), MIME_CSV)
  return nombre
}

/**
 * Exporta el proyecto activo a JSON, el formato de intercambio con Karbec.
 * @param {Object} proyecto
 * @param {Object[]} biblioteca
 * @returns {string} nombre del archivo descargado
 */
export function descargarJsonDeProyecto(proyecto, biblioteca) {
  const nombre = nombreArchivoJson(proyecto)
  descargarTexto(nombre, jsonDeProyecto(proyecto, biblioteca), MIME_JSON)
  return nombre
}
