/* =============================================================================
   Kubikar · Cruz de registro
   -----------------------------------------------------------------------------
   La marca del sistema. En una edición de referencia reglada, la cruz de
   registro es lo que alinea las planchas de impresión: acá alinea la marca de
   la barra superior con los vértices del lienzo, que son literalmente la misma
   figura a otra escala.

   Dos filetes cruzados más un cuadrado central hueco. Nada más. Se dibuja sobre
   una caja de 16 × 16 y se escala entera con `size`, de modo que el trazo
   engorda proporcionalmente y la figura no se deforma.
   ============================================================================ */

/**
 * @typedef {Object} PropsCruz
 * @property {number}  [size]         lado de la cruz en píxeles
 * @property {string}  [color]        color del trazo; por defecto hereda la tinta
 * @property {number}  [strokeWidth]  grosor del trazo en unidades del viewBox
 * @property {boolean} [conCuadrado]  dibuja el cuadrado central de registro
 * @property {string}  [titulo]       si viene, la cruz deja de ser decorativa
 * @property {string}  [className]
 */

/**
 * Cruz de registro del sistema.
 * @param {PropsCruz & Record<string, any>} props
 */
export function Cruz({
  size = 16,
  color = 'currentColor',
  strokeWidth = 1.5,
  conCuadrado = true,
  titulo,
  className,
  ...resto
}) {
  const decorativa = !titulo

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="butt"
      role={decorativa ? undefined : 'img'}
      aria-hidden={decorativa ? 'true' : undefined}
      focusable="false"
      className={className}
      {...resto}
    >
      {titulo ? <title>{titulo}</title> : null}
      <line x1="8" y1="0" x2="8" y2="16" />
      <line x1="0" y1="8" x2="16" y2="8" />
      {conCuadrado ? <rect x="5.25" y="5.25" width="5.5" height="5.5" /> : null}
    </svg>
  )
}

export default Cruz
