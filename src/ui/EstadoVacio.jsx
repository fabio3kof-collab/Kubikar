/* =============================================================================
   Kubikar · Estado vacío
   -----------------------------------------------------------------------------
   Un estado vacío es una instrucción, no un cartel. Tres piezas y nada más:
   qué falta, una línea de prosa que lo explica y la acción concreta que lo
   resuelve. Sin ilustración, sin frase de aliento, sin signos de exclamación.

   La prosa va en brevier (`.kb-prose`), el mismo registro con que esta edición
   escribe una nota al margen: es texto para leer, no un rótulo.
   ============================================================================ */

/**
 * @param {...(string|false|null|undefined)} partes
 * @returns {string}
 */
function cx(...partes) {
  return partes.filter(Boolean).join(' ')
}

/**
 * @typedef {Object} PropsEstadoVacio
 * @property {string} titulo                     qué falta, en una frase
 * @property {import('react').ReactNode} [descripcion]  una línea de prosa
 * @property {import('react').ReactNode} [acciones]     una o dos salidas
 * @property {'h2'|'h3'|'h4'|'p'} [nivelTitulo]   nivel real en el documento
 * @property {boolean} [encuadrado]              lo enmarca con un filete
 * @property {boolean} [centrado]
 * @property {string} [className]
 */

/**
 * Estado vacío del sistema.
 * @param {PropsEstadoVacio & Record<string, any>} props
 */
export function EstadoVacio({
  titulo,
  descripcion,
  acciones,
  nivelTitulo = 'h3',
  encuadrado = false,
  centrado = false,
  className,
  ...resto
}) {
  const Titulo = nivelTitulo

  return (
    <div
      className={cx(
        'flex flex-col gap-3',
        centrado ? 'items-center text-center' : 'items-start text-left',
        encuadrado ? 'border border-rule bg-block px-6 py-6' : 'py-6',
        className,
      )}
      {...resto}
    >
      <Titulo className="text-xl text-ink">{titulo}</Titulo>

      {descripcion ? (
        <p className={cx('kb-prose', centrado && 'mx-auto')}>{descripcion}</p>
      ) : null}

      {acciones ? <div className="flex flex-wrap items-center gap-2 pt-1">{acciones}</div> : null}
    </div>
  )
}

export default EstadoVacio
