-- A series le faltaba la marca de borrado que sí tienen las demás tablas.
-- El cliente filtra por ella en todas por igual, así que sin esto el traer de
-- la nube fallaba con "column series.borrado does not exist" y las series no
-- volvían.
--
-- Además la marca es lo que hace que borrar propague: el respaldo sube por
-- upsert y nunca elimina, así que sin un borrado lógico una sesión eliminada en
-- el teléfono reaparecía en la siguiente restauración.

alter table public.series add column borrado boolean not null default false;

create index series_borrado_idx on public.series (user_id, borrado);

-- La vista de análisis tiene que ignorar lo borrado, igual que ya ignora las
-- sesiones borradas.
create or replace view public.vista_series
with (security_invoker = true) as
select
  s.user_id,
  s.id                as serie_id,
  s.sesion_id,
  s.movimiento_id,
  s.variante_id,
  s.serie_idx,
  s.estado,
  s.peso,
  s.reps,
  s.rir,
  s.peso * s.reps     as volumen,
  ses.inicio          as fecha,
  ses.plantilla_nombre,
  date_trunc('week', ses.inicio) as semana
from public.series s
join public.sesiones ses
  on ses.user_id = s.user_id and ses.id = s.sesion_id
where s.estado = 'hecha'
  and not s.borrado
  and ses.fin is not null
  and not ses.borrado;
