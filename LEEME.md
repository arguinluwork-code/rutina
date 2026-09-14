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

## La rutina: cuatro roles, ocho bloques

La semana es **un bloque de cada rol**: empuje, tirón, brazos, piernas. Cada rol
tiene dos bloques hermanos con el **mismo perfil muscular** y distintos
ejercicios, así que elegir hermano cambia qué hacés, nunca cuánto recibe cada
músculo. Las **16 combinaciones posibles cierran los 16 músculos** dentro de su
objetivo, verificado por cálculo sobre las plantillas reales del código.

Antes eran seis bloques sueltos de los que elegías cuatro cualquiera: quince
sumas distintas, de las que cerraba **una**, y nueve de las veinte semanas de
tres días se pasaban de algún techo. No era cuestión de afinar números: con
bloques independientes el problema no tiene solución.

La regla que lo rompía: **ningún bloque puede llegar solo al techo semanal de un
músculo**. El Empuje viejo entregaba pecho 12, que es el máximo entero de la
semana en una sentada, así que cualquier pectoral agregado después se pasaba.
Ahora el bloque más cargado queda en 8 de 12.

- El **lateral aparece en los cuatro bloques** (5+3+6+3). Es el de mayor retorno
  y el único que no recibe nada indirecto: los press le pegan al anterior.
  Concentrarlo en un bloque hacía que saltear ese bloque lo hundiera.
- **Pecho 8 y dorsal 9 quedan en el piso a propósito.** Con 87 series de
  presupuesto y los brazos como prioridad, subirlos sale de los bíceps.
- El **hombro anterior recibe 4**, que es exactamente lo que dan los dos press
  solos. Cero trabajo directo.
- **Con tres días el que se saltea es Piernas**, y está verificado: los ocho
  músculos del tren superior siguen en rango y ninguno se pasa. Saltear Brazos
  deja bíceps en 9 de 16.
- **No hay quinto día.** Cuatro ya deja todo en el medio del rango.

El sugeridor de Inicio agrupa por rol y marca "Ya lo hiciste" cuando el rol de
la semana está cumplido, además de "La que más suma", "Mejor esperar" cuando un
músculo todavía se recupera y "Se pasa" cuando mandaría más series de sobra que
de déficit cubierto.

## La curva de crecimiento, y por qué es la misma para todos

En Rutina → Objetivos semanales cada músculo muestra dos cosas superpuestas que
conviene no confundir:

- **El fondo de color es la curva dosis-respuesta**, que sale de la evidencia y
  es **igual para todos los músculos**. La meta-regresión de Pelland (2026, 67
  estudios) buscó si la curva cambiaba según el grupo muscular y no encontró
  moderación que valga la pena. Lo que cambia entre músculos no es dónde está el
  óptimo sino cuánto trabajo indirecto ya reciben, y eso el conteo fraccionado
  ya lo cuenta. Inventar un óptimo distinto para el bíceps y para el cuádriceps
  sería precisión fabricada.
- **El marco blanco es el objetivo de esta planificación**, que sí es una
  decisión propia: cuánto de ese óptimo le toca a cada músculo con 3 o 4
  sesiones. Cuando el marco cae fuera del verde no es un error de la app; es lo
  que significa especializar, y conviene verlo en vez de esconderlo.

El modelo es una saturación: la fracción de la respuesta alcanzable con `n`
series es `1 - e^(-n/8)`, y el rendimiento marginal cae como `e^(-n/8)`.
Calibrado contra tres anclas: Schoenfeld y Krieger (2017) para el piso, Baz-Valle
(2022) para el óptimo de 12-20, y Pelland (2026) para el aplanamiento. Los cortes
no son redondeos sino los puntos donde el rendimiento marginal cruza un umbral:

| series | capturás | la siguiente rinde | |
|---|---|---|---|
| menos de 6 | menos del 53% | mucho | **no alcanza** |
| 6 a 10 | 53-71% | 47-29% | falta para el óptimo |
| 10 a 20 | 71-92% | 29-8% | **óptimo** |
| 20 a 28 | 92-97% | menos del 8% | rinde cada vez menos |
| más de 28 | 97%+ | menos del 3% | la curva ya es plana |

La escala también marca con una línea cuánto llevás esta semana, y la ficha de
cada músculo dice en números qué fracción estás capturando y cuánto rendiría una
serie más. Una recomendación que no se puede auditar sirve para obedecer, no
para decidir.

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

- **La cuenta es un código**, no un login: una sola cosa para escribir, la misma
  en cualquier teléfono. Abajo sigue siendo auth de verdad (el código es la
  credencial y el mail es sintético), porque lo que protege los datos no es que
  sean poco interesantes sino que nadie más pueda borrarlos. Por eso el código
  sugerido es aleatorio: un teléfono es adivinable.
- **La sincronización es automática.** Cada cambio se sube solo, agrupado, y al
  abrir con un código en un teléfono vacío se ofrece bajar todo. Si los dos
  lados tienen datos y nunca sincronizaron, se pregunta en vez de pisar.
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
