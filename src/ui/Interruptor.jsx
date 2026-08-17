/* =============================================================================
   Kubikar · Interruptor
   -----------------------------------------------------------------------------
   Rectangular, con un detente que se corre de un extremo al otro. No es una
   píldora: en esta edición nada tiene radio y un conmutador es un detente que
   cambia de posición, igual que el de una regla de cálculo.

   Toda la fila es el objetivo de clic, así que el rótulo también acciona y en
   puntero grueso el alto sube al objetivo táctil sin agrandar el detente.

   Semántica: `role="switch"` con `aria-checked`. El estado se lee, no se deduce
   del color, que es lo que exige un lector de pantalla y lo que salva a quien
   no distingue el naranja.
   ============================================================================ */

import { useId } from 'react'

/**
 * @param {...(string|false|null|undefined)} partes
 * @returns {string}
 */
function cx(...partes) {
  return partes.filter(Boolean).join(' ')
}

/**
 * @typedef {Object} PropsInterruptor
 * @property {string}  [id]
 * @property {string}  etiqueta
 * @property {boolean} [activo]
 * @property {(activo: boolean) => void} [onChange]
 * @property {string}  [ayuda]
 * @property {boolean} [deshabilitado]
 * @property {string}  [className]
 */

/**
 * Conmutador de dos posiciones.
 * @param {PropsInterruptor & Record<string, any>} props
 */
export function Interruptor({
  id,
  etiqueta,
  activo = false,
  onChange,
  ayuda,
  deshabilitado = false,
  className,
  ...resto
}) {
  const idAuto = useId()
  const idControl = id || `interruptor-${idAuto}`
  const idEtiqueta = `${idControl}-rotulo`
  const idAyuda = `${idControl}-ayuda`

  return (
    <div className={cx('flex flex-col gap-1', className)}>
      <button
        id={idControl}
        type="button"
        role="switch"
        aria-checked={activo ? 'true' : 'false'}
        aria-labelledby={idEtiqueta}
        aria-describedby={ayuda ? idAyuda : undefined}
        disabled={deshabilitado}
        onClick={() => onChange && onChange(!activo)}
        className={cx(
          'flex w-full items-center justify-between gap-3 border bg-block px-3 text-left',
          'min-h-[var(--size-touch-sm)] pointer-coarse:min-h-[var(--size-touch)]',
          'transition-[border-color] duration-[var(--duration-fast)] ease-damped',
          deshabilitado
            ? // La diagonal de tachado es la marca de deshabilitado del sistema
              // y vive en `.kb-detent`; se toma prestada solo por eso.
              'kb-detent cursor-not-allowed border-rule'
            : 'border-rule-strong hover:border-ink-3',
        )}
        {...resto}
      >
        <span
          id={idEtiqueta}
          className={cx('kb-label', activo && !deshabilitado && 'kb-label-rubric')}
        >
          {etiqueta}
        </span>

        <span
          aria-hidden="true"
          className={cx(
            'relative block h-5 w-11 shrink-0 border',
            deshabilitado ? 'border-rule' : 'border-rule-strong',
          )}
        >
          <span
            className={cx(
              'absolute inset-y-0 left-0 block w-1/2 border',
              'transition-transform duration-[var(--duration-base)] ease-damped',
              activo ? 'translate-x-full' : 'translate-x-0',
              // El relleno naranja es la señal de color, pero un relleno de
              // 2,4:1 no identifica por sí solo el estado de un control. El
              // límite del detente aporta el contraste: `--color-accent-ink`
              // da 6,2:1 contra el blanco del control y sigue siendo naranja.
              deshabilitado
                ? 'border-rule bg-margin-deep'
                : activo
                  ? 'border-accent-ink bg-accent'
                  : 'border-rule-strong bg-margin-deep',
            )}
          />
        </span>
      </button>

      {ayuda ? (
        <p id={idAyuda} className="text-sm text-ink-3">
          {ayuda}
        </p>
      ) : null}
    </div>
  )
}

export default Interruptor
