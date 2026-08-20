/**
 * Kubikar · esquema de datos versionado
 * -----------------------------------------------------------------------------
 * Este archivo define LA FORMA de todo lo que Kubikar guarda y exporta.
 *
 * Punto de integración futura con la plataforma Karbec
 * ----------------------------------------------------
 * El JSON de proyecto que produce `src/export/json.js` (y que valida acá
 * `validarProyectoImportado`) es el contrato de intercambio con Karbec. Los
 * nombres de campo de esta versión son estables: se eligieron para poder
 * mapearse contra la base de materiales y el presupuesto de Karbec sin
 * renombrar nada después.
 *
 * Dos campos van previstos y VACÍOS (`null`) en esta versión:
 *   · `codigoMaterial` — código de artículo en el maestro de Karbec.
 *   · `partida`        — partida de presupuesto a la que carga la línea.
 * Se emiten igual en cada material y en cada línea de material para que un
 * lector externo ya pueda contar con las columnas, y para que llenarlas más
 * adelante no cambie la versión del formato.
 *
 * Toda la geometría se guarda SIEMPRE en la unidad base (milímetros). La
 * unidad activa de la interfaz es solo presentación y viaja aparte, en
 * `proyecto.unidadActiva`.
 */

/** Identificador del formato de intercambio. */
export const FORMATO = 'kubikar.proyecto'

/** Versión del formato. Se sube solo si cambia la forma de manera incompatible. */
export const FORMATO_VERSION = 1

/** Unidad base interna. La geometría almacenada nunca sale de milímetros. */
export const UNIDAD_BASE = 'mm'

/**
 * Unidades de presentación aceptadas al importar.
 * `src/core/units.js` es la autoridad para convertir y formatear; acá solo se
 * usan para no dejar entrar un valor desconocido en `unidadActiva`.
 */
export const UNIDADES_VALIDAS = ['mm', 'cm', 'm']

/** Tipos de material soportados por la biblioteca. */
export const TIPOS_MATERIAL = ['plancha', 'barra', 'pieza']

/**
 * Para qué sirve un material de tipo 'pieza'. Es lo que permite que el selector
 * de un parámetro ofrezca solo lo que corresponde: en "Tornillo metal-metal" no
 * tiene por qué aparecer el alambre de colgar.
 *
 * `'general'` es COMODÍN, no cajón de sastre: significa "sirve para cualquier
 * cosa" y por eso aparece en todos los selectores. Ahí está la migración de las
 * bibliotecas guardadas antes de que este campo existiera: entran completas, sin
 * el campo, y no se le vacía ningún desplegable al usuario. A medida que
 * clasifique sus piezas, las listas se le van acortando solas.
 *
 * Reemplaza al antiguo `consumo` ('por_m2' | 'por_ml'), que prometía gobernar el
 * cálculo y no lo gobernaba: ningún módulo lo leyó nunca. Un archivo viejo que lo
 * traiga se lee igual; el campo simplemente se ignora al normalizar.
 */
export const USOS_PIEZA = ['fijacion_plancha', 'fijacion_metal', 'colgante', 'general']

/** Uso de una pieza que no declara ninguno. Comodín: calza con todo. */
export const USO_PIEZA_POR_DEFECTO = 'general'

/**
 * Retazo mínimo aprovechable de una barra, en milímetros, cuando el material no
 * lo declara. Medio metro es el corte bajo el cual un perfil deja de servir para
 * otra corrida y se va al descarte; el usuario lo ajusta por material en la
 * Biblioteca, y con 0 vuelve a aprovecharse cualquier sobrante.
 */
export const RETAZO_MINIMO_POR_DEFECTO_MM = 500

/**
 * Desperdicio con que nace un material, por tipo.
 *
 * La plancha va en 10 y no en 5 porque es la única que se cubica por área: su
 * porcentaje carga además con el corte contra los bordes del recinto, que en las
 * barras se cuenta aparte, pieza por pieza, en el reparto. La pieza va en 0
 * porque un tornillo no se corta ni se rompe al instalarse.
 *
 * @param {string} tipo
 * @returns {number}
 */
