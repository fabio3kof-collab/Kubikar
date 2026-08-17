/* =============================================================================
   Kubikar · Campo de texto
   -----------------------------------------------------------------------------
   Caja rectangular con filete de un píxel. Al enfocarse suma los cuatro ticks
   de registro de esquina (`.kb-ticks`) sobre el contorno de foco global, que no
   se anula nunca: el foco es una marca impresa, no un halo.

   El mensaje de error nombra el problema y queda enlazado por aria-describedby,
   de modo que el lector de pantalla lo anuncia junto al campo y no como un
   texto suelto en la página.
   ============================================================================ */

import { useId, useState } from 'react'
import { Rotulo } from './Rotulo.jsx'

/**
 * @param {...(string|false|null|undefined)} partes
 * @returns {string}
 */
function cx(...partes) {
  return partes.filter(Boolean).join(' ')
}

/** Alturas mínimas del control; en puntero grueso suben al objetivo táctil. */
export const TAMANOS_CAMPO = {
  sm: 'min-h-[var(--size-touch-sm)] text-sm pointer-coarse:min-h-[var(--size-touch)]',
  md: 'min-h-[var(--size-touch-sm)] text-base pointer-coarse:min-h-[var(--size-touch)]',
}

/**
 * Clases del contorno de un control de entrada. Se comparten con CampoNumero y
 * con Selector para que los tres campos midan y pesen exactamente lo mismo.
 * @param {{error?: boolean, enfocado?: boolean, deshabilitado?: boolean}} estado
 * @returns {string}
 */
export function contornoCampo({ error = false, enfocado = false, deshabilitado = false } = {}) {
  return cx(
    'w-full border bg-block text-ink transition-[border-color] duration-[var(--duration-fast)] ease-damped',
    error ? 'border-error' : deshabilitado ? 'border-rule' : 'border-rule-strong',
    // Bajo el puntero el filete se oscurece, igual que el marco del Interruptor:
    // los cinco controles de entrada del producto responden igual al pasar por
    // encima. El error no se aclara por pasar el mouse.
    !error && !deshabilitado && 'hover:border-ink-3',
    enfocado && !deshabilitado && 'kb-ticks',
    // La diagonal de tachado es la marca de deshabilitado del sistema y vive en
    // `.kb-detent`; se toma prestada solo por eso.
    deshabilitado && 'kb-detent cursor-not-allowed text-ink-3',
  )
}

/**
 * @typedef {Object} PropsCampoTexto
 * @property {string}  [id]
 * @property {string}  [etiqueta]
 * @property {string}  [valor]
 * @property {(valor: string) => void} [onChange]
 * @property {string}  [ayuda]         una línea que explica qué se espera
 * @property {string}  [error]         mensaje de error; nombra problema y salida
 * @property {string}  [placeholder]
 * @property {boolean} [deshabilitado]
 * @property {boolean} [soloLectura]
 * @property {boolean} [requerido]
 * @property {'sm'|'md'} [tamano]
 * @property {import('react').Ref<HTMLInputElement>} [refCampo]
 * @property {string}  [className]
 * @property {string}  [claseCampo]
 */

/**
 * Campo de texto de una línea.
 * @param {PropsCampoTexto & Record<string, any>} props
 */
export function CampoTexto({
  id,
  etiqueta,
  valor = '',
  onChange,
  ayuda,
  error,
  placeholder,
  deshabilitado = false,
  soloLectura = false,
  requerido = false,
  tamano = 'md',
  refCampo,
  className,
  claseCampo,
  ...resto
}) {
  const idAuto = useId()
  const idCampo = id || `campo-${idAuto}`
  const idAyuda = `${idCampo}-ayuda`
  const idError = `${idCampo}-error`
  const [enfocado, setEnfocado] = useState(false)

  const descrito = [ayuda ? idAyuda : null, error ? idError : null].filter(Boolean).join(' ')

  return (
    <div className={cx('flex flex-col gap-1', className)}>
      {etiqueta ? (
        <Rotulo htmlFor={idCampo} tinta={enfocado ? 'rubrica' : 'normal'}>
          {etiqueta}
        </Rotulo>
      ) : null}

      <input
        id={idCampo}
        ref={refCampo}
        type="text"
        value={valor ?? ''}
        placeholder={placeholder}
        disabled={deshabilitado}
        readOnly={soloLectura}
        required={requerido}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={descrito || undefined}
        onFocus={() => setEnfocado(true)}
        onBlur={() => setEnfocado(false)}
        onChange={(evento) => onChange && onChange(evento.target.value)}
        className={cx(
          contornoCampo({ error: Boolean(error), enfocado, deshabilitado }),
          TAMANOS_CAMPO[tamano] || TAMANOS_CAMPO.md,
          'px-3',
          claseCampo,
        )}
        {...resto}
      />

      {ayuda ? (
        <p id={idAyuda} className="text-sm text-ink-3">
          {ayuda}
        </p>
      ) : null}

      {/* La región viva se monta SIEMPRE y solo cambia de contenido. Un nodo que
          aparece junto con su texto no se anuncia: el lector de pantalla tiene
          que haber estado observando la región antes del cambio. */}
      <p id={idError} role="alert" className={cx('text-sm text-error-ink', !error && 'sr-only')}>
        {error}
      </p>
    </div>
  )
}

export default CampoTexto
