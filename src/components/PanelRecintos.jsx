/* =============================================================================
   Kubikar · clave numerada de recintos
   -----------------------------------------------------------------------------
   El margen izquierdo de la edición. Cada recinto es una entrada de la clave:
   número correlativo en rótulo de aparato, nombre, y su área en m². El activo
   lleva la barra de rúbrica de `.kb-key-mark[data-current="true"]`, que es la
   única marca de selección de la clave y vive en base.css.

   Dos decisiones que sostiene este archivo:

   1. UN RECINTO SIN POLÍGONO CERRADO MUESTRA UN GUION, NO UN CERO. Un área en
      cero y un área que todavía no existe son cosas distintas: la primera es un
      dato, la segunda es trabajo pendiente. Imprimir 0,00 m² invitaría a cubicar
      sobre una planta que no está definida.

   2. EL ÁREA SE DERIVA ACÁ, NO SE LEE DEL RECINTO. Los derivados guardados en el
      proyecto (`areaMm2`) se congelan al guardar y al exportar, así que mientras
      se dibuja están atrasados. La clave calcula con la misma fórmula de Gauss de
      `core/geometry.js` que usa el motor de cálculo.

   Bajo 900px esta zona desaparece y su función pasa al desplegable de recintos
   de la barra superior, que se alimenta de los mismos ayudantes exportados acá.
   ============================================================================ */

