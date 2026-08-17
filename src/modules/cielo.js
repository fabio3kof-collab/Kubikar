/* =============================================================================
   Kubikar · módulo Cielo
   -----------------------------------------------------------------------------
   Cubicación de cielo falso de acero galvanizado: planchas, perfilería omega,
   perfil perimetral y accesorios.

   Versión rápida por área y por longitud, sin optimización de cortes: es la
   cubicación que se hace en terreno con huincha y calculadora, y por eso cada
   línea deja su memoria de cálculo escrita con los números reales.

   Este archivo no importa React, no toca el navegador y no lee la unidad
   activa: la geometría siempre llega en milímetros y las cantidades salen en
   metros y en unidades.
   ========================================================================== */

import { formatearCantidad, formatearNumero, parsearNumeroCL } from '../core/units.js'
import { esAutoIntersectante } from '../core/geometry.js'

/** @typedef {import('./registry.js').ModuloCalculo} ModuloCalculo */
/** @typedef {import('./registry.js').EsquemaParametro} EsquemaParametro */
/** @typedef {import('./registry.js').ContextoCalculo} ContextoCalculo */
/** @typedef {import('./registry.js').ResultadoCalculo} ResultadoCalculo */
/** @typedef {import('./registry.js').LineaMaterial} LineaMaterial */
/** @typedef {import('./registry.js').AvisoCalculo} AvisoCalculo */

/** Milímetros cuadrados por metro cuadrado. */
const MM2_POR_M2 = 1_000_000
/** Milímetros por metro. */
const MM_POR_M = 1000

/**
 * Esquema declarado del módulo. La interfaz lo dibuja sola: acá no hay ni un
 * componente ni una decisión de presentación.
 * @type {EsquemaParametro[]}
 */
