/* =============================================================================
   Kubikar · cálculo de un recinto
   -----------------------------------------------------------------------------
   Une las tres piezas que el producto mantiene separadas: la geometría pura de
   `core/geometry.js`, el módulo de cálculo del registro y la biblioteca de
   materiales. Nadie más arma el `ContextoCalculo`.

   Este archivo NO importa el estado de la aplicación: recibe el recinto y la
   biblioteca por parámetro. Así `AppState.jsx` puede usar `calcularRecinto`
   para congelar los derivados al guardar sin que se forme un ciclo de imports.

   La geometría viaja SIEMPRE en milímetros. La unidad activa de la interfaz no
   entra acá y no puede alterar ni un número de la cubicación.
   ========================================================================== */

import { useMemo } from 'react'
import {
  areaMm2 as areaDeVertices,
  boundingBox,
  esAutoIntersectante,
  perimetroMm as perimetroDeVertices,
} from '../core/geometry.js'
import { obtenerModulo } from '../modules/index.js'

/**
 * @typedef {Object} GeometriaRecinto
 * @property {Array<{id:string,x:number,y:number}>} vertices  vértices en mm
 * @property {boolean} cerrado           true solo con polígono cerrado y 3+ vértices
 * @property {number} areaMm2            0 mientras el polígono esté abierto
 * @property {number} perimetroMm        incluye el segmento de cierre si está cerrado
 * @property {{minX:number,minY:number,maxX:number,maxY:number,ancho:number,alto:number}} bbox
 * @property {boolean} autoIntersectante
 */

/**
 * @typedef {Object} ResultadoDeRecinto
 * @property {GeometriaRecinto} geometria
 * @property {{lineas:Array,avisos:{nivel:string,mensaje:string}[],calculable:boolean}} resultado
 * @property {Object|null} modulo   null si el recinto apunta a un módulo que no existe
 */

/** Aviso de polígono cruzado. Se declara acá para poder deduplicarlo. */
const AVISO_CRUCE = 'El polígono se cruza a sí mismo. El área puede ser incorrecta.'

/**
 * Deriva toda la geometría publicable de un recinto.
 *
 * El área solo existe con el polígono cerrado: una polilínea abierta no encierra
 * superficie y publicar un número provisorio invitaría a cubicar sobre algo que
 * todavía no está definido. El perímetro, en cambio, sí tiene sentido mientras
 * se dibuja, y por eso se calcula siempre.
 *
 * @param {Object|null|undefined} recinto
 * @returns {GeometriaRecinto}
 */
export function geometriaDeRecinto(recinto) {
  const fuente = recinto && typeof recinto === 'object' ? recinto : {}
  const vertices = Array.isArray(fuente.verticesMm) ? fuente.verticesMm : []
  const cerrado = fuente.cerrado === true && vertices.length >= 3

  return {
    vertices,
    cerrado,
    areaMm2: cerrado ? areaDeVertices(vertices) : 0,
    perimetroMm: perimetroDeVertices(vertices, cerrado),
    bbox: boundingBox(vertices),
    // Con menos de 4 segmentos no hay par no adyacente que pueda cruzarse.
    autoIntersectante: vertices.length >= 4 ? esAutoIntersectante(vertices, cerrado) : false,
  }
}

/**
 * Deja un solo aviso por nivel + mensaje, conservando el orden de aparición.
 * El módulo ya emite el aviso de cruce cuando corresponde; este hook lo agrega
 * si el módulo no lo hizo, y sin la deduplicación saldría dos veces.
 *
 * @param {{nivel:string,mensaje:string}[]} avisos
 * @returns {{nivel:string,mensaje:string}[]}
 */
function unicos(avisos) {
  const vistos = new Set()
  const salida = []
  for (const aviso of avisos) {
    if (!aviso || typeof aviso.mensaje !== 'string') continue
    // El separador es un espacio, no un byte nulo literal: un NUL crudo en el
    // fuente hace que las herramientas traten el archivo como binario. Los tres
    // niveles son palabras sin espacios, así que la marca sigue siendo única.
    const marca = `${aviso.nivel} ${aviso.mensaje}`
    if (vistos.has(marca)) continue
    vistos.add(marca)
    salida.push(aviso)
  }
  return salida
}