import { useRef, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'

import { areaMm2 as areaDeVertices } from '../core/geometry.js'
import { formatearArea } from '../core/units.js'
import { useApp } from '../state/AppState.jsx'
import { useConsolidado } from '../state/useConsolidado.js'
import { Boton, CampoTexto, Cruz, Dialogo, EstadoVacio, Rotulo } from '../ui/index.js'

/**
 * @param {...(string|false|null|undefined)} partes
 * @returns {string}
 */
function cx(...partes) {
  return partes.filter(Boolean).join(' ')
}

/**
 * Área encerrada por el polígono del recinto, en mm².
 * Devuelve `null` mientras el polígono no esté cerrado: es la señal de que
 * todavía no hay superficie que informar.
 *
 * @param {Object|null|undefined} recinto
 * @returns {number|null}
 */
export function areaDeRecinto(recinto) {
  if (!recinto || typeof recinto !== 'object') return null
  const vertices = Array.isArray(recinto.verticesMm) ? recinto.verticesMm : []
  if (recinto.cerrado !== true || vertices.length < 3) return null
  return areaDeVertices(vertices)
}

/**
 * Número correlativo de la clave, con dos cifras: 01, 02, 12.
 * @param {number} indice
 * @returns {string}
 */
export function numeroRecinto(indice) {
  return String(indice + 1).padStart(2, '0')
}

/**
 * Una línea de recinto en texto plano, para el desplegable de la barra superior.
 * @param {Object} recinto
 * @param {number} indice
 * @returns {string}
 */
export function etiquetaRecinto(recinto, indice) {
  const area = areaDeRecinto(recinto)
  const medida = area === null ? 'sin polígono cerrado' : `${formatearArea(area)} m²`
  return `${numeroRecinto(indice)} · ${recinto.nombre} · ${medida}`
}

/**
 * Cantidad de recintos en palabras corrientes de obra.
 * @param {number} cantidad
 * @returns {string}
 */
function cuentaDeRecintos(cantidad) {
  if (cantidad === 1) return '1 recinto'
  return `${cantidad} recintos`
}

/**
 * @typedef {Object} PropsEntrada
 * @property {Object} recinto
 * @property {number} indice
 * @property {boolean} activo
 * @property {() => void} onSeleccionar
 * @property {(nombre: string) => void} onRenombrar
 * @property {() => void} onEliminar
 */

/**
 * Una entrada de la clave. El renombrado ocurre en línea, sobre la propia
 * entrada: Enter confirma, Escape cancela, salir del campo confirma.
 * @param {PropsEntrada} props
 */
function EntradaRecinto({ recinto, indice, activo, onSeleccionar, onRenombrar, onEliminar }) {
  const [editando, setEditando] = useState(false)
  const [borrador, setBorrador] = useState(recinto.nombre)
  // Escape cierra la edición y el campo pierde el foco enseguida: sin esta
  // marca, el confirmar del blur revertiría la cancelación.
  const canceladoRef = useRef(false)

  const area = areaDeRecinto(recinto)
  const numero = numeroRecinto(indice)

  function comenzar() {
    setBorrador(recinto.nombre)
    canceladoRef.current = false
    setEditando(true)
  }

  function confirmar() {
    const limpio = borrador.trim()
    if (limpio && limpio !== recinto.nombre) onRenombrar(limpio)
    setEditando(false)
  }

  /** @param {import('react').KeyboardEvent<HTMLDivElement>} evento */
  function alTeclear(evento) {
    if (evento.key === 'Enter') {
      evento.preventDefault()
      confirmar()
      return
    }
    if (evento.key === 'Escape') {
      evento.preventDefault()
      evento.stopPropagation()
      canceladoRef.current = true
      setEditando(false)
    }
  }

  function alSalir() {
    if (canceladoRef.current) {
      canceladoRef.current = false
      return
    }
    if (editando) confirmar()
  }

  if (editando) {
    return (
      <li className="kb-key-mark border-b border-rule" data-current={activo ? 'true' : 'false'}>
        {/* El teclado y la salida del campo se escuchan en el envoltorio: el
            campo ya usa sus propios onFocus y onBlur para los ticks de registro. */}
        <div className="px-3 py-2" onKeyDown={alTeclear} onBlur={alSalir}>
          <CampoTexto
            tamano="sm"
            valor={borrador}
            onChange={setBorrador}
            aria-label={`Nombre del recinto ${numero}`}
            autoFocus
          />
        </div>
      </li>
    )
  }

  return (
    <li className="kb-key-mark border-b border-rule" data-current={activo ? 'true' : 'false'}>
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={onSeleccionar}
          aria-current={activo ? 'true' : undefined}
          className={cx(
            'flex min-h-[var(--size-touch-sm)] min-w-0 flex-1 flex-col items-start gap-0.5 px-3 py-2 text-left',
            'transition-[background-color] duration-[var(--duration-fast)] ease-damped',
            'hover:bg-margin-deep pointer-coarse:min-h-[var(--size-touch)]',
          )}
        >
          <span className="flex w-full min-w-0 items-baseline gap-2">
            <span className={cx('kb-label shrink-0', activo && 'kb-label-rubric')}>{numero}</span>
            <span className="truncate text-base text-ink">{recinto.nombre}</span>
          </span>

          {area === null ? (
            <span className="kb-num text-sm text-ink-3">
              <span aria-hidden="true">—</span>
              <span className="sr-only">Sin polígono cerrado</span>
            </span>
          ) : (
            <span className="kb-num text-sm text-ink-2">{formatearArea(area)} m²</span>
          )}
        </button>

        <div className="flex shrink-0 items-start">
          <Boton
            variante="fantasma"
            tamano="sm"
            soloIcono
            icono={Pencil}
            etiquetaAccesible={`Renombrar ${recinto.nombre}`}
            onClick={comenzar}
          />
          <Boton
            variante="fantasma"
            tamano="sm"
            soloIcono
            icono={Trash2}
            etiquetaAccesible={`Eliminar ${recinto.nombre}`}
            onClick={onEliminar}
          />
        </div>
      </div>
    </li>
  )
}

/**
 * Clave numerada del margen izquierdo.
 */
export function PanelRecintos() {
  const { estado, acciones } = useApp()
  const [porEliminar, setPorEliminar] = useState(/** @type {Object|null} */ (null))
  // La cifra de cierre sale del mismo consolidado que imprime la vista: no hay
  // dos cuentas de cuántos recintos entraron.
  const consolidado = useConsolidado(estado.proyecto, estado.biblioteca)

  const proyecto = estado.proyecto
  if (!proyecto) return null

  const recintos = Array.isArray(proyecto.recintos) ? proyecto.recintos : []
  const enConsolidado = estado.vista === 'consolidado'
  const fuera = consolidado.omitidos.length

  function agregar() {
    acciones.agregarRecinto()
  }

  function confirmarEliminacion() {
    if (porEliminar) acciones.eliminarRecinto(porEliminar.id)
    setPorEliminar(null)
  }

  return (
    <nav
      aria-label="Recintos del proyecto"
      className="flex h-full w-[var(--size-margin-left)] shrink-0 flex-col border-r border-rule-strong bg-margin max-[900px]:hidden"
    >
      <div className="shrink-0 border-b border-rule-strong px-3 py-2">
        <Rotulo tinta="fuerte" sufijo={recintos.length}>
          Recintos
        </Rotulo>
      </div>

      {recintos.length === 0 ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-3">
          <EstadoVacio
            titulo="Este proyecto no tiene recintos."
            descripcion="Agrega el primero para dibujar su planta y cubicarlo."
            acciones={
              <Boton variante="primaria" icono={Plus} onClick={agregar}>
                Agregar recinto
              </Boton>
            }
          />
        </div>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {recintos.map((recinto, indice) => (
            <EntradaRecinto
              key={recinto.id}
              recinto={recinto}
              indice={indice}
              activo={!enConsolidado && estado.recintoActivoId === recinto.id}
              onSeleccionar={() => acciones.seleccionarRecinto(recinto.id)}
              onRenombrar={(nombre) => acciones.renombrarRecinto(recinto.id, nombre)}
              onEliminar={() => setPorEliminar(recinto)}
            />
          ))}
        </ul>
      )}

      <div className="mt-auto flex shrink-0 flex-col gap-2 border-t border-rule-strong p-3">
        <Boton icono={Plus} bloque onClick={agregar}>
          Agregar recinto
        </Boton>

      </div>

      {/* Bloque de cierre de la clave. Es una de las funciones principales del
          producto y hasta acá pesaba menos que cualquier fila de recinto: un
          rótulo de 11px en tinta terciaria, sin filete. Gana peso como lo gana
          todo en esta edición —filete de corte, registro de lectura y cifra de
          cierre—, no con relleno naranja ni con elevación. El naranja se queda
          donde estaba: en "Agregar recinto", que es la acción de edición de esta
          columna. */}
      <button
        type="button"
        data-current={enConsolidado ? 'true' : 'false'}
        aria-current={enConsolidado ? 'true' : undefined}
        onClick={() => acciones.cambiarVista('consolidado')}
        title={
          fuera > 0
            ? `${fuera} ${fuera === 1 ? 'recinto queda' : 'recintos quedan'} fuera del consolidado`
            : undefined
        }
        className={cx(
          'kb-key-mark relative flex shrink-0 items-center gap-3 border-t border-rule-strong px-3 py-3 text-left',
          'transition-[background-color] duration-[var(--duration-fast)] ease-damped',
          'hover:bg-margin-deep',
        )}
      >
        <Cruz size={16} aria-hidden="true" className="shrink-0 text-navy-ink" />
        <span className="min-w-0 flex-1 truncate text-base text-ink">Consolidado</span>
        <span className="kb-num shrink-0 text-lg text-ink">
          {consolidado.incluidos}
          <span className="text-ink-3">/{consolidado.totalRecintos}</span>
        </span>
        <span className="sr-only">
          {`${consolidado.incluidos} de ${consolidado.totalRecintos} recintos cubicados`}
          {fuera > 0
            ? `. ${fuera} ${fuera === 1 ? 'queda fuera' : 'quedan fuera'} del consolidado.`
            : ''}
        </span>

        {/* Misma escuadra de registro con que el detente de Resultados declara
            que trae problemas. Lo que dice va además en el nombre accesible. */}
        {fuera > 0 ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-0.5 right-0.5 block h-2 w-2 border-t border-r border-error-ink"
          />
        ) : null}
      </button>

      <Dialogo
        abierto={porEliminar !== null}
        onCerrar={() => setPorEliminar(null)}
        titulo="Eliminar recinto"
        ancho="sm"
        descripcion={
          porEliminar
            ? `Se elimina "${porEliminar.nombre}" con su polígono, sus parámetros y su cubicación. Esta acción no se puede deshacer.`
            : ''
        }
        acciones={
          <>
            <Boton variante="fantasma" onClick={() => setPorEliminar(null)}>
              Cancelar
            </Boton>
            <Boton variante="peligro" icono={Trash2} onClick={confirmarEliminacion}>
              Eliminar recinto
            </Boton>
          </>
        }
      />
    </nav>
  )
}

export { cuentaDeRecintos }
export default PanelRecintos
