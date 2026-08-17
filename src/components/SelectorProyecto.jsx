/* =============================================================================
   Kubikar · selección de proyecto
   -----------------------------------------------------------------------------
   La vista de apertura: qué hay guardado en este navegador y por dónde se entra.
   Crear, abrir, eliminar con confirmación, e importar un JSON exportado desde
   Kubikar.

   La importación nunca pisa nada: el repositorio asigna identificadores nuevos si
   colisionan y reutiliza los materiales que ya existen. Cuando el archivo no
   sirve, `importarProyecto` devuelve `{ok:false, error}` con el motivo redactado
   en español, y ese motivo se muestra tal cual. Un archivo inválido es un dato
   del usuario, no una falla del sistema: no levanta el aviso de almacenamiento.
   ============================================================================ */

import { useRef, useState } from 'react'
import { FilePlus2, FolderOpen, Trash2, Upload } from 'lucide-react'

import { formatearNumero } from '../core/units.js'
import { useApp } from '../state/AppState.jsx'
import {
  Aviso,
  Boton,
  CampoTexto,
  Dialogo,
  EstadoVacio,
  Regla,
  Tabla,
  TablaCabecera,
  TablaCelda,
  TablaCuerpo,
  TablaFila,
  TablaTitulo,
} from '../ui/index.js'

/** Fecha corta chilena: 17-08-2026 12:40. */
const FECHA = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/**
 * @param {string|null|undefined} iso
 * @returns {string}
 */
function fechaLegible(iso) {
  if (typeof iso !== 'string' || iso === '') return '—'
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return '—'
  return FECHA.format(fecha)
}

/**
 * @param {number} cantidad
 * @returns {string}
 */
function cuentaDeRecintos(cantidad) {
  if (!Number.isFinite(cantidad) || cantidad <= 0) return 'sin recintos'
  if (cantidad === 1) return '1 recinto'
  return `${cantidad} recintos`
}

/**
 * Vista de apertura de proyectos.
 */