export const esquema = [
  {
    clave: 'planchaId',
    tipo: 'material',
    etiqueta: 'Material de plancha',
    materialTipo: 'plancha',
    grupo: 'Planchas',
    ayuda: 'Define el área útil de cada plancha con su ancho, su largo y su traslapo.',
  },
  {
    clave: 'planchaDesperdicio',
    tipo: 'porcentaje',
    etiqueta: 'Desperdicio de plancha',
    desperdicioDe: 'planchaId',
    min: 0,
    max: 100,
    paso: 1,
    sufijo: '%',
    grupo: 'Planchas',
  },
  {
    clave: 'perfilId',
    tipo: 'material',
    etiqueta: 'Perfil soportante',
    materialTipo: 'barra',
    // Arranca en un omega, que es lo que sostiene un cielo. Si la biblioteca no
    // tiene ninguno, cae al primer perfil disponible y el usuario lo cambia.
    preferir: ['omega'],
    grupo: 'Perfilería',
    ayuda: 'Perfil omega que recibe las planchas.',
  },
  {
    clave: 'separacionCm',
    tipo: 'numero',
    etiqueta: 'Separación entre ejes',
    porDefecto: 40,
    sugeridos: [40, 60],
    min: 1,
    paso: 1,
    sufijo: 'cm',
    grupo: 'Perfilería',
  },
  {
    clave: 'perfilDireccion',
    tipo: 'seleccion',
    etiqueta: 'Dirección del perfil',
    porDefecto: 'x',
    opciones: [
      { valor: 'x', etiqueta: 'Horizontal · eje X' },
      { valor: 'y', etiqueta: 'Vertical · eje Y' },
    ],
    grupo: 'Perfilería',
    // Se dice explícitamente que no mueve la cantidad, porque el usuario ve un
    // parámetro nuevo en el panel de cubicación y lo primero que se pregunta es
    // si tiene que volver a revisar el listado. La cubicación de este módulo es
    // por área (área ÷ separación), y esa división no distingue dirección.
    ayuda:
      'Hacia dónde corren los perfiles en el lienzo. Ordena el despiece dibujado; no cambia la cantidad cubicada, que sale del área.',
  },
  {
    clave: 'perfilDesperdicio',
    tipo: 'porcentaje',
    etiqueta: 'Desperdicio de perfil',
    desperdicioDe: 'perfilId',
    min: 0,
    max: 100,
    paso: 1,
    sufijo: '%',
    grupo: 'Perfilería',
  },
  {
    clave: 'perimetralActivo',
    tipo: 'booleano',
    etiqueta: 'Perfil perimetral',
    porDefecto: true,
    grupo: 'Perimetral',
  },
  {
    clave: 'perimetralId',
    tipo: 'material',
    etiqueta: 'Ángulo o tabica',
    materialTipo: 'barra',
    // El perimetral no es un omega: sin esta preferencia arranca repitiendo el
    // perfil soportante y la cubicación sale con dos líneas de igual nombre.
    preferir: ['ángulo', 'angulo', 'tabica', 'perimetral'],
    dependeDe: 'perimetralActivo',
    grupo: 'Perimetral',
  },
  {
    clave: 'perimetralDesperdicio',
    tipo: 'porcentaje',
    etiqueta: 'Desperdicio perimetral',
    desperdicioDe: 'perimetralId',
    dependeDe: 'perimetralActivo',
    min: 0,
    max: 100,
    paso: 1,
    sufijo: '%',
    grupo: 'Perimetral',
  },
  {
    clave: 'tornillosActivo',
    tipo: 'booleano',
    etiqueta: 'Tornillos',
    porDefecto: true,
    grupo: 'Accesorios',
  },
  {
    clave: 'tornillosId',
    tipo: 'material',
    etiqueta: 'Material de tornillo',
    materialTipo: 'pieza',
    preferir: ['tornillo'],
    dependeDe: 'tornillosActivo',
    grupo: 'Accesorios',
  },
  {
    clave: 'tornillosPorM2',
    tipo: 'numero',
    etiqueta: 'Tornillos por m²',
    porDefecto: 15,
    min: 0,
    paso: 1,
    sufijo: 'un/m²',
    dependeDe: 'tornillosActivo',
    grupo: 'Accesorios',
  },
  {
    clave: 'colgantesActivo',
    tipo: 'booleano',
    etiqueta: 'Colgantes o alambre',
    porDefecto: true,
    grupo: 'Accesorios',
  },
  {
    clave: 'colgantesId',
    tipo: 'material',
    etiqueta: 'Material de colgante',
    materialTipo: 'pieza',
    // El colgante se cuelga de alambre, no de tornillos: sin esto ambos
    // accesorios arrancan en el mismo material.
    preferir: ['alambre', 'colgante'],
    dependeDe: 'colgantesActivo',
    grupo: 'Accesorios',
  },
  {
    clave: 'colgantesPorM2',
    tipo: 'numero',
    etiqueta: 'Colgantes por m²',
    porDefecto: 1.5,
    min: 0,
    paso: 0.5,
    sufijo: 'un/m²',
    dependeDe: 'colgantesActivo',
    grupo: 'Accesorios',
  },
  {
    clave: 'descuentoM2',
    tipo: 'numero',
    etiqueta: 'Descuento por vanos',
    porDefecto: 0,
    min: 0,
    paso: 0.1,
    sufijo: 'm²',
    grupo: 'Descuentos',
    ayuda: 'Superficie de escotillas, ductos o vacíos que no lleva cielo.',
  },
]

/* -----------------------------------------------------------------------------
   Ayudantes de lectura y de formato
   -------------------------------------------------------------------------- */

/**
 * Lee un número desde los parámetros tolerando cadenas del formulario, incluida
 * la notación chilena '1.234,5'. Devuelve el respaldo si no hay número válido.
 *
 * @param {*} valor
 * @param {number} [respaldo]
 * @returns {number}
 */
function numero(valor, respaldo = 0) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : respaldo
  if (typeof valor === 'string') {
    const leido = parsearNumeroCL(valor)
    return typeof leido === 'number' && Number.isFinite(leido) ? leido : respaldo
  }
  return respaldo
}

/**
 * Cifra de la memoria de cálculo: dos decimales, formato es-CL.
 * @param {number} n
 * @returns {string}
 */
function f2(n) {
  return formatearCantidad(n, 2)
}

/**
 * Redondeo hacia arriba tolerante al ruido de coma flotante.
 *
 * `Math.ceil` sobre un float crudo hace comprar una unidad de más y contradice
 * la nota impresa. Caso real: 20 ml de perímetro ÷ 3 m por barra = 6,6666… ;
 * × 1,05 de desperdicio = 7.000000000000001 → `Math.ceil` daría 8 mientras la
 * memoria de cálculo dice 7,00. El error va siempre en contra del usuario y
 * ensucia el CSV, el JSON congelado y el consolidado, que suman las cantidades
 * finales ya redondeadas. Se descarta el ruido bajo el microlímite y recién
 * después se sube al entero.
 *
 * @param {number} n
 * @returns {number}
 */
