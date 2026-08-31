/* =============================================================================
   Kubikar · barra superior
   -----------------------------------------------------------------------------
   La cabecera de la edición: la marca con su cruz de registro, qué proyecto está
   abierto, en qué unidad se trabaja y por dónde entra y sale el trabajo
   (biblioteca, archivo de proyecto, CSV).

   Cuatro cosas que este archivo resuelve y conviene no perder de vista:

   1. LA UNIDAD ACTIVA ES SOLO PRESENTACIÓN. Los tres detentes mm / cm / m
      cambian cómo se leen y se escriben las medidas; la geometría sigue en
      milímetros y no se toca. Eso lo garantiza el reductor, acá solo se despacha.

   2. LO QUE SE GUARDA ES EL PROYECTO CON SUS DERIVADOS CONGELADOS
      (`acciones.proyectoConResultados()`), no el proyecto en memoria: el archivo
      debe decir exactamente lo que muestra la pantalla.

   3. GUARDAR Y ABRIR VAN JUNTOS, Y ESO NO ES SIMETRÍA DECORATIVA. "Guardar en
      el PC" vivía acá y "abrir desde el PC" vivía dos clics adentro, en la vista
      de proyectos. La consecuencia observada fue que el usuario creyera que
      Kubikar exportaba archivos que después no sabía leer, cuando lo único que
      pasaba era que el botón de entrada estaba escondido. Una salida sin su
      entrada al lado no se lee como media función: se lee como un callejón.

      Los rótulos nombran el DESTINO y no el formato —"Guardar en el PC", no
      "JSON del proyecto"— porque lo que el usuario decide en esa barra es dónde
      queda su trabajo, no en qué sintaxis. Decir "en el PC" además desambigua
      contra el testigo de guardado, que dice "Guardado 12:40" y se refiere al
      navegador. El CSV conserva su nombre de formato porque ahí el formato SÍ
      es la decisión: se elige por abrirlo en Excel.

   4. BAJO 900px LA CLAVE DE RECINTOS COLAPSA ACÁ. El desplegable de esta barra
      es el mismo margen izquierdo en otra forma, alimentado por los ayudantes de
      `PanelRecintos.jsx` para que la numeración y el área digan lo mismo en las
      dos presentaciones.

   5. LA BARRA SE ENCOGE QUITANDO, NO APILANDO. Bajo 900px aparece el
      desplegable de recintos y se retira el botón de renombrar, que ya tiene su
      lugar en la vista de proyectos. Bajo 900px también se retira la versión,
      que es dato de identificación y no de trabajo. Bajo 640px las cuatro
      entradas y salidas del trabajo —Biblioteca, abrir, guardar, CSV— se
      repliegan en un solo botón de desbordamiento. Sin eso la cabecera se
      reparte en cinco filas y le come al lienzo la mitad de la pantalla, y el
      lienzo es la única zona que nunca desaparece.

      El corte de los rótulos está en 1320px y no en 1180px porque cuatro
      rótulos no caben donde cabían tres. Se subió el corte en vez de dejar un
      botón sin rótulo: el que se habría quedado mudo es justamente el de abrir,
      que es el que nadie encontraba.

   6. EL TESTIGO DE GUARDADO. El proyecto se escribe con retardo y hasta acá lo
      único visible del almacenamiento era su falla. El rótulo dice "Guardando"
      mientras el temporizador corre y "Guardado 12:40" cuando el repositorio ya
      resolvió. Sin icono y sin animación: es un cambio de texto en registro de
      rótulo, que es la gramática de esta edición.
   ============================================================================ */

import { useRef, useState } from 'react'
import {
  Download,
  FileSpreadsheet,
  FolderOpen,
  Library,
  MoreHorizontal,
  Plus,
  SquarePen,
  Upload,
} from 'lucide-react'

import { UNIDADES } from '../core/units.js'
import { FECHA_BUILD, VERSION_ACTUAL } from '../data/actualizaciones.js'
import { descargarCsvDeProyecto, descargarJsonDeProyecto } from '../export/descargar.js'
import { useApp } from '../state/AppState.jsx'
import {
  Aviso,
  Boton,
  CampoTexto,
  Cruz,
  Detente,
  Dialogo,
  Regla,
  Rotulo,
  Selector,
} from '../ui/index.js'
import { etiquetaRecinto } from './PanelRecintos.jsx'

/**
 * @param {...(string|false|null|undefined)} partes
 * @returns {string}
 */
function cx(...partes) {
  return partes.filter(Boolean).join(' ')
}

/** Valor con que el desplegable compacto representa la vista de consolidado. */
const CLAVE_CONSOLIDADO = '__consolidado'

