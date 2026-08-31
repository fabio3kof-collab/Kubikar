/**
 * Kubikar · repositorio (única puerta de persistencia)
 * -----------------------------------------------------------------------------
 * RESTRICCIÓN ARQUITECTÓNICA DEL PROYECTO
 *
 * Ningún componente, hook o módulo de cálculo importa `storage.js` ni menciona
 * `localStorage`. Todo el acceso a datos pasa por este objeto `repo`, y TODOS
 * sus métodos son asíncronos aunque el driver local sea síncrono.
 *
 * El objetivo es explícito: cuando Kubikar guarde contra la API de la
 * plataforma Karbec, se reescribe SOLO este archivo — cada método pasa a ser un
 * `fetch` — y no se toca ni una línea de interfaz ni de cálculo. Por eso:
 *
 *   1. La firma de cada método es la que tendría un cliente de API: recibe y
 *      devuelve objetos de dominio ya normalizados, nunca texto crudo.
 *   2. Todo devuelve promesas, así la interfaz ya está escrita contra latencia
 *      de red y no habrá que introducir estados de carga después.
 *   3. Nada de acá arriba filtra detalles del driver: quien consume solo ve
 *      objetos de dominio y `ErrorAlmacenamiento`, que en la versión API pasará
 *      a envolver fallas de red con la misma forma `{tipo, mensaje}`.
 *   4. El repositorio no calcula: congela lo que la capa de cálculo le entrega.
 *
 * Único punto de acoplamiento con el navegador: los tres imports de abajo.
 */

import { CLAVES, ErrorAlmacenamiento, borrar, escribir, leer } from './storage.js'
import {
  ahoraISO,
  clonar,
  normalizarMaterial,
  normalizarProyecto,
  nuevoId,
  nuevoProyecto,
  validarProyectoImportado,
  UNIDAD_POR_DEFECTO,
} from './schema.js'
import { materialesSemilla } from './seed.js'

export { ErrorAlmacenamiento }

/**
 * @typedef {Object} Preferencias
 * @property {string} unidadActiva      'mm' | 'cm' | 'm'
 * @property {string|null} proyectoActivoId
 * @property {boolean} imanGrilla
 * @property {boolean} ortogonal
 * @property {boolean} verPiezas        dibujar las piezas de material en la planta
 * @property {boolean} verEjes          dibujar los ejes de elementos lineales
 * @property {number} pasoGrilla        paso de grilla en milímetros
 * @property {string|null} versionDescartada  versión publicada que el usuario ya vio y descartó
 */

/** @type {Preferencias} */
export const PREFERENCIAS_POR_DEFECTO = {
  unidadActiva: UNIDAD_POR_DEFECTO,
  proyectoActivoId: null,
  imanGrilla: true,
  ortogonal: false,
  verPiezas: true,
  verEjes: true,
  pasoGrilla: 100,
  // Nunca se descartó ninguna: la primera versión nueva avisa. Guardar el
  // número y no un booleano es lo que hace que descartar la 0.2.0 no silencie
  // también la 0.3.0.
  versionDescartada: null,
}

/**
 * Lee uno de los dos interruptores del despiece desde lo guardado, heredando
 * del interruptor único `verDespiece` que existió antes que ellos.
 *
 * @param {Object} crudo    preferencias tal como salieron del almacén
 * @param {'verPiezas'|'verEjes'} clave
 * @returns {boolean}
 */
function booleanoDeDespiece(crudo, clave) {
  if (typeof crudo[clave] === 'boolean') return crudo[clave]
  if (crudo.verDespiece === false) return false
  return true
}

/* =============================================================================
   Acceso interno al driver
   Sustituir estas cuatro funciones por llamadas HTTP es todo lo que se necesita
   para mover Kubikar a la API de Karbec.
   ========================================================================== */

/** @returns {Object[]} todos los proyectos completos, normalizados */
function cargarProyectos() {
  const crudo = leer(CLAVES.proyectos, [])
  if (!Array.isArray(crudo)) return []
  return crudo.map(normalizarProyecto)
}

/** @param {Object[]} lista */
function persistirProyectos(lista) {
  escribir(CLAVES.proyectos, lista)
}

/** @returns {Object[]} biblioteca completa, normalizada */
function cargarBiblioteca() {
  const crudo = leer(CLAVES.biblioteca, null)
  if (!Array.isArray(crudo)) return []
  return crudo.map(normalizarMaterial)
}