function techo(n) {
  if (!Number.isFinite(n)) return 0
  return Math.ceil(Math.round(n * 1e6) / 1e6)
}

/**
 * Cifra corta para porcentajes y densidades: sin decimales si es entera.
 * @param {number} n
 * @returns {string}
 */
function fCorto(n) {
  if (!Number.isFinite(n)) return formatearNumero(0, 0)
  if (Number.isInteger(n)) return formatearNumero(n, 0)
  if (Number.isInteger(n * 10)) return formatearNumero(n, 1)
  return formatearNumero(n, 2)
}

/**
 * Busca en la biblioteca un material por id, exigiendo el tipo esperado. Un
 * material de otro tipo se trata como ausente: el parámetro quedó apuntando a
 * algo que ya no sirve.
 *
 * @param {Array} biblioteca
 * @param {*} id
 * @param {'plancha'|'barra'|'pieza'} tipo
 * @returns {Object|null}
 */
function buscarMaterial(biblioteca, id, tipo) {
  if (!id || typeof id !== 'string') return null
  const material = biblioteca.find((m) => m && m.id === id)
  if (!material || material.tipo !== tipo) return null
  return material
}

/**
 * Arma una línea de material completa.
 *
 * `codigoMaterial` y `partida` van siempre en null: están previstos para el
 * mapeo futuro contra la plataforma Karbec (código de artículo y partida de
 * presupuesto). Viajan en el JSON exportado para que el día que exista el
 * catálogo remoto se puedan llenar sin cambiar el formato de archivo ni la
 * forma de esta línea.
 *
 * @param {Object} datos
 * @param {string} datos.clave
 * @param {string} datos.nombre
 * @param {string|null} datos.materialId
 * @param {string} datos.unidad
 * @param {number} datos.cantidadTeorica
 * @param {number} datos.desperdicioPct
 * @param {number} datos.cantidadFinal
 * @param {string} datos.nota
 * @param {number|null} datos.precioUnitario
 * @returns {LineaMaterial}
 */
function crearLinea(datos) {
  const precioUnitario =
    typeof datos.precioUnitario === 'number' && Number.isFinite(datos.precioUnitario)
      ? datos.precioUnitario
      : null
  return {
    clave: datos.clave,
    nombre: datos.nombre,
    materialId: datos.materialId,
    unidad: datos.unidad,
    cantidadTeorica: datos.cantidadTeorica,
    desperdicioPct: datos.desperdicioPct,
    cantidadFinal: datos.cantidadFinal,
    nota: datos.nota,
    precioUnitario,
    subtotal: precioUnitario != null ? precioUnitario * datos.cantidadFinal : null,
    codigoMaterial: null, // previsto para el catálogo de Karbec
    partida: null, // previsto para la partida de presupuesto de Karbec
  }
}

/**
 * Tramo de la memoria de cálculo que describe el desperdicio. Se omite cuando
 * el desperdicio es 0: escribir "+0% desperdicio" sería ruido.
 *
 * @param {number} pct
 * @param {number} conDesperdicio
 * @returns {string}
 */
function tramoDesperdicio(pct, conDesperdicio) {
  if (!(pct > 0)) return ''
  return ` · +${fCorto(pct)}% desperdicio = ${f2(conDesperdicio)}`
}

/**
 * Lee el porcentaje de desperdicio de un parámetro, acotado a 0–100.
 * @param {Object} parametros
 * @param {string} clave
 * @returns {number}
 */
function desperdicioDe(parametros, clave) {
  const pct = numero(parametros[clave], 0)
  if (pct < 0) return 0
  if (pct > 100) return 100
  return pct
}

/* -----------------------------------------------------------------------------
   Cálculo
   -------------------------------------------------------------------------- */

/**
 * Cubica el cielo del recinto.
 *
 * Método (sin optimización de cortes):
 *   areaM2     = areaMm2 / 1.000.000
 *   perimetroM = perimetroMm / 1.000
 *   areaNeta   = areaM2 − descuentoM2
 *
 *   PLANCHAS   areaUtil = ((ancho − traslapo) × (largo − traslapo)) / 1.000.000
 *              teórica  = areaNeta / areaUtil
 *   PERFIL     mlTotales = areaNeta / (separación / 100)
 *              teórica  = mlTotales / largoBarraM
 *   PERIMETRAL mlTotales = perímetro
 *              teórica  = mlTotales / largoBarraM
 *   ACCESORIOS teórica  = areaNeta × densidad
 *   final = ceil(teórica × (1 + desperdicio/100))
 *
 * Ninguna división ocurre sin validar antes su divisor.
 *
 * @param {ContextoCalculo} ctx
 * @returns {ResultadoCalculo}
 */
