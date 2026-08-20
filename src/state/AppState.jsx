/* =============================================================================
   Kubikar · estado de la aplicación
   -----------------------------------------------------------------------------
   Un solo contexto, un solo reductor. Toda la interfaz lee de acá y despacha
   acciones con nombre de acción, nunca setters sueltos.

   Cuatro reglas que este archivo sostiene:

   1. PERSISTENCIA POR UNA SOLA PUERTA. Este archivo importa `repo` y nada más.
      No menciona el driver de almacenamiento ni el navegador. Cuando Kubikar
      guarde contra la API de Karbec, acá no se cambia una línea.

   2. LA UNIDAD ACTIVA ES SOLO PRESENTACIÓN. Cambiar de mm a cm o a m altera
      únicamente cómo se muestran y se ingresan las medidas. JAMÁS escala,
      reescribe ni reinterpreta `verticesMm`: la geometría vive siempre en
      milímetros, que es la unidad base y la única que se guarda y se exporta.

   3. EL HISTORIAL ES DE GEOMETRÍA Y ES POR RECINTO ACTIVO. Entran agregar,
      mover y eliminar vértice, cerrar polígono, fijar largo de segmento, editar
      coordenada y limpiar. NO entran los parámetros del módulo ni los nombres:
      deshacer un dibujo no debe revolver la cubicación.

   4. UNA FALLA DE ALMACENAMIENTO NO PIERDE EL TRABAJO. Si el repositorio lanza
      `ErrorAlmacenamiento`, el estado en memoria queda intacto y el aviso se
      publica en `avisoAlmacenamiento` para que la interfaz ofrezca la salida:
      exportar el proyecto a JSON.
   ========================================================================== */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react'

import { ErrorAlmacenamiento, repo } from '../data/repo.js'
import { nuevoRecinto, nuevoVertice } from '../data/schema.js'
import {
  MODULO_POR_DEFECTO,
  completarParametros,
  obtenerModulo,
  parametrosPorDefecto,
} from '../modules/index.js'
import { obtenerUnidad } from '../core/units.js'
import {
  aplicarDetentes,
  fijarLargoSegmento as fijarLargoDeSegmento,
  limpiarVertices,
  moverVertice as moverVerticeEn,
} from '../core/geometry.js'
import {
  crearHistorial,
  deshacer as deshacerEn,
  empujar,
  puedeDeshacer as sePuedeDeshacer,
  puedeRehacer as sePuedeRehacer,
  rehacer as rehacerEn,
} from '../core/history.js'
import { calcularRecinto } from './useCalculo.js'

/** Espera antes de escribir el proyecto, en milisegundos. */
const RETARDO_GUARDADO_MS = 400

/** Vistas de primer nivel de la aplicación. */
const VISTAS = ['recinto', 'consolidado', 'biblioteca', 'proyectos']

/** Pestañas del margen de aparato. */
const PESTANAS = ['geometria', 'modulo', 'resultados']

/** Tolerancia con que se descartan vértices repetidos al cerrar, en mm. */
const EPS_LIMPIEZA_MM = 1

/**
 * @typedef {Object} EstadoApp
 * @property {boolean} cargando
 * @property {string|null} error
 * @property {{id:string,nombre:string,actualizadoEn:string,recintos:number}[]} proyectos
 * @property {Object|null} proyecto
 * @property {string|null} recintoActivoId
 * @property {'recinto'|'consolidado'|'biblioteca'|'proyectos'} vista
 * @property {'geometria'|'modulo'|'resultados'} pestana
 * @property {string} unidadActiva
 * @property {Object[]} biblioteca
 * @property {{modo:'dibujando'|'listo',imanGrilla:boolean,ortogonal:boolean,verPiezas:boolean,verEjes:boolean,pasoGrillaMm:number,verticeSel:string|null,segmentoSel:number|null,vista:{x:number,y:number,zoom:number}}} dibujo
 * @property {{pasado:Array,futuro:Array}} historial
 * @property {{tipo:string,mensaje:string}|null} avisoAlmacenamiento
 * @property {boolean} guardando        hay una escritura agendada o en curso
 * @property {string|null} guardadoEn   ISO del último guardado que sí escribió
 */

/** @type {EstadoApp} */
const ESTADO_INICIAL = {
  cargando: true,
  error: null,
  proyectos: [],
  proyecto: null,
  recintoActivoId: null,
  vista: 'recinto',
  pestana: 'geometria',
  unidadActiva: 'cm',
  biblioteca: [],
  dibujo: {
    modo: 'dibujando',
    imanGrilla: true,
    ortogonal: false,
    verPiezas: true,
    verEjes: true,
    pasoGrillaMm: 100,
    verticeSel: null,
    segmentoSel: null,
    vista: { x: 0, y: 0, zoom: 1 },
  },
  historial: { pasado: [], futuro: [] },
  avisoAlmacenamiento: null,
  guardando: false,
  guardadoEn: null,
}

/* =============================================================================
   Utilidades del reductor
   Todo lo de esta sección es puro: mismas entradas, mismas salidas, sin ids
   nuevos ni relojes. Los identificadores se generan en las acciones, antes de
   despachar, para que el reductor sea reejecutable sin efectos.
   ========================================================================== */

/**
 * @param {EstadoApp} estado
 * @returns {Object|null}
 */
function recintoActivo(estado) {
  if (!estado.proyecto || !estado.recintoActivoId) return null
  return estado.proyecto.recintos.find((r) => r.id === estado.recintoActivoId) || null
}

/**
 * Instantánea de historial: solo geometría, más el recinto al que pertenece
 * para no restaurar un dibujo sobre el recinto equivocado.
 * @param {Object|null} recinto
 * @returns {{recintoId:string,verticesMm:Array,cerrado:boolean}|undefined}
 */
function instantaneaDe(recinto) {
  if (!recinto) return undefined
  return { recintoId: recinto.id, verticesMm: recinto.verticesMm, cerrado: recinto.cerrado }
}

/**
 * @param {Object|null} recinto
 * @returns {'dibujando'|'listo'}
 */
function modoDe(recinto) {
  return recinto && recinto.cerrado ? 'listo' : 'dibujando'
}

/**
 * Cantidad de segmentos dibujables de un recinto.
 * @param {Object|null} recinto
 * @returns {number}
 */
function totalSegmentos(recinto) {
  if (!recinto) return 0
  const n = recinto.verticesMm.length
  if (n < 2) return 0
  return recinto.cerrado ? n : n - 1
}

/**
 * Descarta selecciones que apuntan a algo que ya no existe. Sin esto, borrar un
 * vértice deja marcada una fila fantasma en la tabla de geometría.
 * @param {EstadoApp['dibujo']} dibujo
 * @param {Object|null} recinto
 * @returns {EstadoApp['dibujo']}
 */
function sanearSeleccion(dibujo, recinto) {
  const vertices = recinto ? recinto.verticesMm : []
  const segmentos = totalSegmentos(recinto)

  const verticeSel =
    dibujo.verticeSel && vertices.some((v) => v.id === dibujo.verticeSel) ? dibujo.verticeSel : null
  const segmentoSel =
    typeof dibujo.segmentoSel === 'number' &&
    dibujo.segmentoSel >= 0 &&
    dibujo.segmentoSel < segmentos
      ? dibujo.segmentoSel
      : null

  if (verticeSel === dibujo.verticeSel && segmentoSel === dibujo.segmentoSel) return dibujo
  return { ...dibujo, verticeSel, segmentoSel }
}