/** Hora del último guardado, en el reloj corriente de faena: 12:40. */
const RELOJ = new Intl.DateTimeFormat('es-CL', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/**
 * Testigo de guardado. Tres estados y ninguno de ellos es un icono que gire:
 * pendiente, escrito con su hora, y nada mientras no haya pasado ninguna de las
 * dos cosas.
 *
 * @param {{guardando:boolean, guardadoEn:string|null}} props
 */
function TestigoGuardado({ guardando, guardadoEn }) {
  if (guardando) {
    return (
      <Rotulo className="shrink-0 max-[640px]:hidden" aria-live="polite">
        Guardando
      </Rotulo>
    )
  }

  if (!guardadoEn) return null

  const fecha = new Date(guardadoEn)
  if (Number.isNaN(fecha.getTime())) return null

  return (
    <Rotulo className="shrink-0 max-[640px]:hidden" aria-live="polite">
      {`Guardado ${RELOJ.format(fecha)}`}
    </Rotulo>
  )
}

/**
 * Barra superior de la aplicación.
 */
export function BarraSuperior() {
  const { estado, acciones } = useApp()

  const [editandoNombre, setEditandoNombre] = useState(false)
  const [borrador, setBorrador] = useState('')
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [errorArchivo, setErrorArchivo] = useState('')
  const [abriendo, setAbriendo] = useState(false)
  // Escape cierra la edición y el campo pierde el foco enseguida: sin esta
  // marca, el confirmar de la salida revertiría la cancelación.
  const canceladoRef = useRef(false)
  const refArchivo = useRef(/** @type {HTMLInputElement|null} */ (null))

  const proyecto = estado.proyecto
  const recintos = proyecto && Array.isArray(proyecto.recintos) ? proyecto.recintos : []
  const enConsolidado = estado.vista === 'consolidado'

  function comenzarEdicion() {
    if (!proyecto) return
    setBorrador(proyecto.nombre)
    canceladoRef.current = false
    setEditandoNombre(true)
  }

  function confirmarEdicion() {
    const limpio = borrador.trim()
    if (proyecto && limpio && limpio !== proyecto.nombre) acciones.renombrarProyecto(limpio)
    setEditandoNombre(false)
  }

  /** @param {import('react').KeyboardEvent<HTMLDivElement>} evento */
  function alTeclearNombre(evento) {
    if (evento.key === 'Enter') {
      evento.preventDefault()
      confirmarEdicion()
      return
    }
    if (evento.key === 'Escape') {
      evento.preventDefault()
      evento.stopPropagation()
      canceladoRef.current = true
      setEditandoNombre(false)
    }
  }

  function alSalirDelNombre() {
    if (canceladoRef.current) {
      canceladoRef.current = false
      return
    }
    if (editandoNombre) confirmarEdicion()
  }

  function guardarEnElPc() {
    setMenuAbierto(false)
    const listo = acciones.proyectoConResultados()
    if (!listo) return
    descargarJsonDeProyecto(listo, estado.biblioteca)
  }

  function abrirDesdeElPc() {
    setMenuAbierto(false)
    setErrorArchivo('')
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
    const resultado = await acciones.importarProyecto(archivo)
    setAbriendo(false)

    // Un archivo que no sirve es un dato del usuario, no una falla del sistema:
    // se le dice acá mismo y no levanta el aviso de almacenamiento.
    if (!resultado || resultado.ok !== true) {
      setErrorArchivo(
        (resultado && resultado.error) ||
          'No se pudo abrir el archivo. Revisa que sea el JSON guardado por Kubikar.',
      )
    }
  }

  function exportarCsv() {
    setMenuAbierto(false)
    const listo = acciones.proyectoConResultados()
    if (!listo) return
    descargarCsvDeProyecto(listo)
  }

  function abrirBiblioteca() {
    setMenuAbierto(false)
    acciones.cambiarVista('biblioteca')
  }

  /** @param {*} valor id de recinto, o la clave del consolidado */
  function alElegirDelDesplegable(valor) {
    if (!valor) return
    if (valor === CLAVE_CONSOLIDADO) {
      acciones.cambiarVista('consolidado')
      return
    }
    acciones.seleccionarRecinto(valor)
  }

  const opcionesProyecto = estado.proyectos.map((resumen) => ({
    valor: resumen.id,
    etiqueta: resumen.nombre,
  }))

  const opcionesRecinto = recintos
    .map((recinto, indice) => ({ valor: recinto.id, etiqueta: etiquetaRecinto(recinto, indice) }))
    .concat([{ valor: CLAVE_CONSOLIDADO, etiqueta: 'Consolidado del proyecto' }])

  return (
    <header className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 border-b border-rule-strong bg-margin px-3 py-2">
      {/* Marca. La cruz de registro es la misma figura que marca los vértices
          del lienzo, a otra escala. */}
      {/* El nombre del producto es el único h1 del documento: está en toda
          vista, así que ninguna vista vuelve a emitir uno. */}
      <h1 className="flex shrink-0 items-center gap-2 text-xl tracking-tight text-navy-ink">
        <Cruz size={16} className="text-accent" />
        Kubikar
      </h1>

      {/* La versión de esta copia, en registro de rótulo. No es decoración: el
          entregable se copia a mano de un PC a otro, y sin este número no hay
          forma de saber cuál de las dos copias que hay sobre la mesa es la
          vigente. La fecha de compilación va en el `title` porque desempata dos
          builds del mismo número, cosa que solo importa cuando ya se sospecha
          de una copia. */}
      <Rotulo
        className="shrink-0 max-[900px]:hidden"
        title={FECHA_BUILD ? `Compilada el ${FECHA_BUILD}` : 'Versión de esta copia'}
      >
        {`v ${VERSION_ACTUAL}`}
      </Rotulo>

      <span className="h-6 shrink-0">
        <Regla orientacion="vertical" />
      </span>

      <Selector
        tamano="sm"
        valor={proyecto ? proyecto.id : null}
        opciones={opcionesProyecto}
        onChange={(id) => {
          if (id) acciones.abrirProyecto(id)
        }}
        placeholder="Sin proyecto abierto"
        textoVacio="No hay proyectos guardados"
        className="w-48 shrink-0"
        aria-label="Proyecto abierto"
      />

      <Boton
        variante="fantasma"
        tamano="sm"
        soloIcono
        icono={FolderOpen}
        etiquetaAccesible="Ver todos los proyectos"
        activo={estado.vista === 'proyectos'}
        onClick={() => acciones.cambiarVista('proyectos')}
      />

      {proyecto && editandoNombre ? (
        // El teclado y la salida se escuchan en el envoltorio: el campo ya usa
        // sus propios onFocus y onBlur para los ticks de registro.
        <div onKeyDown={alTeclearNombre} onBlur={alSalirDelNombre} className="w-56 shrink-0">
          <CampoTexto
            tamano="sm"
            valor={borrador}
            onChange={setBorrador}
            aria-label="Nombre del proyecto"
            autoFocus
          />
        </div>
      ) : null}

      {/* Bajo 900px el desplegable de recintos ya identifica el contexto y el
          renombrado sigue disponible en la vista de proyectos: acá se retira
          antes que dejar la cabecera repartida en cinco filas. */}
      {proyecto && !editandoNombre ? (
        <button
          type="button"
          onClick={comenzarEdicion}
          aria-label={`Renombrar el proyecto ${proyecto.nombre}`}
          className={cx(
            'flex min-h-[var(--size-touch-sm)] min-w-0 items-center gap-2 border border-transparent px-2',
            'transition-[background-color,border-color] duration-[var(--duration-fast)] ease-damped',
            'hover:border-rule-strong hover:bg-margin-deep pointer-coarse:min-h-[var(--size-touch)]',
            'max-[900px]:hidden',
          )}
        >
          <span className="max-w-[16rem] truncate text-base text-ink">{proyecto.nombre}</span>
          <SquarePen
            size={16}
            strokeWidth={1.5}
            aria-hidden="true"
            className="shrink-0 text-ink-3"
          />
        </button>
      ) : null}

      {proyecto ? (
        <TestigoGuardado guardando={estado.guardando} guardadoEn={estado.guardadoEn} />
      ) : null}

      {/* Bajo 900px la clave del margen izquierdo se repliega en este
          desplegable. Sobre 900px no existe: manda `PanelRecintos`. */}
      {proyecto ? (
        <div className="hidden items-center gap-2 max-[900px]:flex">
          <Selector
            tamano="sm"
            valor={enConsolidado ? CLAVE_CONSOLIDADO : estado.recintoActivoId}
            opciones={opcionesRecinto}
            onChange={alElegirDelDesplegable}
            placeholder="Sin recintos"
            textoVacio="Este proyecto no tiene recintos"
            className="w-56"
            aria-label="Recinto activo"
          />
          <Boton
            tamano="sm"
            soloIcono
            icono={Plus}
            etiquetaAccesible="Agregar recinto"
            onClick={() => acciones.agregarRecinto()}
          />
        </div>
      ) : null}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {/* Unidad activa: tres detentes, el vigente macizo en naranja. El
            nombre de cada uno es su propio rótulo —"mm", "cm", "m"—; lo que
            significan lo dice el grupo, y la palabra completa vive en el
            `title` para quien pasa el puntero. */}
        <div role="group" aria-label="Unidad de trabajo" className="flex items-center gap-px">
          {UNIDADES.map((unidad) => (
            <Detente
              key={unidad.id}
              tamano="sm"
              marca="presion"
              activo={estado.unidadActiva === unidad.id}
              title={`Trabajar en ${unidad.nombre}`}
              onClick={() => acciones.cambiarUnidad(unidad.id)}
            >
              {unidad.label}
            </Detente>
          ))}
        </div>

        <span className="h-6 shrink-0 max-[640px]:hidden">
          <Regla orientacion="vertical" />
        </span>

        {/* Las cuatro entradas y salidas del trabajo. Sobre 1320px llevan su
            rótulo; entre 640 y 1320 quedan en icono con `title`, que es el
            nombre accesible cuando el texto se oculta; bajo 640 se repliegan en
            el diálogo.

            El `title` repite el rótulo visible y lo amplía, nunca lo contradice:
            un botón que dice "Guardar en el PC" y se llama "Exportar proyecto a
            JSON" no se puede accionar por voz. */}
        <div className="flex items-center gap-2 max-[640px]:hidden">
          <Boton
            tamano="sm"
            icono={Library}
            title="Abrir la Biblioteca de materiales"
            activo={estado.vista === 'biblioteca'}
            onClick={abrirBiblioteca}
          >
            <span className="max-[1320px]:hidden">Biblioteca</span>
          </Boton>

          <Boton
            tamano="sm"
            icono={Upload}
            title="Abrir un proyecto guardado en el PC"
            cargando={abriendo}
            onClick={abrirDesdeElPc}
          >
            <span className="max-[1320px]:hidden">Abrir desde el PC</span>
          </Boton>

          <Boton
            tamano="sm"
            icono={Download}
            title="Guardar el proyecto en el PC como archivo"
            deshabilitado={!proyecto}
            onClick={guardarEnElPc}
          >
            <span className="max-[1320px]:hidden">Guardar en el PC</span>
          </Boton>

          <Boton
            tamano="sm"
            icono={FileSpreadsheet}
            title="Exportar CSV para Excel"
            deshabilitado={!proyecto}
            onClick={exportarCsv}
          >
            <span className="max-[1320px]:hidden">CSV para Excel</span>
          </Boton>
        </div>

        {/* El envoltorio decide si el botón existe: `hidden` y el display del
            botón no pueden convivir sin variante en el mismo elemento. */}
        <span className="hidden max-[640px]:inline-flex">
          <Boton
            tamano="sm"
            soloIcono
            icono={MoreHorizontal}
            etiquetaAccesible="Más acciones"
            title="Más acciones"
            activo={menuAbierto}
            onClick={() => setMenuAbierto(true)}
          />
        </span>
      </div>

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

      <Dialogo
        abierto={menuAbierto}
        onCerrar={() => setMenuAbierto(false)}
        titulo="Más acciones"
        ancho="sm"
      >
        <div className="flex flex-col gap-2">
          <Boton
            icono={Library}
            bloque
            activo={estado.vista === 'biblioteca'}
            onClick={abrirBiblioteca}
          >
            Biblioteca de materiales
          </Boton>
          <Boton icono={Upload} bloque cargando={abriendo} onClick={abrirDesdeElPc}>
            Abrir desde el PC
          </Boton>
          <Boton icono={Download} bloque deshabilitado={!proyecto} onClick={guardarEnElPc}>
            Guardar en el PC
          </Boton>
          <Boton icono={FileSpreadsheet} bloque deshabilitado={!proyecto} onClick={exportarCsv}>
            CSV para Excel
          </Boton>
        </div>
      </Dialogo>

      {/* El archivo que no sirve se reclama en un diálogo y no en una banda:
          la barra superior no tiene dónde poner una banda sin empujar el lienzo,
          y el error es puntual —se lee, se entiende y se cierra—, no un estado
          persistente como la falla de almacenamiento. */}
      <Dialogo
        abierto={errorArchivo !== ''}
        onCerrar={() => setErrorArchivo('')}
        titulo="No se pudo abrir el archivo"
        ancho="sm"
        acciones={
          <Boton variante="primaria" onClick={() => setErrorArchivo('')}>
            Entendido
          </Boton>
        }
      >
        {/* Sin título propio: el del diálogo ya dijo qué pasó, y repetirlo
            adentro deja al motivo —que es lo único que el usuario todavía no
            sabe— en tercer lugar de lectura. */}
        <Aviso nivel="error">{errorArchivo}</Aviso>
      </Dialogo>
    </header>
  )
}

export default BarraSuperior