export function calcular(ctx) {
  /** @type {LineaMaterial[]} */
  const lineas = []
  /** @type {AvisoCalculo[]} */
  const avisos = []

  const contexto = ctx && typeof ctx === 'object' ? ctx : {}
  const geometria =
    contexto.geometria && typeof contexto.geometria === 'object' ? contexto.geometria : {}
  const parametros =
    contexto.parametros && typeof contexto.parametros === 'object' ? contexto.parametros : {}
  const biblioteca = Array.isArray(contexto.biblioteca) ? contexto.biblioteca : []

  const vertices = Array.isArray(geometria.vertices) ? geometria.vertices : []
  const cerrado = geometria.cerrado === true

  // --- Geometría ------------------------------------------------------------
  if (!cerrado || vertices.length < 3) {
    avisos.push({ nivel: 'error', mensaje: 'Cierra el polígono para cubicar.' })
    return { lineas, avisos, calculable: false }
  }

  const areaM2 = numero(geometria.areaMm2, 0) / MM2_POR_M2
  const perimetroM = numero(geometria.perimetroMm, 0) / MM_POR_M

  if (!(areaM2 > 0)) {
    avisos.push({
      nivel: 'error',
      mensaje:
        'El área del recinto es cero. Revisa el polígono: puede tener vértices repetidos o estar degenerado.',
    })
    return { lineas, avisos, calculable: false }
  }

  // El cruce del polígono no bloquea: el área de Gauss sigue dando un número,
  // pero deja de representar la superficie real y hay que decirlo.
  const cruzado =
    typeof geometria.autoIntersectante === 'boolean'
      ? geometria.autoIntersectante
      : esAutoIntersectante(vertices, true)
  if (cruzado) {
    avisos.push({
      nivel: 'advertencia',
      mensaje: 'El polígono se cruza a sí mismo. El área puede ser incorrecta.',
    })
  }

  // --- Descuento por vanos --------------------------------------------------
  let descuentoM2 = numero(parametros.descuentoM2, 0)
  if (descuentoM2 < 0) {
    avisos.push({
      nivel: 'advertencia',
      mensaje: 'El descuento por vanos no puede ser negativo. Se cubicó con descuento 0 m².',
    })
    descuentoM2 = 0
  }
  if (descuentoM2 >= areaM2) {
    avisos.push({
      nivel: 'error',
      mensaje: `El descuento por vanos (${f2(descuentoM2)} m²) es mayor o igual que el área del recinto (${f2(areaM2)} m²). Ingresa un valor menor.`,
    })
    return { lineas, avisos, calculable: false }
  }

  const areaNeta = areaM2 - descuentoM2

  // Encabezado común de la memoria de cálculo.
  const memoriaNeta =
    descuentoM2 > 0
      ? `${f2(areaM2)} m² − ${f2(descuentoM2)} m² de vanos = ${f2(areaNeta)} m² netos`
      : `${f2(areaNeta)} m² netos`

  // --- Planchas -------------------------------------------------------------
  const plancha = buscarMaterial(biblioteca, parametros.planchaId, 'plancha')
  if (!plancha) {
    avisos.push({
      nivel: 'error',
      mensaje: 'Falta seleccionar el material de Material de plancha.',
    })
  } else {
    const anchoMm = numero(plancha.anchoMm, 0)
    const largoMm = numero(plancha.largoMm, 0)
    const traslapoMm = numero(plancha.traslapoMm, 0)
    const anchoUtilMm = anchoMm - traslapoMm
    const largoUtilMm = largoMm - traslapoMm
    const areaUtil = (anchoUtilMm * largoUtilMm) / MM2_POR_M2

    if (!(areaUtil > 0)) {
      avisos.push({
        nivel: 'error',
        mensaje: `Las medidas de la plancha ${plancha.nombre} no dan un área útil mayor que 0. Revisa ancho, largo y traslapo en la Biblioteca.`,
      })
    } else {
      if (areaUtil >= areaNeta) {
        avisos.push({
          nivel: 'info',
          mensaje:
            'La plancha cubre el recinto completo. Se cubica 1 unidad; en terreno habrá corte.',
        })
      }
      const pct = desperdicioDe(parametros, 'planchaDesperdicio')
      const teorica = areaNeta / areaUtil
      const conDesperdicio = teorica * (1 + pct / 100)
      const final = techo(conDesperdicio)
      lineas.push(
        crearLinea({
          clave: 'cielo.plancha',
          nombre: plancha.nombre,
          materialId: plancha.id,
          unidad: 'un',
          cantidadTeorica: teorica,
          desperdicioPct: pct,
          cantidadFinal: final,
          nota: `${memoriaNeta} ÷ ${f2(areaUtil)} m² útiles por plancha = ${f2(teorica)}${tramoDesperdicio(pct, conDesperdicio)} → ${final} un`,
          precioUnitario: plancha.precioUnitario,
        }),
      )
    }
  }

  // --- Perfil soportante ----------------------------------------------------
  const separacionCm = numero(parametros.separacionCm, 0)
  const perfil = buscarMaterial(biblioteca, parametros.perfilId, 'barra')
  if (!(separacionCm > 0)) {
    // Se omite solo esta línea: el resto del cielo sí se cubica.
    avisos.push({
      nivel: 'error',
      mensaje:
        'La separación entre ejes no puede ser 0. Ingresa un valor mayor que 0 para cubicar la perfilería.',
    })
  } else if (!perfil) {
    avisos.push({ nivel: 'error', mensaje: 'Falta seleccionar el material de Perfil soportante.' })
  } else {
    const largoBarraM = numero(perfil.largoBarraMm, 0) / MM_POR_M
    if (!(largoBarraM > 0)) {
      avisos.push({
        nivel: 'error',
        mensaje: `El largo de barra del perfil ${perfil.nombre} debe ser mayor que 0. Corrígelo en la Biblioteca.`,
      })
    } else {
      const separacionM = separacionCm / 100
      const mlTotales = areaNeta / separacionM
      const pct = desperdicioDe(parametros, 'perfilDesperdicio')
      const teorica = mlTotales / largoBarraM
      const conDesperdicio = teorica * (1 + pct / 100)
      const final = techo(conDesperdicio)
      lineas.push(
        crearLinea({
          clave: 'cielo.perfil',
          nombre: perfil.nombre,
          materialId: perfil.id,
          unidad: 'un',
          cantidadTeorica: teorica,
          desperdicioPct: pct,
          cantidadFinal: final,
          nota: `${memoriaNeta} ÷ ${f2(separacionM)} m entre ejes = ${f2(mlTotales)} ml ÷ ${f2(largoBarraM)} m por barra = ${f2(teorica)}${tramoDesperdicio(pct, conDesperdicio)} → ${final} un`,
          precioUnitario: perfil.precioUnitario,
        }),
      )
    }
  }

  // --- Perfil perimetral ----------------------------------------------------
  if (parametros.perimetralActivo) {
    const perimetral = buscarMaterial(biblioteca, parametros.perimetralId, 'barra')
    if (!perimetral) {
      avisos.push({ nivel: 'error', mensaje: 'Falta seleccionar el material de Ángulo o tabica.' })
    } else {
      const largoBarraM = numero(perimetral.largoBarraMm, 0) / MM_POR_M
      if (!(largoBarraM > 0)) {
        avisos.push({
          nivel: 'error',
          mensaje: `El largo de barra del perfil ${perimetral.nombre} debe ser mayor que 0. Corrígelo en la Biblioteca.`,
        })
      } else if (!(perimetroM > 0)) {
        avisos.push({
          nivel: 'error',
          mensaje: 'El perímetro del recinto es cero. No se puede cubicar el perfil perimetral.',
        })
      } else {
        const mlTotales = perimetroM
        const pct = desperdicioDe(parametros, 'perimetralDesperdicio')
        const teorica = mlTotales / largoBarraM
        const conDesperdicio = teorica * (1 + pct / 100)
        const final = techo(conDesperdicio)
        lineas.push(
          crearLinea({
            clave: 'cielo.perimetral',
            nombre: perimetral.nombre,
            materialId: perimetral.id,
            unidad: 'un',
            cantidadTeorica: teorica,
            desperdicioPct: pct,
            cantidadFinal: final,
            nota: `${f2(mlTotales)} ml de perímetro ÷ ${f2(largoBarraM)} m por barra = ${f2(teorica)}${tramoDesperdicio(pct, conDesperdicio)} → ${final} un`,
            precioUnitario: perimetral.precioUnitario,
          }),
        )
      }
    }
  }

  // --- Accesorios -----------------------------------------------------------
  const accesorios = [
    {
      activo: 'tornillosActivo',
      materialClave: 'tornillosId',
      densidadClave: 'tornillosPorM2',
      clave: 'cielo.tornillos',
      etiquetaMaterial: 'Material de tornillo',
      etiquetaDensidad: 'Tornillos por m²',
    },
    {
      activo: 'colgantesActivo',
      materialClave: 'colgantesId',
      densidadClave: 'colgantesPorM2',
      clave: 'cielo.colgantes',
      etiquetaMaterial: 'Material de colgante',
      etiquetaDensidad: 'Colgantes por m²',
    },
  ]

  for (const accesorio of accesorios) {
    if (!parametros[accesorio.activo]) continue
    const material = buscarMaterial(biblioteca, parametros[accesorio.materialClave], 'pieza')
    if (!material) {
      avisos.push({
        nivel: 'error',
        mensaje: `Falta seleccionar el material de ${accesorio.etiquetaMaterial}.`,
      })
      continue
    }
    const densidad = numero(parametros[accesorio.densidadClave], 0)
    if (!(densidad > 0)) {
      avisos.push({
        nivel: 'info',
        mensaje: `${accesorio.etiquetaDensidad} está en 0. Esa línea no se cubica.`,
      })
      continue
    }
    const teorica = areaNeta * densidad
    const final = techo(teorica)
    lineas.push(
      crearLinea({
        clave: accesorio.clave,
        nombre: material.nombre,
        materialId: material.id,
        unidad: 'un',
        cantidadTeorica: teorica,
        desperdicioPct: 0,
        cantidadFinal: final,
        nota: `${memoriaNeta} × ${fCorto(densidad)} un/m² = ${f2(teorica)} → ${final} un`,
        precioUnitario: material.precioUnitario,
      }),
    )
  }

  // Con geometría válida el recinto es calculable siempre que haya quedado al
  // menos una línea: si faltan todos los materiales no hay nada que cubicar y
  // el consolidado debe dejarlo fuera declarándolo.
  return { lineas, avisos, calculable: lineas.length > 0 }
}

