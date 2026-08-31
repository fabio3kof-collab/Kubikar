# Publicación del entregable y aviso de versión · diseño

Fecha: 2026-08-31

## El problema

Kubikar se trabaja desde varios computadores y se usa en faena. Hoy no hay
entregable: `npm run build` deja un `dist/` con `index.html` más una carpeta de
assets, y `dist/` está en `.gitignore`. Para llevar Kubikar a un PC de obra hay
que copiar una carpeta entera y confiar en que las rutas relativas sobrevivan.

De ahí salen tres problemas encadenados:

1. **No hay un archivo que se abra.** El jefe de obra necesita un doble clic, no
   una carpeta con `assets/`.
2. **Una copia no sabe si está vieja.** Ni la aplicación ni el usuario conocen su
   propia versión, así que una copia desactualizada trabaja con un cálculo viejo
   sin que nadie lo note. En un producto donde el error se paga con material
   comprado de menos, eso importa.
3. **Publicar desde dos PCs se pisa solo.** Si el otro computador publicó y este
   clon está atrasado, el push se rechaza después de haber gastado el build; y si
   el número de versión no vuelve a git, los dos PCs publican el mismo número.

AeroPlan ya resolvió esto. Este diseño lo trae a Kubikar, con una diferencia de
fondo que simplifica el resultado.

## La diferencia con AeroPlan: un solo repo

AeroPlan necesita **dos** repositorios porque su código es privado. El chequeo de
versión corre desde `file://` y solo puede leer un archivo que no pida token; un
token de lectura horneado en el entregable sería un token publicado. Por eso
AeroPlan mantiene un repo público aparte, `AeroPlan-releases`, con el entregable
y el manifiesto.

**El repositorio de Kubikar ya es público.** El entregable y su manifiesto se
publican en el mismo repo, y de ahí se sigue todo lo demás: un clon, un `fetch`,
un commit, un push. Desaparece el paso de AeroPlan que commitea el número de
versión en el otro repo, porque existía solo por tener dos.

## Decisiones

1. **La carpeta contenedora muestra un solo archivo.** `Desktop\Kubikar\` pasa a
   contener `Kubikar-codigo\` —el repositorio— y un único `Kubikar.html` arriba:
   el que de verdad se abre. El build lo escribe en `../Kubikar.html` desde un
   plugin de Vite. La hermandad de esas dos rutas es una dependencia real del
   build, no una convención, y queda escrita en `CLAUDE.md` para que nadie mueva
   la carpeta a ciegas.

2. **El entregable es un solo archivo autocontenido.** `vite-plugin-singlefile`
   más `assetsInlineLimit` alto: el JS, el CSS y la fuente Source Serif 4 entran
   embebidos, y `base: './'` se mantiene para que funcione desde `file://`.

3. **El contrato de dirección sobrevive al build, y se verifica.** `index.html`
   lleva el CONTRATO DE DIRECCION como comentario HTML, y `vite.config.js` ya
   declara que debe poder auditarse en producción. El plugin del entregable falla
   el build si el comentario no está en el HTML final: un requisito que solo se
   comprueba a mano es un requisito que se pierde.

4. **La versión se hornea en el build.** `define` inyecta `__APP_VERSION__` desde
   `package.json` y `__BUILD_DATE__`. Ambas se leen con guarda `typeof` para que
   el módulo siga siendo importable fuera de un bundle de Vite, que es lo que
   necesitan los tests de `node --test`.

5. **El chequeo vive en `src/data/`, no en `src/core/`.** `core/` es el núcleo de
   cálculo —geometría, reparto, unidades— y es puro. La actualización es un dato
   que viene de afuera por la red; su lugar es `data/`, junto al repositorio y al
   driver de almacenamiento.

6. **`buscarActualizacion()` nunca lanza.** Sin red, con GitHub caído, con un 404
   o con un JSON roto devuelve `sin-conexion`. Kubikar se usa en faena: estar
   offline es el caso normal, no un error que reportarle al usuario.

7. **Las versiones se comparan por partes numéricas.** Como texto, `"1.10.0"` es
   menor que `"1.9.0"`, que es justo al revés.

8. **La descarga va por `fetch` → `Blob` → `<a download>`.** El atributo
   `download` se ignora en enlaces cross-origin: apuntar directo a
   `raw.githubusercontent.com` abriría el HTML como texto en vez de bajarlo.

9. **La aplicación no promete reemplazarse sola.** Una página web no puede
   escribir sobre el archivo que la abrió. El alcance máximo es dejar el
   `Kubikar.html` nuevo en Descargas y decir que el viejo se reemplaza a mano.

10. **`npm run publicar` sincroniza antes de compilar.** `git fetch` +
    `merge --ff-only` sobre el repo, *antes* del build, para no gastarlo en vano y
    para fallar temprano si no hay conexión o si el clon divergió. Este es el
    "auto pull": el paso que impide que dos computadores se pisen.