export function desperdicioPorDefecto(tipo) {
  if (tipo === 'pieza') return 0
  if (tipo === 'plancha') return 10
  return 5
}

/**
 * Módulo de cálculo asignado a un recinto nuevo.
 * La capa de datos no importa `src/modules/*` para no acoplarse al registro:
 * guarda el id como texto y el registro de módulos lo resuelve al calcular.
 */
export const MODULO_POR_DEFECTO = 'cielo'

/** Unidad de presentación por defecto de un proyecto nuevo. */
export const UNIDAD_POR_DEFECTO = 'cm'

/* =============================================================================
   Tipos (JSDoc)
   ========================================================================== */

/**
 * @typedef {Object} Vertice
 * @property {string} id
 * @property {number} x  coordenada en mm
 * @property {number} y  coordenada en mm
 */

/**
 * @typedef {Object} Material
 * @property {string} id
 * @property {'plancha'|'barra'|'pieza'} tipo
 * @property {string} nombre
 * @property {number|null} anchoMm        solo 'plancha'
 * @property {number|null} largoMm        solo 'plancha'
 * @property {number|null} espesorMm      solo 'plancha'
 * @property {number|null} traslapoMm     'plancha' (resta área útil) y 'barra'
 *                                        (lo que consume cada empalme); 0 si va a tope
 * @property {number|null} largoBarraMm   solo 'barra'
 * @property {number|null} retazoMinimoMm solo 'barra': bajo ese largo el sobrante
 *                                        de una barra es descarte y no se reutiliza
 * @property {string|null} designacion    solo 'barra' (perfil comercial)
 * @property {'fijacion_plancha'|'fijacion_metal'|'colgante'|'general'|null} uso
 *                                        solo 'pieza': para qué sirve. Filtra los
 *                                        selectores de parámetro; 'general' calza
 *                                        con todos
 * @property {number} desperdicioPct      0 en 'pieza'
 * @property {number|null} precioUnitario null cuando no hay precio cargado
 * @property {string|null} codigoMaterial previsto para Karbec · null en esta versión
 * @property {string|null} partida        previsto para Karbec · null en esta versión
 * @property {string} creadoEn            ISO 8601
 * @property {string} actualizadoEn       ISO 8601
 */

/**
 * @typedef {Object} LineaMaterialGuardada
 * @property {string} clave
 * @property {string} nombre
 * @property {string|null} materialId
 * @property {string} unidad
 * @property {number} cantidadTeorica
 * @property {number} desperdicioPct
 * @property {number} cantidadFinal
 * @property {string} nota
 * @property {number|null} precioUnitario
 * @property {number|null} subtotal
 * @property {string|null} codigoMaterial  previsto para Karbec · null en esta versión
 * @property {string|null} partida         previsto para Karbec · null en esta versión
 */

/**
 * @typedef {Object} Recinto
 * @property {string} id
 * @property {string} nombre
 * @property {boolean} cerrado
 * @property {Vertice[]} verticesMm    siempre en la unidad base
 * @property {string} moduloId
 * @property {Object} parametros
 * @property {number} areaMm2          derivado, se congela al guardar
 * @property {number} perimetroMm      derivado, se congela al guardar
 * @property {LineaMaterialGuardada[]} lineas  resultado congelado
 */

/**
 * @typedef {Object} Proyecto
 * @property {string} id
 * @property {string} nombre
 * @property {string} creadoEn
 * @property {string} actualizadoEn
 * @property {string} unidadActiva
 * @property {Recinto[]} recintos
 */

