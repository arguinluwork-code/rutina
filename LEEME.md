# Rutina

App personal de entrenamiento. PWA, sin build, sin dependencias, sin backend.

## Correrla

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
serve.js                     servidor estático para la red local
sw.js  manifest.webmanifest  instalación y offline
hacer-iconos.js              regenera los PNG del ícono

src/db.js          persistencia, copias de seguridad
src/data.js        modelo, rutina inicial, selectores y cuentas
src/session.js     motor de la sesión: cursor, deshacer, descanso
src/ui.js          helpers de DOM, formato, audio, wake lock
src/charts.js      gráficos en SVG
src/app.js         estado global y navegación
src/s-*.js         una pantalla por archivo
```

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

## Lo que no está construido

- **Respaldo en la nube.** Necesita un servidor; la pantalla de Datos lo dice
  en vez de simularlo. La red de seguridad es exportar el archivo.
- **Superseries**, deliberadamente fuera de alcance.