/**
 * Reemplaza el recinto activo dentro del proyecto.
 * @param {EstadoApp} estado
 * @param {Object} recintoNuevo
 * @returns {EstadoApp}
 */
function conRecinto(estado, recintoNuevo) {
  return {
    ...estado,
    proyecto: {
      ...estado.proyecto,
      recintos: estado.proyecto.recintos.map((r) => (r.id === recintoNuevo.id ? recintoNuevo : r)),
    },
  }
}

/**
 * Aplica una transformación de geometría al recinto activo y la apila en el
 * historial. Es el único camino por el que cambia el dibujo: cualquier acción
 * que pase por acá es deshacible, y ninguna otra lo es.
 *
 * `transformar` devuelve `{verticesMm?, cerrado?, dibujo?, sinHistorial?}` o
 * `null` para declarar que la operación no procede.
 *
 * `sinHistorial` mueve la geometría sin apilar un paso de deshacer. Es la
 * escotilla para cualquier edición continua que tenga que valer UN paso: el
 * llamador la pide con `moverVertice(id, x, y, { confirmar: false })` y cierra
 * el paso con una última llamada sin la opción. El arrastre del lienzo ya no la
 * necesita —mantiene la posición en curso en estado local y despacha una sola
 * vez al soltar—, pero la capacidad se conserva porque es del reductor, no de
 * un gesto en particular.
 *
 * @param {EstadoApp} estado
 * @param {(recinto:Object) => ({verticesMm?:Array,cerrado?:boolean,dibujo?:Object,sinHistorial?:boolean}|null)} transformar
 * @returns {EstadoApp}
 */
function conGeometria(estado, transformar) {
  const recinto = recintoActivo(estado)
  if (!recinto) return estado

  const propuesta = transformar(recinto)
  if (!propuesta) return estado

  const verticesMm = propuesta.verticesMm === undefined ? recinto.verticesMm : propuesta.verticesMm
  const pedido = propuesta.cerrado === undefined ? recinto.cerrado : propuesta.cerrado
  const cerrado = pedido === true && verticesMm.length >= 3

  const sinCambio = verticesMm === recinto.verticesMm && cerrado === recinto.cerrado
  if (sinCambio && !propuesta.dibujo) return estado

  const recintoNuevo = sinCambio ? recinto : { ...recinto, verticesMm, cerrado }
  const base = sinCambio ? estado : conRecinto(estado, recintoNuevo)
  const dibujo = propuesta.dibujo ? { ...base.dibujo, ...propuesta.dibujo } : base.dibujo

  const conservaHistorial = sinCambio || propuesta.sinHistorial === true
  return {
    ...base,
    historial: conservaHistorial
      ? base.historial
      : empujar(base.historial, instantaneaDe(recintoNuevo)),
    dibujo: sanearSeleccion(dibujo, recintoNuevo),
  }
}

/**
 * Restaura una instantánea devuelta por el historial.
 * @param {EstadoApp} estado
 * @param {{historial:Object,instantanea:Object|null,cambio:boolean}} paso
 * @returns {EstadoApp}
 */
function aplicarHistorial(estado, paso) {
  if (!paso.cambio) return estado

  const recinto = recintoActivo(estado)
  const instantanea = paso.instantanea
  if (!recinto || !instantanea || instantanea.recintoId !== recinto.id) {
    return { ...estado, historial: paso.historial }
  }

  // Las instantáneas se guardan congeladas en profundidad: se rehidratan con
  // objetos nuevos para que el resto del estado siga siendo editable.
  const recintoNuevo = {
    ...recinto,
    verticesMm: instantanea.verticesMm.map((v) => ({ ...v })),
    cerrado: instantanea.cerrado === true,
  }
  const base = conRecinto(estado, recintoNuevo)

  return {
    ...base,
    historial: paso.historial,
    dibujo: sanearSeleccion({ ...base.dibujo, modo: modoDe(recintoNuevo) }, recintoNuevo),
  }
}

/**
 * Pone al día los parámetros de cada recinto contra el esquema actual de su
 * módulo, completando SOLO lo que falte.
 *
 * Un recinto guarda los parámetros que tenía el día que se cubicó. Cuando un
 * módulo suma un parámetro —o parte uno en dos, como pasó con los tornillos—, el
 * recinto viejo llega sin la clave nueva, y un booleano ausente es falso: la
 * línea se caería del listado en silencio. Se completa al abrir, que es el único
 * embudo por donde entra un proyecto, y no en la capa de datos, que a propósito
 * no conoce el registro de módulos.
 *
 * @param {Object|null} proyecto
 * @param {Array} biblioteca
 * @returns {Object|null}
 */
function conParametrosAlDia(proyecto, biblioteca) {
  if (!proyecto || !Array.isArray(proyecto.recintos)) return proyecto

  let cambio = false
  const recintos = proyecto.recintos.map((recinto) => {
    const modulo = obtenerModulo(recinto.moduloId)
    if (!modulo) return recinto
    const parametros = completarParametros(modulo, recinto.parametros, biblioteca)
    if (parametros === recinto.parametros) return recinto
    cambio = true
    return { ...recinto, parametros }
  })

  return cambio ? { ...proyecto, recintos } : proyecto
}

/**
 * Abre un proyecto: activa su primer recinto, adopta su unidad de presentación
 * y arranca el historial con la geometría que ya tiene, para que la primera
 * acción del usuario tenga a qué volver.
 * @param {EstadoApp} estado
 * @param {Object|null} proyecto
 * @returns {EstadoApp}
 */
function conProyecto(estado, proyecto) {
  const abierto = conParametrosAlDia(proyecto, estado.biblioteca)
  const recinto = abierto && abierto.recintos.length > 0 ? abierto.recintos[0] : null
  return {
    ...estado,
    proyecto: abierto,
    recintoActivoId: recinto ? recinto.id : null,
    unidadActiva:
      proyecto && typeof proyecto.unidadActiva === 'string'
        ? obtenerUnidad(proyecto.unidadActiva).id
        : estado.unidadActiva,
    vista: 'recinto',
    pestana: 'geometria',
    historial: crearHistorial(instantaneaDe(recinto)),
    dibujo: { ...estado.dibujo, modo: modoDe(recinto), verticeSel: null, segmentoSel: null },
    // El testigo de guardado es del proyecto abierto: al cambiar de proyecto se
    // apaga en vez de arrastrar la hora del anterior, que sería una
    // confirmación falsa sobre un trabajo que todavía no se ha escrito.
    guardando: false,
    guardadoEn: null,
  }
}

/**
 * Activa un recinto y reinicia el historial: deshacer nunca cruza de un recinto
 * a otro.
 * @param {EstadoApp} estado
 * @param {string|null} recintoId
 * @returns {EstadoApp}
 */