/**
 * Forma exacta del proyecto exportado (la que viaja hacia Karbec):
 *
 * {
 *   formato: 'kubikar.proyecto',
 *   version: 1,
 *   unidadBase: 'mm',
 *   generadoEn: '2026-08-17T12:00:00.000Z',
 *   proyecto: {
 *     id, nombre, creadoEn, actualizadoEn,
 *     unidadActiva: 'cm',
 *     recintos: [{
 *       id, nombre,
 *       cerrado: true,
 *       verticesMm: [{ id, x, y }],   // SIEMPRE en milímetros
 *       moduloId: 'cielo',
 *       parametros: { … },            // según el esquema del módulo
 *       areaMm2, perimetroMm,         // derivados, incluidos para lectores externos
 *       lineas: [ LineaMaterial ]     // resultado congelado al exportar
 *     }]
 *   },
 *   biblioteca: [ Material ]          // materiales referidos por el proyecto
 * }
 *
 * @typedef {Object} ProyectoExportado
 * @property {string} formato
 * @property {number} version
 * @property {string} unidadBase
 * @property {string} generadoEn
 * @property {Proyecto} proyecto
 * @property {Material[]} biblioteca
 */

/* =============================================================================
   Utilidades base
   ========================================================================== */

let contadorId = 0

/**
 * Identificador estable. Usa `crypto.randomUUID()` cuando existe y cae a un
 * contador con marca de tiempo en navegadores o contextos sin cripto seguro.
 * @param {string} [prefijo]
 * @returns {string}
 */
export function nuevoId(prefijo = 'id') {
  let base
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    base = crypto.randomUUID()
  } else {
    contadorId += 1
    base = `${Date.now().toString(36)}-${contadorId.toString(36)}-${Math.floor(
      Math.random() * 1e6,
    ).toString(36)}`
  }
  return `${prefijo}_${base}`
}

/**
 * Copia profunda sin dependencias.
 * @template T
 * @param {T} valor
 * @returns {T}
 */
export function clonar(valor) {
  if (valor === null || typeof valor !== 'object') return valor
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(valor)
    } catch {
      /* cae al respaldo por JSON */
    }
  }
  return JSON.parse(JSON.stringify(valor))
}

/** Marca de tiempo ISO del momento actual. */
export function ahoraISO() {
  return new Date().toISOString()
}

/**
 * Número finito o el respaldo indicado.
 * @param {*} valor
 * @param {number|null} porDefecto
 * @returns {number|null}
 */
function numeroO(valor, porDefecto) {
  // Ojo: `Number(null)` es 0 y `Number(true)` es 1. Un precio sin cargar debe
  // seguir siendo null después de normalizar, nunca cero: un cero se suma en
  // la planilla y miente. Por eso solo se convierten números y textos.
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : porDefecto
  if (typeof valor === 'string') {
    const t = valor.trim()
    if (t === '') return porDefecto
    const n = Number(t.replace(',', '.'))
    return Number.isFinite(n) ? n : porDefecto
  }
  return porDefecto
}

/**
 * Texto recortado o el respaldo indicado.
 * @param {*} valor
 * @param {string} porDefecto
 * @returns {string}
 */
function textoO(valor, porDefecto) {
  if (typeof valor !== 'string') return porDefecto
  const t = valor.trim()
  return t.length > 0 ? t : porDefecto
}

/* =============================================================================
   Fábricas
   ========================================================================== */

/**
 * Proyecto nuevo, sin recintos. La interfaz muestra el estado vacío
 * "Este proyecto no tiene recintos." y ofrece agregar el primero.
 * @param {string} [nombre]
 * @returns {Proyecto}
 */
export function nuevoProyecto(nombre = 'Proyecto sin nombre') {
  const ahora = ahoraISO()
  return {
    id: nuevoId('pro'),
    nombre: textoO(nombre, 'Proyecto sin nombre'),
    creadoEn: ahora,
    actualizadoEn: ahora,
    unidadActiva: UNIDAD_POR_DEFECTO,
    recintos: [],
  }
}

/**
 * Recinto nuevo, con el polígono en blanco.
 * @param {string} [nombre]
 * @returns {Recinto}
 */
export function nuevoRecinto(nombre = 'Recinto') {
  return {
    id: nuevoId('rec'),
    nombre: textoO(nombre, 'Recinto'),
    cerrado: false,
    verticesMm: [],
    moduloId: MODULO_POR_DEFECTO,
    parametros: {},
    areaMm2: 0,
    perimetroMm: 0,
    lineas: [],
  }
}

/**
 * Vértice nuevo, en milímetros.
 * @param {number} x
 * @param {number} y
 * @returns {Vertice}
 */