/**
 * Normaliza lo que devuelve un módulo: por contrato `calcular` nunca lanza y
 * siempre entrega la forma completa, pero el registro es un punto de extensión
 * abierto y un módulo de terceros mal escrito no puede dejar la aplicación en
 * blanco.
 *
 * @param {*} bruto
 * @returns {{lineas:Array,avisos:{nivel:string,mensaje:string}[],calculable:boolean}}
 */
function normalizarResultado(bruto) {
  const fuente = bruto && typeof bruto === 'object' ? bruto : {}
  return {
    lineas: Array.isArray(fuente.lineas) ? fuente.lineas : [],
    avisos: Array.isArray(fuente.avisos) ? fuente.avisos : [],
    calculable: fuente.calculable === true,
  }
}

/**
 * @param {string} mensaje
 * @param {'error'|'advertencia'|'info'} [nivel]
 * @returns {{geometria:GeometriaRecinto,resultado:Object,modulo:Object|null}}
 */
function sinCubicar(geometria, modulo, mensaje, nivel = 'error') {
  return {
    geometria,
    resultado: { lineas: [], avisos: [{ nivel, mensaje }], calculable: false },
    modulo,
  }
}

/**
 * Corre el módulo del recinto sobre su geometría. Función pura: la usan el hook
 * `useCalculo`, el consolidado y el guardado de proyecto.
 *
 * Antes de llamar al módulo se resuelven los casos en que no hay nada que
 * cubicar, con el aviso que explica qué falta:
 *   · el recinto apunta a un módulo que no está registrado
 *   · el módulo está anunciado pero todavía no cubica
 *   · el polígono no tiene vértices, tiene menos de 3, o está abierto
 *
 * @param {Object|null|undefined} recinto
 * @param {Array} [biblioteca]
 * @returns {ResultadoDeRecinto}
 */
export function calcularRecinto(recinto, biblioteca) {
  const geometria = geometriaDeRecinto(recinto)
  const materiales = Array.isArray(biblioteca) ? biblioteca : []
  const moduloId = recinto && typeof recinto.moduloId === 'string' ? recinto.moduloId : ''
  const modulo = obtenerModulo(moduloId)

  if (!modulo) {
    return sinCubicar(
      geometria,
      null,
      `Este recinto usa el módulo "${moduloId}", que no existe en esta versión. Elige un módulo en la pestaña Módulo para cubicarlo.`,
    )
  }

  if (!modulo.disponible) {
    return sinCubicar(
      geometria,
      modulo,
      `El módulo ${modulo.nombre} todavía no cubica. Está anunciado como próximamente.`,
      'info',
    )
  }

  const cantidad = geometria.vertices.length
  if (cantidad === 0) {
    return sinCubicar(
      geometria,
      modulo,
      'Este recinto todavía no tiene polígono. Marca los vértices en el lienzo para cubicar.',
    )
  }
  if (cantidad < 3) {
    return sinCubicar(
      geometria,
      modulo,
      'El polígono necesita al menos 3 vértices para cerrarse y poder cubicar.',
    )
  }
  if (!geometria.cerrado) {
    return sinCubicar(geometria, modulo, 'Cierra el polígono para cubicar.')
  }

  /** @type {import('../modules/registry.js').ContextoCalculo} */
  const contexto = {
    geometria: {
      areaMm2: geometria.areaMm2,
      perimetroMm: geometria.perimetroMm,
      vertices: geometria.vertices,
      bbox: geometria.bbox,
      cerrado: geometria.cerrado,
      // Extra fuera del contrato mínimo: el módulo lo aprovecha para no volver
      // a recorrer los pares de segmentos. Quien no lo lea, lo recalcula.
      autoIntersectante: geometria.autoIntersectante,
    },
    parametros:
      recinto && recinto.parametros && typeof recinto.parametros === 'object'
        ? recinto.parametros
        : {},
    biblioteca: materiales,
  }

  let resultado
  try {
    resultado = normalizarResultado(modulo.calcular(contexto))
  } catch (falla) {
    // Un módulo que revienta es un error de programación, no un estado del
    // proyecto: se informa en la pestaña y el resto de la aplicación sigue viva.
    console.error('Kubikar · falla al cubicar con el módulo', moduloId, falla)
    return sinCubicar(
      geometria,
      modulo,
      `El módulo ${modulo.nombre} no pudo cubicar este recinto. Revisa los parámetros y los materiales seleccionados.`,
    )
  }

  const avisos = geometria.autoIntersectante
    ? unicos(resultado.avisos.concat([{ nivel: 'advertencia', mensaje: AVISO_CRUCE }]))
    : unicos(resultado.avisos)

  return { geometria, resultado: { ...resultado, avisos }, modulo }
}