export function SelectorProyecto() {
  const { estado, acciones } = useApp()

  const [creando, setCreando] = useState(false)
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [porEliminar, setPorEliminar] = useState(/** @type {Object|null} */ (null))
  const [errorImportacion, setErrorImportacion] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  const refArchivo = useRef(/** @type {HTMLInputElement|null} */ (null))

  const proyectos = Array.isArray(estado.proyectos) ? estado.proyectos : []
  const activoId = estado.proyecto ? estado.proyecto.id : null

  function abrirCreacion() {
    setNombreNuevo(`Proyecto ${proyectos.length + 1}`)
    setCreando(true)
  }

  async function confirmarCreacion() {
    const limpio = nombreNuevo.trim()
    if (!limpio) return
    setTrabajando(true)
    await acciones.crearProyecto(limpio)
    setTrabajando(false)
    setCreando(false)
  }

  /** @param {import('react').KeyboardEvent<HTMLInputElement>} evento */
  function alTeclearNombre(evento) {
    if (evento.key !== 'Enter') return
    evento.preventDefault()
    confirmarCreacion()
  }

  async function confirmarEliminacion() {
    const objetivo = porEliminar
    setPorEliminar(null)
    if (!objetivo) return
    setTrabajando(true)
    await acciones.eliminarProyecto(objetivo.id)
    setTrabajando(false)
  }

  function pedirArchivo() {
    setErrorImportacion('')
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

    setErrorImportacion('')
    setTrabajando(true)
    const resultado = await acciones.importarProyecto(archivo)
    setTrabajando(false)

    if (!resultado || resultado.ok !== true) {
      setErrorImportacion(
        (resultado && resultado.error) ||
          'No se pudo abrir el archivo. Revisa que sea el JSON exportado por Kubikar.',
      )
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-[60rem] flex-col gap-4 px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          {/* El h1 del documento es la marca de la barra superior; cada vista
              abre en h2, igual que la Biblioteca y el Consolidado. */}
          <h2 className="text-2xl text-ink">Proyectos</h2>
          <p className="kb-prose">
            Cada proyecto guarda sus recintos, la planta dibujada y la cubicación en este navegador.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Boton variante="primaria" icono={FilePlus2} onClick={abrirCreacion}>
            Crear proyecto
          </Boton>
          <Boton icono={Upload} cargando={trabajando} onClick={pedirArchivo}>
            Importar JSON
          </Boton>
        </div>
      </header>

      <Regla tono="fuerte" />

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

      {errorImportacion ? (
        <Aviso
          nivel="error"
          titulo="No se pudo importar el archivo"
          onCerrar={() => setErrorImportacion('')}
        >
          {errorImportacion}
        </Aviso>
      ) : null}

      {estado.cargando ? (
        <p className="kb-prose">Leyendo los proyectos guardados en este navegador.</p>
      ) : null}

      {!estado.cargando && proyectos.length === 0 ? (
        <EstadoVacio
          encuadrado
          titulo="Todavía no hay proyectos."
          descripcion="Crea el primero para empezar a dibujar la planta, o importa un JSON exportado desde Kubikar."
          acciones={
            <>
              <Boton variante="primaria" icono={FilePlus2} onClick={abrirCreacion}>
                Crear proyecto
              </Boton>
              <Boton icono={Upload} onClick={pedirArchivo}>
                Importar JSON
              </Boton>
            </>
          }
        />
      ) : null}

      {proyectos.length > 0 ? (
        <Tabla titulo="Proyectos guardados" tituloOculto className="border border-rule bg-block">
          <TablaCabecera>
            <tr>
              <TablaTitulo>Proyecto</TablaTitulo>
              <TablaTitulo numerica>Recintos</TablaTitulo>
              <TablaTitulo>Última edición</TablaTitulo>
              <TablaTitulo>
                <span className="sr-only">Acciones</span>
              </TablaTitulo>
            </tr>
          </TablaCabecera>

          <TablaCuerpo>
            {proyectos.map((resumen) => (
              <TablaFila key={resumen.id} seleccionada={resumen.id === activoId}>
                <TablaCelda>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-ink">{resumen.nombre}</span>
                    {resumen.id === activoId ? (
                      <span className="kb-label kb-label-rubric">Abierto</span>
                    ) : null}
                  </span>
                </TablaCelda>

                <TablaCelda numerica>{formatearNumero(resumen.recintos, 0)}</TablaCelda>

                <TablaCelda>
                  <span className="kb-num whitespace-nowrap text-ink-2">
                    {fechaLegible(resumen.actualizadoEn)}
                  </span>
                </TablaCelda>

                <TablaCelda>
                  <span className="flex flex-wrap items-center justify-end gap-2">
                    <Boton
                      tamano="sm"
                      icono={FolderOpen}
                      onClick={() => acciones.abrirProyecto(resumen.id)}
                    >
                      Abrir
                    </Boton>
                    <Boton
                      variante="peligro"
                      tamano="sm"
                      soloIcono
                      icono={Trash2}
                      etiquetaAccesible={`Eliminar ${resumen.nombre}`}
                      onClick={() => setPorEliminar(resumen)}
                    />
                  </span>
                </TablaCelda>
              </TablaFila>
            ))}
          </TablaCuerpo>
        </Tabla>
      ) : null}

      <Dialogo
        abierto={creando}
        onCerrar={() => setCreando(false)}
        titulo="Crear proyecto"
        ancho="sm"
        descripcion="Ponle el nombre de la obra o del mandante para reconocerlo después."
        acciones={
          <>
            <Boton variante="fantasma" onClick={() => setCreando(false)}>
              Cancelar
            </Boton>
            <Boton
              variante="primaria"
              cargando={trabajando}
              deshabilitado={nombreNuevo.trim() === ''}
              onClick={confirmarCreacion}
            >
              Crear proyecto
            </Boton>
          </>
        }
      >
        <CampoTexto
          etiqueta="Nombre del proyecto"
          valor={nombreNuevo}
          onChange={setNombreNuevo}
          onKeyDown={alTeclearNombre}
          requerido
          autoFocus
        />
      </Dialogo>

      <Dialogo
        abierto={porEliminar !== null}
        onCerrar={() => setPorEliminar(null)}
        titulo="Eliminar proyecto"
        ancho="sm"
        descripcion={
          porEliminar
            ? `Se elimina "${porEliminar.nombre}" y toda su cubicación (${cuentaDeRecintos(porEliminar.recintos)}). Esta acción no se puede deshacer. Si quieres conservarlo, ábrelo y expórtalo a JSON antes.`
            : ''
        }
        acciones={
          <>
            <Boton variante="fantasma" onClick={() => setPorEliminar(null)}>
              Cancelar
            </Boton>
            <Boton variante="peligro" icono={Trash2} onClick={confirmarEliminacion}>
              Eliminar proyecto
            </Boton>
          </>
        }
      />
    </section>
  )
}

export default SelectorProyecto
