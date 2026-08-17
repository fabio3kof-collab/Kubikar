/* =============================================================================
   Kubikar · Rótulo
   -----------------------------------------------------------------------------
   El nombre impreso de cada cosa: versal rastreada de 11px, el registro con que
   esta edición rotula un control, una columna o un grupo de parámetros.

   Tres tintas posibles y ninguna decisión de color en el componente: `.kb-label`
   y sus modificadores viven en base.css y son la única fuente de verdad.
     · normal   tinta terciaria, el rótulo en reposo
     · fuerte   azul marino, el rótulo estructural de una zona
     · rubrica  naranja, el rótulo de lo activo o seleccionado
   ============================================================================ */

/**
 * @param {...(string|false|null|undefined)} partes
 * @returns {string}
 */
function cx(...partes) {
  return partes.filter(Boolean).join(' ')
}

/**
 * @typedef {Object} PropsRotulo
 * @property {import('react').ReactNode} children
 * @property {string}  [htmlFor]   si viene, el rótulo se emite como <label>
 * @property {'normal'|'fuerte'|'rubrica'} [tinta]
 * @property {import('react').ReactNode} [sufijo]  cifra o marca al final de la línea
 * @property {string}  [como]      etiqueta a emitir cuando no hay htmlFor
 * @property {string}  [className]
 */

/**
 * Rótulo de aparato.
 * @param {PropsRotulo & Record<string, any>} props
 */
export function Rotulo({ children, htmlFor, tinta = 'normal', sufijo, como = 'span', className, ...resto }) {
  const Etiqueta = htmlFor ? 'label' : como

  const clases = cx(
    'kb-label',
    tinta === 'fuerte' && 'kb-label-strong',
    tinta === 'rubrica' && 'kb-label-rubric',
    sufijo ? 'flex w-full items-baseline justify-between gap-3' : 'block',
    className,
  )

  return (
    <Etiqueta htmlFor={htmlFor} className={clases} {...resto}>
      <span>{children}</span>
      {sufijo ? <span className="kb-num shrink-0">{sufijo}</span> : null}
    </Etiqueta>
  )
}

export default Rotulo
