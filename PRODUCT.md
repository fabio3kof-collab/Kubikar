# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Definido por el usuario: React + Tailwind CSS, tokens de diseño como variables CSS consumidas desde la configuración de Tailwind, lienzo en SVG (no canvas), iconos con `lucide-react`, persistencia con localStorage del navegador encapsulada tras una única capa de acceso a datos asíncrona. Componentes propios; primitivas de terceros solo si son sin estilo y se alinean a los tokens. Sin backend, sin base de datos remota, sin autenticación, sin llamadas a APIs externas ni carga de recursos por red en tiempo de ejecución.

## Users

Usuarios primarios: constructores civiles, presupuestadores y jefes de obra chilenos.

Situación de uso mixta: escritorio en oficina y notebook o tablet en faena. En faena hay luz de día fuerte, pantalla a brillo alto y a veces las manos ocupadas. El trabajo que hacen es cubicar: obtener, a partir de la planta de un recinto, la cantidad de material que hay que comprar para ejecutar una partida.

Valoran la precisión numérica y la velocidad de ingreso por sobre la estética. Necesitan poder auditar el número: ver la cantidad teórica antes del redondeo y del desperdicio, no solo el resultado final.

## Product Purpose

Kubikar convierte una planta dibujada sobre una grilla en un listado de materiales cubicado. El usuario dibuja el polígono de un recinto uniendo puntos, ajusta la geometría con precisión numérica, elige un módulo de cálculo y obtiene la cantidad de material con su desperdicio aplicado.

Un proyecto contiene uno o varios recintos. Cada recinto tiene su propio polígono, su propia configuración de cálculo y su propio resultado. El proyecto tiene además una vista de consolidado que suma los materiales de todos los recintos.

Éxito: el usuario cubica un recinto completo más rápido que en una planilla, confía en el número porque puede auditarlo, y se lleva el resultado en CSV para Excel o en JSON para integrarlo después a la plataforma Karbec.

## Positioning

El mecanismo propio es el dibujo geométrico como entrada del cálculo, combinado con un núcleo modular de partidas. La geometría se dibuja una vez y sirve a cualquier módulo de cálculo: el mismo polígono alimenta hoy el módulo de cielo falso y mañana los de tabiquería, pisos, pintura y cerámicos, sin rehacer la planta.

El segundo diferencial es la auditabilidad: cada línea de material muestra la cantidad teórica antes del redondeo y del desperdicio, y la nota de cálculo que la produjo. No es una caja negra que entrega un número.

## Operating Context

Flujo de trabajo confirmado:

1. El usuario crea un proyecto y le da nombre.
2. Agrega un recinto y lo nombra (por ejemplo "Living", "Dormitorio 1").
3. Dibuja el polígono del recinto en el lienzo de grilla. Cada clic agrega un vértice y traza un segmento desde el vértice anterior, como una polilínea. El polígono se cierra al hacer clic sobre el primer vértice o con el botón "Cerrar polígono". Mientras la figura está abierta no se puede calcular.
   - El trazo en curso se puede acotar a mano, que es como se mide en obra: el puntero define la **dirección** y el teclado el **largo**. Con un trazo empezado, escribir una cifra abre el campo de cota junto al puntero, la dirección queda congelada en la que marca el trazo, Enter marca el vértice a esa distancia exacta —sin imán de grilla: quien escribe 247 pide 247— y Escape abandona la cota. La cifra en curso viaja pegada al puntero, no colgada del medio del trazo, para que acercar el zoom no la mande fuera del recuadro justo cuando hay que leerla.
4. Ajusta la geometría con precisión: selecciona un vértice y edita sus coordenadas numéricamente, o selecciona un segmento y escribe su longitud exacta.
5. Elige el módulo de cálculo y configura sus parámetros y los materiales que va a usar desde la biblioteca de materiales.
6. Revisa el listado de materiales con cantidades y el consolidado del proyecto completo.
7. Exporta el proyecto en JSON y el listado de materiales en CSV.

Entorno: navegador de escritorio en oficina y notebook o tablet en faena. Sin conexión asegurada. El trabajo no se puede perder al recargar la página.

Documentos y materiales reales del contexto: plantas de arquitectura, listados de materiales por partida, catálogos de planchas y perfilería del mercado chileno, planillas de presupuesto en Excel con configuración regional chilena (separador de columnas punto y coma, decimales con coma).

## Capabilities and Constraints

Alcance funcional confirmado:

- Multi-proyecto con selector en la barra superior, nombre de proyecto editable, y vista de apertura para crear, abrir o importar un proyecto. Decisión del usuario, agosto 2026.
- Sistema de unidades: selector de unidad activa entre milímetros, centímetros y metros. Toda la geometría se almacena internamente en una unidad base única, milímetros. Cambiar la unidad activa solo cambia cómo se muestran e ingresan los valores, en tiempo real, sin alterar ni escalar la figura. El área se muestra siempre en metros cuadrados y las longitudes lineales en metros lineales en la sección de resultados, independiente de la unidad activa de dibujo.
- Biblioteca de materiales propia y compartida entre proyectos, con tipos Plancha, Barra o perfil, y Pieza o accesorio. Se precarga con materiales típicos del mercado chileno, editables. La pieza declara para qué sirve —fijación a plancha, fijación metal-metal, colgante o sin uso específico—, y ese uso filtra los selectores del módulo para que un parámetro de tornillo no ofrezca alambre. La barra declara además dos datos de corte: el traslapo que consume cada empalme y el retazo mínimo aprovechable, bajo el cual el sobrante es descarte y no se reutiliza en otra corrida. Son propiedad del perfil, no del recinto, porque un omega y un ángulo perimetral se comportan distinto y el dato se edita una vez.
- Módulos de cálculo con contrato único y registro central. El núcleo renderiza el panel de parámetros automáticamente a partir del esquema declarado por el módulo, sin código específico por módulo en la interfaz.
- Primer módulo activo: cielo falso de acero galvanizado, planchas más perfilería omega. Quedan registrados y visibles como deshabilitados, con el texto "próximamente": Tabiquería, Pisos, Pintura y Cerámicos.
- Método de cálculo: la perfilería sale de la planta. Los ejes se recortan contra el polígono y entregan corridas de largo real; el perfil perimetral usa los lados del polígono. La plancha es la excepción y se cubica por los metros cuadrados que cubre —área neta del recinto dividida por el área útil de la plancha, o sea su ancho y su largo menos el traslapo—, porque contar las posiciones de la retícula que tocan el recinto cobraba entera una posición que entraba cinco centímetros y sobredimensionaba la compra; en obra ese rendimiento se recupera cortando, y lo que el corte no recupera lo cubre el desperdicio, que por eso arranca en 10% para las planchas y en 5% para el resto. Decisión del usuario, agosto 2026. Los tornillos son dos y se cuentan donde van: el drywall punta fina sobre los metros lineales de perfilería, que es donde se atornilla la plancha, y el punta broca cabeza de lenteja por punto de unión metal-metal, o sea los dos extremos de cada corrida más un tornillo por colgante. Solo el colgante sale de una densidad por metro cuadrado. Sobre eso se aplica el porcentaje de desperdicio, que cubre rotura y error de medida: en la barra ya no carga con el retazo, que se cuenta aparte en el reparto, y en la plancha sí carga con el corte contra los bordes del recinto, que es lo que la cubicación por área no cuenta. Cada resultado muestra la cantidad teórica antes del redondeo y del desperdicio.
- Deshacer y rehacer para las operaciones de dibujo, con atajos de teclado, y tecla Escape para cancelar el trazado en curso.
- Exportación a CSV con separador punto y coma y decimales con coma, para abrir correctamente en Excel en configuración regional chilena.
- Exportación a JSON del proyecto completo con esquema estable y versionado.
- Impresión en papel de dos documentos, con botón propio en cada vista: el consolidado como lista de compra —lo que quedó fuera, la tabla con su total y la composición por recinto—, y el recinto como lámina de terreno —la planta con su despiece y sus cotas, el listado de materiales y la memoria de cálculo de cada línea—. Decisión del usuario, agosto 2026.

Restricciones técnicas confirmadas:

- Sin backend, sin base de datos remota, sin autenticación, sin llamadas a APIs externas ni carga de recursos por red en tiempo de ejecución.
- Toda la persistencia es local en el navegador y sobrevive al recargar la página.
- Toda la persistencia queda encapsulada tras una única capa de acceso a datos con métodos asíncronos, de modo que el almacenamiento local se pueda reemplazar más adelante por llamadas a la API de la plataforma Karbec cambiando solo esa capa, sin tocar la interfaz ni los módulos de cálculo. No se dispersan llamadas de almacenamiento por los componentes.
- No se implementa optimización de cortes. La cantidad sale de las corridas y de las posiciones reales sobre la planta, con el retazo corto descartado según lo que declara el material, pero no se empaqueta buscando el óptimo, no se mezclan materiales distintos, no se numeran las piezas y no se reutiliza retazo entre recintos. La heurística es declarada y reconstruible a mano: las piezas se cortan de mayor a menor y cada una entra en la primera barra abierta donde quepa. Decisión del usuario, agosto 2026, después de que el método por área dejara material corto en obra.
- El lienzo dibuja el reparto de planchas y de ejes de perfilería dentro del polígono, como referencia de replanteo para el trabajo en terreno. Decisión del usuario, agosto 2026. **En la perfilería es el mismo dato del que sale la cubicación**: el módulo resuelve el reparto una sola vez y de ahí leen tanto los metros de perfil como el dibujo, de modo que lo que se compra y los ejes que se ven no pueden divergir. **En las planchas el dibujo es solo replanteo**: la retícula muestra cómo se instalan, pero la cantidad se cubica por área, así que las posiciones dibujadas son más que las planchas compradas y la diferencia es el recorte que en terreno se reaprovecha. Sigue sin numerar cortes ni rotular piezas. El módulo lo declara con `trazar(ctx)` y el lienzo lo recorta contra la planta; la orientación la define el parámetro "Dirección del perfil", que mueve las cantidades de perfilería porque cambia cómo se reparten las corridas, y mueve el replanteo de planchas sin mover su cantidad, porque esa sale del área. Se apaga con dos interruptores independientes en la barra del lienzo, junto a "ajustar vista" —uno para las piezas de material y otro para los ejes de perfilería, rotulados por el propio módulo—: arrancan encendidos y la elección se recuerda entre sesiones, igual que el imán y el modo ortogonal.
- No se agrega login, usuarios, roles ni sincronización en la nube.
- No se usan librerías de CAD ni motores de geometría externos. El área se calcula con la fórmula del área de Gauss sobre la lista de vértices.

Terminología obligatoria, español de Chile y vocabulario de construcción chilena: recinto, cubicación, plancha, perfil, tabica, desperdicio, partida, vano, faena, cota, traslapo, colgante, ángulo perimetral, autoperforante.

Moneda: pesos chilenos sin decimales, separador de miles con punto. Decisión del usuario, agosto 2026. El precio unitario es opcional por material; cuando no existe, la columna de costo queda vacía y no se inventa ningún valor.

## Brand Commitments

Nombre del producto: Kubikar. Pertenece a Karbec.

Identidad heredada de Karbec, vinculante: azul marino #1A237E como color institucional y estructural, naranja #F39200 para la acción primaria y el estado seleccionado o activo, verde #4CAF50 para confirmación y resultado válido.

Voz de la interfaz: directa y técnica, en español de Chile, sin entusiasmo comercial y sin signos de exclamación.

Personalidad declarada por el usuario en tres palabras: preciso, sobrio, de terreno.

Modo de la superficie: operar. El diseño sirve a la tarea, no persuade ni vende.

## Evidence on Hand

No hay activos gráficos entregados: no hay logotipo, fotografías, capturas ni tipografía corporativa en el repositorio. La única identidad disponible son los tres colores de Karbec listados arriba.

No hay clientes, testimonios, benchmarks, precios de venta ni datos de uso reales. Ningún trabajo futuro debe fabricarlos.

Los materiales precargados en la biblioteca son ejemplos editables de referencia del mercado chileno, no un catálogo de precios oficial: plancha de yeso-cartón 1200 x 3000 mm, plancha de yeso-cartón 1200 x 2400 mm, volcanita RH 1200 x 2400 mm, perfil Omega 38 x 3000 mm de acero galvanizado, perfil Omega 38 x 6000 mm, ángulo perimetral 25 x 25 x 3000 mm, tornillo drywall punta fina 6 x 1", tornillo punta broca cabeza lenteja 8 x 1/2", alambre galvanizado #14. Se cargan sin precio unitario.

## Product Principles

1. **El número es auditable.** Toda cantidad final va acompañada de su cantidad teórica y de la nota de cálculo que la produjo. Nunca se muestra un resultado que el usuario no pueda reconstruir a mano.
2. **La geometría se dibuja una vez y sirve a todos los módulos.** El polígono es el dato durable; el módulo de cálculo es intercambiable sobre él.
3. **Agregar un módulo de cálculo no toca el núcleo ni la interfaz.** El módulo declara su esquema de parámetros y el núcleo lo renderiza. Si un módulo nuevo obliga a escribir código de interfaz, el contrato falló.
4. **No se inventan valores.** Sin precio unitario no hay costo. Sin polígono cerrado no hay cálculo. Un dato ausente se declara ausente, no se rellena con cero.
5. **La persistencia es una sola puerta.** Hoy es localStorage, mañana es la API de Karbec, y el cambio ocurre en un solo archivo.

## Accessibility & Inclusion

Requisito confirmado: contraste mínimo AA en texto y en todos los estados de los controles.

La grilla y las cotas del lienzo deben seguir siendo legibles con brillo alto de pantalla, porque el uso en faena ocurre con luz de día fuerte.

Los objetivos táctiles de vértices y controles deben ser suficientemente grandes para uso en tablet, porque el mismo usuario opera la app con el dedo en obra y con mouse en oficina.
