/* =============================================================================
   Kubikar · Campo numérico
   -----------------------------------------------------------------------------
   El campo que carga la cubicación. Tres decisiones lo definen:

   1. El texto que se está escribiendo y el número comprometido son cosas
      distintas. El campo mantiene su propio texto mientras hay foco, así se
      puede escribir "1," o "0," sin que un parseo prematuro borre la coma. Al
      salir del campo el texto se normaliza al formato chileno.
   2. En obra se escribe con coma y también con punto. `parsearNumeroCL` acepta
      los dos, y el teclado móvil se abre en decimal (`inputMode="decimal"`), no
      en el teclado completo.
   3. Un valor fuera de rango no se acepta en silencio: se lleva al límite al
      salir del campo y el mensaje explica qué pasó y cuál es el límite.

   El sufijo de unidad va dentro de la caja, a la derecha, en registro de rótulo:
   la cifra y su unidad se leen como una sola cosa. El espacio que ocupa se
   reserva con `--kb-sufijo` para que el número nunca corra por debajo.
   ============================================================================ */

import { useEffect, useId, useRef, useState } from 'react'
import { formatearNumero, parsearNumeroCL } from '../core/units.js'
import { Rotulo } from './Rotulo.jsx'
import { Detente } from './Detente.jsx'
import { TAMANOS_CAMPO, contornoCampo } from './CampoTexto.jsx'

/**
 * @param {...(string|false|null|undefined)} partes
 * @returns {string}
 */
function cx(...partes) {
  return partes.filter(Boolean).join(' ')
}

const MENSAJE_NO_NUMERO = 'Escribe un número. Puedes usar coma o punto para los decimales.'
const MENSAJE_VACIO = 'Ingresa un valor para poder cubicar.'

/**
 * Presenta un número con formato chileno. Sin `decimales` explícitos muestra
 * hasta dos, sin ceros de relleno: 40 se lee "40" y 1,5 se lee "1,5".
 * @param {number|null|undefined} v
 * @param {number} [decimales]
 * @returns {string}
 */
function mostrar(v, decimales) {
  if (v === null || v === undefined || !Number.isFinite(v)) return ''
  if (Number.isFinite(decimales)) return formatearNumero(v, decimales)
  const redondeado = Math.round(v * 100) / 100
  const fraccion = String(redondeado).split('.')[1] || ''
  return formatearNumero(redondeado, Math.min(2, fraccion.length))
}

/**
 * Quita el ruido de coma flotante que deja sumar pasos decimales.
 * @param {number} n
 * @returns {number}
 */
function limpio(n) {
  return Math.round(n * 1e6) / 1e6
}

/**
 * @typedef {Object} PropsCampoNumero
 * @property {string}  [id]
 * @property {string}  [etiqueta]
 * @property {number|null} [valor]
 * @property {(valor: number|null) => void} [onChange]
 * @property {number}  [min]
 * @property {number}  [max]
 * @property {number}  [paso]        salto de las flechas del teclado
 * @property {number}  [decimales]   decimales fijos de presentación
 * @property {string}  [sufijo]      unidad que se imprime dentro de la caja
 * @property {string}  [ayuda]
 * @property {string}  [error]       error externo; manda sobre el interno
 * @property {string}  [mensajeMin]  reemplaza el mensaje de mínimo
 * @property {string}  [mensajeMax]  reemplaza el mensaje de máximo
 * @property {number[]} [sugeridos]  valores rápidos, en fila de detentes
 * @property {boolean} [requerido]
 * @property {boolean} [deshabilitado]
 * @property {'sm'|'md'} [tamano]
 * @property {string}  [className]
 */

/**
 * Campo de una cifra.
 * @param {PropsCampoNumero & Record<string, any>} props
 */
