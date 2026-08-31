/* =============================================================================
   Kubikar · registro central de módulos de cálculo
   -----------------------------------------------------------------------------
   Este archivo es EL PUNTO DE EXTENSIÓN del producto.

   La interfaz no conoce ningún módulo por nombre: no hay una sola condición
   sobre `moduloId` en los componentes. Todo lo que la interfaz necesita saber
   de un módulo lo obtiene de este contrato:

     · `listarModulos()`        alimenta el selector de módulo
     · `esquema`                declara los parámetros y la interfaz los dibuja
     · `parametrosPorDefecto()` precarga el estado inicial del recinto
     · `esquemaVisible()`       resuelve qué parámetros se ven en cada momento
     · `calcular(ctx)`          produce las líneas de material y los avisos
     · `trazar(ctx)`            produce las capas de despiece que el lienzo pinta
                                dentro del polígono (opcional)

   Agregar un módulo nuevo (Tabiquería, Pisos, Pintura, Cerámicos…) NO debe
   requerir tocar la interfaz. El procedimiento completo es:

     1. Crear `src/modules/miModulo.js` exportando un objeto `ModuloCalculo`:
        un `id` estable, `nombre`, `descripcion`, `disponible`, un `esquema`
        declarativo y una función `calcular(ctx) -> ResultadoCalculo`.
     2. Importarlo en `src/modules/index.js` y llamar a `registrarModulo`.
        Ese es el único lugar donde se registra un módulo.

   No hay paso 3. Los campos del panel de parámetros, el filtrado de la
   biblioteca por tipo de material, la tabla de resultados, el consolidado y la
   exportación funcionan solos porque leen este contrato.

   Reglas del contrato que un módulo debe respetar:
     · `id` estable y único: se persiste en el proyecto y en el JSON exportado.
     · `clave` de cada parámetro estable: se persiste en `recinto.parametros`.
     · `clave` de cada línea con prefijo del módulo (`'cielo.plancha'`), porque
       el consolidado agrupa por `materialId` y cae a `clave` + `nombre`.
     · `calcular` es pura: no lee `localStorage`, no toca el DOM, no depende de
       la unidad activa. La geometría siempre llega en milímetros.
     · `calcular` nunca lanza: los problemas se informan como avisos.
     · `trazar` es igual de pura y devuelve SOLO geometría en milímetros. No
       elige colores ni grosores: declara el rol de cada capa y el lienzo, que
       es el dueño del sistema de diseño, resuelve la tinta.
   ========================================================================== */

/**
 * Parámetro declarado por un módulo. La interfaz decide el control a dibujar
 * a partir de `tipo`; ningún componente sabe qué significa la clave.
 *
 * @typedef {Object} EsquemaParametro
 * @property {string} clave
 * @property {'numero'|'porcentaje'|'material'|'booleano'|'seleccion'} tipo
 * @property {string} etiqueta
 * @property {string} [ayuda]
 * @property {string} [sufijo]            // 'cm', 'un/m²', 'm²'
 * @property {number} [min]
 * @property {number} [max]
 * @property {number} [paso]
 * @property {*} [porDefecto]
 * @property {'plancha'|'barra'|'pieza'} [materialTipo]   // filtra la biblioteca
 * @property {string} [materialUso]       // uso que debe declarar el material para
 *                                        // ofrecerse acá. El registro solo compara
 *                                        // texto: no sabe qué usos existen ni qué
 *                                        // significan, igual que con `preferir`
 * @property {string[]} [preferir]        // marcas de texto que eligen el material
 *                                        // inicial dentro del tipo, en orden de
 *                                        // preferencia; cae al primero del tipo
 * @property {{valor:*,etiqueta:string}[]} [opciones]
 * @property {number[]} [sugeridos]       // botones de valor rápido
 * @property {string} [dependeDe]         // clave de un booleano que lo habilita
 * @property {string} [grupo]             // título de agrupación en el panel
 * @property {string} [desperdicioDe]     // clave de un parámetro 'material':
 *                                        // precarga el % por defecto de ese material
 * @property {string} [mensajeMin]        // texto de dominio para el mínimo
 * @property {string} [mensajeMax]        // texto de dominio para el máximo
 */