function conRecintoActivo(estado, recintoId) {
  const recinto = estado.proyecto
    ? estado.proyecto.recintos.find((r) => r.id === recintoId) || null
    : null
  return {
    ...estado,
    recintoActivoId: recinto ? recinto.id : null,
    historial: crearHistorial(instantaneaDe(recinto)),
    dibujo: { ...estado.dibujo, modo: modoDe(recinto), verticeSel: null, segmentoSel: null },
  }
}

/**
 * Cuando cambia el material de un parámetro, el porcentaje de desperdicio que
 * declara `desperdicioDe` sigue al material nuevo, pero SOLO si el usuario no
 * lo había ajustado a mano: un valor escrito por el usuario manda sobre el
 * valor por defecto del material.
 *
 * Muta `parametros`, que siempre es un objeto recién creado por quien llama.
 *
 * @param {Object|null} modulo
 * @param {Object} parametros  objeto nuevo, ya con el valor cambiado
 * @param {Object} previos     parámetros antes del cambio
 * @param {string} clave       parámetro que cambió
 * @param {Array} biblioteca
 */
function propagarDesperdicio(modulo, parametros, previos, clave, biblioteca) {
  if (!modulo || !Array.isArray(modulo.esquema)) return
  const cambiado = modulo.esquema.find((p) => p.clave === clave)
  if (!cambiado || cambiado.tipo !== 'material') return

  const lista = Array.isArray(biblioteca) ? biblioteca : []
  const anterior = lista.find((m) => m && m.id === previos[clave]) || null
  const nuevo = lista.find((m) => m && m.id === parametros[clave]) || null
  if (!nuevo) return

  const pctNuevo = Number(nuevo.desperdicioPct)
  if (!Number.isFinite(pctNuevo)) return
  const pctAnterior = anterior ? Number(anterior.desperdicioPct) : Number.NaN

  for (const parametro of modulo.esquema) {
    if (parametro.desperdicioDe !== clave) continue
    const actual = Number(parametros[parametro.clave])
    const intacto =
      !Number.isFinite(actual) || (Number.isFinite(pctAnterior) && actual === pctAnterior)
    if (intacto) parametros[parametro.clave] = pctNuevo
  }
}

/**
 * Congela los derivados de cada recinto antes de guardar o exportar. El
 * repositorio no calcula: recibe el resultado ya resuelto con el mismo motor
 * que alimenta la pestaña de resultados, de modo que el archivo diga exactamente
 * lo que muestra la pantalla.
 *
 * @param {Object|null} proyecto
 * @param {Array} biblioteca
 * @returns {Object|null}
 */
export function proyectoConDerivados(proyecto, biblioteca) {
  if (!proyecto) return null
  return {
    ...proyecto,
    recintos: proyecto.recintos.map((recinto) => {
      const { geometria, resultado } = calcularRecinto(recinto, biblioteca)
      return {
        ...recinto,
        areaMm2: geometria.areaMm2,
        perimetroMm: geometria.perimetroMm,
        lineas: resultado.lineas,
      }
    }),
  }
}

/* =============================================================================
   Reductor
   ========================================================================== */

/**
 * @param {EstadoApp} estado
 * @param {{tipo:string}} accion
 * @returns {EstadoApp}
 */
