/* =============================================================================
   Kubikar · Tabla
   -----------------------------------------------------------------------------
   La tabla es donde el producto entrega su carga útil, así que manda la columna
   numérica: toda celda de cifra va a la derecha, con cifras tabulares y sin
   quiebre de línea, para que los órdenes de magnitud se alineen verticalmente y
   un error de un cero salte a la vista.

   Decisiones estructurales:
   · `border-separate` con espaciado cero. Es lo que permite marcar la fila
     seleccionada con la barra de rúbrica de `.kb-key-mark`, que es una sombra
     interior y no se dibuja de forma confiable con los bordes colapsados.
   · El filete de separación vive en las celdas, no en la fila, por la misma
     razón.
   · El contenedor desplaza en horizontal por su cuenta. La tabla puede ser más
     ancha que la zona sin empujar jamás el ancho de la página.

   La densidad viaja por contexto: se declara una vez en la tabla y todas las
   celdas la respetan sin tener que repetirla en cada una.
   ============================================================================ */

import { createContext, useContext } from 'react'

/**
 * @param {...(string|false|null|undefined)} partes
 * @returns {string}
 */
function cx(...partes) {
  return partes.filter(Boolean).join(' ')
}

/** @type {import('react').Context<'densa'|'normal'>} */
const ContextoDensidad = createContext('normal')

/**
 * Relleno y registro tipográfico van SEPARADOS a propósito. La cabecera se
 * rotula con `.kb-label` —versal rastreada de 11px, el registro de rótulo del
 * sistema— y no puede llevar encima una utilidad de tamaño de texto: dos
 * declaraciones de `font-size` sobre el mismo elemento se resuelven por el
 * orden de la hoja generada, no por el orden en que se escriben, y la utilidad
 * gana siempre a la clase de componente. Con el tamaño mezclado en el relleno,
 * el rótulo de cabecera salía a 13 o 15px en versalitas en vez de a 11.
 */
const RELLENO = {
  densa: 'px-2 py-1',
  normal: 'px-3 py-2',
}

/** Registro de texto de una celda de datos, por densidad de la tabla. */
const TEXTO_CELDA = {
  densa: 'text-sm',
  normal: 'text-base',
}

/**
 * Registros de celda. `cifra` es el de la cantidad que se compra: el único
 * número del producto que sube de registro, y por eso vive acá y no como una
 * clase suelta en cada vista.
 */
const REGISTRO_CELDA = {
  cifra: 'text-lg',
}

/**
 * @typedef {Object} PropsTabla
 * @property {import('react').ReactNode} children
 * @property {'densa'|'normal'} [densidad]
 * @property {string} [titulo]      leyenda de la tabla, en registro de rótulo
 * @property {boolean} [tituloOculto]  la deja solo para lectores de pantalla
 * @property {string} [className]      clases del contenedor que desplaza
 * @property {string} [claseTabla]
 */

/**
 * Tabla del sistema. Envuelve en un contenedor que desplaza en horizontal.
 * @param {PropsTabla & Record<string, any>} props
 */
export function Tabla({
  children,
  densidad = 'normal',
  titulo,
  tituloOculto = false,
  className,
  claseTabla,
  ...resto
}) {
  return (
    <ContextoDensidad.Provider value={densidad}>
      <div className={cx('w-full max-w-full overflow-x-auto', className)}>
        <table
          className={cx('min-w-full border-separate border-spacing-0 text-left', claseTabla)}
          {...resto}
        >
          {titulo ? (
            <caption className={cx('kb-label pb-2 text-left', tituloOculto && 'sr-only')}>
              {titulo}
            </caption>
          ) : null}
          {children}
        </table>
      </div>
    </ContextoDensidad.Provider>
  )
}

/**
 * @param {{children: import('react').ReactNode, className?: string}} props
 */
export function TablaCabecera({ children, className, ...resto }) {
  return (
    <thead className={className} {...resto}>
      {children}
    </thead>
  )
}

/**
 * @param {{children: import('react').ReactNode, className?: string}} props
 */
export function TablaCuerpo({ children, className, ...resto }) {
  return (
    <tbody className={className} {...resto}>
      {children}
    </tbody>
  )
}

/**
 * @param {{children: import('react').ReactNode, className?: string}} props
 */
export function TablaPie({ children, className, ...resto }) {
  return (
    <tfoot className={className} {...resto}>
      {children}
    </tfoot>
  )
}