export function CampoNumero({
  id,
  etiqueta,
  valor = null,
  onChange,
  min,
  max,
  paso = 1,
  decimales,
  sufijo,
  ayuda,
  error,
  mensajeMin,
  mensajeMax,
  sugeridos,
  requerido = false,
  deshabilitado = false,
  tamano = 'md',
  className,
  ...resto
}) {
  const idAuto = useId()
  const idCampo = id || `cifra-${idAuto}`
  const idAyuda = `${idCampo}-ayuda`
  const idError = `${idCampo}-error`
  const idSugeridos = `${idCampo}-sugeridos`

  const [texto, setTexto] = useState(() => mostrar(valor, decimales))
  const [enfocado, setEnfocado] = useState(false)
  const [errorInterno, setErrorInterno] = useState('')
  const ultimoEmitido = useRef(valor)

  // El valor puede cambiar por fuera (deshacer, cambio de unidad, carga de un
  // proyecto). Solo se reescribe el texto cuando el cambio no vino de acá: si
  // el padre devuelve el mismo número que se acaba de emitir, no se toca lo que
  // el usuario está escribiendo.
  useEffect(() => {
    if (valor === ultimoEmitido.current) return
    ultimoEmitido.current = valor
    setTexto(mostrar(valor, decimales))
    setErrorInterno('')
  }, [valor, decimales])

  const hayMin = Number.isFinite(min)
  const hayMax = Number.isFinite(max)
  const unidad = sufijo ? ` ${sufijo}` : ''
  const textoMin = mensajeMin || `El valor mínimo es ${mostrar(min, decimales)}${unidad}.`
  const textoMax = mensajeMax || `El valor máximo es ${mostrar(max, decimales)}${unidad}.`

  /**
   * @param {number} n
   * @returns {number}
   */
  function acotar(n) {
    let v = n
    if (hayMin && v < min) v = min
    if (hayMax && v > max) v = max
    return limpio(v)
  }

  /**
   * @param {number|null} n
   */
  function emitir(n) {
    ultimoEmitido.current = n
    if (onChange) onChange(n)
  }

  /**
   * @param {string} bruto
   */
  function alEscribir(bruto) {
    setTexto(bruto)

    if (bruto.trim() === '') {
      setErrorInterno(requerido ? MENSAJE_VACIO : '')
      emitir(null)
      return
    }

    const n = parsearNumeroCL(bruto)
    if (n === null) {
      setErrorInterno(MENSAJE_NO_NUMERO)
      return
    }
    if (hayMin && n < min) {
      setErrorInterno(textoMin)
      return
    }
    if (hayMax && n > max) {
      setErrorInterno(textoMax)
      return
    }

    setErrorInterno('')
    emitir(limpio(n))
  }

  function alSalir() {
    setEnfocado(false)
    const bruto = texto.trim()

    if (bruto === '') {
      setTexto('')
      return
    }

    const n = parsearNumeroCL(bruto)
    if (n === null) {
      // Texto ilegible: se restituye el último número bueno y el mensaje queda
      // a la vista para que se entienda por qué volvió atrás.
      setTexto(mostrar(valor, decimales))
      return
    }

    const acotado = acotar(n)
    setTexto(mostrar(acotado, decimales))
    emitir(acotado)
    // Si hubo que llevarlo al límite, el mensaje que explica el recorte se
    // mantiene; si el valor entró tal cual, la advertencia deja de tener sentido.
    if (acotado === limpio(n)) setErrorInterno('')
  }

  /**
   * @param {import('react').KeyboardEvent<HTMLInputElement>} evento
   */
  function alTeclear(evento) {
    if (evento.key !== 'ArrowUp' && evento.key !== 'ArrowDown') return
    evento.preventDefault()
    const salto = Number.isFinite(paso) && paso > 0 ? paso : 1
    const actual = parsearNumeroCL(texto)
    const base = actual === null ? (hayMin ? min : 0) : actual
    const siguiente = acotar(limpio(base + (evento.key === 'ArrowUp' ? salto : -salto)))
    setErrorInterno('')
    setTexto(mostrar(siguiente, decimales))
    emitir(siguiente)
  }

  /**
   * @param {number} sugerido
   */
  function alElegirSugerido(sugerido) {
    const elegido = acotar(sugerido)
    setErrorInterno('')
    setTexto(mostrar(elegido, decimales))
    emitir(elegido)
  }

  const mensaje = error || errorInterno
  const listaSugeridos = Array.isArray(sugeridos) ? sugeridos.filter((s) => Number.isFinite(s)) : []
  // Los valores rápidos entran en la cadena de descripción: sin eso quedan como
  // dos botones sueltos después del input, sin relación anunciada con el campo
  // al que pertenecen.
  const descrito = [
    ayuda ? idAyuda : null,
    mensaje ? idError : null,
    listaSugeridos.length > 0 ? idSugeridos : null,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cx('flex flex-col gap-1', className)}>
      {etiqueta ? (
        <Rotulo htmlFor={idCampo} tinta={enfocado ? 'rubrica' : 'normal'}>
          {etiqueta}
        </Rotulo>
      ) : null}

      <div className="relative flex w-full">
        <input
          id={idCampo}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={texto}
          disabled={deshabilitado}
          required={requerido}
          aria-invalid={mensaje ? 'true' : undefined}
          aria-describedby={descrito || undefined}
          onFocus={() => setEnfocado(true)}
          onBlur={alSalir}
          onKeyDown={alTeclear}
          onChange={(evento) => alEscribir(evento.target.value)}
          style={sufijo ? { '--kb-sufijo': `${String(sufijo).length + 1.5}ch` } : undefined}
          className={cx(
            contornoCampo({ error: Boolean(mensaje), enfocado, deshabilitado }),
            TAMANOS_CAMPO[tamano] || TAMANOS_CAMPO.md,
            'kb-num pl-3 pr-[calc(var(--kb-sufijo,0px)_+_var(--spacing)*3)] text-right',
          )}
          {...resto}
        />
        {sufijo ? (
          <span className="kb-label pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            {sufijo}
          </span>
        ) : null}
      </div>

      {listaSugeridos.length > 0 ? (
        <div
          role="group"
          id={idSugeridos}
          aria-label={etiqueta ? `Valores rápidos de ${etiqueta}` : 'Valores rápidos'}
          className="flex flex-wrap items-center gap-1 pt-1"
        >
          {listaSugeridos.map((sugerido) => (
            <Detente
              key={sugerido}
              tamano="sm"
              marca="presion"
              deshabilitado={deshabilitado}
              activo={valor !== null && valor !== undefined && Math.abs(valor - sugerido) < 1e-9}
              onClick={() => alElegirSugerido(sugerido)}
              title={`Usar ${mostrar(sugerido, decimales)}${unidad}`}
            >
              <span className="kb-num">{mostrar(sugerido, decimales)}</span>
            </Detente>
          ))}
        </div>
      ) : null}

      {ayuda ? (
        <p id={idAyuda} className="text-sm text-ink-3">
          {ayuda}
        </p>
      ) : null}

      {/* La región viva se monta SIEMPRE y solo cambia de contenido. Un nodo que
          aparece junto con su texto no se anuncia: el lector de pantalla tiene
          que haber estado observando la región antes del cambio, y los mensajes
          de este campo ("El desperdicio no puede ser negativo.") son justo los
          que hay que oír mientras se escribe, no solo al volver a enfocar. */}
      <p id={idError} role="alert" className={cx('text-sm text-error-ink', !mensaje && 'sr-only')}>
        {mensaje}
      </p>
    </div>
  )
}

export default CampoNumero
