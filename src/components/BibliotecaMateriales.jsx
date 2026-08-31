/* =============================================================================
   Kubikar · Biblioteca de materiales
   -----------------------------------------------------------------------------
   Vista propia, no un modal: la biblioteca es un catálogo de trabajo que se
   revisa, se ordena y se corrige, y eso no se hace en una ventana flotante que
   tapa el proyecto.

   CINCO DECISIONES

   1. AGRUPADA POR TIPO, y filtrable por tipo desde la misma fila de detentes.
      Una plancha se describe por ancho y largo, una barra por su largo comercial
      y una pieza por para qué sirve: meterlas en una sola tabla obligaría a
      dejar dos tercios de las celdas vacías. Cada tipo trae sus columnas.

   2. LAS MEDIDAS SE MUESTRAN EN LA UNIDAD ACTIVA, y la cabecera de cada columna
      lo declara entre paréntesis. Lo guardado son milímetros; acá solo se lee.

   3. EL PRECIO AUSENTE SE VE VACÍO. `formatearCLP` devuelve cadena vacía con
      `null` y jamás "$ 0": un precio que no está cargado y un precio que vale
      cero son cosas distintas en una cubicación. Para el lector de pantalla la
      celda dice "Sin precio", que es la información real.

   4. ELIMINAR EXIGE VER EL ALCANCE. Antes de confirmar se consulta en qué
      recintos se está usando el material —de TODOS los proyectos guardados, no
      solo del abierto— y el diálogo los lista por nombre. Borrar un material
      que alimenta seis recintos no puede sentirse igual que borrar uno suelto.

   5. LA BIBLIOTECA VIAJA SOLA. El archivo de proyecto lleva únicamente los
      materiales que ese proyecto usa, así que no sirve para mudar el catálogo:
      quien pasó una tarde cargando perfiles y precios en la oficina los quiere
      completos en el notebook de faena. De ahí los dos botones de archivo de
      esta cabecera, con el mismo par de rótulos que la barra superior.

      Abrir MEZCLA, nunca reemplaza, y lo local gana: un material que ya está
      —mismo tipo y mismo nombre— se omite con su precio y sus medidas intactos.
      Reemplazar la biblioteca desde un archivo sería la única operación de
      Kubikar capaz de borrar trabajo sin confirmación de por medio.

   Toda escritura pasa por las acciones del estado, que a su vez pasan por el
   repositorio: este archivo no conoce el almacenamiento.
   ============================================================================ */

import { useCallback, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Copy, Download, Pencil, Plus, RotateCcw, Trash2, Upload } from 'lucide-react'

import { aUnidad, formatearCLP, formatearNumero, obtenerUnidad } from '../core/units.js'
import { descargarJsonDeBiblioteca } from '../export/descargar.js'
import { useApp } from '../state/AppState.jsx'
import {
  Aviso,
  Boton,
  Detente,
  Dialogo,
  EstadoVacio,
  Regla,
  Rotulo,
  Tabla,
  TablaCabecera,
  TablaCelda,
  TablaCuerpo,
  TablaFila,
  TablaTitulo,
} from '../ui/index.js'
import { FormularioMaterial } from './FormularioMaterial.jsx'

/**
 * @param {...(string|false|null|undefined)} partes
 * @returns {string}
 */
function cx(...partes) {
  return partes.filter(Boolean).join(' ')
}

/** Los tres tipos, con el nombre con que se rotula cada grupo. */
const TIPOS = [
  { id: 'plancha', grupo: 'Planchas', filtro: 'Planchas' },
  { id: 'barra', grupo: 'Barras y perfiles', filtro: 'Barras' },
  { id: 'pieza', grupo: 'Piezas y accesorios', filtro: 'Piezas' },
]

/**
 * El uso de una pieza, escrito como se habla. Una pieza sin uso declarado —o
 * guardada antes de que el campo existiera— se lee como comodín, que es
 * exactamente lo que es: se ofrece en todos los parámetros.
 * @type {Record<string,string>}
 */
const USOS_LEGIBLES = {
  fijacion_plancha: 'Fijación a plancha',
  fijacion_metal: 'Fijación metal-metal',
  colgante: 'Colgante',
  general: 'Sin uso específico',
}

/** Id del formulario del diálogo: enlaza el botón del pie con el <form>. */
const ID_FORMULARIO = 'kb-formulario-material'