/**
 * Todo lo que un módulo recibe para cubicar. La geometría llega en la unidad
 * base (milímetros) y jamás en la unidad activa de la interfaz.
 *
 * @typedef {Object} ContextoCalculo
 * @property {{areaMm2:number,perimetroMm:number,vertices:Array,bbox:Object,cerrado:boolean}} geometria
 * @property {Object} parametros
 * @property {Array} biblioteca
 */

/**
 * Una línea de la cubicación. `cantidadTeorica` es el número crudo, antes de
 * desperdicio y de redondeo: es lo que hace auditable la memoria de cálculo.
 *
 * @typedef {Object} LineaMaterial
 * @property {string}  clave              // estable dentro del módulo, p.ej. 'cielo.plancha'
 * @property {string}  nombre             // nombre visible del material
 * @property {string|null} materialId
 * @property {string}  unidad             // 'un' | 'm²' | 'ml'
 * @property {number}  cantidadTeorica    // ANTES de desperdicio y de redondeo
 * @property {number}  desperdicioPct     // 0 si no aplica
 * @property {number}  cantidadFinal      // redondeada hacia arriba
 * @property {{minimo:number,paso:number}|null} [compra]
 *                                        // escalón de compra que el módulo DECLARA
 *                                        // y NO aplica: la lista de compra lo aplica
 *                                        // sobre la suma del proyecto, porque comprar
 *                                        // se decide una vez para toda la obra y no
 *                                        // por recinto. Ver `src/core/compra.js`.
 *                                        // Ausente en casi todas las líneas: solo lo
 *                                        // declara lo que la ferretería no despacha
 *                                        // en la cantidad exacta, como un tornillo.
 * @property {string}  nota               // memoria de cálculo legible
 * @property {number|null} precioUnitario
 * @property {number|null} subtotal       // null si no hay precio
 * @property {string|null} codigoMaterial // previsto para Karbec, va null en esta versión
 * @property {string|null} partida        // previsto para Karbec, va null en esta versión
 */

/**
 * @typedef {Object} AvisoCalculo
 * @property {'error'|'advertencia'|'info'} nivel
 * @property {string} mensaje
 */

/**
 * @typedef {Object} ResultadoCalculo
 * @property {LineaMaterial[]} lineas
 * @property {AvisoCalculo[]} avisos
 * @property {boolean} calculable
 */

/**
 * Una capa del despiece que el lienzo dibuja DENTRO del polígono.
 *
 * Todo viene en milímetros de mundo y sin recortar: el lienzo aplica el
 * recorte contra el polígono con un `clipPath`, así que el módulo puede emitir
 * su retícula cómodamente sobre el rectángulo envolvente sin resolver ni una
 * intersección de segmentos.
 *
 * `rol` es vocabulario de DIBUJO, no de partida: dice qué peso visual tiene la
 * capa, no qué material es. Así el lienzo mapea rol → tinta sin aprender nunca
 * qué es una plancha ni un perfil.
 *   · 'pieza'  contorno de una unidad de material (una plancha, una palmeta)
 *   · 'eje'    línea de un elemento lineal (un perfil, una vigueta)
 *
 * El rol es además LA UNIDAD DE ENCENDIDO Y APAGADO: la barra del lienzo tiene
 * un interruptor por rol, no uno por capa. Son dos slots fijos, porque son los
 * dos que este vocabulario define, y eso mantiene la barra estable pase lo que
 * pase con los módulos. Lo que cambia es el nombre del interruptor, y de eso se
 * encarga `rotulo`: el módulo dice cómo se llama su rol en su propia partida
 * ("Planchas", "Perfilería"), y el lienzo lo imprime sin entenderlo.
 *
 * @typedef {Object} CapaTrazado
 * @property {string} clave    estable dentro del módulo, p.ej. 'cielo.plancha'
 * @property {string} nombre   nombre visible del material, para la descripción
 * @property {string} [rotulo] nombre corto del rol en este módulo, para la
 *                             barra de herramientas; cae al genérico si falta
 * @property {'pieza'|'eje'} rol
 * @property {{x:number,y:number,ancho:number,alto:number}[]} rectangulos
 * @property {{x1:number,y1:number,x2:number,y2:number}[]} lineas
 */

