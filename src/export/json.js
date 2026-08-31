/**
 * Kubikar · exportación a JSON
 * -----------------------------------------------------------------------------
 * ESTE ARCHIVO ES EL PUNTO DE INTEGRACIÓN CON LA PLATAFORMA KARBEC.
 *
 * El JSON que se produce acá es el formato de intercambio del producto: lo lee
 * el propio Kubikar al importar y está pensado para que la plataforma Karbec lo
 * consuma sin traducción intermedia. Por eso:
 *
 *   · lleva `formato` y `version` en la raíz, para que un lector externo pueda
 *     rechazar lo que no entiende en vez de adivinar,
 *   · la geometría viaja SIEMPRE en milímetros (`unidadBase`), y la unidad de
 *     la interfaz viaja aparte como preferencia de presentación,
 *   · cada recinto incluye `areaMm2` y `perimetroMm` aunque sean derivados, para
 *     que quien lea no tenga que reimplementar el área de Gauss,
 *   · las líneas de material van congeladas tal como se cubicaron.
 *
 * Campos previstos para Karbec, VACÍOS en esta versión:
 *   · `codigoMaterial` — código de artículo del maestro de materiales.
 *   · `partida`        — partida de presupuesto que carga la línea.
 * Se emiten como `null` en cada material y en cada línea para que las columnas
 * ya existan del lado del que integra, y llenarlas más adelante no obligue a
 * subir la versión del formato.
 *
 * Este archivo produce ADEMÁS un segundo formato, `kubikar.biblioteca`, con el
 * catálogo completo y sin proyecto adentro. No es una variante del anterior: el
 * archivo de proyecto lleva a propósito solo los materiales que el proyecto usa,
 * y mudar un catálogo de perfiles con sus precios a otro computador es otra
 * tarea. Los dos comparten el sobre para que un lector externo —Karbec incluido—
 * decida qué está leyendo mirando un solo campo.
 */

import {
  FORMATO,
  FORMATO_BIBLIOTECA,
  FORMATO_BIBLIOTECA_VERSION,
  FORMATO_VERSION,
  UNIDAD_BASE,
  clonar,
} from '../data/schema.js'
import { sufijoNombre } from './csv.js'

/** MIME del archivo generado. */
export const MIME_JSON = 'application/json;charset=utf-8'

/**
 * Ids de material referidos por un proyecto, tanto por los parámetros de sus
 * módulos como por las líneas ya cubicadas.
 * @param {Object} proyecto
 * @returns {Set<string>}
 */
function materialesReferidos(proyecto) {
  const ids = new Set()
  const recintos = proyecto && Array.isArray(proyecto.recintos) ? proyecto.recintos : []
  for (const recinto of recintos) {
    for (const valor of Object.values(recinto.parametros || {})) {
      if (typeof valor === 'string' && valor) ids.add(valor)
    }
    for (const linea of Array.isArray(recinto.lineas) ? recinto.lineas : []) {
      if (linea && typeof linea.materialId === 'string' && linea.materialId) {
        ids.add(linea.materialId)
      }
    }
  }
  return ids
}

/**
 * Arma el objeto exportado completo.
 * @param {Object} proyecto proyecto activo
 * @param {Object[]} biblioteca biblioteca completa
 * @param {{todaLaBiblioteca?:boolean, fecha?:Date}} [opciones]
 * @returns {Object} objeto con la forma documentada en `data/schema.js`
 */
export function armarProyectoExportado(proyecto, biblioteca, opciones = {}) {
  const lista = Array.isArray(biblioteca) ? biblioteca : []
  const referidos = materialesReferidos(proyecto)
  const materiales = opciones.todaLaBiblioteca
    ? lista
    : lista.filter((material) => referidos.has(material.id))

  const fecha = opciones.fecha instanceof Date ? opciones.fecha : new Date()

  return {
    formato: FORMATO,
    version: FORMATO_VERSION,
    unidadBase: UNIDAD_BASE,
    generadoEn: fecha.toISOString(),
    proyecto: clonar(proyecto),
    biblioteca: clonar(materiales),
  }
}

/**
 * Serializa el proyecto para descarga. Va con sangría de dos espacios: el
 * archivo se abre y se revisa a mano en obra más veces de lo que parece.
 * @param {Object} proyecto
 * @param {Object[]} biblioteca
 * @param {{todaLaBiblioteca?:boolean, fecha?:Date}} [opciones]
 * @returns {string}
 */
export function jsonDeProyecto(proyecto, biblioteca, opciones = {}) {
  return JSON.stringify(armarProyectoExportado(proyecto, biblioteca, opciones), null, 2)
}

/**
 * Nombre de archivo sugerido: `kubikar-<proyecto>-<aaaa-mm-dd>.json`.
 * @param {Object} proyecto
 * @param {Date} [fecha]
 * @returns {string}
 */
export function nombreArchivoJson(proyecto, fecha = new Date()) {
  return `kubikar-${sufijoNombre(proyecto, fecha)}.json`
}

/* =============================================================================
   Biblioteca suelta
   -----------------------------------------------------------------------------
   La biblioteca es compartida entre proyectos y se traslada sin proyecto de por
   medio: el catálogo que se arma en la oficina tiene que llegar completo al
   notebook de faena, y el archivo de proyecto solo lleva los materiales que ese
   proyecto usa.
   ========================================================================== */

/**
 * Arma el objeto de biblioteca exportado.
 * @param {Object[]} biblioteca biblioteca completa
 * @param {{fecha?:Date}} [opciones]
 * @returns {Object}
 */
export function armarBibliotecaExportada(biblioteca, opciones = {}) {
  const fecha = opciones.fecha instanceof Date ? opciones.fecha : new Date()
  return {
    formato: FORMATO_BIBLIOTECA,
    version: FORMATO_BIBLIOTECA_VERSION,
    unidadBase: UNIDAD_BASE,
    generadoEn: fecha.toISOString(),
    biblioteca: clonar(Array.isArray(biblioteca) ? biblioteca : []),
  }
}

/**
 * Serializa la biblioteca completa para descarga.
 * @param {Object[]} biblioteca
 * @param {{fecha?:Date}} [opciones]
 * @returns {string}
 */
export function jsonDeBiblioteca(biblioteca, opciones = {}) {
  return JSON.stringify(armarBibliotecaExportada(biblioteca, opciones), null, 2)
}

/**
 * Nombre de archivo sugerido: `kubikar-biblioteca-<aaaa-mm-dd>.json`.
 *
 * Reusa `sufijoNombre` con un proyecto de mentira llamado "biblioteca" para que
 * la fecha se arme igual que en los otros dos archivos: tres archivos con tres
 * maneras distintas de escribir la misma fecha se ordenan mal en una carpeta.
 * @param {Date} [fecha]
 * @returns {string}
 */
export function nombreArchivoJsonBiblioteca(fecha = new Date()) {
  return `kubikar-${sufijoNombre({ nombre: 'biblioteca' }, fecha)}.json`
}

/**
 * Lee un archivo elegido por el usuario y devuelve su texto. La validación la
 * hace `validarProyectoImportado` en `data/schema.js`, vía `repo.importarProyecto`.
 * @param {File} archivo
 * @returns {Promise<string>}
 */
export function leerArchivoDeTexto(archivo) {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader()
    lector.onload = () => resolver(String(lector.result ?? ''))
    lector.onerror = () =>
      rechazar(new Error('No se pudo leer el archivo. Vuelve a elegirlo e intenta de nuevo.'))
    lector.readAsText(archivo, 'utf-8')
  })
}