export function nuevoVertice(x, y) {
  return { id: nuevoId('vtx'), x: numeroO(x, 0), y: numeroO(y, 0) }
}

/**
 * Material nuevo del tipo pedido, con la forma COMPLETA y estable: todos los
 * campos existen siempre, los que no aplican al tipo van en null. Esa
 * estabilidad es lo que permite mapear la biblioteca contra Karbec sin
 * inspeccionar el tipo.
 * @param {'plancha'|'barra'|'pieza'} [tipo]
 * @returns {Material}
 */
export function nuevoMaterial(tipo = 'plancha') {
  const t = TIPOS_MATERIAL.includes(tipo) ? tipo : 'plancha'
  const ahora = ahoraISO()
  return {
    id: nuevoId('mat'),
    tipo: t,
    nombre: '',

    // plancha
    anchoMm: t === 'plancha' ? 1200 : null,
    largoMm: t === 'plancha' ? 2400 : null,
    espesorMm: t === 'plancha' ? 15 : null,

    // plancha y barra, con significados distintos: en la plancha el traslapo
    // resta área útil, en la barra es lo que consume cada empalme.
    traslapoMm: t === 'plancha' || t === 'barra' ? 0 : null,

    // barra
    largoBarraMm: t === 'barra' ? 3000 : null,
    retazoMinimoMm: t === 'barra' ? RETAZO_MINIMO_POR_DEFECTO_MM : null,
    designacion: null,

    // pieza
    uso: t === 'pieza' ? USO_PIEZA_POR_DEFECTO : null,

    // comunes
    desperdicioPct: desperdicioPorDefecto(t),
    precioUnitario: null,

    // previstos para Karbec · van vacíos en esta versión
    codigoMaterial: null,
    partida: null,

    creadoEn: ahora,
    actualizadoEn: ahora,
  }
}

/* =============================================================================
   Normalización
   -----------------------------------------------------------------------------
   Todo lo que entra desde el almacenamiento o desde un archivo pasa por acá,
   de modo que el resto del código pueda asumir la forma completa sin defender
   cada acceso.
   ========================================================================== */

/**
 * @param {*} obj
 * @returns {Material}
 */
export function normalizarMaterial(obj) {
  const fuente = obj && typeof obj === 'object' ? obj : {}
  const tipo = TIPOS_MATERIAL.includes(fuente.tipo) ? fuente.tipo : 'plancha'
  const ahora = ahoraISO()

  const desperdicio = numeroO(fuente.desperdicioPct, desperdicioPorDefecto(tipo))

  return {
    id: typeof fuente.id === 'string' && fuente.id ? fuente.id : nuevoId('mat'),
    tipo,
    nombre: textoO(fuente.nombre, 'Material sin nombre'),

    anchoMm: tipo === 'plancha' ? numeroO(fuente.anchoMm, null) : null,
    largoMm: tipo === 'plancha' ? numeroO(fuente.largoMm, null) : null,
    espesorMm: tipo === 'plancha' ? numeroO(fuente.espesorMm, null) : null,
    traslapoMm: tipo === 'plancha' || tipo === 'barra' ? numeroO(fuente.traslapoMm, 0) : null,

    largoBarraMm: tipo === 'barra' ? numeroO(fuente.largoBarraMm, null) : null,
    // Una barra guardada antes de que existiera este campo entra CON descarte, no
    // sin él: su cifra sube apenas se abre el proyecto. Es deliberado —el número
    // anterior estaba corto— y queda auditable porque la memoria de cálculo de
    // cada línea imprime el umbral que usó.
    retazoMinimoMm:
      tipo === 'barra' ? numeroO(fuente.retazoMinimoMm, RETAZO_MINIMO_POR_DEFECTO_MM) : null,
    designacion:
      tipo === 'barra' && typeof fuente.designacion === 'string' && fuente.designacion.trim()
        ? fuente.designacion.trim()
        : null,

    // Una pieza guardada antes de que existiera este campo entra como comodín, no
    // como error: sigue apareciendo en todos los selectores, tal como aparecía
    // antes, y el usuario la clasifica cuando quiera. Lo mismo vale para un valor
    // desconocido: esconder el material sería peor que ofrecerlo de más.
    uso:
      tipo === 'pieza'
        ? USOS_PIEZA.includes(fuente.uso)
          ? fuente.uso
          : USO_PIEZA_POR_DEFECTO
        : null,

    desperdicioPct: tipo === 'pieza' ? 0 : Math.max(0, desperdicio === null ? 0 : desperdicio),
    precioUnitario: numeroO(fuente.precioUnitario, null),

    // Previstos para Karbec: se conserva lo que venga si algún día llega con
    // valor, pero esta versión no los llena en ninguna parte.
    codigoMaterial: typeof fuente.codigoMaterial === 'string' ? fuente.codigoMaterial : null,
    partida: typeof fuente.partida === 'string' ? fuente.partida : null,

    creadoEn: typeof fuente.creadoEn === 'string' ? fuente.creadoEn : ahora,
    actualizadoEn: typeof fuente.actualizadoEn === 'string' ? fuente.actualizadoEn : ahora,
  }
}