function reductor(estado, accion) {
  switch (accion.tipo) {
    /* --- carga y catálogos ------------------------------------------------ */

    case 'CARGA_OK': {
      const preferencias = accion.preferencias
      const base = {
        ...estado,
        cargando: false,
        error: null,
        proyectos: accion.proyectos,
        biblioteca: accion.biblioteca,
        unidadActiva: obtenerUnidad(preferencias.unidadActiva).id,
        dibujo: {
          ...estado.dibujo,
          imanGrilla: preferencias.imanGrilla === true,
          ortogonal: preferencias.ortogonal === true,
          // Encendido salvo que esté apagado explícitamente: es el único de los
          // tres que arranca en true, y `=== true` lo apagaría al hidratar unas
          // preferencias guardadas antes de que existiera.
          verPiezas: preferencias.verPiezas !== false,
          verEjes: preferencias.verEjes !== false,
          pasoGrillaMm:
            Number.isFinite(preferencias.pasoGrilla) && preferencias.pasoGrilla > 0
              ? preferencias.pasoGrilla
              : estado.dibujo.pasoGrillaMm,
        },
        avisoAlmacenamiento: accion.avisoAlmacenamiento || null,
      }
      // Sin proyecto abierto se arranca en la vista de proyectos: ahí viven
      // tanto el estado vacío "Todavía no hay proyectos." como el selector.
      if (!accion.proyecto) return { ...base, vista: 'proyectos' }
      return conProyecto(base, accion.proyecto)
    }

    case 'CARGA_ERROR':
      return { ...estado, cargando: false, error: accion.error }

    case 'PROYECTOS':
      return { ...estado, proyectos: accion.proyectos }

    case 'BIBLIOTECA':
      return { ...estado, biblioteca: accion.biblioteca }

    case 'AVISO_ALMACENAMIENTO':
      return { ...estado, avisoAlmacenamiento: accion.aviso, guardando: false }

    /* --- testigo de guardado ----------------------------------------------
       La única confirmación de que el trabajo quedó escrito. Sin esto, el
       almacenamiento solo se vuelve visible cuando falla, y quien dibuja veinte
       vértices en una tablet no tiene ni un indicio de que algo se guardó. */

    case 'GUARDANDO':
      return estado.guardando ? estado : { ...estado, guardando: true }

    case 'GUARDADO_OK':
      return { ...estado, guardando: false, guardadoEn: accion.en }

    case 'GUARDADO_INACTIVO':
      return estado.guardando ? { ...estado, guardando: false } : estado

    /* --- proyecto ---------------------------------------------------------- */

    case 'PROYECTO_ABIERTO':
      return conProyecto(estado, accion.proyecto)

    case 'PROYECTO_CERRADO':
      return {
        ...conProyecto(estado, null),
        vista: 'proyectos',
      }

    case 'PROYECTO_RENOMBRADO': {
      if (!estado.proyecto) return estado
      const nombre = accion.nombre
      if (estado.proyecto.nombre === nombre) return estado
      return {
        ...estado,
        proyecto: { ...estado.proyecto, nombre },
        proyectos: estado.proyectos.map((p) =>
          p.id === estado.proyecto.id ? { ...p, nombre } : p,
        ),
      }
    }

    /* --- recintos ---------------------------------------------------------- */

    case 'RECINTO_AGREGADO': {
      if (!estado.proyecto) return estado
      const proyecto = {
        ...estado.proyecto,
        recintos: estado.proyecto.recintos.concat([accion.recinto]),
      }
      return conRecintoActivo({ ...estado, proyecto, vista: 'recinto' }, accion.recinto.id)
    }

    case 'RECINTO_RENOMBRADO': {
      if (!estado.proyecto) return estado
      const recinto = estado.proyecto.recintos.find((r) => r.id === accion.id)
      if (!recinto || recinto.nombre === accion.nombre) return estado
      return {
        ...estado,
        proyecto: {
          ...estado.proyecto,
          recintos: estado.proyecto.recintos.map((r) =>
            r.id === accion.id ? { ...r, nombre: accion.nombre } : r,
          ),
        },
      }
    }

    case 'RECINTO_ELIMINADO': {
      if (!estado.proyecto) return estado
      const indice = estado.proyecto.recintos.findIndex((r) => r.id === accion.id)
      if (indice < 0) return estado

      const recintos = estado.proyecto.recintos.filter((r) => r.id !== accion.id)
      const proyecto = { ...estado.proyecto, recintos }
      const base = { ...estado, proyecto }
      if (estado.recintoActivoId !== accion.id) return base

      const vecino = recintos[Math.min(indice, recintos.length - 1)] || null
      return conRecintoActivo(base, vecino ? vecino.id : null)
    }

    case 'RECINTO_SELECCIONADO':
      if (estado.recintoActivoId === accion.id) {
        // Mismo recinto, pero puede que se esté llegando desde el consolidado o
        // desde la biblioteca: la clave del margen SIEMPRE devuelve al dibujo.
        // Sin esto, un proyecto de un solo recinto no tiene salida del
        // consolidado por la clave, que es justo donde el usuario la busca.
        return estado.vista === 'recinto' ? estado : { ...estado, vista: 'recinto' }
      }
      return conRecintoActivo({ ...estado, vista: 'recinto' }, accion.id)

    /* --- geometría (todo lo de acá entra al historial) --------------------- */

    case 'VERTICE_AGREGADO':
      return conGeometria(estado, (recinto) => {
        if (recinto.cerrado) return null
        return {
          verticesMm: recinto.verticesMm.concat([accion.vertice]),
          dibujo: { modo: 'dibujando', verticeSel: accion.vertice.id, segmentoSel: null },
        }
      })

    case 'VERTICE_MOVIDO':
      return conGeometria(estado, (recinto) => {
        const verticeAntes = recinto.verticesMm.find((v) => v.id === accion.id)
        if (!verticeAntes) return null
        if (verticeAntes.x === accion.x && verticeAntes.y === accion.y) return null
        return {
          verticesMm: moverVerticeEn(recinto.verticesMm, accion.id, accion.x, accion.y),
          sinHistorial: accion.confirmar === false,
        }
      })

    case 'VERTICE_ELIMINADO':
      return conGeometria(estado, (recinto) => {
        if (!recinto.verticesMm.some((v) => v.id === accion.id)) return null
        const verticesMm = recinto.verticesMm.filter((v) => v.id !== accion.id)
        return {
          verticesMm,
          // Un polígono con menos de 3 vértices no puede seguir cerrado.
          cerrado: recinto.cerrado && verticesMm.length >= 3,
          dibujo: { modo: verticesMm.length >= 3 && recinto.cerrado ? 'listo' : 'dibujando' },
        }
      })

    case 'POLIGONO_CERRADO':
      return conGeometria(estado, (recinto) => {
        if (recinto.cerrado) return null
        const verticesMm = limpiarVertices(recinto.verticesMm, EPS_LIMPIEZA_MM)
        if (verticesMm.length < 3) return null
        return { verticesMm, cerrado: true, dibujo: { modo: 'listo' } }
      })

    case 'SEGMENTO_FIJADO':
      return conGeometria(estado, (recinto) => {
        const verticesMm = fijarLargoDeSegmento(
          recinto.verticesMm,
          accion.indice,
          accion.largoMm,
          recinto.cerrado,
        )
        // `fijarLargoSegmento` devuelve el mismo arreglo cuando no puede operar.
        if (verticesMm === recinto.verticesMm) return null
        return { verticesMm }
      })

    case 'COORDENADA_EDITADA':
      return conGeometria(estado, (recinto) => {
        const eje = accion.eje === 'y' ? 'y' : 'x'
        const valor = Number(accion.valorMm)
        if (!Number.isFinite(valor)) return null
        const actual = recinto.verticesMm.find((v) => v.id === accion.verticeId)
        if (!actual || actual[eje] === valor) return null
        return {
          verticesMm: recinto.verticesMm.map((v) =>
            v.id === accion.verticeId ? { ...v, [eje]: valor } : v,
          ),
        }
      })

    case 'DIBUJO_LIMPIADO':
      return conGeometria(estado, (recinto) => {
        if (recinto.verticesMm.length === 0 && !recinto.cerrado) return null
        return {
          verticesMm: [],
          cerrado: false,
          dibujo: { modo: 'dibujando', verticeSel: null, segmentoSel: null },
        }
      })

    case 'DESHACER':
      return aplicarHistorial(estado, deshacerEn(estado.historial))

    case 'REHACER':
      return aplicarHistorial(estado, rehacerEn(estado.historial))

    /* --- trazado y selección (no entran al historial) ---------------------- */

    case 'TRAZADO_CANCELADO': {
      // Escape suelta la herramienta y la selección, pero NO borra vértices:
      // para eso está "Limpiar dibujo", que sí es deshacible.
      const dibujo = { ...estado.dibujo, modo: 'listo', verticeSel: null, segmentoSel: null }
      const igual =
        estado.dibujo.modo === dibujo.modo &&
        estado.dibujo.verticeSel === null &&
        estado.dibujo.segmentoSel === null
      return igual ? estado : { ...estado, dibujo }
    }

    case 'VERTICE_SELECCIONADO': {
      if (estado.dibujo.verticeSel === accion.id && estado.dibujo.segmentoSel === null)
        return estado
      return { ...estado, dibujo: { ...estado.dibujo, verticeSel: accion.id, segmentoSel: null } }
    }

    case 'SEGMENTO_SELECCIONADO': {
      if (estado.dibujo.segmentoSel === accion.indice && estado.dibujo.verticeSel === null) {
        return estado
      }
      return {
        ...estado,
        dibujo: { ...estado.dibujo, segmentoSel: accion.indice, verticeSel: null },
      }
    }

    /* --- módulo y parámetros (no entran al historial) ---------------------- */

    case 'MODULO_CAMBIADO': {
      const recinto = recintoActivo(estado)
      if (!recinto || recinto.moduloId === accion.moduloId) return estado
      const modulo = obtenerModulo(accion.moduloId)
      if (!modulo) return estado
      return conRecinto(estado, {
        ...recinto,
        moduloId: modulo.id,
        parametros: parametrosPorDefecto(modulo, estado.biblioteca),
      })
    }

    case 'PARAMETRO_CAMBIADO': {
      const recinto = recintoActivo(estado)
      if (!recinto) return estado
      const previos = recinto.parametros || {}
      if (previos[accion.clave] === accion.valor) return estado

      const parametros = { ...previos, [accion.clave]: accion.valor }
      propagarDesperdicio(
        obtenerModulo(recinto.moduloId),
        parametros,
        previos,
        accion.clave,
        estado.biblioteca,
      )
      return conRecinto(estado, { ...recinto, parametros })
    }

    /* --- presentación y herramientas --------------------------------------- */

    case 'UNIDAD_CAMBIADA': {
      const unidad = obtenerUnidad(accion.unidadId)
      if (unidad.id === estado.unidadActiva) return estado
      // La unidad activa es SOLO presentación: cambia cómo se muestran y se
      // ingresan las medidas. No escala `verticesMm`, que siguen en milímetros,
      // ni el paso de grilla, que es una distancia física.
      return {
        ...estado,
        unidadActiva: unidad.id,
        proyecto: estado.proyecto ? { ...estado.proyecto, unidadActiva: unidad.id } : null,
      }
    }

    case 'VISTA_CAMBIADA':
      if (!VISTAS.includes(accion.vista) || estado.vista === accion.vista) return estado
      return { ...estado, vista: accion.vista }

    case 'PESTANA_CAMBIADA':
      if (!PESTANAS.includes(accion.pestana) || estado.pestana === accion.pestana) return estado
      return { ...estado, pestana: accion.pestana }

    case 'IMAN_ALTERNADO': {
      const imanGrilla =
        typeof accion.valor === 'boolean' ? accion.valor : !estado.dibujo.imanGrilla
      if (imanGrilla === estado.dibujo.imanGrilla) return estado
      return { ...estado, dibujo: { ...estado.dibujo, imanGrilla } }
    }

    case 'ORTOGONAL_ALTERNADO': {
      const ortogonal = typeof accion.valor === 'boolean' ? accion.valor : !estado.dibujo.ortogonal
      if (ortogonal === estado.dibujo.ortogonal) return estado
      return { ...estado, dibujo: { ...estado.dibujo, ortogonal } }
    }

    // Una sola acción para los dos interruptores del despiece, parametrizada
    // por el ROL de dibujo. Dos casos gemelos que solo se distinguen en el
    // nombre de la clave serían dos sitios donde equivocarse al agregar un rol.
    case 'CAPA_TRAZADO_ALTERNADA': {
      const clave = accion.rol === 'eje' ? 'verEjes' : 'verPiezas'
      const valor = typeof accion.valor === 'boolean' ? accion.valor : !estado.dibujo[clave]
      if (valor === estado.dibujo[clave]) return estado
      return { ...estado, dibujo: { ...estado.dibujo, [clave]: valor } }
    }

    case 'PASO_GRILLA_CAMBIADO': {
      const paso = Number(accion.pasoMm)
      if (!Number.isFinite(paso) || paso <= 0) return estado
      if (paso === estado.dibujo.pasoGrillaMm) return estado
      return { ...estado, dibujo: { ...estado.dibujo, pasoGrillaMm: paso } }
    }

    case 'VISTA_LIENZO_AJUSTADA': {
      const vista = { ...estado.dibujo.vista, ...accion.vista }
      const igual =
        vista.x === estado.dibujo.vista.x &&
        vista.y === estado.dibujo.vista.y &&
        vista.zoom === estado.dibujo.vista.zoom
      return igual ? estado : { ...estado, dibujo: { ...estado.dibujo, vista } }
    }

    default:
      return estado
  }
}