/**
 * ¿La biblioteca ya se sembró alguna vez?
 *
 * La clave ausente y el arreglo vacío son cosas distintas: la primera es un
 * navegador donde Kubikar nunca corrió, la segunda es un usuario que borró
 * todos sus materiales a propósito. Sembrar por `length === 0` volvería a
 * meterle los ocho materiales de ejemplo en la siguiente recarga y dejaría el
 * estado vacío de la Biblioteca —con su acción "Restaurar materiales de
 * ejemplo"— sin sentido y sin manera de alcanzarlo.
 *
 * @returns {boolean}
 */
function bibliotecaSembrada() {
  return Array.isArray(leer(CLAVES.biblioteca, null))
}

/** @param {Object[]} lista */
function persistirBiblioteca(lista) {
  escribir(CLAVES.biblioteca, lista)
}

/**
 * Resumen de proyecto para el selector.
 * @param {Object} proyecto
 * @returns {{id:string,nombre:string,actualizadoEn:string,recintos:number}}
 */
function resumen(proyecto) {
  return {
    id: proyecto.id,
    nombre: proyecto.nombre,
    actualizadoEn: proyecto.actualizadoEn,
    recintos: proyecto.recintos.length,
  }
}

/**
 * Ordena por última modificación, lo más reciente primero.
 * @param {{actualizadoEn:string}} a
 * @param {{actualizadoEn:string}} b
 */
function porMasReciente(a, b) {
  return String(b.actualizadoEn).localeCompare(String(a.actualizadoEn))
}

/**
 * Recorre los valores de parámetros de un recinto buscando referencias a un
 * material. Los parámetros de tipo 'material' guardan el id como texto plano,
 * así que la referencia es simplemente el valor.
 * @param {Object} recinto
 * @param {string} materialId
 * @returns {boolean}
 */
function recintoReferencia(recinto, materialId) {
  const parametros = recinto.parametros || {}
  for (const valor of Object.values(parametros)) {
    if (valor === materialId) return true
  }
  return recinto.lineas.some((linea) => linea.materialId === materialId)
}

/* =============================================================================
   Repositorio
   ========================================================================== */