/**
 * @param {*} obj
 * @returns {Vertice}
 */
function normalizarVertice(obj) {
  const fuente = obj && typeof obj === 'object' ? obj : {}
  return {
    id: typeof fuente.id === 'string' && fuente.id ? fuente.id : nuevoId('vtx'),
    x: numeroO(fuente.x, 0),
    y: numeroO(fuente.y, 0),
  }
}

/**
 * @param {*} obj
 * @returns {LineaMaterialGuardada}
 */
function normalizarLinea(obj) {
  const fuente = obj && typeof obj === 'object' ? obj : {}
  return {
    clave: textoO(fuente.clave, 'linea'),
    nombre: textoO(fuente.nombre, 'Material'),
    materialId: typeof fuente.materialId === 'string' ? fuente.materialId : null,
    unidad: textoO(fuente.unidad, 'un'),
    cantidadTeorica: numeroO(fuente.cantidadTeorica, 0) ?? 0,
    desperdicioPct: numeroO(fuente.desperdicioPct, 0) ?? 0,
    cantidadFinal: numeroO(fuente.cantidadFinal, 0) ?? 0,
    nota: typeof fuente.nota === 'string' ? fuente.nota : '',
    precioUnitario: numeroO(fuente.precioUnitario, null),
    subtotal: numeroO(fuente.subtotal, null),
    codigoMaterial: typeof fuente.codigoMaterial === 'string' ? fuente.codigoMaterial : null,
    partida: typeof fuente.partida === 'string' ? fuente.partida : null,
  }
}

/**
 * @param {*} obj
 * @returns {Recinto}
 */
export function normalizarRecinto(obj) {
  const fuente = obj && typeof obj === 'object' ? obj : {}
  const vertices = Array.isArray(fuente.verticesMm) ? fuente.verticesMm.map(normalizarVertice) : []
  return {
    id: typeof fuente.id === 'string' && fuente.id ? fuente.id : nuevoId('rec'),
    nombre: textoO(fuente.nombre, 'Recinto'),
    cerrado: fuente.cerrado === true && vertices.length >= 3,
    verticesMm: vertices,
    moduloId: textoO(fuente.moduloId, MODULO_POR_DEFECTO),
    parametros:
      fuente.parametros && typeof fuente.parametros === 'object' && !Array.isArray(fuente.parametros)
        ? clonar(fuente.parametros)
        : {},
    areaMm2: numeroO(fuente.areaMm2, 0) ?? 0,
    perimetroMm: numeroO(fuente.perimetroMm, 0) ?? 0,
    lineas: Array.isArray(fuente.lineas) ? fuente.lineas.map(normalizarLinea) : [],
  }
}

/**
 * @param {*} obj
 * @returns {Proyecto}
 */
