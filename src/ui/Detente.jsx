/* =============================================================================
   Kubikar · Detente
   -----------------------------------------------------------------------------
   El botón cuadrado del riel. Es la pieza de estado del sistema: filete en
   reposo, relleno macizo naranja al quedar activo, tachado por una diagonal
   cuando está deshabilitado. Todo ese vocabulario vive en la clase `.kb-detent`
   de base.css y este componente no repinta ni un color: solo decide qué
   atributo lleva el estado, porque de eso depende cómo lo lee un lector de
   pantalla.

     marca='estado'    data-state="on"        interruptor de herramienta
     marca='seleccion' aria-selected="true"   pestaña dentro de una tablist
     marca='presion'   aria-pressed="true"    valor rápido, alternador

   Los tres selectores están en `.kb-detent`, así que el aspecto es idéntico y
   la semántica es la correcta en cada caso.
   ============================================================================ */

/**
 * @param {...(string|false|null|undefined)} partes
 * @returns {string}
 */
function cx(...partes) {
  return partes.filter(Boolean).join(' ')
}

/**
 * Alto y ancho mínimo por tamaño. Ningún detente baja de `--size-touch-sm`, que
 * es el piso de escritorio denso del sistema; en puntero grueso todo sube a
 * `--size-touch`. `sm` y `md` se diferencian por el relleno horizontal, no por
 * el tamaño del blanco: el riel es la navegación principal del aparato y no
 * puede ofrecer un objetivo más chico que el que el propio proyecto declara.
 */
const TAMANOS = {
  sm: 'min-h-[var(--size-touch-sm)] min-w-[var(--size-touch-sm)] px-2 pointer-coarse:min-h-[var(--size-touch)] pointer-coarse:min-w-[var(--size-touch)]',
  md: 'min-h-[var(--size-touch-sm)] min-w-[var(--size-touch-sm)] px-3 pointer-coarse:min-h-[var(--size-touch)] pointer-coarse:min-w-[var(--size-touch)]',
}

/**
 * @typedef {Object} PropsDetente
 * @property {import('react').ReactNode} [children]  rótulo corto del detente
 * @property {import('react').ComponentType<any>} [icono]  icono de lucide-react
 * @property {boolean} [activo]
 * @property {boolean} [deshabilitado]
 * @property {'estado'|'seleccion'|'presion'} [marca]  atributo que porta el estado
 * @property {'sm'|'md'} [tamano]
 * @property {'horizontal'|'vertical'} [orientacion]   apila icono y rótulo
 * @property {string}  [etiquetaAccesible]  obligatorio si solo lleva icono; con
 *                                          rótulo visible manda el rótulo
 * @property {'error'|null} [aviso]   escuadra de registro en la esquina
 * @property {() => void} [onClick]
 * @property {string}  [className]
 */

/**
 * Detente cuadrado del riel.
 * @param {PropsDetente & Record<string, any>} props
 */
export function Detente({
  children,
  icono: Icono,
  activo = false,
  deshabilitado = false,
  marca = 'estado',
  tamano = 'md',
  orientacion = 'horizontal',
  etiquetaAccesible,
  aviso = null,
  onClick,
  type = 'button',
  className,
  ...resto
}) {
  const estado = {}
  if (marca === 'seleccion') estado['aria-selected'] = activo ? 'true' : 'false'
  else if (marca === 'presion') estado['aria-pressed'] = activo ? 'true' : 'false'
  else estado['data-state'] = activo ? 'on' : 'off'

  // Misma regla que en `Boton`: si el detente lleva rótulo visible, ese rótulo
  // ES su nombre. Un `aria-label` que dice otra cosa rompe el control por voz,
  // porque quien lee "mm" en pantalla no puede accionar un botón que se llama
  // "Trabajar en milímetros". El contexto lo da el grupo que los envuelve.
  const nombreAccesible = children ? undefined : etiquetaAccesible

  return (
    <button
      type={type}
      disabled={deshabilitado}
      onClick={deshabilitado ? undefined : onClick}
      aria-label={nombreAccesible}
      className={cx(
        'kb-detent inline-flex select-none items-center justify-center gap-2 py-1',
        orientacion === 'vertical' && 'flex-col gap-1',
        TAMANOS[tamano] || TAMANOS.md,
        className,
      )}
      {...estado}
      {...resto}
    >
      {Icono ? <Icono size={16} strokeWidth={1.5} aria-hidden="true" /> : null}
      {children ? <span className="kb-label text-current">{children}</span> : null}

      {/* Escuadra de registro en la esquina superior derecha: dos filetes, no un
          relleno, para que se lea igual sobre el detente en reposo y sobre el
          naranja macizo del seleccionado. Lo que dice la escuadra tiene que
          venir además en el nombre accesible del detente: acá es tinta. */}
      {aviso === 'error' ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-0.5 right-0.5 block h-2 w-2 border-t border-r border-error-ink"
        />
      ) : null}
    </button>
  )
}

export default Detente
