/* =============================================================================
   Kubikar · Selector
   -----------------------------------------------------------------------------
   Un <select> nativo, no una lista reinventada. El desplegable del sistema
   operativo ya resuelve teclado, búsqueda por letra, lectores de pantalla y
   pantalla táctil mejor que cualquier reimplementación, así que solo se le
   quita la piel del navegador y se le pone el filete de la edición.

   Los valores de las opciones pueden no ser texto (un booleano, un número). El
   <select> siempre habla en cadenas, así que se indexa por posición y se emite
   de vuelta el valor original, sin convertirlo.

   Con la lista vacía el control queda deshabilitado y tachado, y dice qué falta
   con el texto que recibe. Un selector vacío sin explicación es un callejón.
   ============================================================================ */

import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Rotulo } from './Rotulo.jsx'
import { TAMANOS_CAMPO, contornoCampo } from './CampoTexto.jsx'

/**
 * @param {...(string|false|null|undefined)} partes
 * @returns {string}
 */
function cx(...partes) {
  return partes.filter(Boolean).join(' ')
}

/**
 * @typedef {Object} OpcionSelector
 * @property {*} valor
 * @property {string} etiqueta
 * @property {boolean} [deshabilitada]
 */

/**
 * @typedef {Object} PropsSelector
 * @property {string}  [id]
 * @property {string}  [etiqueta]
 * @property {*}       [valor]
 * @property {(valor: *) => void} [onChange]
 * @property {OpcionSelector[]} [opciones]
 * @property {string}  [placeholder]   opción de cortesía cuando no hay valor
 * @property {string}  [textoVacio]    qué se muestra con la lista vacía
 * @property {import('react').ReactNode} [pie]  acción bajo el control
 * @property {string}  [ayuda]
 * @property {string}  [error]
 * @property {boolean} [requerido]
 * @property {boolean} [deshabilitado]
 * @property {'sm'|'md'} [tamano]
 * @property {string}  [className]
 */

/**
 * Selector de una opción.
 * @param {PropsSelector & Record<string, any>} props
 */
export function Selector({
  id,
  etiqueta,
  valor,
  onChange,
  opciones,
  placeholder = 'Selecciona una opción',
  textoVacio = 'No hay opciones disponibles',
  pie,
  ayuda,
  error,
  requerido = false,
  deshabilitado = false,
  tamano = 'md',
  className,
  ...resto
}) {
  const idAuto = useId()
  const idCampo = id || `selector-${idAuto}`
  const idAyuda = `${idCampo}-ayuda`
  const idError = `${idCampo}-error`
  const [enfocado, setEnfocado] = useState(false)

  const lista = Array.isArray(opciones) ? opciones : []
  const vacio = lista.length === 0
  const inerte = deshabilitado || vacio

  const indiceActual = lista.findIndex((opcion) => opcion.valor === valor)
  const hayValor = indiceActual !== -1
  const valorSelect = vacio ? '__vacio' : hayValor ? String(indiceActual) : '__sin'

  const descrito = [ayuda ? idAyuda : null, error ? idError : null].filter(Boolean).join(' ')

  /**
   * @param {import('react').ChangeEvent<HTMLSelectElement>} evento
   */
  function alCambiar(evento) {
    const bruto = evento.target.value
    if (bruto === '__sin' || bruto === '__vacio') {
      if (onChange) onChange(null)
      return
    }
    const opcion = lista[Number(bruto)]
    if (opcion && onChange) onChange(opcion.valor)
  }

  return (
    <div className={cx('flex flex-col gap-1', className)}>
      {etiqueta ? (
        <Rotulo htmlFor={idCampo} tinta={enfocado ? 'rubrica' : 'normal'}>
          {etiqueta}
        </Rotulo>
      ) : null}

      <div className="relative flex w-full">
        <select
          id={idCampo}
          value={valorSelect}
          disabled={inerte}
          required={requerido}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={descrito || undefined}
          onFocus={() => setEnfocado(true)}
          onBlur={() => setEnfocado(false)}
          onChange={alCambiar}
          className={cx(
            contornoCampo({ error: Boolean(error), enfocado, deshabilitado: inerte }),
            TAMANOS_CAMPO[tamano] || TAMANOS_CAMPO.md,
            'appearance-none pl-3 pr-9',
          )}
          {...resto}
        >
          {vacio ? (
            <option value="__vacio">{textoVacio}</option>
          ) : (
            <>
              {!hayValor ? (
                <option value="__sin" disabled={requerido}>
                  {placeholder}
                </option>
              ) : null}
              {lista.map((opcion, indice) => (
                <option
                  key={`${indice}-${String(opcion.valor)}`}
                  value={String(indice)}
                  disabled={opcion.deshabilitada}
                >
                  {opcion.etiqueta}
                </option>
              ))}
            </>
          )}
        </select>

        <span
          className={cx(
            'pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3',
            inerte ? 'text-ink-3' : 'text-ink-2',
          )}
        >
          <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" />
        </span>
      </div>

      {ayuda ? (
        <p id={idAyuda} className="text-sm text-ink-3">
          {ayuda}
        </p>
      ) : null}

      {/* Región viva montada desde el primer render: ver la nota de CampoTexto. */}
      <p id={idError} role="alert" className={cx('text-sm text-error-ink', !error && 'sr-only')}>
        {error}
      </p>

      {pie ? <div className="pt-1">{pie}</div> : null}
    </div>
  )
}

export default Selector
