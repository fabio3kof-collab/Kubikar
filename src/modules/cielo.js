/* =============================================================================
   Kubikar · módulo Cielo
   -----------------------------------------------------------------------------
   Cubicación de cielo falso de acero galvanizado: planchas, perfilería omega,
   perfil perimetral y accesorios.

   La PERFILERÍA sale de la planta, no de una división del área: los ejes se
   recortan contra el polígono para obtener corridas de largo real y el
   perimetral usa los lados del polígono. Dividir el área suponía que cada barra
   rinde entera, y con corridas de 2,6 m sobre barras de 3 m eso regalaba 40 cm
   por barra.

   La PLANCHA es la excepción y es deliberada: se cubica por los metros cuadrados
   que cubre. Contar las posiciones de la retícula que tocan el recinto cobraba
   entera una posición que entraba cinco centímetros, y eso sobredimensionaba la
   compra. En obra ese rendimiento se recupera cortando: el recorte de una
   posición se usa en la siguiente. Lo que el corte no alcanza a recuperar lo
   cubre el desperdicio, que por eso arranca en 10% y no en 5%. La retícula se
   sigue dibujando, pero como replanteo: es la guía de instalación, ya no la
   cuenta.

   Los tornillos siguen la misma regla. Son DOS, porque en obra son dos: el
   drywall punta fina se cuenta sobre los metros lineales de perfilería, que es
   donde se atornilla la plancha, y el punta broca cabeza de lenteja se cuenta por
   punto de unión —los dos extremos de cada corrida, más un colgante— porque une
   metal con metal. Solo el colgante se sigue consumiendo por superficie.

   Y los dos se COMPRAN redondeados: bajo 50 un se lleva 50, y de ahí arriba se
   sube a la centena siguiente. Este archivo solo lo DECLARA, en `compra` de la
   línea; el escalón lo aplica la lista de compra, porque comprar es una decisión
   del proyecto entero. Tres recintos de 20 tornillos son 60 tornillos y una sola
   visita a la ferretería: redondear acá los convertiría en 150. Ver
   `src/core/compra.js`.

   Sigue sin haber optimización de cortes: no se empaqueta, no se mezclan
   materiales, no se numeran piezas y no se reutiliza retazo entre recintos.

   `calcular` y `trazar` leen el MISMO reparto, de una sola función. Es la
   garantía de que el número que se compra y la retícula que se dibuja no puedan
   separarse: son el mismo dato leído dos veces.

   Este archivo no importa React, no toca el navegador y no lee la unidad
   activa: la geometría siempre llega en milímetros y las cantidades salen en
   metros y en unidades.
   ========================================================================== */

