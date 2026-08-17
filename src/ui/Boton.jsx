/* =============================================================================
   Kubikar · Botón
   -----------------------------------------------------------------------------
   Rectangular, sin radio, delimitado por un filete. Cuatro variantes y una sola
   regla de estado: lo presionado o activo se llena de naranja macizo con tinta
   hierro encima (`text-accent-onfill`), nunca blanco sobre naranja.

   El deshabilitado se tacha con la diagonal de `.kb-detent`. Se toma esa clase
   exclusivamente por su marca de tachado: el resto de las propiedades las gana
   la capa de utilidades, que se aplica después. La marca de estado deshabilitado
   del producto vive en un único lugar, base.css, y no se reimplementa acá.

   La transición cubre solo color de fondo, de filete y de tinta: comunica el
   cambio de estado y nada más. Ninguna propiedad de layout se anima.
   ============================================================================ */

import { LoaderCircle } from 'lucide-react'

/**
 * @param {...(string|false|null|undefined)} partes
 * @returns {string}
 */
function cx(...partes) {
  return partes.filter(Boolean).join(' ')
}

const BASE = cx(
  'relative inline-flex select-none items-center justify-center gap-2 border text-center',
  'transition-[background-color,border-color,color] duration-[var(--duration-fast)] ease-damped',
  'disabled:cursor-not-allowed disabled:border-rule disabled:bg-transparent disabled:text-ink-3',
)

/**
 * Alturas mínimas. Ningún objetivo baja de `--size-touch-sm`, que es el piso de
 * escritorio denso que declara el sistema; en puntero grueso todo sube a
 * `--size-touch`. Lo que separa `sm` de `md` es el relleno horizontal y el
 * registro de texto, no el tamaño del blanco.
 */
const TAMANOS = {
  sm: 'min-h-[var(--size-touch-sm)] px-3 text-sm pointer-coarse:min-h-[var(--size-touch)]',
  md: 'min-h-[var(--size-touch-sm)] px-4 text-base pointer-coarse:min-h-[var(--size-touch)]',
}

/** Cuando el botón es solo icono se cuadra al mismo alto. */
const TAMANOS_ICONO = {
  sm: 'min-h-[var(--size-touch-sm)] min-w-[var(--size-touch-sm)] px-0 pointer-coarse:min-h-[var(--size-touch)] pointer-coarse:min-w-[var(--size-touch)]',
  md: 'min-h-[var(--size-touch-sm)] min-w-[var(--size-touch-sm)] px-0 pointer-coarse:min-h-[var(--size-touch)] pointer-coarse:min-w-[var(--size-touch)]',
}

const VARIANTES = {
  primaria: cx(
    'border-accent-hover bg-accent text-accent-onfill',
    'enabled:hover:bg-accent-hover enabled:active:bg-accent-hover',
  ),
  secundaria: cx(
    'border-rule-strong bg-transparent text-ink',
    'enabled:hover:bg-margin-deep',
    'enabled:active:border-accent-hover enabled:active:bg-accent enabled:active:text-accent-onfill',
  ),
  fantasma: cx(
    'border-transparent bg-transparent text-ink-2',
    'enabled:hover:bg-margin-deep enabled:hover:text-ink',
    'enabled:active:border-accent-hover enabled:active:bg-accent enabled:active:text-accent-onfill',
  ),
  peligro: cx(
    'border-error bg-transparent text-error-ink',
    'enabled:hover:bg-error-soft',
    'enabled:active:border-accent-hover enabled:active:bg-accent enabled:active:text-accent-onfill',
  ),
}

/** Estado sostenido: el botón queda macizo en naranja mientras dura. */
const ACTIVO = 'border-accent-hover bg-accent text-accent-onfill enabled:hover:bg-accent-hover'

/**
 * @typedef {Object} PropsBoton
 * @property {import('react').ReactNode} [children]
 * @property {'primaria'|'secundaria'|'fantasma'|'peligro'} [variante]
 * @property {'sm'|'md'} [tamano]
 * @property {import('react').ComponentType<any>} [icono]     icono de lucide-react
 * @property {boolean} [iconoAlFinal]   pone el icono a la derecha del rótulo
 * @property {boolean} [soloIcono]      cuadra el botón; exige etiquetaAccesible
 * @property {string}  [etiquetaAccesible]  solo se emite si no hay texto visible
 * @property {boolean} [cargando]       muestra el testigo de trabajo y bloquea
 * @property {boolean} [activo]         estado sostenido, se emite como aria-pressed
 * @property {boolean} [bloque]         ocupa todo el ancho disponible
 * @property {boolean} [deshabilitado]
 * @property {string}  [className]
 */

/**
 * Botón del sistema.
 * @param {PropsBoton & Record<string, any>} props
 */
export function Boton({
  children,
  variante = 'secundaria',
  tamano = 'md',
  icono: Icono,
  iconoAlFinal = false,
  soloIcono = false,
  etiquetaAccesible,
  cargando = false,
  activo = false,
  bloque = false,
  deshabilitado = false,
  type = 'button',
  className,
  ...resto
}) {
  const inerte = deshabilitado || cargando
  const escalaTamano = soloIcono ? TAMANOS_ICONO : TAMANOS
  const pinta = activo ? ACTIVO : VARIANTES[variante] || VARIANTES.secundaria

  // El testigo de trabajo reemplaza al icono para que el botón no cambie de
  // ancho al empezar a trabajar: la caja se queda quieta, solo cambia la marca.
  const IconoVisible = cargando ? LoaderCircle : Icono
  const marca = IconoVisible ? (
    <IconoVisible
      size={16}
      strokeWidth={1.5}
      aria-hidden="true"
      className={cx('shrink-0', cargando && 'kb-testigo animate-spin')}
    />
  ) : null

  // El nombre accesible lo da el texto visible cuando lo hay. Ponerle además un
  // `aria-label` distinto rompe el control por voz: quien dice "Exportar JSON"
  // no acciona un botón que se llama "Exportar proyecto a JSON". Solo se emite
  // cuando no hay texto que leer.
  const sinTexto = soloIcono || !children
  const nombreAccesible = sinTexto ? etiquetaAccesible : undefined

  return (
    <button
      type={type}
      disabled={inerte}
      aria-busy={cargando ? 'true' : undefined}
      aria-pressed={activo ? 'true' : undefined}
      aria-label={nombreAccesible}
      className={cx(
        BASE,
        escalaTamano[tamano] || escalaTamano.md,
        pinta,
        bloque && 'w-full',
        // La diagonal de tachado es la marca de deshabilitado del sistema y
        // vive en `.kb-detent`; se toma prestada solo por eso.
        inerte && 'kb-detent',
        className,
      )}
      {...resto}
    >
      {!iconoAlFinal ? marca : null}
      {!soloIcono && children ? <span>{children}</span> : null}
      {iconoAlFinal ? marca : null}
    </button>
  )
}

export default Boton