/**
 * @typedef {Object} ModuloCalculo
 * @property {string} id
 * @property {string} nombre
 * @property {string} descripcion
 * @property {boolean} disponible
 * @property {EsquemaParametro[]} esquema
 * @property {(ctx: ContextoCalculo) => ResultadoCalculo} calcular
 * @property {(ctx: ContextoCalculo) => CapaTrazado[]} trazar
 * @property {boolean} traza   el módulo declaró `trazar` de verdad, en vez de
 *                             recibir el respaldo vacío. La interfaz lo usa para
 *                             no ofrecer los interruptores del despiece en un
 *                             módulo que no dibuja nada, sin tener que
 *                             distinguir "apagado" de "vacío" ejecutándolo.
 */

/** Tipos de parámetro que la interfaz sabe dibujar. */
const TIPOS_PARAMETRO = ['numero', 'porcentaje', 'material', 'booleano', 'seleccion']

/** Tipos de material de la biblioteca a los que puede apuntar un parámetro. */
const TIPOS_MATERIAL = ['plancha', 'barra', 'pieza']

/**
 * Uso comodín: un material que lo declara calza con cualquier `materialUso` que
 * pida un parámetro. Es la única palabra del vocabulario de usos que el registro
 * conoce, y la conoce como regla de coincidencia, no como partida: no sabe qué es
 * un colgante ni un tornillo, sabe que "general" calza con todo.
 *
 * Se repite acá en vez de importarse de `src/data/schema.js` por la misma razón
 * que `TIPOS_MATERIAL`: el contrato de módulos no depende de la capa de datos.
 * La autoridad del vocabulario sigue siendo el esquema.
 */
const USO_COMODIN = 'general'

/**
 * Registro interno. Guarda el módulo y su orden de registro, para que
 * `listarModulos` sea estable entre recargas.
 * @type {Map<string,{modulo:ModuloCalculo,orden:number}>}
 */
const registro = new Map()

/** Contador de orden de registro. */
let orden = 0

/**
 * Resultado de un módulo que no cubica. Es la respuesta de todo módulo
 * declarado `disponible:false`.
 * @returns {ResultadoCalculo}
 */
function resultadoNoCalculable() {
  return { lineas: [], avisos: [], calculable: false }
}

/**
 * Trazado de un módulo que no dibuja despiece. `trazar` es opcional: un módulo
 * que solo cubica es un módulo válido, y el lienzo simplemente no pinta nada
 * dentro del polígono.
 * @returns {CapaTrazado[]}
 */
function sinTrazado() {
  return []
}

/**
 * Valida y normaliza un módulo antes de guardarlo. Lanza con un mensaje claro
 * si el módulo no cumple el contrato: es un error de programación, no un
 * estado de la aplicación, y debe reventar en desarrollo.
 *
 * @param {ModuloCalculo} modulo
 * @returns {ModuloCalculo}
 */