import { formatearCantidad, formatearNumero, parsearNumeroCL } from '../core/units.js'
import {
  esAutoIntersectante,
  recortarLineaEnPoligono,
  rectanguloTocaPoligono,
  segmentos,
} from '../core/geometry.js'
import { repartirBarras } from '../core/reparto.js'

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
    // Respaldo para cuando todavía no hay plancha elegida: sin esto el parámetro
    // nacería en 0, que para una cubicación por área es la cifra equivocada.
    porDefecto: 10,
    min: 0,
    max: 100,
    paso: 1,
    sufijo: '%',
    grupo: 'Planchas',
    // La plancha se cubica por área, así que este porcentaje SÍ carga con el
    // corte: es el único lugar donde se compensa lo que se pierde ajustando
    // contra los bordes del recinto. Por eso el material lo trae en 10% y no en
    // el 5% del resto.
    ayuda:
      'Cubre el corte contra los bordes del recinto, la rotura y el error de medida. La cantidad sale de los m² que cubre la plancha, no de la retícula.',
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
    // Desde que la cantidad sale de la planta, este parámetro SÍ mueve el
    // número: cambia el largo de cada corrida y la orientación de la retícula.
    // Decirlo es obligación, porque hasta la versión anterior la ayuda prometía
    // lo contrario y el usuario podría no volver a mirar el listado.
    ayuda:
      'Hacia dónde corren los perfiles. Define el largo de cada corrida y la orientación de la retícula de planchas, así que cambia las cantidades: al girarlo, revisa el listado.',
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
    ayuda:
      'Cubre rotura y error de corte. El retazo que se pierde en cada barra ya está contado aparte, según el retazo mínimo del material.',
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
    ayuda:
      'Cubre rotura y error de corte. El retazo que se pierde en cada barra ya está contado aparte.',
  },
  // Un cielo lleva DOS tornillos y no son intercambiables. El punta fina rasga el
  // yeso-cartón sin reventarlo y muerde la chapa delgada del omega; el punta
  // broca perfora los dos metales de un encuentro y su cabeza de lenteja queda
  // plana para que la plancha apoye encima. Cubicarlos como uno solo obligaba a
  // decidir en la ferretería cuál de los dos se había comprado.
  {
    clave: 'tornillosPlanchaActivo',
    tipo: 'booleano',
    etiqueta: 'Tornillos de plancha',
    porDefecto: true,
    grupo: 'Accesorios',
  },
  {
    clave: 'tornillosPlanchaId',
    tipo: 'material',
    etiqueta: 'Tornillo de plancha',
    materialTipo: 'pieza',
    materialUso: 'fijacion_plancha',
    preferir: ['punta fina', 'drywall', 'yeso'],
    dependeDe: 'tornillosPlanchaActivo',
    grupo: 'Accesorios',
    ayuda:
      'Drywall punta fina: fija la plancha al perfil. Acá va la cantidad exacta del recinto; el consolidado suma los recintos y sube el total al escalón de compra, porque los tornillos se piden una sola vez para toda la obra.',
  },
  {
    clave: 'tornillosPlanchaSeparacionCm',
    tipo: 'numero',
    etiqueta: 'Separación entre tornillos',
    porDefecto: 20,
    // 15 y 20 son el paso de plancha; 25, 30 y 40 son el paso de perfil, que es
    // lo que se usa cuando el tornillo va sobre el omega y no sobre la junta.
    // Sin 30 ni 40 en la fila, esos dos casos —los más corrientes en cielo con
    // ejes a 40— obligaban a escribir la cifra a mano en cada recinto.
    sugeridos: [15, 20, 25, 30, 40],
    min: 1,
    paso: 1,
    sufijo: 'cm',
    dependeDe: 'tornillosPlanchaActivo',
    grupo: 'Accesorios',
    ayuda:
      'A lo largo de cada corrida de perfil. Como se cuenta sobre los metros lineales trazados, abrir la separación entre ejes baja los tornillos: hay menos perfil que atornillar.',
  },
  {
    clave: 'tornillosMetalActivo',
    tipo: 'booleano',
    etiqueta: 'Tornillos metal-metal',
    porDefecto: true,
    grupo: 'Accesorios',
  },
  {
    clave: 'tornillosMetalId',
    tipo: 'material',
    etiqueta: 'Tornillo metal-metal',
    materialTipo: 'pieza',
    materialUso: 'fijacion_metal',
    preferir: ['punta broca', 'lenteja', 'broca'],
    dependeDe: 'tornillosMetalActivo',
    grupo: 'Accesorios',
    ayuda:
      'Punta broca cabeza de lenteja: une el perimetral con los perfiles y el colgante con el perfil. Acá va la cantidad exacta del recinto; el consolidado suma los recintos y sube el total al escalón de compra, porque los tornillos se piden una sola vez para toda la obra.',
  },
  {
    clave: 'tornillosMetalPorEncuentro',
    tipo: 'numero',
    etiqueta: 'Tornillos por encuentro',
    porDefecto: 2,
    sugeridos: [1, 2, 3],
    min: 0,
    paso: 1,
    sufijo: 'un',
    dependeDe: 'tornillosMetalActivo',
    grupo: 'Accesorios',
    ayuda:
      'En cada extremo de corrida que llega al perimetral. La fijación del colgante al perfil se suma aparte, a uno por colgante.',
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
    materialUso: 'colgante',
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
 * Escalón de compra de los tornillos: bajo 50 un se lleva 50, y de ahí arriba se
 * sube a la centena siguiente.
 *
 * Un tornillo no se compra de a uno. En la ferretería se pide por puñado o por
 * caja, y nadie despacha 358: el que llega con esa cifra redondea igual, pero en
 * el mesón y sin dejar rastro en la cubicación.
 *
 * Va DECLARADO en la línea y no aplicado acá. El recinto dice cuántos tornillos
 * lleva —20 un son 20 un, y así se instalan— y la lista de compra suma los
 * recintos y sube el total una sola vez. Aplicarlo en cada recinto redondearía
 * tres veces lo que se compra una, y el sobrante de un tornillo sí viaja a la
 * pieza siguiente: no es un retazo de barra. Ver `src/core/compra.js`.
 */
const COMPRA_TORNILLOS = { minimo: 50, paso: 100 }

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
 * @param {{minimo:number,paso:number}} [datos.compra]
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
    // Ausente en casi todas las líneas, y eso es lo correcto: una plancha se
    // compra por unidad y una barra por barra. Solo lo declara lo que la
    // ferretería no despacha en la cantidad exacta.
    compra: datos.compra ?? null,
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
   Reparto sobre la planta
   -----------------------------------------------------------------------------
   La única lectura de la geometría del módulo. `calcular` saca de acá las
   corridas de perfilería y `trazar` saca de acá sus rectángulos y sus líneas:
   por eso los metros de perfil que se compran y los ejes que se dibujan no
   pueden divergir. La retícula de planchas sale del mismo lugar, pero solo para
   dibujarse: su cantidad se cubica por área.

   No decide tinta, grosor ni presentación. Devuelve milímetros de mundo.
   -------------------------------------------------------------------------- */

/**
 * Topes del REPARTO, distintos de los del dibujo. Pasado el tope de dibujo la
 * capa no se pinta porque sería una mancha; pasado el tope de reparto ni siquiera
 * se arma la lista, porque recorrerla costaría más que el dato que entrega.
 *
 * El de corridas es además un tope de cálculo: sin corridas no hay metros de
 * perfil que cubicar y la línea queda fuera con su aviso. El de posiciones ya no
 * lo es: la plancha se cubica por área, así que pasarse solo apaga el replanteo.
 */
const MAX_CORRIDAS_CALCULO = 20_000
const MAX_POSICIONES_CALCULO = 50_000

/**
 * Cuánto se corre hacia adentro un eje que cae exactamente sobre un muro.
 *
 * El recorte contra el polígono usa una convención semiabierta: una recta que
 * coincide con el borde de arranque devuelve la corrida completa y la que
 * coincide con el borde opuesto no devuelve nada. Como los ejes nacen en el
 * borde del rectángulo envolvente y avanzan a paso fijo, el último eje cae justo
 * sobre el muro cada vez que la travesía es múltiplo de la separación —2,40 m
 * con ejes cada 40 cm, que es de lo más corriente— y se perdería una corrida
 * entera. Un milímetro hacia adentro no mueve ninguna medida y resuelve también
 * el caso del eje que coincide con un muro interior.
 */
const EPS_MURO_MM = 1

/**
 * Corridas de un eje, con el desplazamiento de rescate cuando el eje cae sobre
 * un muro y el recorte no devuelve nada.
 *
 * @param {Array} vertices
 * @param {{x1:number,y1:number,x2:number,y2:number}} eje
 * @param {'x'|'y'} direccion  hacia dónde corre el eje
 * @returns {{x1:number,y1:number,x2:number,y2:number,largoMm:number}[]}
 */
function corridasDeEje(vertices, eje, direccion) {
  const directo = recortarLineaEnPoligono(vertices, eje)
  if (directo.length > 0) return directo

  // El eje se reparte a lo ancho de la dirección en que corre, así que el
  // rescate se aplica sobre el otro eje: un perfil horizontal se corre en Y.
  for (const paso of [EPS_MURO_MM, -EPS_MURO_MM]) {
    const corrido =
      direccion === 'x'
        ? { x1: eje.x1, y1: eje.y1 - paso, x2: eje.x2, y2: eje.y2 - paso }
        : { x1: eje.x1 - paso, y1: eje.y1, x2: eje.x2 - paso, y2: eje.y2 }
    const tramos = recortarLineaEnPoligono(vertices, corrido)
    if (tramos.length > 0) return tramos
  }

  return []
}

/**
 * @typedef {Object} RepartoDeRecinto
 * @property {Object|null} plancha  material, pasos, retícula y posiciones que tocan
 * @property {Object|null} perfil   material, dirección, ejes y corridas reales
 */

/**
 * Reparto del módulo sobre la planta.
 * @param {ContextoCalculo} ctx
 * @returns {RepartoDeRecinto|null}
 */
function repartoDelRecinto(ctx) {
  const contexto = ctx && typeof ctx === 'object' ? ctx : {}
  const geometria =
    contexto.geometria && typeof contexto.geometria === 'object' ? contexto.geometria : {}
  const parametros =
    contexto.parametros && typeof contexto.parametros === 'object' ? contexto.parametros : {}
  const biblioteca = Array.isArray(contexto.biblioteca) ? contexto.biblioteca : []

  if (geometria.cerrado !== true) return null
  const vertices = Array.isArray(geometria.vertices) ? geometria.vertices : []
  if (vertices.length < 3) return null

  const bbox = geometria.bbox && typeof geometria.bbox === 'object' ? geometria.bbox : null
  if (!bbox) return null
  const minX = numero(bbox.minX, 0)
  const minY = numero(bbox.minY, 0)
  const anchoBB = numero(bbox.ancho, 0)
  const altoBB = numero(bbox.alto, 0)
  if (!(anchoBB > 0) || !(altoBB > 0)) return null

  const direccion = direccionDe(parametros)

  /** @type {RepartoDeRecinto} */
  const reparto = { plancha: null, perfil: null }

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
      const total = columnas * filas

      reparto.plancha = {
        material: plancha,
        pasoX,
        pasoY,
        columnas,
        filas,
        total,
        excedido: total > MAX_POSICIONES_CALCULO,
        posiciones: [],
      }

      if (columnas > 0 && filas > 0 && !reparto.plancha.excedido) {
        for (let fila = 0; fila < filas; fila += 1) {
          for (let columna = 0; columna < columnas; columna += 1) {
            const rect = {
              x: minX + columna * pasoX,
              y: minY + fila * pasoY,
              ancho: pasoX,
              alto: pasoY,
            }
            if (!rectanguloTocaPoligono(vertices, rect)) continue
            reparto.plancha.posiciones.push(rect)
          }
        }
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

    reparto.perfil = {
      material: perfil,
      direccion,
      ejes: total,
      excedido: total > MAX_CORRIDAS_CALCULO,
      lineas: [],
      corridas: [],
    }

    if (!reparto.perfil.excedido) {
      for (let i = 0; i < total; i += 1) {
        const corrimiento = i * separacionMm
        const eje =
          direccion === 'x'
            ? {
                x1: minX,
                y1: minY + corrimiento,
                x2: minX + anchoBB,
                y2: minY + corrimiento,
              }
            : {
                x1: minX + corrimiento,
                y1: minY,
                x2: minX + corrimiento,
                y2: minY + altoBB,
              }
        const tramos = corridasDeEje(vertices, eje, direccion)
        for (let k = 0; k < tramos.length; k += 1) {
          reparto.perfil.lineas.push({
            x1: tramos[k].x1,
            y1: tramos[k].y1,
            x2: tramos[k].x2,
            y2: tramos[k].y2,
          })
          reparto.perfil.corridas.push(tramos[k].largoMm)
        }
      }
    }
  }

  return reparto
}

/**
 * Resumen legible de una lista de grupos de largo: «8 × 2,60 m + 6 × 1,80 m».
 * Se muestran los tres grupos más largos y el resto se declara agregado, porque
 * una nota con veinte sumandos deja de ser una memoria de cálculo.
 *
 * @param {{largoMm:number,veces:number}[]} grupos
 * @returns {string}
 */
function resumenDeGrupos(grupos) {
  if (!Array.isArray(grupos) || grupos.length === 0) return ''
  const visibles = grupos.slice(0, 3)
  const texto = visibles.map((g) => `${g.veces} × ${f2(g.largoMm / MM_POR_M)} m`).join(' + ')
  const restantes = grupos.length - visibles.length
  if (restantes === 0) return texto
  return `${texto} y ${restantes} ${restantes === 1 ? 'largo más' : 'largos más'}`
}

/**
 * Tramo de la memoria que declara los empalmes. Se omite con traslapo 0: escribir
 * «2 empalmes de 0,00 m» sería ruido, igual que «+0 % desperdicio».
 *
 * @param {number} empalmes
 * @param {number} traslapoMm
 * @returns {string}
 */
function tramoEmpalmes(empalmes, traslapoMm) {
  if (!(empalmes > 0) || !(traslapoMm > 0)) return ''
  const plural = empalmes === 1 ? 'empalme' : 'empalmes'
  return ` · ${empalmes} ${plural} de ${f2(traslapoMm / MM_POR_M)} m`
}

/**
 * Cubica una línea de barras a partir de las piezas que pide la planta.
 *
 * Devuelve la línea lista o el aviso que explica por qué no se pudo, de modo que
 * el perfil soportante y el perimetral compartan validación, reparto y redacción
 * en vez de repetirlas con dos textos que se van separando con el tiempo.
 *
 * @param {Object} datos
 * @param {Object} datos.material
 * @param {number[]} datos.piezasMm
 * @param {string} datos.clave
 * @param {number} datos.desperdicioPct
 * @param {string} datos.sujeto        'corridas' o 'lados'
 * @param {string} [datos.encabezado]  tramo propio antes de la barra
 * @returns {{linea:LineaMaterial}|{aviso:AvisoCalculo}}
 */
function cubicarBarras(datos) {
  const material = datos.material
  const largoBarraMm = numero(material.largoBarraMm, 0)
  const traslapoMm = numero(material.traslapoMm, 0)
  const retazoMinimoMm = numero(material.retazoMinimoMm, 0)

  if (!(largoBarraMm > 0)) {
    return {
      aviso: {
        nivel: 'error',
        mensaje: `El largo de barra del perfil ${material.nombre} debe ser mayor que 0. Corrígelo en la Biblioteca.`,
      },
    }
  }

  if (traslapoMm >= largoBarraMm) {
    return {
      aviso: {
        nivel: 'error',
        mensaje: `El traslapo de empalme del perfil ${material.nombre} (${f2(traslapoMm / MM_POR_M)} m) debe ser menor que su largo de barra (${f2(largoBarraMm / MM_POR_M)} m): con ese valor un empalme no avanza corrida. Corrígelo en la Biblioteca.`,
      },
    }
  }

  const reparto = repartirBarras(datos.piezasMm, {
    largoBarraMm,
    traslapoMm,
    retazoMinimoMm,
  })

  if (!reparto || !(reparto.barras > 0)) {
    return {
      aviso: {
        nivel: 'error',
        mensaje: `No se pudo repartir ${material.nombre} sobre la planta. Revisa el largo de barra y el traslapo en la Biblioteca, y la separación entre ejes.`,
      },
    }
  }

  const pct = datos.desperdicioPct
  const teorica = reparto.barras
  const conDesperdicio = teorica * (1 + pct / 100)
  const final = techo(conDesperdicio)

  const cuantas = reparto.grupos.reduce((suma, g) => suma + g.veces, 0)
  const sujeto = `${cuantas} ${datos.sujeto}`
  const detalle = resumenDeGrupos(reparto.grupos)
  const encabezado = datos.encabezado
    ? `${sujeto} (${detalle}) = ${f2(reparto.mlPedidos)} ${datos.encabezado}`
    : `${sujeto} (${detalle}) = ${f2(reparto.mlPedidos)} ml`

  const nota =
    `${encabezado} · barra de ${f2(largoBarraMm / MM_POR_M)} m, retazo mínimo ` +
    `${f2(retazoMinimoMm / MM_POR_M)} m${tramoEmpalmes(reparto.empalmes, traslapoMm)} → ` +
    `${teorica} barras · descarte ${f2(reparto.mlDescartados)} ml` +
    `${tramoDesperdicio(pct, conDesperdicio)} → ${final} un`

  return {
    linea: crearLinea({
      clave: datos.clave,
      nombre: material.nombre,
      materialId: material.id,
      unidad: 'un',
      cantidadTeorica: teorica,
      desperdicioPct: pct,
      cantidadFinal: final,
      nota,
      precioUnitario: material.precioUnitario,
    }),
  }
}

/* -----------------------------------------------------------------------------
   Accesorios
   -----------------------------------------------------------------------------
   Tres cuentas distintas y por eso tres funciones, no un bucle con banderas: el
   colgante se consume por superficie, el tornillo de plancha por metro lineal de
   perfil y el tornillo metal-metal por punto de unión. Comparten la forma de
   `cubicarBarras` —devuelven `{linea}` o `{aviso}`— para que `calcular` las trate
   a todas igual.
   -------------------------------------------------------------------------- */

/**
 * Accesorio que se consume por superficie: densidad × área neta.
 *
 * @param {Object} datos
 * @param {Object|null} datos.material
 * @param {number} datos.densidad
 * @param {number} datos.areaNeta
 * @param {string} datos.memoriaNeta
 * @param {string} datos.clave
 * @param {string} datos.etiquetaMaterial
 * @param {string} datos.etiquetaDensidad
 * @returns {{linea:LineaMaterial}|{aviso:AvisoCalculo}}
 */
function cubicarPorArea(datos) {
  if (!datos.material) {
    return {
      aviso: {
        nivel: 'error',
        mensaje: `Falta seleccionar el material de ${datos.etiquetaMaterial}.`,
      },
    }
  }
  if (!(datos.densidad > 0)) {
    return {
      aviso: {
        nivel: 'info',
        mensaje: `${datos.etiquetaDensidad} está en 0. Esa línea no se cubica.`,
      },
    }
  }

  const teorica = datos.areaNeta * datos.densidad
  const final = techo(teorica)
  return {
    linea: crearLinea({
      clave: datos.clave,
      nombre: datos.material.nombre,
      materialId: datos.material.id,
      unidad: 'un',
      cantidadTeorica: teorica,
      desperdicioPct: 0,
      cantidadFinal: final,
      nota: `${datos.memoriaNeta} × ${fCorto(datos.densidad)} un/m² = ${f2(teorica)} → ${final} un`,
      precioUnitario: datos.material.precioUnitario,
    }),
  }
}

/**
 * Tornillo que fija la plancha al perfil.
 *
 * Se cuenta sobre los METROS LINEALES REALES de perfilería, que es donde va el
 * tornillo: la plancha se atornilla donde cruza el perfil, no repartida sobre la
 * superficie. Por eso reacciona a la separación entre ejes —abrirla de 40 a 60 cm
 * baja los tornillos de verdad— cosa que una densidad por m² no podía ver.
 *
 * El precio de esa fidelidad es esta dependencia: sin corridas trazadas no hay de
 * dónde contar, y la línea sale del listado declarándolo.
 *
 * @param {Object} datos
 * @param {Object|null} datos.material
 * @param {number[]|null} datos.corridas   largos en mm, ya recortados contra la planta
 * @param {number} datos.separacionCm
 * @returns {{linea:LineaMaterial}|{aviso:AvisoCalculo}}
 */
function cubicarTornillosPlancha(datos) {
  if (!datos.material) {
    return {
      aviso: { nivel: 'error', mensaje: 'Falta seleccionar el material de Tornillo de plancha.' },
    }
  }
  if (!Array.isArray(datos.corridas) || datos.corridas.length === 0) {
    return {
      aviso: {
        nivel: 'error',
        mensaje:
          'Los tornillos de plancha se cuentan sobre los metros lineales de perfilería, y la perfilería no se pudo trazar. Esa línea queda fuera.',
      },
    }
  }
  if (!(datos.separacionCm > 0)) {
    return {
      aviso: {
        nivel: 'error',
        mensaje:
          'La separación entre tornillos no puede ser 0. Ingresa un valor mayor que 0 para cubicar los tornillos de plancha.',
      },
    }
  }

  const mlPerfil = datos.corridas.reduce((suma, largo) => suma + largo, 0) / MM_POR_M
  const pasoM = datos.separacionCm / 100
  const teorica = mlPerfil / pasoM
  const final = techo(teorica)

  return {
    linea: crearLinea({
      clave: 'cielo.tornillosPlancha',
      nombre: datos.material.nombre,
      materialId: datos.material.id,
      unidad: 'un',
      cantidadTeorica: teorica,
      desperdicioPct: 0,
      cantidadFinal: final,
      compra: COMPRA_TORNILLOS,
      nota: `${f2(mlPerfil)} ml de perfilería ÷ ${f2(pasoM)} m entre tornillos = ${f2(teorica)} → ${final} un`,
      precioUnitario: datos.material.precioUnitario,
    }),
  }
}

/**
 * Tornillo metal-metal: perimetral con perfil, y colgante con perfil.
 *
 * Los encuentros salen de la planta, no de una densidad: cada corrida trazada
 * llega al perimetral por sus DOS extremos, y esas corridas son las mismas que ya
 * compraron las barras. No depende de que el perimetral esté activo, porque el
 * extremo del perfil hay que fijarlo igual; quien no los quiera apaga la línea
 * con su propio interruptor.
 *
 * La fijación del colgante va fija en uno por colgante: un colgante se amarra al
 * perfil en un punto y eso no es una variable. El número de colgantes llega ya
 * redondeado desde su propia línea —no se recalcula acá— para que las dos líneas
 * no puedan discrepar.
 *
 * @param {Object} datos
 * @param {Object|null} datos.material
 * @param {number[]|null} datos.corridas
 * @param {number} datos.porEncuentro
 * @param {number} datos.colgantes  cantidad final de la línea de colgantes
 * @returns {{linea:LineaMaterial}|{aviso:AvisoCalculo}}
 */
function cubicarTornillosMetal(datos) {
  if (!datos.material) {
    return {
      aviso: { nivel: 'error', mensaje: 'Falta seleccionar el material de Tornillo metal-metal.' },
    }
  }
  if (!Array.isArray(datos.corridas) || datos.corridas.length === 0) {
    return {
      aviso: {
        nivel: 'error',
        mensaje:
          'Los tornillos metal-metal se cuentan sobre los encuentros de la perfilería, que no se pudo trazar. Esa línea queda fuera.',
      },
    }
  }

  const encuentros = datos.corridas.length * 2
  const porEncuentro = datos.porEncuentro > 0 ? datos.porEncuentro : 0
  const colgantes = datos.colgantes > 0 ? datos.colgantes : 0
  const teorica = encuentros * porEncuentro + colgantes

  if (!(teorica > 0)) {
    return {
      aviso: {
        nivel: 'info',
        mensaje:
          'Tornillos por encuentro está en 0 y no hay colgantes que fijar. Esa línea no se cubica.',
      },
    }
  }

  const final = techo(teorica)
  const deEncuentros = `${datos.corridas.length} ${datos.corridas.length === 1 ? 'corrida' : 'corridas'} × 2 extremos × ${fCorto(porEncuentro)} un = ${encuentros * porEncuentro} un`
  const deColgantes =
    colgantes > 0
      ? ` · ${colgantes} ${colgantes === 1 ? 'colgante' : 'colgantes'} × 1 un = ${colgantes} un`
      : ''

  return {
    linea: crearLinea({
      clave: 'cielo.tornillosMetal',
      nombre: datos.material.nombre,
      materialId: datos.material.id,
      unidad: 'un',
      cantidadTeorica: teorica,
      desperdicioPct: 0,
      cantidadFinal: final,
      compra: COMPRA_TORNILLOS,
      nota: `${deEncuentros}${deColgantes} → ${final} un`,
      precioUnitario: datos.material.precioUnitario,
    }),
  }
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
 *   TORNILLO   plancha  = (Σ corridas / 1000) / (separacionTornilloCm / 100)
 *              metal    = corridas × 2 extremos × porEncuentro + colgantes
 *   COLGANTES  teórica  = areaNeta × densidad
 *   final = ceil(teórica × (1 + desperdicio/100))
 *   Los TORNILLOS declaran además su escalón de compra —50 un, o la centena
 *   siguiente de ahí para arriba— que NO se aplica acá: lo aplica la lista de
 *   compra sobre la suma del proyecto (ver `src/core/compra.js`).
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

  // El reparto es la lectura de la planta y lo comparte `trazar`: las corridas
  // de perfilería que se compran y los ejes que se dibujan son el mismo dato, así
  // que una diferencia sería un error en un solo lugar y no en dos cuentas
  // paralelas. La retícula de planchas viaja en el mismo reparto, pero solo para
  // el dibujo: su cantidad se cubica por área más abajo.
  const reparto = repartoDelRecinto(contexto)

  // --- Planchas -------------------------------------------------------------
  const plancha = buscarMaterial(biblioteca, parametros.planchaId, 'plancha')
  if (!plancha) {
    avisos.push({
      nivel: 'error',
      mensaje: 'Falta seleccionar el material de Material de plancha.',
    })
  } else {
    // El traslapo se descuenta de las dos medidas: lo que la plancha tapa de
    // verdad es su cara menos lo que se monta sobre la vecina.
    const traslapoMm = numero(plancha.traslapoMm, 0)
    const anchoUtilMm = numero(plancha.anchoMm, 0) - traslapoMm
    const largoUtilMm = numero(plancha.largoMm, 0) - traslapoMm
    const areaUtilM2 = (anchoUtilMm * largoUtilMm) / MM2_POR_M2

    if (!(anchoUtilMm > 0) || !(largoUtilMm > 0) || !(areaUtilM2 > 0)) {
      avisos.push({
        nivel: 'error',
        mensaje: `Las medidas de la plancha ${plancha.nombre} no dan un área útil mayor que 0. Revisa ancho, largo y traslapo en la Biblioteca.`,
      })
    } else {
      const pct = desperdicioDe(parametros, 'planchaDesperdicio')
      const teorica = areaNeta / areaUtilM2
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
          nota: `${memoriaNeta} ÷ ${f2(areaUtilM2)} m² útiles por plancha = ${f2(teorica)} un${tramoDesperdicio(pct, conDesperdicio)} → ${final} un`,
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
  } else if (!reparto || !reparto.perfil) {
    avisos.push({
      nivel: 'error',
      mensaje: `No se pudo trazar la perfilería de ${perfil.nombre} sobre la planta. Revisa el polígono del recinto y la separación entre ejes.`,
    })
  } else if (reparto.perfil.excedido) {
    avisos.push({
      nivel: 'error',
      mensaje: `La perfilería pide ${reparto.perfil.ejes} ejes sobre esta planta y el tope de cálculo es ${MAX_CORRIDAS_CALCULO}. Aumenta la separación entre ejes o divide el recinto para cubicarla.`,
    })
  } else if (reparto.perfil.corridas.length === 0) {
    avisos.push({
      nivel: 'error',
      mensaje:
        'No se trazó ninguna corrida de perfilería sobre la planta. Revisa la separación entre ejes y el polígono del recinto.',
    })
  } else {
    const cubicado = cubicarBarras({
      material: perfil,
      piezasMm: reparto.perfil.corridas,
      clave: 'cielo.perfil',
      desperdicioPct: desperdicioDe(parametros, 'perfilDesperdicio'),
      sujeto: 'corridas',
    })
    if (cubicado.aviso) avisos.push(cubicado.aviso)
    else lineas.push(cubicado.linea)
  }

  // --- Perfil perimetral ----------------------------------------------------
  if (parametros.perimetralActivo) {
    const perimetral = buscarMaterial(biblioteca, parametros.perimetralId, 'barra')
    if (!perimetral) {
      avisos.push({ nivel: 'error', mensaje: 'Falta seleccionar el material de Ángulo o tabica.' })
    } else if (!(perimetroM > 0)) {
      avisos.push({
        nivel: 'error',
        mensaje: 'El perímetro del recinto es cero. No se puede cubicar el perfil perimetral.',
      })
    } else {
      // El perimetral no se corta de un perímetro continuo: cada muro lleva su
      // pieza y el sobrante de uno solo sirve en otro si alcanza el mínimo.
      const lados = segmentos(vertices, true).map((s) => s.largoMm)
      const cubicado = cubicarBarras({
        material: perimetral,
        piezasMm: lados,
        clave: 'cielo.perimetral',
        desperdicioPct: desperdicioDe(parametros, 'perimetralDesperdicio'),
        sujeto: 'lados',
        encabezado: 'ml de perímetro',
      })
      if (cubicado.aviso) avisos.push(cubicado.aviso)
      else lineas.push(cubicado.linea)
    }
  }

  // --- Accesorios -----------------------------------------------------------
  // Las corridas que los tornillos usan son las MISMAS que compraron las barras.
  // Se leen del reparto y no del resultado de la perfilería a propósito: un omega
  // mal configurado en la Biblioteca deja sin línea al perfil, pero la planta
  // sigue trazada y los tornillos siguen siendo contables.
  const corridas =
    reparto && reparto.perfil && !reparto.perfil.excedido && reparto.perfil.corridas.length > 0
      ? reparto.perfil.corridas
      : null

  // El colgante se cubica ANTES que el tornillo metal-metal porque ese tornillo
  // lee su cantidad ya redondeada: el que amarra el colgante al perfil sale de la
  // misma caja, y recalcularlo con otro redondeo dejaría dos líneas que se
  // contradicen. Un solo dato, leído dos veces —el mismo trato que el reparto.
  // La línea se guarda y se agrega al final para que el listado conserve el
  // orden del panel: primero los tornillos, después los colgantes.
  /** @type {LineaMaterial|null} */
  let lineaColgantes = null
  if (parametros.colgantesActivo) {
    const cubicado = cubicarPorArea({
      material: buscarMaterial(biblioteca, parametros.colgantesId, 'pieza'),
      densidad: numero(parametros.colgantesPorM2, 0),
      areaNeta,
      memoriaNeta,
      clave: 'cielo.colgantes',
      etiquetaMaterial: 'Material de colgante',
      etiquetaDensidad: 'Colgantes por m²',
    })
    if (cubicado.aviso) avisos.push(cubicado.aviso)
    else lineaColgantes = cubicado.linea
  }

  if (parametros.tornillosPlanchaActivo) {
    const cubicado = cubicarTornillosPlancha({
      material: buscarMaterial(biblioteca, parametros.tornillosPlanchaId, 'pieza'),
      corridas,
      separacionCm: numero(parametros.tornillosPlanchaSeparacionCm, 0),
    })
    if (cubicado.aviso) avisos.push(cubicado.aviso)
    else lineas.push(cubicado.linea)
  }

  if (parametros.tornillosMetalActivo) {
    const cubicado = cubicarTornillosMetal({
      material: buscarMaterial(biblioteca, parametros.tornillosMetalId, 'pieza'),
      corridas,
      porEncuentro: numero(parametros.tornillosMetalPorEncuentro, 0),
      colgantes: lineaColgantes ? lineaColgantes.cantidadFinal : 0,
    })
    if (cubicado.aviso) avisos.push(cubicado.aviso)
    else lineas.push(cubicado.linea)
  }

  if (lineaColgantes) lineas.push(lineaColgantes)

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

  const reparto = repartoDelRecinto(ctx)
  if (!reparto) return capas

  // --- Retícula de planchas -------------------------------------------------
  // Replanteo, no cuenta: la cantidad sale del área. Solo se pintan las
  // posiciones que tocan la planta, porque las de afuera igual las borraba el
  // recorte del lienzo.
  const plancha = reparto.plancha
  if (
    plancha &&
    !plancha.excedido &&
    plancha.posiciones.length > 0 &&
    plancha.posiciones.length <= MAX_PIEZAS_TRAZADO
  ) {
    capas.push({
      clave: 'cielo.plancha',
      nombre: plancha.material.nombre,
      rotulo: 'Planchas',
      rol: 'pieza',
      rectangulos: plancha.posiciones.map((p) => ({ ...p })),
      lineas: [],
    })
  }

  // --- Ejes de perfilería ---------------------------------------------------
  // Las corridas reales, recortadas contra la planta: exactamente las piezas que
  // el reparto convirtió en barras.
  const perfil = reparto.perfil
  if (
    perfil &&
    !perfil.excedido &&
    perfil.lineas.length > 0 &&
    perfil.ejes <= MAX_EJES_TRAZADO
  ) {
    capas.push({
      clave: 'cielo.perfil',
      nombre: perfil.material.nombre,
      rotulo: 'Perfilería',
      rol: 'eje',
      rectangulos: [],
      lineas: perfil.lineas.map((l) => ({ ...l })),
    })
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
  descripcion:
    'Cielo falso de acero galvanizado: planchas, perfilería omega y sus fijaciones.',
  disponible: true,
  esquema,
  calcular,
  trazar,
}

export default cielo
