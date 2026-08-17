/* =============================================================================
   Kubikar · Regla
   -----------------------------------------------------------------------------
   El filete de 1px que separa y agrupa. Es la unidad estructural del mundo
   visual: acá la jerarquía la hace la regla, no la sombra ni la tarjeta.

   Con `conCruz` la regla se parte al medio y deja pasar una cruz de registro,
   igual que las reglas de margen de una edición compuesta a mano. Se usa para
   abrir un grupo de parámetros o para cerrar un bloque de resultados.
   ============================================================================ */

import { Cruz } from './Cruz.jsx'

/**
 * @param {...(string|false|null|undefined)} partes
 * @returns {string}
 */
function cx(...partes) {
  return partes.filter(Boolean).join(' ')
}

/** Tonos disponibles del filete. */
const TONOS = {
  suave: 'bg-rule',
  fuerte: 'bg-rule-strong',
  rubrica: 'bg-accent',
}

/**
 * @typedef {Object} PropsRegla
 * @property {'horizontal'|'vertical'} [orientacion]
 * @property {'suave'|'fuerte'|'rubrica'} [tono]
 * @property {boolean} [conCruz]     intercala una cruz de registro al centro
 * @property {number}  [tamanoCruz]  lado de la cruz, en píxeles
 * @property {string}  [className]
 */

/**
 * Filete de un píxel, horizontal o vertical.
 * @param {PropsRegla & Record<string, any>} props
 */
export function Regla({
  orientacion = 'horizontal',
  tono = 'suave',
  conCruz = false,
  tamanoCruz = 12,
  className,
  ...resto
}) {
  const vertical = orientacion === 'vertical'
  const relleno = TONOS[tono] || TONOS.suave
  const trazo = vertical ? cx('w-px flex-1', relleno) : cx('h-px flex-1', relleno)

  const comunes = {
    role: 'separator',
    'aria-orientation': vertical ? 'vertical' : 'horizontal',
    ...resto,
  }

  if (!conCruz) {
    return (
      <div
        {...comunes}
        className={cx(vertical ? 'h-full w-px self-stretch' : 'h-px w-full', relleno, className)}
      />
    )
  }

  return (
    <div
      {...comunes}
      className={cx(
        'flex items-center',
        vertical ? 'h-full w-3 flex-col gap-1' : 'w-full flex-row gap-1',
        className,
      )}
    >
      <span className={trazo} />
      <Cruz
        size={tamanoCruz}
        strokeWidth={1.5}
        className={tono === 'rubrica' ? 'text-accent' : 'text-rule-strong'}
      />
      <span className={trazo} />
    </div>
  )
}

export default Regla