/* =============================================================================
   Contexto
   ========================================================================== */

const ContextoApp = createContext(null)

/**
 * ¿El evento nació dentro de un campo de texto? Los atajos globales no pueden
 * robarle Ctrl+Z ni Enter a un input donde el usuario está escribiendo.
 * @param {*} destino
 * @returns {boolean}
 */
function esCampoEditable(destino) {
  if (!destino || typeof destino !== 'object') return false
  const etiqueta = typeof destino.tagName === 'string' ? destino.tagName.toUpperCase() : ''
  if (etiqueta === 'INPUT' || etiqueta === 'TEXTAREA' || etiqueta === 'SELECT') return true
  return destino.isContentEditable === true
}

/**
 * @param {*} falla
 * @returns {boolean}
 */
function esFallaDeAlmacenamiento(falla) {
  return (
    falla instanceof ErrorAlmacenamiento ||
    (falla && typeof falla === 'object' && falla.name === 'ErrorAlmacenamiento')
  )
}

/**
 * Pasa el punto por los detentes del dibujo. La secuencia entera vive en
 * `aplicarDetentes`, que es la MISMA que usa la vista previa del lienzo: acá solo
 * se leen los interruptores del estado y se le entregan.
 *
 * @param {EstadoApp} estado
 * @param {{x:number,y:number}|null} desde  vértice de referencia del trazo
 * @param {number} x
 * @param {number} y
 * @param {{ajustar?:boolean, ortogonal?:boolean}} [opciones]
 * @returns {{x:number,y:number}}
 */
function puntoAjustado(estado, desde, x, y, opciones) {
  const ajustar = !opciones || opciones.ajustar !== false
  const punto = { x: Number(x), y: Number(y) }
  if (!Number.isFinite(punto.x)) punto.x = 0
  if (!Number.isFinite(punto.y)) punto.y = 0
  if (!ajustar) return punto

  const conOrtogonal =
    opciones && opciones.ortogonal !== undefined ? opciones.ortogonal : estado.dibujo.ortogonal
  return aplicarDetentes(desde, punto, {
    imanGrilla: estado.dibujo.imanGrilla,
    ortogonal: conOrtogonal,
    pasoMm: estado.dibujo.pasoGrillaMm,
  })
}

/**
 * Proveedor único de la aplicación. Carga, persiste y publica el estado.
 *
 * @param {{children: React.ReactNode}} props
 */