function normalizarModulo(modulo) {
  if (!modulo || typeof modulo !== 'object') {
    throw new Error('registrarModulo: se esperaba un objeto de módulo.')
  }
  const { id, nombre, descripcion, disponible, esquema, calcular, trazar } = modulo

  if (typeof id !== 'string' || id.trim() === '') {
    throw new Error('registrarModulo: el módulo necesita un id de texto no vacío.')
  }
  if (typeof nombre !== 'string' || nombre.trim() === '') {
    throw new Error(`registrarModulo: el módulo "${id}" necesita un nombre.`)
  }
  if (typeof descripcion !== 'string') {
    throw new Error(`registrarModulo: el módulo "${id}" necesita una descripción de texto.`)
  }
  if (typeof disponible !== 'boolean') {
    throw new Error(`registrarModulo: el módulo "${id}" debe declarar disponible como booleano.`)
  }
  if (!Array.isArray(esquema)) {
    throw new Error(`registrarModulo: el esquema del módulo "${id}" debe ser un arreglo.`)
  }
  if (disponible && typeof calcular !== 'function') {
    throw new Error(`registrarModulo: el módulo disponible "${id}" debe implementar calcular.`)
  }
  if (trazar !== undefined && typeof trazar !== 'function') {
    throw new Error(`registrarModulo: trazar del módulo "${id}" debe ser una función.`)
  }

  const claves = new Set()
  for (const parametro of esquema) {
    if (!parametro || typeof parametro !== 'object') {
      throw new Error(`registrarModulo: el esquema del módulo "${id}" tiene una entrada inválida.`)
    }
    if (typeof parametro.clave !== 'string' || parametro.clave.trim() === '') {
      throw new Error(`registrarModulo: un parámetro del módulo "${id}" no tiene clave.`)
    }
    if (claves.has(parametro.clave)) {
      throw new Error(
        `registrarModulo: el módulo "${id}" repite la clave de parámetro "${parametro.clave}".`,
      )
    }
    claves.add(parametro.clave)
    if (!TIPOS_PARAMETRO.includes(parametro.tipo)) {
      throw new Error(
        `registrarModulo: el parámetro "${parametro.clave}" del módulo "${id}" declara el tipo "${parametro.tipo}", que no existe.`,
      )
    }
    if (typeof parametro.etiqueta !== 'string' || parametro.etiqueta.trim() === '') {
      throw new Error(
        `registrarModulo: el parámetro "${parametro.clave}" del módulo "${id}" necesita una etiqueta.`,
      )
    }
    if (parametro.tipo === 'material' && !TIPOS_MATERIAL.includes(parametro.materialTipo)) {
      throw new Error(
        `registrarModulo: el parámetro de material "${parametro.clave}" del módulo "${id}" debe declarar materialTipo plancha, barra o pieza.`,
      )
    }
    if (
      parametro.materialUso !== undefined &&
      (typeof parametro.materialUso !== 'string' || parametro.materialUso.trim() === '')
    ) {
      throw new Error(
        `registrarModulo: el parámetro "${parametro.clave}" del módulo "${id}" declara un materialUso vacío. Escribe el uso o quita el campo.`,
      )
    }
    if (parametro.materialUso !== undefined && parametro.tipo !== 'material') {
      throw new Error(
        `registrarModulo: el parámetro "${parametro.clave}" del módulo "${id}" declara materialUso sin ser de tipo material.`,
      )
    }
    if (parametro.tipo === 'seleccion' && !Array.isArray(parametro.opciones)) {
      throw new Error(
        `registrarModulo: el parámetro de selección "${parametro.clave}" del módulo "${id}" debe declarar opciones.`,
      )
    }
  }

  // Referencias internas: dependeDe y desperdicioDe deben apuntar a claves del
  // propio esquema, o el panel de parámetros escondería campos para siempre.
  for (const parametro of esquema) {
    if (parametro.dependeDe && !claves.has(parametro.dependeDe)) {
      throw new Error(
        `registrarModulo: el parámetro "${parametro.clave}" del módulo "${id}" depende de "${parametro.dependeDe}", que no está en el esquema.`,
      )
    }
    if (parametro.desperdicioDe && !claves.has(parametro.desperdicioDe)) {
      throw new Error(
        `registrarModulo: el parámetro "${parametro.clave}" del módulo "${id}" toma el desperdicio de "${parametro.desperdicioDe}", que no está en el esquema.`,
      )
    }
  }

  /** @type {ModuloCalculo} */
  const normalizado = {
    id,
    nombre,
    descripcion,
    disponible,
    esquema,
    calcular: typeof calcular === 'function' ? calcular : resultadoNoCalculable,
    trazar: typeof trazar === 'function' ? trazar : sinTrazado,
    traza: typeof trazar === 'function',
  }
  return normalizado
}

/**
 * Registra un módulo de cálculo. Si el id ya existe, lo reemplaza conservando
 * su posición en la lista: así el reemplazo en caliente durante el desarrollo
 * no reordena el selector ni duplica entradas.
 *
 * @param {ModuloCalculo} modulo
 * @returns {ModuloCalculo} el módulo normalizado que quedó registrado
 */
export function registrarModulo(modulo) {
  const normalizado = normalizarModulo(modulo)
  const previo = registro.get(normalizado.id)
  registro.set(normalizado.id, {
    modulo: normalizado,
    orden: previo ? previo.orden : orden++,
  })
  return normalizado
}

/**
 * Devuelve el módulo con ese id, o null si no está registrado. La interfaz usa
 * el null para caer a un estado vacío en vez de reventar con un proyecto
 * antiguo que apunta a un módulo que ya no existe.
 *
 * @param {string} id
 * @returns {ModuloCalculo|null}
 */
export function obtenerModulo(id) {
  const entrada = registro.get(id)
  return entrada ? entrada.modulo : null
}

/**
 * Lista todos los módulos registrados: primero los disponibles, después los
 * que van con la leyenda "Próximamente". Dentro de cada grupo se conserva el
 * orden de registro declarado en `src/modules/index.js`.
 *
 * @returns {ModuloCalculo[]}
 */
