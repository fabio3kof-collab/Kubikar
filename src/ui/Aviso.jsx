/* =============================================================================
   Kubikar · Aviso
   -----------------------------------------------------------------------------
   Cuatro niveles, una sola forma: filete de un píxel del color pleno a la
   izquierda, fondo suave del mismo tono y tinta de contraste garantizado. El
   color pleno no se usa nunca como texto; para eso están las tintas
   `-ink`, que son las únicas que llegan a AA sobre papel.

   El filete es de un píxel, no de cuatro. Una banda de color gruesa a la
   izquierda es decoración de plantilla; acá la señal es la misma regla con que
   está trazado todo lo demás.

   El texto de un aviso nombra el problema y la salida. "No se pudo guardar" es
   una queja; "No se pudo guardar en este navegador. Exporta el proyecto a JSON
   para no perder el trabajo" es un aviso.
   ============================================================================ */

import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { Boton } from './Boton.jsx'

/**
 * @param {...(string|false|null|undefined)} partes
 * @returns {string}
 */
function cx(...partes) {
  return partes.filter(Boolean).join(' ')
}

/** Gramática de los cuatro niveles. Ningún componente decide un color por su cuenta. */
const NIVELES = {
  error: {
    icono: CircleAlert,
    clases: 'border-l-error bg-error-soft text-error-ink',
    rol: 'alert',
    cortesia: 'assertive',
    nombre: 'Error',
  },
  advertencia: {
    icono: TriangleAlert,
    clases: 'border-l-warn bg-warn-soft text-warn-ink',
    rol: 'status',
    cortesia: 'polite',
    nombre: 'Advertencia',
  },
  info: {
    icono: Info,
    clases: 'border-l-navy bg-navy-soft text-navy-ink',
    rol: 'status',
    cortesia: 'polite',
    nombre: 'Nota',
  },
  ok: {
    icono: CircleCheck,
    clases: 'border-l-ok bg-ok-soft text-ok-ink',
    rol: 'status',
    cortesia: 'polite',
    nombre: 'Listo',
  },
}

/**
 * @typedef {Object} PropsAviso
 * @property {'error'|'advertencia'|'info'|'ok'} [nivel]
 * @property {string} [titulo]
 * @property {import('react').ReactNode} [children]  el cuerpo del aviso
 * @property {import('react').ReactNode} [acciones]  la salida concreta
 * @property {() => void} [onCerrar]
 * @property {boolean} [compacto]   una sola línea, sin título ni acciones
 * @property {string} [className]
 */

/**
 * Aviso de estado.
 * @param {PropsAviso & Record<string, any>} props
 */
export function Aviso({
  nivel = 'info',
  titulo,
  children,
  acciones,
  onCerrar,
  compacto = false,
  className,
  ...resto
}) {
  const config = NIVELES[nivel] || NIVELES.info
  const Icono = config.icono

  return (
    <div
      role={config.rol}
      aria-live={config.cortesia}
      className={cx(
        'flex w-full items-start gap-2 border-l',
        config.clases,
        compacto ? 'px-3 py-1' : 'px-3 py-2',
        className,
      )}
      {...resto}
    >
      <Icono size={16} strokeWidth={1.5} aria-hidden="true" className="mt-1 shrink-0" />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="sr-only">{config.nombre}. </span>
        {titulo && !compacto ? <span className="kb-label text-current">{titulo}</span> : null}
        <div className={cx('text-base', compacto && 'text-sm')}>{children}</div>
        {acciones && !compacto ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">{acciones}</div>
        ) : null}
      </div>

      {onCerrar ? (
        <Boton
          variante="fantasma"
          tamano="sm"
          soloIcono
          icono={X}
          etiquetaAccesible="Cerrar aviso"
          onClick={onCerrar}
          className="-mr-1 shrink-0"
        />
      ) : null}
    </div>
  )
}

export default Aviso
