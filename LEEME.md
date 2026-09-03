# Rutina

App personal de entrenamiento. PWA, sin build ni dependencias, local-first, con
respaldo en Supabase.

**En línea:** https://arguinluwork-code.github.io/rutina/

## Desplegar

GitHub Pages sirve la rama `main` desde la raíz. Cada `git push` la actualiza
en un minuto. No hay build: son los archivos tal cual.

Después de un cambio en el código conviene subirle el número a `CACHE` en
`sw.js` (`rutina-v3` → `rutina-v4`), porque si no los teléfonos que ya la
tienen instalada siguen con la versión vieja del caché.

## Correrla local

```
node serve.js
```

Imprime la dirección de tu PC en la red local. Abrí esa dirección en Safari
desde el iPhone (misma wifi) y **Compartir → Agregar a pantalla de inicio**.
Queda sin barra de navegador.

Sobre `http://` en la red local anda todo salvo el caché offline: el service
worker solo se registra sobre `https` o `localhost`. Para tenerlo offline de
verdad hay que servirla por https (Caddy, ngrok, o subirla a cualquier hosting
estático — son archivos sueltos, no hay build).

## Cómo guarda los datos

Cada cambio se escribe **sincrónicamente en localStorage** y en diferido en
IndexedDB. Al abrir gana la copia más nueva. El write sincrónico es lo que hace
que matar la app desde el multitarea no pierda nada.

Además pide `navigator.storage.persist()` para que iOS no desaloje los datos, y
antes de toda operación destructiva (importar, restaurar, borrar) guarda una
copia de seguridad recuperable desde Datos.

## Archivos

```
index.html  styles.css       armazón y sistema de diseño
fonts/                       Archivo variable, servida local (no depende de Google)
serve.js                     servidor estático para la red local
sw.js  manifest.webmanifest  instalación y offline
hacer-iconos.js              regenera los PNG del ícono
scripts/generar-iconos.js    regenera src/icons.js desde lucide-static

src/db.js          persistencia, copias de seguridad
src/data.js        modelo, rutina inicial, selectores y cuentas
src/session.js     motor de la sesión: cursor, deshacer, descanso
src/ui.js          helpers de DOM, formato, audio, wake lock
src/charts.js      gráficos en SVG
src/app.js         estado global y navegación
src/musculos.js    taxonomía y objetivos semanales, con su fundamento
src/nube.js        respaldo en Supabase, sin dependencias
src/icons.js       íconos de Lucide (ISC), empaquetados
src/s-*.js         una pantalla por archivo
```

Nada se carga desde la red en tiempo de ejecución: ni tipografías, ni íconos,
ni librerías. Es lo que hace que ande sin conexión de verdad.

## Decisiones que conviene conocer

- **El ejercicio es una entidad de catálogo con id estable.** La rutina solo lo
  referencia. Renombrarlo no parte el historial.
- **La rutina se versiona append-only.** Editar un día es un borrador; guardar
  crea una versión con fecha y un resumen del cambio. "Volver a la versión 2"
  crea la versión 5 con ese contenido, no borra nada.
- **El descanso se guarda como instante de fin, no como contador.** Si matás la
  app y volvés, el tiempo que queda es el real. Pide wake lock para que la
  pantalla no se apague, y avisa con sonido más un cambio de color a pantalla
  completa. En iOS no hay vibración desde el navegador.
- **La precarga de peso es por índice de serie**: la serie 2 de hoy arranca con
  la serie 2 de la última vez. Si la rutina creció, copia la última disponible.
- **Deshacer** es una pila lineal de 10 pasos, persistida con la sesión, que se
  limpia al terminarla.
- **Los días son nombres, no días de la semana.** La adherencia se mide contra
  un objetivo de sesiones por semana (editable en Rutina).
- **El gráfico semanal cuenta series efectivas por músculo**, no kilos:
  primario suma 1, secundario 0.5. Es la métrica que se usa para hipertrofia.
- **El esfuerzo objetivo es un rango** (`rirMin`–`rirMax`). Cuando los dos
  valores coinciden se muestra un número solo: "2 en el tanque"; si difieren,
  "1-2 en el tanque".
- **Hay tres tipos de carga.** En `asistido` el número de la máquina es la
  ayuda, así que menos es mejor: el stepper se rotula "Asistencia" y la ficha
  muestra "Menos ayuda" en vez de "Máximo". Mostrar el máximo ahí sería decir
  exactamente lo contrario de lo que pasó.

## Migración de datos

`VERSION_DATOS` en `src/data.js` marca el formato. Al abrir, si la base guardada
es más vieja:

- sin sesiones registradas, se reemplaza por la semilla nueva (no hay nada que perder);
- con sesiones, **no se toca**: se guarda una copia de seguridad, se sube el
  número de versión y la rutina vieja queda como está. Los cambios de rutina
  son decisión tuya, no de una actualización.

## Respaldo en la nube

Proyecto de Supabase `rutina` (`iaryulfcoisvkytfbuhk`, São Paulo). El esquema
vive en `supabase/migrations/` y se aplica con `supabase db push`.

La app **no deja de ser local-first**: el teléfono sigue siendo la fuente de
verdad mientras entrenás, porque en el gimnasio no hay señal. Supabase es el
respaldo durable y la capa de análisis.

- **Cuenta anónima al vuelo**, sin pantalla de registro ni contraseña. Vincular
  un mail es opcional y sirve para recuperar los datos en otro teléfono.
- **Respaldar** sube todo por upsert y marca como borrado lo que ya no está
  acá. **Traer** baja todo y reconstruye, siempre preguntando antes y con una
  copia de seguridad previa.
- **RLS en todas las tablas**, verificado: sin sesión no se ve una sola fila, y
  un usuario no puede leer ni escribir las de otro. Con sign-in anónimo activado
  todo usuario lleva el rol `authenticated`, así que ninguna política confía en
  el rol solo: todas comparan contra `auth.uid()`.
- **`vista_series`** con `security_invoker`, para consultar volumen por semana
  en SQL sin saltear los permisos.
- El cliente (`src/nube.js`) **no usa supabase-js**: traerlo de un CDN rompería
  la propiedad de que la app no pide nada a la red en ejecución, que es lo que
  la hace andar sin conexión. Contra PostgREST y GoTrue alcanza con fetch.

La clave `anon` está en el código del cliente a propósito: es pública por
diseño y lo que protege los datos es RLS. La `service_role` no está en el repo
y no debe estarlo nunca.

## Lo que no está construido

- **Sincronización automática entre dos teléfonos.** Hoy es respaldo y
  restauración explícitos, que es lo que corresponde a un usuario con un
  teléfono. Un motor de conflictos sería complejidad que nunca se ejercita.
- **Superseries**, deliberadamente fuera de alcance.