11. **Publicar corre las verificaciones del ciclo.** `npm test` y
    `npm run design:check` antes de compilar. AeroPlan no los tiene; Kubikar sí, y
    publicar un entregable que no pasa los tests contradice el `CLAUDE.md`. Si el
    detector de Impeccable no está instalado en ese PC —sale con código 2— avisa y
    sigue; si encuentra infracciones, se detiene.

## Arquitectura

### `vite.config.js`

- `define`: `__APP_VERSION__` (de `package.json`), `__BUILD_DATE__`.
- `viteSingleFile()` y `build.assetsInlineLimit` alto, `build.cssCodeSplit: false`.
- Plugin `entregableEnEspacioDeTrabajo`: en `closeBundle` verifica el contrato de
  dirección en `dist/index.html`, copia a `../Kubikar.html` e informa el peso.
- Se mantiene `minify: 'oxc'` y `base: './'`.

### `src/data/actualizaciones.js`

Módulo puro salvo por la red. No toca el DOM salvo para disparar la descarga, no
lee `localStorage` y no depende de la unidad activa.

```
REPO_PUBLICACION = 'fabio3kof-collab/Kubikar'
URL_MANIFIESTO   = raw.githubusercontent.com/<repo>/main/version.json
URL_DESCARGA     = raw.githubusercontent.com/<repo>/main/Kubikar.html

VERSION_ACTUAL, FECHA_BUILD          // horneadas, con guarda typeof
compararVersiones(a, b) -> -1|0|1
buscarActualizacion(timeoutMs = 5000)
  -> {estado:'al-dia', version}
   | {estado:'hay-nueva', manifiesto}
   | {estado:'sin-conexion'}
descargarActualizacion(url, onProgreso) // lanza; quien llama decide qué mostrar
```

El manifiesto es `{ version, fecha, notas, url }`.

### Preferencias

`kubikar.v1.preferencias` gana dos campos, por la puerta que ya existe
(`repo.js`; ningún componente habla con `storage.js`):

- `buscarActualizaciones` — por defecto `true`.
- `versionDescartada` — el número que el usuario ya vio y descartó.

### Interfaz

- **La versión** en `BarraSuperior`, junto a la marca, en registro de `Rotulo`,
  con la fecha de compilación en el `title`. Sin adorno.
- **`AvisoActualizacion`** — banda `Aviso` nivel `info` bajo la barra superior,
  el mismo patrón de `AvisoAlmacenamiento` pero **con cierre**. Aquella no se
  puede descartar porque descartarla sería perder trabajo; esta sí, porque una
  versión nueva no es una urgencia. Descartar guarda el número en
  `versionDescartada` y no vuelve a avisar por esa versión.
- El chequeo corre una vez al montar la aplicación.

### `scripts/publicar.mjs`

```
npm run publicar                        → 0.1.0 → 0.1.1
npm run publicar -- minor               → 0.2.0
npm run publicar -- 1.0.0               → versión explícita
npm run publicar -- --notas "Arregla X" → nota que verá el usuario
npm run publicar -- --si                → no preguntar antes del push
```

1. Sincroniza con GitHub: `fetch` + `merge --ff-only`. Descarta las sobras de una
   publicación cancelada —solo `Kubikar.html` y `version.json`, que se reescriben
   igual—; ante cualquier otro archivo sucio, se detiene y lo lista.
2. `npm test` y `npm run design:check`.
3. Sube el número en `package.json`, compila. Si el build falla, `package.json`
   vuelve a la versión anterior.
4. Escribe `Kubikar.html` y `version.json` en la raíz del repo.
5. Commit y push previa confirmación, con mensaje `Kubikar X.Y.Z — notas`.

`.gitignore` sigue ignorando `dist/`: lo que se versiona es el entregable de la
raíz, no la carpeta intermedia.

## Tests

`tests/actualizaciones.test.mjs`:

- `compararVersiones` ordena por partes numéricas: `"1.10.0"` es posterior a
  `"1.9.0"`; tolera cadenas vacías y largos distintos.
- `buscarActualizacion` no lanza y devuelve `sin-conexion` ante un `fetch` que
  rechaza, un 404, un JSON roto y un manifiesto sin `version`.
- Devuelve `hay-nueva` solo cuando el remoto es estrictamente posterior.

## Riesgos conocidos

- **El peso del entregable.** Con la fuente embebida, AeroPlan quedó en 2,2 MB.
  El de Kubikar se mide en el primer build y se informa.
- **Un HTML grande commiteado en cada versión** engorda el repositorio. Es el
  precio de que el entregable sea descargable sin token, y es el mismo que ya
  paga AeroPlan.

## Fuera de alcance

- Actualización automática en el disco: imposible desde una página web.
- Un panel de ajustes. Las preferencias nuevas no tienen interfaz propia; el
  descarte se hace desde la banda.