/**
 * @typedef {Object} PropsTablaFila
 * @property {import('react').ReactNode} children
 * @property {boolean} [seleccionada]
 * @property {() => void} [onClick]
 * @property {string} [className]
 */

/**
 * Fila. Si es seleccionable responde a Enter y a Espacio, no solo al clic.
 *
 * La selección viaja por `aria-current`, no por `aria-selected`: esta tabla es
 * una `table` corriente y el rol implícito de `<tr>` es `row`, donde
 * `aria-selected` no está soportado fuera de `grid` y `treegrid`. `aria-current`
 * sí es válido en `row` y dice lo mismo, que es cuál fila es la que está en
 * juego. La marca visual la sigue dando `.kb-key-mark[data-current]`.
 * @param {PropsTablaFila & Record<string, any>} props
 */
export function TablaFila({ children, seleccionada = false, onClick, className, ...resto }) {
  const elegible = typeof onClick === 'function'

  /** @param {import('react').KeyboardEvent<HTMLTableRowElement>} evento */
  function alTeclear(evento) {
    if (!elegible) return
    if (evento.key !== 'Enter' && evento.key !== ' ') return
    evento.preventDefault()
    onClick()
  }

  return (
    <tr
      className={cx(
        'kb-key-mark',
        elegible && 'cursor-pointer hover:bg-margin',
        'transition-[background-color] duration-[var(--duration-fast)] ease-damped',
        className,
      )}
      data-current={seleccionada ? 'true' : 'false'}
      aria-current={elegible && seleccionada ? 'true' : undefined}
      tabIndex={elegible ? 0 : undefined}
      onClick={onClick}
      onKeyDown={elegible ? alTeclear : undefined}
      {...resto}
    >
      {children}
    </tr>
  )
}

/**
 * Alineación vertical del contenido de una celda. Va como prop y no como clase
 * suelta porque dos utilidades de `vertical-align` en el mismo elemento se
 * resuelven por el orden de la hoja generada, no por el orden en que se
 * escriben: `align-middle` puesto después de `align-top` no lo pisa.
 *
 *   arriba  el caso corriente: la primera línea de cada celda a la misma altura
 *   medio   celdas que solo llevan un control o un correlativo
 *   base    filas con dos registros tipográficos, para que las cifras se lean
 *           sobre una misma línea de base
 */
const ALINEACION_CELDA = {
  arriba: 'align-top',
  medio: 'align-middle',
  base: 'align-baseline',
}

/**
 * @typedef {Object} PropsCelda
 * @property {import('react').ReactNode} children
 * @property {boolean} [numerica]   alinea a la derecha con cifras tabulares
 * @property {'arriba'|'medio'|'base'} [alineacion]
 * @property {'cifra'} [registro]   sube la celda al registro de la cifra de cierre
 * @property {string}  [className]
 */

/**
 * Celda de cabecera.
 * @param {PropsCelda & {alcance?: string} & Record<string, any>} props
 */
export function TablaTitulo({ children, numerica = false, alcance = 'col', className, ...resto }) {
  const densidad = useContext(ContextoDensidad)
  return (
    <th
      scope={alcance}
      className={cx(
        // Tinta azul marino sobre la cabecera: el rótulo terciario no alcanza
        // contraste AA sobre `--color-navy-soft` a 11px.
        'kb-label kb-label-strong border-b border-rule-strong bg-navy-soft align-bottom whitespace-nowrap',
        RELLENO[densidad] || RELLENO.normal,
        numerica ? 'text-right' : 'text-left',
        className,
      )}
      {...resto}
    >
      {children}
    </th>
  )
}

/**
 * Celda de datos.
 * @param {PropsCelda & Record<string, any>} props
 */
export function TablaCelda({
  children,
  numerica = false,
  alineacion = 'arriba',
  registro,
  className,
  ...resto
}) {
  const densidad = useContext(ContextoDensidad)
  return (
    <td
      className={cx(
        'border-b border-rule text-ink',
        ALINEACION_CELDA[alineacion] || ALINEACION_CELDA.arriba,
        RELLENO[densidad] || RELLENO.normal,
        REGISTRO_CELDA[registro] || TEXTO_CELDA[densidad] || TEXTO_CELDA.normal,
        numerica ? 'kb-num text-right whitespace-nowrap' : 'text-left',
        className,
      )}
      {...resto}
    >
      {children}
    </td>
  )
}

export default Tabla
