/* =============================================================================
   Kubikar · Diálogo
   -----------------------------------------------------------------------------
   Elemento <dialog> nativo abierto con showModal(). No es una preferencia de
   estilo: es la única forma de que el diálogo escape del recorte de cualquier
   contenedor con overflow (el riel, la tabla que desplaza, el margen de
   aparato) y de que el navegador se haga cargo de la capa superior, del
   atrapado de foco y del cierre con Escape sin una sola línea de JavaScript.

   Lo que sí hay que resolver a mano es la devolución del foco: el navegador
   devuelve el foco al elemento que abrió el diálogo solo si sigue existiendo,
   así que se guarda la referencia al abrir y se restituye al cerrar, después de
   comprobar que el elemento continúa en el documento.

   El diálogo es lo único, junto al menú, que flota: por eso lleva sombra, y esa
   sombra tiene desplazamiento real (`--shadow-lift`), no es un halo.
   ============================================================================ */

import { useCallback, useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import { Boton } from './Boton.jsx'

/**
 * @param {...(string|false|null|undefined)} partes
 * @returns {string}
 */
function cx(...partes) {
  return partes.filter(Boolean).join(' ')
}

/** Anchos máximos. El diálogo nunca pasa del 92% del viewport. */
const ANCHOS = {
  sm: 'w-[min(92vw,24rem)]',
  md: 'w-[min(92vw,34rem)]',
  lg: 'w-[min(92vw,48rem)]',
}

/**
 * @typedef {Object} PropsDialogo
 * @property {boolean} abierto
 * @property {() => void} onCerrar
 * @property {string} titulo
 * @property {import('react').ReactNode} [descripcion]
 * @property {import('react').ReactNode} [children]
 * @property {import('react').ReactNode} [acciones]   botones del pie
 * @property {'sm'|'md'|'lg'} [ancho]
 * @property {boolean} [cerrarAlClicFuera]
 * @property {string} [className]
 */

/**
 * Diálogo modal.
 * @param {PropsDialogo & Record<string, any>} props
 */
export function Dialogo({
  abierto,
  onCerrar,
  titulo,
  descripcion,
  children,
  acciones,
  ancho = 'md',
  cerrarAlClicFuera = true,
  className,
  ...resto
}) {
  const idAuto = useId()
  const idTitulo = `dialogo-${idAuto}-titulo`
  const idDescripcion = `dialogo-${idAuto}-descripcion`

  const refDialogo = useRef(null)
  const refAbridor = useRef(null)
  const refAbierto = useRef(abierto)
  const refOnCerrar = useRef(onCerrar)
  refOnCerrar.current = onCerrar

  // Abrir y cerrar el elemento nativo siguiendo la prop. Las guardas contra
  // `open` evitan el error de volver a llamar showModal sobre un diálogo ya
  // abierto, que es lo que ocurre con el doble montaje de StrictMode.
  useEffect(() => {
    const dialogo = refDialogo.current
    if (!dialogo) return

    if (abierto && !dialogo.open) {
      refAbridor.current = document.activeElement
      refAbierto.current = true
      dialogo.showModal()
    } else if (!abierto && dialogo.open) {
      refAbierto.current = false
      dialogo.close()
    }
  }, [abierto])

  // Cierre por cualquier vía (Escape, clic fuera, botón): devolver el foco a
  // quien abrió y avisar al padre una sola vez.
  useEffect(() => {
    const dialogo = refDialogo.current
    if (!dialogo) return

    function alCerrarse() {
      const abridor = refAbridor.current
      refAbridor.current = null
      if (abridor && typeof abridor.focus === 'function' && document.contains(abridor)) {
        abridor.focus()
      }
      if (refAbierto.current) {
        refAbierto.current = false
        if (refOnCerrar.current) refOnCerrar.current()
      }
    }

    dialogo.addEventListener('close', alCerrarse)
    return () => dialogo.removeEventListener('close', alCerrarse)
  }, [])

  const cerrar = useCallback(() => {
    const dialogo = refDialogo.current
    if (dialogo && dialogo.open) dialogo.close()
    else if (onCerrar) onCerrar()
  }, [onCerrar])

  /** El clic sobre el telón aterriza en el propio <dialog>, no en su contenido. */
  const alClic = useCallback(
    (evento) => {
      if (!cerrarAlClicFuera) return
      if (evento.target === refDialogo.current) cerrar()
    },
    [cerrarAlClicFuera, cerrar],
  )

  return (
    <dialog
      ref={refDialogo}
      aria-labelledby={idTitulo}
      aria-describedby={descripcion ? idDescripcion : undefined}
      onClick={alClic}
      className={cx(
        'm-auto max-h-[85vh] border border-rule-strong bg-block p-0 text-ink shadow-lift',
        'backdrop:bg-ink/45',
        ANCHOS[ancho] || ANCHOS.md,
        className,
      )}
      {...resto}
    >
      <div className="flex max-h-[85vh] flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-rule-strong px-5 py-3">
          <h2 id={idTitulo} className="text-xl text-ink">
            {titulo}
          </h2>
          <Boton
            variante="fantasma"
            tamano="sm"
            soloIcono
            icono={X}
            etiquetaAccesible="Cerrar"
            onClick={cerrar}
            className="-mr-2 shrink-0"
          />
        </header>

        <div className="flex flex-col gap-3 overflow-y-auto px-5 py-4">
          {descripcion ? (
            <p id={idDescripcion} className="kb-prose">
              {descripcion}
            </p>
          ) : null}
          {children}
        </div>

        {acciones ? (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-rule-strong bg-margin px-5 py-3">
            {acciones}
          </footer>
        ) : null}
      </div>
    </dialog>
  )
}

export default Dialogo