/* -----------------------------------------------------------------------------
   Trazado del despiece
   -------------------------------------------------------------------------- */

/**
 * Normaliza lo que devuelve `trazar`. Mismo criterio que `normalizarResultado`:
 * el registro es un punto de extensión abierto y una capa mal formada no puede
 * dejar el lienzo en blanco.
 *
 * @param {*} bruto
 * @returns {import('../modules/registry.js').CapaTrazado[]}
 */
function normalizarTrazado(bruto) {
  if (!Array.isArray(bruto)) return []
  const salida = []
  for (const capa of bruto) {
    if (!capa || typeof capa !== 'object') continue
    if (typeof capa.clave !== 'string' || capa.clave === '') continue
    const rectangulos = Array.isArray(capa.rectangulos) ? capa.rectangulos : []
    const lineas = Array.isArray(capa.lineas) ? capa.lineas : []
    if (rectangulos.length === 0 && lineas.length === 0) continue
    salida.push({
      clave: capa.clave,
      nombre: typeof capa.nombre === 'string' ? capa.nombre : '',
      rol: capa.rol === 'eje' ? 'eje' : 'pieza',
      rectangulos,
      lineas,
    })
  }
  return salida
}

/**
 * Corre el `trazar` del módulo del recinto. Función pura, hermana de
 * `calcularRecinto`: mismo contexto, misma tolerancia a un módulo que falla.
 *
 * Deriva la geometría del recinto GUARDADO, no de la que el lienzo tenga en
 * pantalla. Es a propósito: mientras se arrastra un vértice, la posición en
 * curso vive en estado local del lienzo —justo para no reconstruir el proyecto
 * entero a 60 Hz— y recalcular acá una retícula de hasta mil quinientas piezas
 * por cada `pointermove` devolvería ese costo multiplicado. El recorte contra
 * el polígono sí sigue al dedo, porque lo hace el `clipPath` en el compositor:
 * durante el arrastre la retícula se recorta en vivo contra la forma nueva y
 * solo su encuadre queda un gesto atrasado.
 *
 * @param {Object|null|undefined} recinto
 * @param {Array} [biblioteca]
 * @returns {import('../modules/registry.js').CapaTrazado[]}
 */
export function trazadoDeRecinto(recinto, biblioteca) {
  const moduloId = recinto && typeof recinto.moduloId === 'string' ? recinto.moduloId : ''
  const modulo = obtenerModulo(moduloId)
  if (!modulo || !modulo.disponible || typeof modulo.trazar !== 'function') return []

  const geo = geometriaDeRecinto(recinto)
  if (!geo.cerrado) return []

  try {
    return normalizarTrazado(
      modulo.trazar({
        geometria: {
          areaMm2: geo.areaMm2,
          perimetroMm: geo.perimetroMm,
          vertices: geo.vertices,
          bbox: geo.bbox,
          cerrado: geo.cerrado,
          autoIntersectante: geo.autoIntersectante,
        },
        parametros:
          recinto && recinto.parametros && typeof recinto.parametros === 'object'
            ? recinto.parametros
            : {},
        biblioteca: Array.isArray(biblioteca) ? biblioteca : [],
      }),
    )
  } catch (falla) {
    // El despiece es una ayuda de lectura: si el módulo revienta dibujando, el
    // lienzo se queda sin retícula pero la planta y la cubicación siguen vivas.
    console.error('Kubikar · falla al trazar el despiece del módulo', moduloId, falla)
    return []
  }
}

/**
 * Hook memoizado sobre `calcularRecinto`. Recalcula solo cuando cambia la
 * identidad del recinto o de la biblioteca, y el reductor de `AppState` crea
 * objetos nuevos en cada cambio, así que la comparación por referencia alcanza.
 *
 * La biblioteca llega por parámetro a propósito: este hook no importa el
 * contexto de la aplicación, de modo que también sirve fuera de la interfaz.
 *
 * @param {Object|null|undefined} recinto
 * @param {Array} [biblioteca]
 * @returns {ResultadoDeRecinto}
 */
export function useCalculo(recinto, biblioteca) {
  return useMemo(() => calcularRecinto(recinto, biblioteca), [recinto, biblioteca])
}

export default useCalculo