export function listarModulos() {
  return [...registro.values()]
    .sort((a, b) => {
      const disponibilidad = Number(b.modulo.disponible) - Number(a.modulo.disponible)
      return disponibilidad !== 0 ? disponibilidad : a.orden - b.orden
    })
    .map((entrada) => entrada.modulo)
}

/**
 * Valor inicial de un parámetro cuando no se puede derivar de la biblioteca.
 *
 * @param {EsquemaParametro} parametro
 * @returns {*}
 */
function valorPorDefecto(parametro) {
  if (parametro.porDefecto !== undefined) return parametro.porDefecto
  switch (parametro.tipo) {
    case 'booleano':
      return false
    case 'numero':
    case 'porcentaje':
      return 0
    case 'seleccion':
      return Array.isArray(parametro.opciones) && parametro.opciones.length > 0
        ? parametro.opciones[0].valor
        : null
    default:
      return null
  }
}

/**
 * Normaliza un texto para comparar nombres de material sin que la tilde ni la
 * caja decidan el resultado: "Ángulo perimetral" y "angulo" tienen que calzar.
 * @param {string} texto
 * @returns {string}
 */
function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/**
 * Materiales de la biblioteca que un parámetro `tipo:'material'` puede ofrecer.
 *
 * Filtra por tipo y, si el parámetro lo pide, por uso declarado. El comodín
 * `'general'` calza siempre: es lo que permite que una biblioteca guardada antes
 * de que el uso existiera siga apareciendo completa en vez de vaciarse de golpe.
 *
 * Vive acá y no en la interfaz porque la regla de coincidencia es una sola: el
 * material que el panel ofrece tiene que ser exactamente el mismo conjunto del
 * que sale la preselección, o el usuario vería preseleccionado algo que su
 * desplegable no contiene.
 *
 * @param {EsquemaParametro} parametro
 * @param {Array} biblioteca
 * @returns {Object[]}
 */
export function materialesDe(parametro, biblioteca) {
  const lista = Array.isArray(biblioteca) ? biblioteca : []
  if (!parametro || parametro.tipo !== 'material') return []
  const uso = typeof parametro.materialUso === 'string' ? parametro.materialUso : null
  return lista.filter((material) => {
    if (!material || material.tipo !== parametro.materialTipo) return false
    if (!uso) return true
    if (material.uso === uso || material.uso === USO_COMODIN) return true
    // Un material sin uso declarado calza con todo, pero SOLO donde el uso existe
    // como concepto. La capa de datos ya convierte el ausente en comodín; esto
    // cubre el material que llegue sin normalizar, y no puede ser más ancho: una
    // plancha tampoco declara uso, y colarla en un parámetro que pide "fijación
    // metal-metal" ofrecería para atornillar algo que no atornilla nada.
    return !material.uso && parametro.materialTipo === 'pieza'
  })
}

/**
 * Elige el material inicial de un parámetro `tipo:'material'`.
 *
 * Entre los materiales que el parámetro puede ofrecer, si trae `preferir`, gana
 * el primero cuyo nombre o designación contenga alguna de esas marcas, en el
 * orden en que el módulo las escribió. Si ninguna calza, cae al primero de la
 * lista. El núcleo no sabe qué significan las marcas: solo compara texto. Así el
 * módulo expresa "el perimetral parte en un ángulo, no en un omega" sin que la
 * interfaz ni el registro conozcan una sola partida de construcción.
 *
 * @param {EsquemaParametro} parametro
 * @param {Array} lista
 * @returns {Object|null}
 */
function materialInicial(parametro, lista) {
  const candidatos = materialesDe(parametro, lista)
  if (candidatos.length === 0) return null

  const marcas = Array.isArray(parametro.preferir) ? parametro.preferir : []
  for (const marca of marcas) {
    const aguja = normalizar(marca)
    if (!aguja) continue
    const hallado = candidatos.find(
      (m) =>
        normalizar(m.nombre).includes(aguja) || normalizar(m.designacion).includes(aguja),
    )
    if (hallado) return hallado
  }
  return candidatos[0]
}

/**
 * Construye el objeto de parámetros inicial de un módulo.
 *
 * Resuelve, para cada parámetro `tipo:'material'`, el material de la biblioteca
 * que mejor calza con lo declarado (ver `materialInicial`); y para cada
 * parámetro con `desperdicioDe`, el `desperdicioPct` de ese material ya elegido.
 * Por eso son dos pasadas: el desperdicio depende del material de la primera.
 *
 * Si la biblioteca está vacía, los parámetros de material quedan en null y la
 * interfaz muestra el enlace a la Biblioteca; el cálculo informa el aviso
 * "Falta seleccionar el material de …".
 *
 * @param {ModuloCalculo} modulo
 * @param {Array} biblioteca
 * @returns {Object} parámetros listos para guardar en el recinto
 */