/* -----------------------------------------------------------------------------
   Trazado del despiece
   -----------------------------------------------------------------------------
   Lo que se dibuja acá es la MISMA cubicación puesta en planta, no un cálculo
   nuevo: la retícula de planchas usa el área útil que ya divide el área neta, y
   los ejes usan la misma separación que ya divide el área en metros lineales.

   El trazado no recorta contra el polígono. Emite su retícula completa sobre el
   rectángulo envolvente y deja el recorte al `clipPath` del lienzo: resolver a
   mano la intersección de cada rectángulo con un polígono cóncavo cualquiera es
   un problema de geometría computacional entero, y el navegador ya lo tiene
   resuelto en el compositor.

   Por lo mismo, ESTO NO ES UN DESPIECE OPTIMIZADO. Es la retícula de referencia
   que ordena el trabajo en terreno; el conteo de material sigue saliendo del
   área, tal como declara la cabecera del archivo.
   -------------------------------------------------------------------------- */

/**
 * Techo de piezas y de ejes dibujados. Un recinto grande con una plancha chica
 * puede pedir decenas de miles de rectángulos: a esa densidad la retícula ya no
 * se lee —es una mancha— y además hunde el cuadro del lienzo justo mientras se
 * está editando la planta. Pasado el tope, la capa no se dibuja: es preferible
 * un lienzo limpio a una mancha que además va lenta.
 */