export function normalizarProyecto(obj) {
  const fuente = obj && typeof obj === 'object' ? obj : {}
  const ahora = ahoraISO()
  const recintos = Array.isArray(fuente.recintos) ? fuente.recintos.map(normalizarRecinto) : []

  // Los ids de recinto deben ser únicos dentro del proyecto: si un archivo
  // llega con repetidos, el segundo recibe uno nuevo.
  const vistos = new Set()
  for (const recinto of recintos) {
    if (vistos.has(recinto.id)) recinto.id = nuevoId('rec')
    vistos.add(recinto.id)
  }

  return {
    id: typeof fuente.id === 'string' && fuente.id ? fuente.id : nuevoId('pro'),
    nombre: textoO(fuente.nombre, 'Proyecto sin nombre'),
    creadoEn: typeof fuente.creadoEn === 'string' ? fuente.creadoEn : ahora,
    actualizadoEn: typeof fuente.actualizadoEn === 'string' ? fuente.actualizadoEn : ahora,
    unidadActiva: UNIDADES_VALIDAS.includes(fuente.unidadActiva)
      ? fuente.unidadActiva
      : UNIDAD_POR_DEFECTO,
    recintos,
  }
}

/* =============================================================================
   Validación de importación
   ========================================================================== */

/**
 * Valida un archivo de proyecto de Kubikar.
 *
 * Acepta el objeto ya parseado o el texto crudo del archivo. Rechaza con un
 * mensaje en español cualquier formato o versión que esta build no sepa leer:
 * abrir a medias un archivo desconocido es peor que no abrirlo.
 *
 * @param {*} obj objeto parseado o texto JSON
 * @returns {{ok:true, proyecto:Proyecto, biblioteca:Material[]} | {ok:false, error:string}}
 */
export function validarProyectoImportado(obj) {
  let datos = obj

  if (typeof datos === 'string') {
    try {
      datos = JSON.parse(datos)
    } catch {
      return {
        ok: false,
        error: 'El archivo no es un JSON válido. Revisa que sea el archivo exportado por Kubikar.',
      }
    }
  }

  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    return { ok: false, error: 'El archivo no contiene un proyecto de Kubikar.' }
  }

  if (datos.formato !== FORMATO) {
    const encontrado =
      typeof datos.formato === 'string' && datos.formato.trim()
        ? `"${datos.formato.trim()}"`
        : 'ninguno'
    return {
      ok: false,
      error: `El archivo no es un proyecto de Kubikar. Se esperaba el formato "${FORMATO}" y se encontró ${encontrado}.`,
    }
  }

  const version = Number(datos.version)
  if (!Number.isFinite(version) || !Number.isInteger(version) || version < 1) {
    return {
      ok: false,
      error: 'El archivo no declara una versión de formato válida y no se puede abrir.',
    }
  }
  if (version > FORMATO_VERSION) {
    return {
      ok: false,
      error: `El archivo fue generado con la versión ${version} del formato y esta versión de Kubikar lee hasta la ${FORMATO_VERSION}. Actualiza Kubikar para abrirlo.`,
    }
  }

  if (!datos.proyecto || typeof datos.proyecto !== 'object' || Array.isArray(datos.proyecto)) {
    return { ok: false, error: 'El archivo no trae ningún proyecto adentro.' }
  }
  if (!Array.isArray(datos.proyecto.recintos)) {
    return {
      ok: false,
      error: 'El proyecto del archivo no trae la lista de recintos y no se puede abrir.',
    }
  }
  if (datos.biblioteca !== undefined && !Array.isArray(datos.biblioteca)) {
    return {
      ok: false,
      error: 'La biblioteca de materiales del archivo está dañada y no se puede abrir.',
    }
  }

  // La unidad base es informativa: si el archivo declara otra, la geometría no
  // es interpretable en milímetros y se rechaza antes de deformar las medidas.
  if (datos.unidadBase !== undefined && datos.unidadBase !== UNIDAD_BASE) {
    return {
      ok: false,
      error: `El archivo declara la unidad base "${String(datos.unidadBase)}" y Kubikar guarda la geometría en ${UNIDAD_BASE}.`,
    }
  }

  const proyecto = normalizarProyecto(datos.proyecto)
  const biblioteca = Array.isArray(datos.biblioteca)
    ? datos.biblioteca.map(normalizarMaterial)
    : []

  return { ok: true, proyecto, biblioteca }
}