export function parametrosPorDefecto(modulo, biblioteca) {
  /** @type {Object} */
  const parametros = {}
  const esquema = modulo && Array.isArray(modulo.esquema) ? modulo.esquema : []
  const lista = Array.isArray(biblioteca) ? biblioteca : []

  // Primera pasada: materiales y valores declarados.
  for (const parametro of esquema) {
    if (parametro.tipo === 'material') {
      const material = materialInicial(parametro, lista)
      parametros[parametro.clave] = material ? material.id : valorPorDefecto(parametro)
    } else if (!parametro.desperdicioDe) {
      parametros[parametro.clave] = valorPorDefecto(parametro)
    }
  }

  // Segunda pasada: desperdicios derivados del material que quedó elegido.
  for (const parametro of esquema) {
    if (!parametro.desperdicioDe) continue
    const materialId = parametros[parametro.desperdicioDe]
    const material = materialId ? lista.find((m) => m && m.id === materialId) : null
    const pct = material ? Number(material.desperdicioPct) : Number.NaN
    parametros[parametro.clave] = Number.isFinite(pct) ? pct : valorPorDefecto(parametro)
  }

  return parametros
}

/**
 * Completa los parámetros de un recinto guardado con los valores por defecto de
 * su módulo, SIN tocar ninguno de los que ya tienen valor.
 *
 * Un recinto guarda el objeto de parámetros que tenía el día que se cubicó. Si
 * después el módulo suma un parámetro —o parte uno en dos, como pasó con los
 * tornillos— ese recinto llega sin la clave nueva, y un booleano ausente es
 * falso: la línea desaparecería del listado sin un aviso que lo explique. Quien
 * abre un presupuesto viejo no tiene por qué darse cuenta solo de que le faltan
 * los tornillos.
 *
 * Se completa solo lo ausente porque un valor guardado es una decisión del
 * usuario: pisarla con el defecto sería peor que la falta.
 *
 * @param {ModuloCalculo|null} modulo
 * @param {Object} parametros
 * @param {Array} biblioteca
 * @returns {Object} los mismos parámetros si no faltaba nada, o una copia completa
 */
export function completarParametros(modulo, parametros, biblioteca) {
  const actuales =
    parametros && typeof parametros === 'object' && !Array.isArray(parametros) ? parametros : {}
  const esquema = modulo && Array.isArray(modulo.esquema) ? modulo.esquema : []

  const faltantes = esquema.filter((parametro) => actuales[parametro.clave] === undefined)
  if (faltantes.length === 0) return actuales

  const defectos = parametrosPorDefecto(modulo, biblioteca)
  const completos = { ...actuales }
  for (const parametro of faltantes) completos[parametro.clave] = defectos[parametro.clave]
  return completos
}

/**
 * Filtra el esquema dejando solo los parámetros que corresponde mostrar con el
 * estado actual: un parámetro con `dependeDe` aparece únicamente si el booleano
 * del que depende está activo. La cadena se resuelve completa, de modo que un
 * parámetro que depende de otro que a su vez está oculto tampoco aparece.
 *
 * @param {ModuloCalculo} modulo
 * @param {Object} parametros
 * @returns {EsquemaParametro[]}
 */
export function esquemaVisible(modulo, parametros) {
  const esquema = modulo && Array.isArray(modulo.esquema) ? modulo.esquema : []
  const valores = parametros && typeof parametros === 'object' ? parametros : {}
  const porClave = new Map(esquema.map((parametro) => [parametro.clave, parametro]))

  /**
   * @param {EsquemaParametro} parametro
   * @param {Set<string>} vistos guarda contra una cadena de dependencias cíclica
   * @returns {boolean}
   */
  function visible(parametro, vistos) {
    if (!parametro.dependeDe) return true
    if (vistos.has(parametro.clave)) return true
    vistos.add(parametro.clave)
    if (!valores[parametro.dependeDe]) return false
    const padre = porClave.get(parametro.dependeDe)
    return padre ? visible(padre, vistos) : true
  }

  return esquema.filter((parametro) => visible(parametro, new Set()))
}