export const repo = {
  /**
   * Prepara el almacén: siembra la biblioteca UNA sola vez, la primera, y nunca
   * pisa materiales del usuario ni le devuelve los que borró.
   * @returns {Promise<{biblioteca:Object[], proyectos:Object[], preferencias:Preferencias}>}
   */
  async inicializar() {
    let biblioteca = cargarBiblioteca()
    if (!bibliotecaSembrada()) {
      biblioteca = materialesSemilla()
      persistirBiblioteca(biblioteca)
    }
    const proyectos = cargarProyectos().sort(porMasReciente).map(resumen)
    const preferencias = await repo.obtenerPreferencias()
    return { biblioteca: clonar(biblioteca), proyectos, preferencias }
  },

  /**
   * @returns {Promise<{id:string,nombre:string,actualizadoEn:string,recintos:number}[]>}
   */
  async listarProyectos() {
    return cargarProyectos().sort(porMasReciente).map(resumen)
  },

  /**
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async obtenerProyecto(id) {
    const proyecto = cargarProyectos().find((p) => p.id === id)
    return proyecto ? clonar(proyecto) : null
  },

  /**
   * @param {string} nombre
   * @returns {Promise<Object>} el proyecto creado, completo
   */
  async crearProyecto(nombre) {
    const proyecto = nuevoProyecto(nombre)
    const lista = cargarProyectos()
    lista.push(proyecto)
    persistirProyectos(lista)
    return clonar(proyecto)
  },

  /**
   * Alta o actualización. Marca `actualizadoEn` en el momento de guardar.
   * @param {Object} proyecto
   * @returns {Promise<Object>} el proyecto tal como quedó guardado
   */
  async guardarProyecto(proyecto) {
    const normalizado = normalizarProyecto(proyecto)
    normalizado.actualizadoEn = ahoraISO()

    const lista = cargarProyectos()
    const indice = lista.findIndex((p) => p.id === normalizado.id)
    if (indice >= 0) {
      normalizado.creadoEn = lista[indice].creadoEn
      lista[indice] = normalizado
    } else {
      lista.push(normalizado)
    }
    persistirProyectos(lista)
    return clonar(normalizado)
  },

  /**
   * @param {string} id
   * @returns {Promise<boolean>} true si existía y se eliminó
   */
  async eliminarProyecto(id) {
    const lista = cargarProyectos()
    const restantes = lista.filter((p) => p.id !== id)
    if (restantes.length === lista.length) return false
    persistirProyectos(restantes)

    // Si el proyecto eliminado era el activo, la preferencia queda colgando.
    const preferencias = await repo.obtenerPreferencias()
    if (preferencias.proyectoActivoId === id) {
      await repo.guardarPreferencias({ ...preferencias, proyectoActivoId: null })
    }
    return true
  },

  /**
   * Importa un archivo de proyecto (objeto ya parseado o texto JSON).
   *
   * Reglas de colisión:
   *   · Si el id del proyecto ya existe, el importado recibe un id nuevo: nunca
   *     se pisa un proyecto del usuario con el contenido de un archivo.
   *   · Cada material del archivo cuyo id ya exista en la biblioteca local se
   *     reutiliza si es el mismo material (mismo tipo y mismo nombre) y, si no
   *     lo es, entra con id nuevo y todas las referencias del proyecto
   *     importado se reapuntan al id nuevo.
   *
   * @param {*} json objeto o texto
   * @returns {Promise<{ok:true, proyecto:Object} | {ok:false, error:string}>}
   */
  async importarProyecto(json) {
    const validacion = validarProyectoImportado(json)
    if (!validacion.ok) return validacion

    const proyecto = validacion.proyecto
    const bibliotecaLocal = cargarBiblioteca()
    const porId = new Map(bibliotecaLocal.map((m) => [m.id, m]))

    /** @type {Map<string,string>} id del archivo -> id definitivo */
    const remapeo = new Map()
    let bibliotecaCambio = false

    for (const material of validacion.biblioteca) {
      const existente = porId.get(material.id)
      if (!existente) {
        bibliotecaLocal.push(material)
        porId.set(material.id, material)
        bibliotecaCambio = true
        continue
      }
      const esElMismo = existente.tipo === material.tipo && existente.nombre === material.nombre
      if (esElMismo) continue

      const idNuevo = nuevoId('mat')
      const copia = { ...material, id: idNuevo }
      bibliotecaLocal.push(copia)
      porId.set(idNuevo, copia)
      remapeo.set(material.id, idNuevo)
      bibliotecaCambio = true
    }

    if (remapeo.size > 0) {
      for (const recinto of proyecto.recintos) {
        for (const [clave, valor] of Object.entries(recinto.parametros)) {
          if (typeof valor === 'string' && remapeo.has(valor)) {
            recinto.parametros[clave] = remapeo.get(valor)
          }
        }
        for (const linea of recinto.lineas) {
          if (linea.materialId && remapeo.has(linea.materialId)) {
            linea.materialId = remapeo.get(linea.materialId)
          }
        }
      }
    }

    if (bibliotecaCambio) persistirBiblioteca(bibliotecaLocal)

    const proyectos = cargarProyectos()
    if (proyectos.some((p) => p.id === proyecto.id)) {
      proyecto.id = nuevoId('pro')
    }
    proyecto.actualizadoEn = ahoraISO()
    proyectos.push(proyecto)
    persistirProyectos(proyectos)

    return { ok: true, proyecto: clonar(proyecto) }
  },

  /**
   * @returns {Promise<Object[]>} biblioteca completa
   */
  async listarMateriales() {
    return clonar(cargarBiblioteca())
  },

  /**
   * Alta o actualización de material.
   * @param {Object} material
   * @returns {Promise<Object>} el material tal como quedó guardado
   */
  async guardarMaterial(material) {
    const normalizado = normalizarMaterial(material)
    normalizado.actualizadoEn = ahoraISO()

    const lista = cargarBiblioteca()
    const indice = lista.findIndex((m) => m.id === normalizado.id)
    if (indice >= 0) {
      normalizado.creadoEn = lista[indice].creadoEn
      lista[indice] = normalizado
    } else {
      lista.push(normalizado)
    }
    persistirBiblioteca(lista)
    return clonar(normalizado)
  },

  /**
   * @param {string} id
   * @returns {Promise<boolean>} true si existía y se eliminó
   */
  async eliminarMaterial(id) {
    const lista = cargarBiblioteca()
    const restantes = lista.filter((m) => m.id !== id)
    if (restantes.length === lista.length) return false
    persistirBiblioteca(restantes)
    return true
  },

  /**
   * Copia un material con id nuevo y el nombre marcado como copia.
   * @param {string} id
   * @returns {Promise<Object|null>} el material duplicado o null si no existe
   */
  async duplicarMaterial(id) {
    const lista = cargarBiblioteca()
    const original = lista.find((m) => m.id === id)
    if (!original) return null

    const ahora = ahoraISO()
    const copia = {
      ...clonar(original),
      id: nuevoId('mat'),
      nombre: `${original.nombre} (copia)`,
      creadoEn: ahora,
      actualizadoEn: ahora,
    }
    lista.push(copia)
    persistirBiblioteca(lista)
    return clonar(copia)
  },

  /**
   * Dónde se está usando un material. Recorre TODOS los proyectos guardados,
   * no solo el activo: eliminar un material es una operación de biblioteca y
   * el usuario tiene que ver el alcance completo antes de confirmar.
   * @param {string} id
   * @returns {Promise<{proyectoId:string,proyectoNombre:string,recintoNombre:string}[]>}
   */
  async materialEnUso(id) {
    if (!id) return []
    const usos = []
    for (const proyecto of cargarProyectos()) {
      for (const recinto of proyecto.recintos) {
        if (recintoReferencia(recinto, id)) {
          usos.push({
            proyectoId: proyecto.id,
            proyectoNombre: proyecto.nombre,
            recintoNombre: recinto.nombre,
          })
        }
      }
    }
    return usos
  },

  /**
   * Vuelve a dejar en la biblioteca los materiales de ejemplo que falten, sin
   * tocar ni duplicar los del usuario. Es la acción "Restaurar materiales de
   * ejemplo" del estado vacío de la Biblioteca.
   * @returns {Promise<Object[]>} biblioteca resultante
   */
  async restaurarBiblioteca() {
    const lista = cargarBiblioteca()
    const nombres = new Set(lista.map((m) => `${m.tipo}::${m.nombre}`))
    let agregados = 0
    for (const material of materialesSemilla()) {
      if (nombres.has(`${material.tipo}::${material.nombre}`)) continue
      lista.push(material)
      nombres.add(`${material.tipo}::${material.nombre}`)
      agregados += 1
    }
    if (agregados > 0) persistirBiblioteca(lista)
    return clonar(lista)
  },

  /**
   * @returns {Promise<Preferencias>}
   */
  async obtenerPreferencias() {
    const crudo = leer(CLAVES.preferencias, null)
    if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) {
      return { ...PREFERENCIAS_POR_DEFECTO }
    }
    const paso = Number(crudo.pasoGrilla)
    return {
      unidadActiva:
        typeof crudo.unidadActiva === 'string'
          ? crudo.unidadActiva
          : PREFERENCIAS_POR_DEFECTO.unidadActiva,
      proyectoActivoId: typeof crudo.proyectoActivoId === 'string' ? crudo.proyectoActivoId : null,
      imanGrilla: typeof crudo.imanGrilla === 'boolean' ? crudo.imanGrilla : true,
      ortogonal: typeof crudo.ortogonal === 'boolean' ? crudo.ortogonal : false,
      // Ausentes en lo ya guardado por una versión anterior: caen en encendido,
      // que es el valor por defecto. Un `=== true` acá apagaría el despiece a
      // todo el que ya tenía preferencias escritas.
      //
      // `verDespiece` fue el interruptor único que precedió a estos dos. Si
      // quedó apagado, se hereda apagando ambos: quien escondió el despiece
      // completo no espera que reaparezca a medias al actualizar.
      verPiezas: booleanoDeDespiece(crudo, 'verPiezas'),
      verEjes: booleanoDeDespiece(crudo, 'verEjes'),
      pasoGrilla: Number.isFinite(paso) && paso > 0 ? paso : PREFERENCIAS_POR_DEFECTO.pasoGrilla,
      versionDescartada:
        typeof crudo.versionDescartada === 'string' ? crudo.versionDescartada : null,
    }
  },

  /**
   * Guarda las preferencias completas, mezclando con lo que ya había.
   * @param {Partial<Preferencias>} prefs
   * @returns {Promise<Preferencias>}
   */
  async guardarPreferencias(prefs) {
    const actuales = await repo.obtenerPreferencias()
    const mezcla = { ...actuales, ...(prefs && typeof prefs === 'object' ? prefs : {}) }
    const limpio = {
      unidadActiva: mezcla.unidadActiva,
      proyectoActivoId: mezcla.proyectoActivoId ?? null,
      imanGrilla: mezcla.imanGrilla === true,
      ortogonal: mezcla.ortogonal === true,
      verPiezas: mezcla.verPiezas !== false,
      verEjes: mezcla.verEjes !== false,
      pasoGrilla:
        Number.isFinite(Number(mezcla.pasoGrilla)) && Number(mezcla.pasoGrilla) > 0
          ? Number(mezcla.pasoGrilla)
          : PREFERENCIAS_POR_DEFECTO.pasoGrilla,
      versionDescartada:
        typeof mezcla.versionDescartada === 'string' ? mezcla.versionDescartada : null,
    }
    escribir(CLAVES.preferencias, limpio)
    return limpio
  },

  /**
   * Borra todo lo guardado por Kubikar en este navegador. No lo usa la
   * interfaz de esta versión; existe para diagnóstico y para el paso a la API,
   * donde el almacén local queda como caché descartable.
   * @returns {Promise<void>}
   */
  async limpiarTodo() {
    borrar(CLAVES.proyectos)
    borrar(CLAVES.biblioteca)
    borrar(CLAVES.preferencias)
  },
}

export default repo