/**
 * Las dos frases del resultado de abrir un archivo, conjugadas.
 *
 * Van conjugadas y no armadas por concatenación porque el singular es el caso
 * corriente —se trae un material que faltaba— y "1 material ya estaban" es
 * exactamente la clase de descuido que le quita autoridad a una herramienta de
 * medición. La cifra pasa por `formatearNumero`, como toda cifra de esta
 * interfaz.
 *
 * @param {number} cantidad
 * @returns {string}
 */
function frasePorAgregados(cantidad) {
  if (cantidad === 1) return 'Se agregó 1 material.'
  return `Se agregaron ${formatearNumero(cantidad, 0)} materiales.`
}

/**
 * @param {number} cantidad
 * @returns {string}
 */
function frasePorOmitidos(cantidad) {
  if (cantidad === 1) return '1 material ya estaba y quedó como estaba.'
  return `${formatearNumero(cantidad, 0)} materiales ya estaban y quedaron como estaban.`
}

/**
 * Una medida guardada en milímetros, leída en la unidad activa. Vacío si el
 * material no tiene ese dato.
 * @param {number|null|undefined} valorMm
 * @param {{id:string,decimales:number}} unidad
 * @returns {string}
 */
function medida(valorMm, unidad) {
  if (valorMm === null || valorMm === undefined || !Number.isFinite(valorMm)) return ''
  return formatearNumero(aUnidad(valorMm, unidad.id), unidad.decimales)
}

/**
 * Porcentaje sin decimales de relleno: 5 se lee "5 %" y 2,5 se lee "2,5 %".
 * @param {number|null|undefined} valor
 * @returns {string}
 */
function porcentaje(valor) {
  if (!Number.isFinite(valor)) return ''
  const decimales = Number.isInteger(valor) ? 0 : 1
  return `${formatearNumero(valor, decimales)} %`
}

/**
 * Columnas propias de cada tipo, sin la de precio ni la de acciones, que son
 * comunes a los tres.
 * @param {string} tipoId
 * @param {{id:string,label:string,decimales:number}} unidad
 * @returns {{clave:string,titulo:string,numerica?:boolean,valor:(m:Object)=>string}[]}
 */
function columnasDe(tipoId, unidad) {
  if (tipoId === 'plancha') {
    return [
      {
        clave: 'ancho',
        titulo: `Ancho (${unidad.label})`,
        numerica: true,
        valor: (m) => medida(m.anchoMm, unidad),
      },
      {
        clave: 'largo',
        titulo: `Largo (${unidad.label})`,
        numerica: true,
        valor: (m) => medida(m.largoMm, unidad),
      },
      {
        clave: 'espesor',
        titulo: `Espesor (${unidad.label})`,
        numerica: true,
        valor: (m) => medida(m.espesorMm, unidad),
      },
      {
        clave: 'traslapo',
        titulo: `Traslapo (${unidad.label})`,
        numerica: true,
        valor: (m) => medida(m.traslapoMm, unidad),
      },
      {
        clave: 'desperdicio',
        titulo: 'Desperdicio',
        numerica: true,
        valor: (m) => porcentaje(m.desperdicioPct),
      },
    ]
  }

  if (tipoId === 'barra') {
    return [
      { clave: 'designacion', titulo: 'Designación', valor: (m) => m.designacion || '' },
      {
        clave: 'largoBarra',
        titulo: `Largo de barra (${unidad.label})`,
        numerica: true,
        valor: (m) => medida(m.largoBarraMm, unidad),
      },
      {
        clave: 'desperdicio',
        titulo: 'Desperdicio',
        numerica: true,
        valor: (m) => porcentaje(m.desperdicioPct),
      },
    ]
  }

  return [
    {
      clave: 'uso',
      titulo: 'Uso',
      valor: (m) => USOS_LEGIBLES[m.uso] || USOS_LEGIBLES.general,
    },
  ]
}

/**
 * Tabla de un tipo de material.
 * @param {{
 *   tipo: {id:string,grupo:string},
 *   materiales: Object[],
 *   unidad: Object,
 *   ocupado: string|null,
 *   onEditar: (m:Object) => void,
 *   onDuplicar: (m:Object) => void,
 *   onEliminar: (m:Object) => void,
 * }} props
 */