const MAX_PIEZAS_TRAZADO = 1500
const MAX_EJES_TRAZADO = 400

/**
 * Lee la dirección de la perfilería, tolerando el proyecto guardado antes de
 * que este parámetro existiera: sin valor, corre en X.
 * @param {Object} parametros
 * @returns {'x'|'y'}
 */
function direccionDe(parametros) {
  return parametros.perfilDireccion === 'y' ? 'y' : 'x'
}

/**
 * Capas de despiece del cielo, en milímetros de mundo.
 *
 * @param {ContextoCalculo} ctx
 * @returns {import('./registry.js').CapaTrazado[]}
 */
export function trazar(ctx) {
  /** @type {import('./registry.js').CapaTrazado[]} */
  const capas = []

  const contexto = ctx && typeof ctx === 'object' ? ctx : {}
  const geometria =
    contexto.geometria && typeof contexto.geometria === 'object' ? contexto.geometria : {}
  const parametros =
    contexto.parametros && typeof contexto.parametros === 'object' ? contexto.parametros : {}
  const biblioteca = Array.isArray(contexto.biblioteca) ? contexto.biblioteca : []

  // Sin polígono cerrado no hay superficie que ordenar.
  if (geometria.cerrado !== true) return capas

  const bbox = geometria.bbox && typeof geometria.bbox === 'object' ? geometria.bbox : null
  if (!bbox) return capas
  const minX = numero(bbox.minX, 0)
  const minY = numero(bbox.minY, 0)
  const anchoBB = numero(bbox.ancho, 0)
  const altoBB = numero(bbox.alto, 0)
  if (!(anchoBB > 0) || !(altoBB > 0)) return capas

  const direccion = direccionDe(parametros)

  // --- Retícula de planchas -------------------------------------------------
  const plancha = buscarMaterial(biblioteca, parametros.planchaId, 'plancha')
  if (plancha) {
    const traslapoMm = numero(plancha.traslapoMm, 0)
    const anchoUtilMm = numero(plancha.anchoMm, 0) - traslapoMm
    const largoUtilMm = numero(plancha.largoMm, 0) - traslapoMm

    if (anchoUtilMm > 0 && largoUtilMm > 0) {
      // La plancha se instala con su lado LARGO cruzando los perfiles, que es
      // como amarra a varios ejes en vez de quedar colgando entre dos. Por eso
      // la orientación de la retícula la manda la dirección del perfil y no un
      // parámetro aparte: en terreno no son dos decisiones, es una.
      const pasoX = direccion === 'x' ? anchoUtilMm : largoUtilMm
      const pasoY = direccion === 'x' ? largoUtilMm : anchoUtilMm

      const columnas = Math.ceil(anchoBB / pasoX)
      const filas = Math.ceil(altoBB / pasoY)

      if (columnas > 0 && filas > 0 && columnas * filas <= MAX_PIEZAS_TRAZADO) {
        const rectangulos = []
        for (let fila = 0; fila < filas; fila += 1) {
          for (let columna = 0; columna < columnas; columna += 1) {
            rectangulos.push({
              x: minX + columna * pasoX,
              y: minY + fila * pasoY,
              ancho: pasoX,
              alto: pasoY,
            })
          }
        }
        capas.push({
          clave: 'cielo.plancha',
          nombre: plancha.nombre,
          rotulo: 'Planchas',
          rol: 'pieza',
          rectangulos,
          lineas: [],
        })
      }
    }
  }

  // --- Ejes de perfilería ---------------------------------------------------
  const separacionMm = numero(parametros.separacionCm, 0) * 10
  const perfil = buscarMaterial(biblioteca, parametros.perfilId, 'barra')
  if (perfil && separacionMm > 0) {
    // Los ejes se reparten a lo ANCHO de la dirección en que corren: un perfil
    // horizontal se repite bajando por Y.
    const travesia = direccion === 'x' ? altoBB : anchoBB
    const total = Math.floor(travesia / separacionMm) + 1

    if (total <= MAX_EJES_TRAZADO) {
      const lineas = []
      for (let i = 0; i < total; i += 1) {
        const corrimiento = i * separacionMm
        if (direccion === 'x') {
          const y = minY + corrimiento
          lineas.push({ x1: minX, y1: y, x2: minX + anchoBB, y2: y })
        } else {
          const x = minX + corrimiento
          lineas.push({ x1: x, y1: minY, x2: x, y2: minY + altoBB })
        }
      }
      capas.push({
        clave: 'cielo.perfil',
        nombre: perfil.nombre,
        rotulo: 'Perfilería',
        rol: 'eje',
        rectangulos: [],
        lineas,
      })
    }
  }

  return capas
}

/**
 * Módulo Cielo.
 * @type {ModuloCalculo}
 */
export const cielo = {
  id: 'cielo',
  nombre: 'Cielo',
  descripcion: 'Cielo falso de acero galvanizado: planchas y perfilería omega.',
  disponible: true,
  esquema,
  calcular,
  trazar,
}

export default cielo