export function ProveedorApp({ children }) {
  const [estado, dispatch] = useReducer(reductor, ESTADO_INICIAL)

  // Espejos del estado para los callbacks estables y para el guardado diferido.
  // Se actualizan después de cada commit, nunca durante el render.
  const estadoRef = useRef(estado)
  const bibliotecaRef = useRef(estado.biblioteca)
  useEffect(() => {
    estadoRef.current = estado
    bibliotecaRef.current = estado.biblioteca
  })

  const pendienteRef = useRef(/** @type {Object|null} */ (null))
  const temporizadorGuardadoRef = useRef(/** @type {*} */ (null))
  const temporizadorPrefsRef = useRef(/** @type {*} */ (null))
  const ultimoCargadoRef = useRef(/** @type {Object|null} */ (null))
  const prefsListasRef = useRef(false)

  /* --- fallas ------------------------------------------------------------- */

  const manejarFalla = useCallback((falla) => {
    if (esFallaDeAlmacenamiento(falla)) {
      dispatch({
        tipo: 'AVISO_ALMACENAMIENTO',
        aviso: { tipo: falla.tipo, mensaje: falla.mensaje },
      })
      return
    }
    console.error('Kubikar · falla inesperada al acceder a los datos', falla)
    dispatch({
      tipo: 'AVISO_ALMACENAMIENTO',
      aviso: {
        tipo: 'escritura',
        mensaje:
          'No se pudo acceder a los datos guardados en este navegador. El trabajo sigue en pantalla: expórtalo a JSON para no perderlo.',
      },
    })
  }, [])

  /* --- guardado del proyecto --------------------------------------------- */

  const cancelarGuardadoPendiente = useCallback(() => {
    if (temporizadorGuardadoRef.current) {
      clearTimeout(temporizadorGuardadoRef.current)
      temporizadorGuardadoRef.current = null
    }
    pendienteRef.current = null
    dispatch({ tipo: 'GUARDADO_INACTIVO' })
  }, [])

  const guardarProyectoAhora = useCallback(async () => {
    if (temporizadorGuardadoRef.current) {
      clearTimeout(temporizadorGuardadoRef.current)
      temporizadorGuardadoRef.current = null
    }
    const proyecto = pendienteRef.current
    if (!proyecto) {
      dispatch({ tipo: 'GUARDADO_INACTIVO' })
      return
    }
    pendienteRef.current = null

    try {
      await repo.guardarProyecto(proyectoConDerivados(proyecto, bibliotecaRef.current))
      const proyectos = await repo.listarProyectos()
      dispatch({ tipo: 'PROYECTOS', proyectos })
      // La marca de tiempo se pone acá, cuando el repositorio ya resolvió: es
      // la única prueba de que el trabajo está en disco y no solo en pantalla.
      dispatch({ tipo: 'GUARDADO_OK', en: new Date().toISOString() })
    } catch (falla) {
      manejarFalla(falla)
    }
  }, [manejarFalla])

  /* --- carga inicial ------------------------------------------------------ */

  useEffect(() => {
    let vivo = true

    async function cargar() {
      try {
        // `repo.inicializar()` resuelve las tres lecturas de arranque: siembra
        // la biblioteca si hace falta y devuelve el resumen de proyectos y las
        // preferencias ya normalizadas.
        const { biblioteca, proyectos, preferencias } = await repo.inicializar()
        let proyecto = null
        if (preferencias.proyectoActivoId) {
          proyecto = await repo.obtenerProyecto(preferencias.proyectoActivoId)
        }
        if (!vivo) return
        ultimoCargadoRef.current = proyecto
        dispatch({ tipo: 'CARGA_OK', biblioteca, proyectos, preferencias, proyecto })
      } catch (falla) {
        if (!vivo) return
        if (esFallaDeAlmacenamiento(falla)) {
          // El navegador no deja leer ni escribir (modo privado, cuota, permisos):
          // la aplicación arranca vacía pero usable, y lo declara.
          dispatch({
            tipo: 'CARGA_OK',
            biblioteca: [],
            proyectos: [],
            preferencias: {
              unidadActiva: ESTADO_INICIAL.unidadActiva,
              proyectoActivoId: null,
              imanGrilla: true,
              ortogonal: false,
              verPiezas: true,
              verEjes: true,
              pasoGrilla: ESTADO_INICIAL.dibujo.pasoGrillaMm,
            },
            proyecto: null,
            avisoAlmacenamiento: { tipo: falla.tipo, mensaje: falla.mensaje },
          })
          return
        }
        console.error('Kubikar · falla al cargar', falla)
        dispatch({
          tipo: 'CARGA_ERROR',
          error: 'No se pudo cargar la información guardada en este navegador.',
        })
      }
    }

    cargar()
    return () => {
      vivo = false
    }
  }, [])

  /* --- persistencia diferida del proyecto --------------------------------- */

  useEffect(() => {
    if (estado.cargando) return undefined
    const proyecto = estado.proyecto
    // El proyecto recién abierto o recién creado ya está en el repositorio.
    if (!proyecto || proyecto === ultimoCargadoRef.current) return undefined

    pendienteRef.current = proyecto
    // Mientras el temporizador corre, el testigo de la barra superior dice
    // "Guardando": el estado del sistema tiene que ser visible también en el
    // intertanto, no solo cuando la escritura terminó.
    dispatch({ tipo: 'GUARDANDO' })
    temporizadorGuardadoRef.current = setTimeout(() => {
      temporizadorGuardadoRef.current = null
      guardarProyectoAhora()
    }, RETARDO_GUARDADO_MS)

    return () => {
      if (temporizadorGuardadoRef.current) {
        clearTimeout(temporizadorGuardadoRef.current)
        temporizadorGuardadoRef.current = null
      }
    }
  }, [estado.proyecto, estado.cargando, guardarProyectoAhora])

  // Al cerrar la pestaña o al desmontar, lo pendiente se escribe de inmediato.
  useEffect(() => {
    function alSalir() {
      guardarProyectoAhora()
    }
    window.addEventListener('beforeunload', alSalir)
    return () => {
      window.removeEventListener('beforeunload', alSalir)
      alSalir()
    }
  }, [guardarProyectoAhora])

  /* --- persistencia de preferencias --------------------------------------- */

  const unidadActiva = estado.unidadActiva
  const proyectoActivoId = estado.proyecto ? estado.proyecto.id : null
  const { imanGrilla, ortogonal, verPiezas, verEjes, pasoGrillaMm } = estado.dibujo

  useEffect(() => {
    if (estado.cargando) return undefined
    // La primera pasada después de cargar solo refleja lo que ya está guardado.
    if (!prefsListasRef.current) {
      prefsListasRef.current = true
      return undefined
    }

    temporizadorPrefsRef.current = setTimeout(() => {
      temporizadorPrefsRef.current = null
      repo
        // El estado llama `pasoGrillaMm` a lo que las preferencias guardan como
        // `pasoGrilla`; el valor es el mismo y va siempre en milímetros.
        .guardarPreferencias({
          unidadActiva,
          proyectoActivoId,
          imanGrilla,
          ortogonal,
          verPiezas,
          verEjes,
          pasoGrilla: pasoGrillaMm,
        })
        .catch(manejarFalla)
    }, RETARDO_GUARDADO_MS)

    return () => {
      if (temporizadorPrefsRef.current) {
        clearTimeout(temporizadorPrefsRef.current)
        temporizadorPrefsRef.current = null
      }
    }
  }, [
    estado.cargando,
    unidadActiva,
    proyectoActivoId,
    imanGrilla,
    ortogonal,
    verPiezas,
    verEjes,
    pasoGrillaMm,
    manejarFalla,
  ])

  /* --- acciones ----------------------------------------------------------- */

  const refrescarProyectos = useCallback(async () => {
    try {
      dispatch({ tipo: 'PROYECTOS', proyectos: await repo.listarProyectos() })
    } catch (falla) {
      manejarFalla(falla)
    }
  }, [manejarFalla])

  const refrescarBiblioteca = useCallback(async () => {
    try {
      dispatch({ tipo: 'BIBLIOTECA', biblioteca: await repo.listarMateriales() })
    } catch (falla) {
      manejarFalla(falla)
    }
  }, [manejarFalla])

  const acciones = useMemo(() => {
    /* -- proyecto -- */

    async function crearProyecto(nombre) {
      await guardarProyectoAhora()
      try {
        const proyecto = await repo.crearProyecto(nombre)
        ultimoCargadoRef.current = proyecto
        dispatch({ tipo: 'PROYECTO_ABIERTO', proyecto })
        await refrescarProyectos()
        return proyecto
      } catch (falla) {
        manejarFalla(falla)
        return null
      }
    }

    async function abrirProyecto(id) {
      if (estadoRef.current.proyecto && estadoRef.current.proyecto.id === id) {
        dispatch({ tipo: 'VISTA_CAMBIADA', vista: 'recinto' })
        return estadoRef.current.proyecto
      }
      await guardarProyectoAhora()
      try {
        const proyecto = await repo.obtenerProyecto(id)
        if (!proyecto) {
          await refrescarProyectos()
          return null
        }
        ultimoCargadoRef.current = proyecto
        dispatch({ tipo: 'PROYECTO_ABIERTO', proyecto })
        return proyecto
      } catch (falla) {
        manejarFalla(falla)
        return null
      }
    }

    function renombrarProyecto(nombre) {
      const limpio = typeof nombre === 'string' ? nombre.trim() : ''
      if (!limpio) return
      dispatch({ tipo: 'PROYECTO_RENOMBRADO', nombre: limpio })
    }

    async function eliminarProyecto(id) {
      const esActivo = estadoRef.current.proyecto && estadoRef.current.proyecto.id === id
      // Se cancela lo pendiente antes de borrar: guardar después de eliminar
      // resucitaría el proyecto.
      if (esActivo) cancelarGuardadoPendiente()
      else await guardarProyectoAhora()

      try {
        await repo.eliminarProyecto(id)
        if (esActivo) {
          ultimoCargadoRef.current = null
          dispatch({ tipo: 'PROYECTO_CERRADO' })
        }
        await refrescarProyectos()
        return true
      } catch (falla) {
        manejarFalla(falla)
        return false
      }
    }

    /**
     * Acepta el `File` del selector, el texto del archivo o el objeto ya
     * parseado. Devuelve `{ok:false, error}` con el motivo en español cuando el
     * archivo no sirve: eso no es una falla de almacenamiento y no levanta el
     * aviso persistente.
     */
    async function importarProyecto(entrada) {
      await guardarProyectoAhora()
      try {
        const contenido =
          entrada && typeof entrada.text === 'function' ? await entrada.text() : entrada
        const resultado = await repo.importarProyecto(contenido)
        if (!resultado.ok) return resultado

        ultimoCargadoRef.current = resultado.proyecto
        dispatch({ tipo: 'PROYECTO_ABIERTO', proyecto: resultado.proyecto })
        await refrescarProyectos()
        // La importación puede haber sumado materiales a la biblioteca.
        await refrescarBiblioteca()
        return resultado
      } catch (falla) {
        manejarFalla(falla)
        return {
          ok: false,
          error: 'No se pudo abrir el archivo. Revisa que sea el JSON exportado por Kubikar.',
        }
      }
    }

    /** Proyecto con los derivados congelados, listo para exportar a CSV o JSON. */
    function proyectoConResultados() {
      const actual = estadoRef.current
      return proyectoConDerivados(actual.proyecto, actual.biblioteca)
    }

    /* -- recintos -- */

    function agregarRecinto(nombre) {
      const actual = estadoRef.current
      if (!actual.proyecto) return null
      const correlativo = actual.proyecto.recintos.length + 1
      const recinto = nuevoRecinto(
        typeof nombre === 'string' && nombre.trim() ? nombre.trim() : `Recinto ${correlativo}`,
      )
      const modulo = obtenerModulo(MODULO_POR_DEFECTO)
      recinto.parametros = modulo ? parametrosPorDefecto(modulo, actual.biblioteca) : {}
      dispatch({ tipo: 'RECINTO_AGREGADO', recinto })
      return recinto
    }

    function renombrarRecinto(id, nombre) {
      const limpio = typeof nombre === 'string' ? nombre.trim() : ''
      if (!limpio) return
      dispatch({ tipo: 'RECINTO_RENOMBRADO', id, nombre: limpio })
    }

    function eliminarRecinto(id) {
      dispatch({ tipo: 'RECINTO_ELIMINADO', id })
    }

    function seleccionarRecinto(id) {
      dispatch({ tipo: 'RECINTO_SELECCIONADO', id })
    }

    /* -- dibujo -- */

    /**
     * Agrega un vértice al polígono del recinto activo.
     * Las coordenadas llegan en milímetros, en el sistema del dibujo. El imán a
     * la grilla y el modo ortogonal se aplican acá, de modo que el lienzo pueda
     * mandar el punto crudo del cursor; pasar `{ajustar:false}` los desactiva
     * para esta llamada.
     */
    function agregarVertice(x, y, opciones) {
      const actual = estadoRef.current
      const recinto = recintoActivo(actual)
      if (!recinto || recinto.cerrado) return
      const ultimo =
        recinto.verticesMm.length > 0 ? recinto.verticesMm[recinto.verticesMm.length - 1] : null
      const punto = puntoAjustado(actual, ultimo, x, y, opciones)
      dispatch({ tipo: 'VERTICE_AGREGADO', vertice: nuevoVertice(punto.x, punto.y) })
    }

    /**
     * Mueve un vértice. Solo se aplica el imán a la grilla: la restricción
     * ortogonal no tiene un punto de partida único cuando el vértice está entre
     * dos segmentos.
     *
     * Durante el arrastre, el lienzo llama con `{confirmar:false}`: la geometría
     * se actualiza en pantalla pero no entra al historial. Al soltar, una última
     * llamada sin la opción deja UN solo paso deshacible para todo el arrastre.
     *
     * @param {string} id
     * @param {number} x @param {number} y  milímetros
     * @param {{ajustar?:boolean, confirmar?:boolean}} [opciones]
     */
    function moverVertice(id, x, y, opciones) {
      const actual = estadoRef.current
      const punto = puntoAjustado(actual, null, x, y, { ...opciones, ortogonal: false })
      dispatch({
        tipo: 'VERTICE_MOVIDO',
        id,
        x: punto.x,
        y: punto.y,
        confirmar: !opciones || opciones.confirmar !== false,
      })
    }

    function eliminarVertice(id) {
      dispatch({ tipo: 'VERTICE_ELIMINADO', id })
    }

    function cerrarPoligono() {
      dispatch({ tipo: 'POLIGONO_CERRADO' })
    }

    function cancelarTrazado() {
      dispatch({ tipo: 'TRAZADO_CANCELADO' })
    }

    /**
     * Fija el largo de un segmento. El campo que la llama debe confirmar con
     * Enter o al perder el foco, no en cada tecla: cada llamada es un paso de
     * deshacer.
     * @param {number} indice índice del segmento @param {number} largoMm
     */
    function fijarLargoSegmento(indice, largoMm) {
      dispatch({ tipo: 'SEGMENTO_FIJADO', indice, largoMm })
    }

    /**
     * Edita una coordenada de un vértice, en milímetros. Igual que el largo de
     * segmento: se llama al confirmar el campo, no en cada tecla.
     * @param {string} verticeId @param {'x'|'y'} eje @param {number} valorMm
     */
    function editarCoordenada(verticeId, eje, valorMm) {
      dispatch({ tipo: 'COORDENADA_EDITADA', verticeId, eje, valorMm })
    }

    function limpiarDibujo() {
      dispatch({ tipo: 'DIBUJO_LIMPIADO' })
    }

    function deshacer() {
      dispatch({ tipo: 'DESHACER' })
    }

    function rehacer() {
      dispatch({ tipo: 'REHACER' })
    }

    function seleccionarVertice(id) {
      dispatch({ tipo: 'VERTICE_SELECCIONADO', id: id || null })
    }

    function seleccionarSegmento(indice) {
      dispatch({
        tipo: 'SEGMENTO_SELECCIONADO',
        indice: typeof indice === 'number' ? indice : null,
      })
    }

    /* -- presentación -- */

    function cambiarUnidad(unidadId) {
      dispatch({ tipo: 'UNIDAD_CAMBIADA', unidadId })
    }

    function cambiarModulo(moduloId) {
      dispatch({ tipo: 'MODULO_CAMBIADO', moduloId })
    }

    function cambiarParametro(clave, valor) {
      dispatch({ tipo: 'PARAMETRO_CAMBIADO', clave, valor })
    }

    function cambiarVista(vista) {
      dispatch({ tipo: 'VISTA_CAMBIADA', vista })
    }

    function cambiarPestana(pestana) {
      dispatch({ tipo: 'PESTANA_CAMBIADA', pestana })
    }

    function alternarIman(valor) {
      dispatch({ tipo: 'IMAN_ALTERNADO', valor })
    }

    function alternarOrtogonal(valor) {
      dispatch({ tipo: 'ORTOGONAL_ALTERNADO', valor })
    }

    /**
     * Enciende o apaga una capa del despiece por su rol de dibujo.
     * @param {'pieza'|'eje'} rol
     * @param {boolean} [valor]  omitido, alterna
     */
    function alternarCapaTrazado(rol, valor) {
      dispatch({ tipo: 'CAPA_TRAZADO_ALTERNADA', rol, valor })
    }

    function cambiarPasoGrilla(pasoMm) {
      dispatch({ tipo: 'PASO_GRILLA_CAMBIADO', pasoMm })
    }

    /** @param {{x?:number,y?:number,zoom?:number}} vista transformación del lienzo */
    function ajustarVista(vista) {
      dispatch({ tipo: 'VISTA_LIENZO_AJUSTADA', vista: vista || {} })
    }

    /* -- biblioteca -- */

    async function guardarMaterial(material) {
      try {
        const guardado = await repo.guardarMaterial(material)
        await refrescarBiblioteca()
        return guardado
      } catch (falla) {
        manejarFalla(falla)
        return null
      }
    }

    async function eliminarMaterial(id) {
      try {
        const eliminado = await repo.eliminarMaterial(id)
        await refrescarBiblioteca()
        return eliminado
      } catch (falla) {
        manejarFalla(falla)
        return false
      }
    }

    async function duplicarMaterial(id) {
      try {
        const copia = await repo.duplicarMaterial(id)
        await refrescarBiblioteca()
        return copia
      } catch (falla) {
        manejarFalla(falla)
        return null
      }
    }

    async function restaurarBiblioteca() {
      try {
        const biblioteca = await repo.restaurarBiblioteca()
        dispatch({ tipo: 'BIBLIOTECA', biblioteca })
        return biblioteca
      } catch (falla) {
        manejarFalla(falla)
        return null
      }
    }

    /** Dónde se usa un material, para el diálogo de confirmación de borrado. */
    async function usosDeMaterial(id) {
      try {
        return await repo.materialEnUso(id)
      } catch (falla) {
        manejarFalla(falla)
        return []
      }
    }

    /* -- aviso de almacenamiento -- */

    function descartarAviso() {
      dispatch({ tipo: 'AVISO_ALMACENAMIENTO', aviso: null })
    }

    return {
      crearProyecto,
      abrirProyecto,
      renombrarProyecto,
      eliminarProyecto,
      importarProyecto,
      proyectoConResultados,
      agregarRecinto,
      renombrarRecinto,
      eliminarRecinto,
      seleccionarRecinto,
      agregarVertice,
      moverVertice,
      eliminarVertice,
      cerrarPoligono,
      cancelarTrazado,
      fijarLargoSegmento,
      editarCoordenada,
      limpiarDibujo,
      deshacer,
      rehacer,
      seleccionarVertice,
      seleccionarSegmento,
      cambiarUnidad,
      cambiarModulo,
      cambiarParametro,
      cambiarVista,
      cambiarPestana,
      guardarMaterial,
      eliminarMaterial,
      duplicarMaterial,
      restaurarBiblioteca,
      usosDeMaterial,
      alternarIman,
      alternarOrtogonal,
      alternarCapaTrazado,
      cambiarPasoGrilla,
      ajustarVista,
      descartarAviso,
      guardarAhora: guardarProyectoAhora,
    }
  }, [
    cancelarGuardadoPendiente,
    guardarProyectoAhora,
    manejarFalla,
    refrescarBiblioteca,
    refrescarProyectos,
  ])

  /* --- atajos de teclado --------------------------------------------------- */

  useEffect(() => {
    /** @param {KeyboardEvent} evento */
    function alPresionar(evento) {
      if (typeof evento.key !== 'string') return
      // Dentro de un campo de texto mandan el campo y el navegador.
      if (esCampoEditable(evento.target)) return

      const meta = evento.ctrlKey || evento.metaKey
      const tecla = evento.key.toLowerCase()

      if (meta && tecla === 'z' && !evento.shiftKey) {
        evento.preventDefault()
        dispatch({ tipo: 'DESHACER' })
        return
      }
      if (meta && ((tecla === 'z' && evento.shiftKey) || tecla === 'y')) {
        evento.preventDefault()
        dispatch({ tipo: 'REHACER' })
        return
      }

      // Con un diálogo abierto, Escape y Enter le pertenecen al diálogo.
      //
      // El selector mira las DOS formas y solo el estado abierto. `<dialog>` es
      // el elemento nativo y su rol `dialog` es implícito: no lleva el atributo,
      // así que buscar `[role="dialog"]` no lo encuentra y los modales de
      // recinto y de proyecto quedaban sin proteger. Y un `<dialog>` montado
      // pero cerrado no puede quedarse con Escape y con Enter, que es lo que
      // pasaba mientras la vista Biblioteca estuviera a la vista.
      if (document.querySelector('dialog[open], [role="dialog"][open]')) return

      if (evento.key === 'Escape') {
        dispatch({ tipo: 'TRAZADO_CANCELADO' })
        return
      }
      if (evento.key === 'Enter') {
        // Enter sobre un botón lo acciona: es su contrato, y el atajo global no
        // puede además cerrar el polígono por detrás. "Agregar recinto" o
        // "Ajustar vista" no cierran figuras.
        const destino = evento.target
        const etiqueta =
          destino && typeof destino.tagName === 'string' ? destino.tagName.toUpperCase() : ''
        if (etiqueta === 'BUTTON' || etiqueta === 'A') return
        if (destino && typeof destino.getAttribute === 'function') {
          const rol = destino.getAttribute('role')
          if (rol === 'button' || rol === 'tab' || rol === 'switch' || rol === 'link') return
        }

        const recinto = recintoActivo(estadoRef.current)
        if (!recinto || recinto.cerrado || recinto.verticesMm.length < 3) return
        evento.preventDefault()
        dispatch({ tipo: 'POLIGONO_CERRADO' })
      }
    }

    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [])

  /* --- valor publicado ----------------------------------------------------- */

  const recinto = recintoActivo(estado)

  const valor = useMemo(
    () => ({
      estado,
      acciones,
      /** Recinto activo ya resuelto, o null. */
      recinto,
      puedeDeshacer: sePuedeDeshacer(estado.historial),
      puedeRehacer: sePuedeRehacer(estado.historial),
    }),
    [estado, acciones, recinto],
  )

  return <ContextoApp.Provider value={valor}>{children}</ContextoApp.Provider>
}

/**
 * Acceso al estado de la aplicación.
 * @returns {{estado:EstadoApp, acciones:Object, recinto:Object|null, puedeDeshacer:boolean, puedeRehacer:boolean}}
 */
export function useApp() {
  const valor = useContext(ContextoApp)
  if (!valor) {
    throw new Error('useApp debe usarse dentro de ProveedorApp.')
  }
  return valor
}