function TablaTipo({ tipo, materiales, unidad, ocupado, onEditar, onDuplicar, onEliminar }) {
  const columnas = columnasDe(tipo.id, unidad)

  return (
    <section className="flex flex-col gap-2" aria-label={tipo.grupo}>
      <Rotulo tinta="fuerte" como="h3" sufijo={formatearNumero(materiales.length, 0)}>
        {tipo.grupo}
      </Rotulo>
      <Regla tono="fuerte" />

      <Tabla densidad="densa" titulo={`Materiales · ${tipo.grupo}`} tituloOculto>
        <TablaCabecera>
          <tr>
            <TablaTitulo>Material</TablaTitulo>
            {columnas.map((columna) => (
              <TablaTitulo key={columna.clave} numerica={columna.numerica}>
                {columna.titulo}
              </TablaTitulo>
            ))}
            <TablaTitulo numerica>Precio unitario</TablaTitulo>
            <TablaTitulo className="text-right">Acciones</TablaTitulo>
          </tr>
        </TablaCabecera>

        <TablaCuerpo>
          {materiales.map((material) => {
            const precio = formatearCLP(material.precioUnitario)
            const trabajando = ocupado === material.id

            return (
              <TablaFila key={material.id}>
                <TablaCelda className="min-w-48 text-ink">{material.nombre}</TablaCelda>

                {columnas.map((columna) => (
                  <TablaCelda key={columna.clave} numerica={columna.numerica}>
                    {columna.valor(material)}
                  </TablaCelda>
                ))}

                <TablaCelda numerica>
                  {precio || <span className="sr-only">Sin precio</span>}
                </TablaCelda>

                <TablaCelda className="whitespace-nowrap text-right">
                  <div className="inline-flex items-center gap-1">
                    <Boton
                      variante="fantasma"
                      tamano="sm"
                      soloIcono
                      icono={Pencil}
                      etiquetaAccesible={`Editar ${material.nombre}`}
                      deshabilitado={trabajando}
                      onClick={() => onEditar(material)}
                    />
                    <Boton
                      variante="fantasma"
                      tamano="sm"
                      soloIcono
                      icono={Copy}
                      etiquetaAccesible={`Duplicar ${material.nombre}`}
                      deshabilitado={trabajando}
                      onClick={() => onDuplicar(material)}
                    />
                    <Boton
                      variante="fantasma"
                      tamano="sm"
                      soloIcono
                      icono={Trash2}
                      etiquetaAccesible={`Eliminar ${material.nombre}`}
                      deshabilitado={trabajando}
                      onClick={() => onEliminar(material)}
                    />
                  </div>
                </TablaCelda>
              </TablaFila>
            )
          })}
        </TablaCuerpo>
      </Tabla>
    </section>
  )
}

/**
 * @typedef {Object} PropsBiblioteca
 * @property {() => void} [onVolver]  si viene, se dibuja la salida hacia el recinto
 * @property {string} [className]
 */

/**
 * Vista de la biblioteca de materiales.
 * @param {PropsBiblioteca} props
 */
export function BibliotecaMateriales({ onVolver, className }) {
  const { estado, acciones } = useApp()
  const unidad = obtenerUnidad(estado.unidadActiva)

  const [filtro, setFiltro] = useState('todos')
  const [edicion, setEdicion] = useState(/** @type {{material:Object|null}|null} */ (null))
  const [guardando, setGuardando] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState('')
  const [ocupado, setOcupado] = useState(/** @type {string|null} */ (null))
  const [restaurando, setRestaurando] = useState(false)
  const [porEliminar, setPorEliminar] = useState(
    /** @type {{material:Object, usos:Object[]|null}|null} */ (null),
  )
  const [eliminando, setEliminando] = useState(false)
  const [abriendo, setAbriendo] = useState(false)
  const [resultadoArchivo, setResultadoArchivo] = useState(
    /** @type {{nivel:'error'|'ok'|'info', titulo:string, texto:string}|null} */ (null),
  )
  const refArchivo = useRef(/** @type {HTMLInputElement|null} */ (null))

  const biblioteca = estado.biblioteca

  // Con la biblioteca vacia manda el estado vacio: el dice que falta y ofrece las
  // tres salidas. La barra calla las dos que repetiria; conserva las suyas.
  const bibliotecaVacia = !estado.cargando && biblioteca.length === 0

  /** Materiales por tipo, ordenados por nombre con las reglas del español. */
  const porTipo = useMemo(() => {
    /** @type {Record<string, Object[]>} */
    const grupos = { plancha: [], barra: [], pieza: [] }
    for (const material of biblioteca) {
      const lista = grupos[material.tipo] || grupos.plancha
      lista.push(material)
    }
    for (const clave of Object.keys(grupos)) {
      grupos[clave].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-CL'))
    }
    return grupos
  }, [biblioteca])

  const tiposVisibles = TIPOS.filter((tipo) => filtro === 'todos' || filtro === tipo.id)
  const visibles = tiposVisibles.reduce((total, tipo) => total + porTipo[tipo.id].length, 0)

  const abrirNuevo = useCallback(() => {
    setErrorGuardado('')
    setEdicion({ material: null })
  }, [])

  const abrirEdicion = useCallback((material) => {
    setErrorGuardado('')
    setEdicion({ material })
  }, [])

  const cerrarFormulario = useCallback(() => {
    if (guardando) return
    setEdicion(null)
    setErrorGuardado('')
  }, [guardando])

  /**
   * @param {Object} material material ya armado por el formulario, en mm
   */
  async function guardar(material) {
    setGuardando(true)
    setErrorGuardado('')
    const guardado = await acciones.guardarMaterial(material)
    setGuardando(false)
    if (!guardado) {
      // `guardarMaterial` devuelve null cuando el navegador no dejó escribir. El
      // formulario queda abierto con lo escrito: nada se pierde por cerrarlo.
      setErrorGuardado(
        'No se pudo guardar el material en este navegador. Revisa el aviso de almacenamiento y guarda el proyecto en el PC para no perder el trabajo.',
      )
      return
    }
    setEdicion(null)
  }

  /** @param {Object} material */
  async function duplicar(material) {
    setOcupado(material.id)
    await acciones.duplicarMaterial(material.id)
    setOcupado(null)
  }

  /**
   * Pide confirmación y, en paralelo, consulta dónde se está usando el material.
   * El diálogo se abre de inmediato y declara que está revisando: no se deja al
   * usuario mirando una pantalla quieta mientras se recorre el almacenamiento.
   * @param {Object} material
   */
  async function pedirEliminar(material) {
    setPorEliminar({ material, usos: null })
    const usos = await acciones.usosDeMaterial(material.id)
    setPorEliminar((actual) =>
      actual && actual.material.id === material.id ? { ...actual, usos } : actual,
    )
  }

  async function confirmarEliminar() {
    if (!porEliminar) return
    setEliminando(true)
    await acciones.eliminarMaterial(porEliminar.material.id)
    setEliminando(false)
    setPorEliminar(null)
  }

  async function restaurar() {
    setRestaurando(true)
    await acciones.restaurarBiblioteca()
    setRestaurando(false)
  }

  function guardarEnElPc() {
    setResultadoArchivo(null)
    descargarJsonDeBiblioteca(biblioteca)
  }

  function abrirDesdeElPc() {
    setResultadoArchivo(null)
    if (refArchivo.current) refArchivo.current.click()
  }

  /** @param {import('react').ChangeEvent<HTMLInputElement>} evento */
  async function alElegirArchivo(evento) {
    const campo = evento.target
    const archivo = campo.files && campo.files.length > 0 ? campo.files[0] : null
    // Se limpia enseguida para poder volver a elegir el mismo archivo después
    // de corregirlo.
    campo.value = ''
    if (!archivo) return

    setAbriendo(true)
    const resultado = await acciones.importarBiblioteca(archivo)
    setAbriendo(false)

    if (!resultado || resultado.ok !== true) {
      setResultadoArchivo({
        nivel: 'error',
        titulo: 'No se pudo abrir el archivo',
        texto:
          (resultado && resultado.error) ||
          'No se pudo abrir el archivo. Revisa que sea un JSON guardado por Kubikar.',
      })
      return
    }

    // Se declaran las dos cifras, incluida la de los omitidos: sin ella, abrir
    // un archivo de 30 materiales y ver que no cambió nada se lee como falla.
    const { agregados, omitidos } = resultado

    if (agregados === 0 && omitidos === 0) {
      setResultadoArchivo({
        nivel: 'info',
        titulo: 'El archivo estaba vacío',
        texto: 'El archivo no traía ningún material. La biblioteca quedó como estaba.',
      })
      return
    }

    if (agregados === 0) {
      setResultadoArchivo({
        nivel: 'info',
        titulo: 'No había nada nuevo que agregar',
        texto:
          omitidos === 1
            ? 'El único material del archivo ya estaba en la biblioteca y quedó como estaba.'
            : `Los ${formatearNumero(omitidos, 0)} materiales del archivo ya estaban en la biblioteca y quedaron como estaban.`,
      })
      return
    }

    setResultadoArchivo({
      nivel: 'ok',
      titulo: 'Biblioteca actualizada',
      texto:
        omitidos > 0
          ? `${frasePorAgregados(agregados)} ${frasePorOmitidos(omitidos)}`
          : frasePorAgregados(agregados),
    })
  }

  const usos = porEliminar ? porEliminar.usos : null
  const revisandoUsos = Boolean(porEliminar) && usos === null

  return (
    <section
      aria-labelledby="biblioteca-titulo"
      className={cx('flex h-full min-h-0 w-full flex-col bg-paper', className)}
    >
      {/* --- cabecera de la vista ------------------------------------------- */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-rule-strong bg-margin px-6 py-4">
        <div className="flex flex-col gap-1">
          <h2 id="biblioteca-titulo" className="text-2xl text-ink">
            Biblioteca de materiales
          </h2>
          <p className="text-sm text-ink-2">
            Los materiales de la biblioteca alimentan los parámetros de todos los proyectos de este
            navegador. Las medidas se guardan en milímetros y se muestran en{' '}
            {unidad.nombre}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onVolver ? (
            <Boton variante="fantasma" icono={ArrowLeft} onClick={onVolver}>
              Volver al recinto
            </Boton>
          ) : null}
          {bibliotecaVacia ? null : (
            <Boton icono={Upload} cargando={abriendo} onClick={abrirDesdeElPc}>
              Abrir desde el PC
            </Boton>
          )}
          <Boton
            icono={Download}
            deshabilitado={biblioteca.length === 0}
            title="Guardar la biblioteca completa como archivo"
            onClick={guardarEnElPc}
          >
            Guardar en el PC
          </Boton>
          {bibliotecaVacia ? null : (
            <Boton variante="primaria" icono={Plus} onClick={abrirNuevo}>
              Agregar material
            </Boton>
          )}
        </div>
      </header>

      {/* El campo de archivo no se muestra: la acción visible es el botón. */}
      <input
        ref={refArchivo}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={alElegirArchivo}
      />

      {resultadoArchivo ? (
        <div className="border-b border-rule px-6 py-3">
          <Aviso
            nivel={resultadoArchivo.nivel}
            titulo={resultadoArchivo.titulo}
            onCerrar={() => setResultadoArchivo(null)}
          >
            {resultadoArchivo.texto}
          </Aviso>
        </div>
      ) : null}

      {/* --- cuerpo ---------------------------------------------------------- */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {estado.cargando ? (
          <p className="kb-prose">Cargando la biblioteca.</p>
        ) : bibliotecaVacia ? (
          <EstadoVacio
            titulo="La biblioteca está vacía."
            descripcion="Sin materiales no hay qué cubicar: los parámetros del módulo quedan sin opciones para elegir. Agrega el primero, abre la biblioteca que guardaste en otro computador, o vuelve a cargar los materiales de ejemplo."
            encuadrado
            acciones={
              <>
                <Boton variante="primaria" icono={Plus} onClick={abrirNuevo}>
                  Agregar material
                </Boton>
                <Boton icono={Upload} cargando={abriendo} onClick={abrirDesdeElPc}>
                  Abrir desde el PC
                </Boton>
                <Boton icono={RotateCcw} onClick={restaurar} cargando={restaurando}>
                  Restaurar materiales de ejemplo
                </Boton>
              </>
            }
          />
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <Rotulo como="span">Filtrar por tipo</Rotulo>
              <div role="group" aria-label="Filtrar por tipo de material" className="flex gap-1">
                <Detente
                  tamano="sm"
                  marca="presion"
                  activo={filtro === 'todos'}
                  onClick={() => setFiltro('todos')}
                >
                  Todos
                </Detente>
                {TIPOS.map((tipo) => (
                  <Detente
                    key={tipo.id}
                    tamano="sm"
                    marca="presion"
                    activo={filtro === tipo.id}
                    onClick={() => setFiltro(tipo.id)}
                  >
                    {tipo.filtro}
                  </Detente>
                ))}
              </div>
            </div>

            {visibles === 0 ? (
              /* Este vacío no es el de una biblioteca sin materiales, sino el de un
                 filtro que no caza ninguno: la barra sigue arriba con "Agregar
                 material". Repetirlo acá pondría el mismo botón dos veces en
                 pantalla, y lo que de verdad resuelve este vacío -cambiar el
                 filtro- son los rótulos que están justo encima. */
              <EstadoVacio
                titulo="No hay materiales de este tipo."
                descripcion="Cambia el filtro para ver el resto de la biblioteca, o agrega uno de este tipo para poder elegirlo en los parámetros del módulo."
                encuadrado
              />
            ) : (
              tiposVisibles
                .filter((tipo) => porTipo[tipo.id].length > 0)
                .map((tipo) => (
                  <TablaTipo
                    key={tipo.id}
                    tipo={tipo}
                    materiales={porTipo[tipo.id]}
                    unidad={unidad}
                    ocupado={ocupado}
                    onEditar={abrirEdicion}
                    onDuplicar={duplicar}
                    onEliminar={pedirEliminar}
                  />
                ))
            )}
          </div>
        )}
      </div>

      {/* --- alta y edición --------------------------------------------------- */}
      <Dialogo
        abierto={Boolean(edicion)}
        onCerrar={cerrarFormulario}
        cerrarAlClicFuera={false}
        titulo={edicion && edicion.material ? 'Editar material' : 'Agregar material'}
        ancho="lg"
        acciones={
          <>
            <Boton variante="fantasma" onClick={cerrarFormulario} deshabilitado={guardando}>
              Cancelar
            </Boton>
            <Boton
              type="submit"
              form={ID_FORMULARIO}
              variante="primaria"
              cargando={guardando}
            >
              Guardar material
            </Boton>
          </>
        }
      >
        {edicion ? (
          <FormularioMaterial
            // Remontar por material: el formulario inicializa su estado una sola
            // vez y así abrir otro material no arrastra lo escrito en el anterior.
            key={edicion.material ? edicion.material.id : 'material-nuevo'}
            material={edicion.material}
            unidadActiva={estado.unidadActiva}
            idFormulario={ID_FORMULARIO}
            onGuardar={guardar}
            guardando={guardando}
            error={errorGuardado}
          />
        ) : null}
      </Dialogo>

      {/* --- confirmación de borrado ------------------------------------------ */}
      <Dialogo
        abierto={Boolean(porEliminar)}
        onCerrar={() => setPorEliminar(null)}
        titulo="Eliminar material"
        descripcion={
          porEliminar
            ? `Se va a eliminar "${porEliminar.material.nombre}" de la biblioteca. Esta acción no se puede deshacer.`
            : undefined
        }
        ancho="md"
        acciones={
          <>
            <Boton
              variante="fantasma"
              onClick={() => setPorEliminar(null)}
              deshabilitado={eliminando}
            >
              Cancelar
            </Boton>
            <Boton
              variante="peligro"
              icono={Trash2}
              onClick={confirmarEliminar}
              deshabilitado={revisandoUsos}
              cargando={eliminando}
            >
              Eliminar material
            </Boton>
          </>
        }
      >
        {revisandoUsos ? (
          <p className="kb-prose">Revisando en qué recintos se está usando este material.</p>
        ) : usos && usos.length > 0 ? (
          <>
            <Aviso nivel="advertencia" titulo="Material en uso">
              {usos.length === 1
                ? 'Hay 1 recinto que usa este material.'
                : `Hay ${formatearNumero(usos.length, 0)} recintos que usan este material.`}{' '}
              Al eliminarlo quedan sin ese material y su cubicación no se va a poder completar hasta
              que elijas otro en la pestaña Módulo.
            </Aviso>

            <Rotulo como="h3">Recintos afectados</Rotulo>
            <ul className="flex flex-col divide-y divide-rule border border-rule bg-block">
              {usos.map((uso, indice) => (
                <li
                  key={`${uso.proyectoId}-${uso.recintoNombre}-${indice}`}
                  className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2"
                >
                  <span className="text-base text-ink">{uso.recintoNombre}</span>
                  <span className="kb-label">{uso.proyectoNombre}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="kb-prose">
            Este material no se está usando en ningún recinto. Se elimina solo de la biblioteca.
          </p>
        )}
      </Dialogo>
    </section>
  )
}

export default BibliotecaMateriales
