-- Esquema de Rutina.
--
-- La app es local-first: el teléfono sigue siendo la fuente de verdad durante
-- el entrenamiento, porque en el gimnasio no hay señal. Esto es el respaldo
-- durable y la capa de análisis; se sincroniza en segundo plano.
--
-- Los ids son text y los genera el cliente: son los mismos que ya viven en el
-- teléfono, así la sincronización es idempotente y no hace falta mapear nada.
-- La clave primaria es (user_id, id) para que dos usuarios no puedan chocar y
-- para que la política de RLS sea una comparación directa.
--
-- Todo cuelga de auth.users. Con sign-in anónimo no hay pantalla de registro:
-- el usuario existe desde el primer arranque y puede vincular un mail después
-- para recuperar los datos si pierde el teléfono.

-- ---------------------------------------------------------------- utilidades

-- Marca de tiempo del servidor, no del teléfono: la sincronización pregunta
-- "dame todo lo más nuevo que X" y con relojes desfasados eso se rompe.
create or replace function public.tocar_actualizado()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.actualizado = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- tablas

create table public.perfil (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  config       jsonb not null default '{}'::jsonb,
  -- Ajustes propios de los objetivos semanales por músculo. Vacío = los que
  -- trae la app.
  objetivos    jsonb not null default '{}'::jsonb,
  actualizado  timestamptz not null default now()
);

create table public.movimientos (
  id           text not null,
  user_id      uuid not null references auth.users (id) on delete cascade,
  nombre       text not null,
  prim         text[] not null default '{}',
  sec          text[] not null default '{}',
  tips         text not null default '',
  borrado      boolean not null default false,
  actualizado  timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.variantes (
  id            text not null,
  user_id       uuid not null references auth.users (id) on delete cascade,
  movimiento_id text not null,
  nombre        text not null,
  tipo          text not null default 'peso',
  incremento    numeric(5,2) not null default 2.5,
  -- Equivalencia contra la variante de referencia del movimiento. Solo se usa
  -- para comparar en los gráficos: el peso guardado es siempre el crudo.
  factor        numeric(5,2) not null default 1,
  nota          text not null default '',
  ultimo        jsonb,
  borrado       boolean not null default false,
  actualizado   timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.plantillas (
  id              text not null,
  user_id         uuid not null references auth.users (id) on delete cascade,
  nombre          text not null,
  foco            text not null default '',
  version_actual  int not null default 1,
  -- Historial append-only de la plantilla. Se guarda entero como jsonb porque
  -- se lee y se escribe siempre completo, y nunca se consulta por adentro.
  versiones       jsonb not null default '[]'::jsonb,
  borrado         boolean not null default false,
  actualizado     timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.sesiones (
  id                text not null,
  user_id           uuid not null references auth.users (id) on delete cascade,
  plantilla_id      text,
  plantilla_nombre  text,
  version_n         int,
  inicio            timestamptz not null,
  fin               timestamptz,
  borrado           boolean not null default false,
  actualizado       timestamptz not null default now(),
  primary key (user_id, id)
);

-- La tabla que importa: acá vive el volumen real y es lo que hace que valga la
-- pena tener Postgres en vez de un archivo.
create table public.series (
  id            text not null,
  user_id       uuid not null references auth.users (id) on delete cascade,
  sesion_id     text not null,
  movimiento_id text not null,
  variante_id   text not null,
  ex_idx        int not null,
  serie_idx     int not null,
  series_plan   int,
  reps_min      int,
  reps_max      int,
  rir_min       int,
  rir_max       int,
  descanso      int,
  estado        text not null default 'pendiente',
  peso          numeric(6,2),
  reps          int,
  rir           text,
  hecha_en      timestamptz,
  actualizado   timestamptz not null default now(),
  primary key (user_id, id),
  constraint series_estado_valido check (estado in ('pendiente', 'hecha', 'salteada'))
);

-- ---------------------------------------------------------------- índices

-- La sincronización siempre pregunta por lo más nuevo de un usuario.
create index movimientos_sync_idx on public.movimientos (user_id, actualizado);
create index variantes_sync_idx   on public.variantes (user_id, actualizado);
create index plantillas_sync_idx  on public.plantillas (user_id, actualizado);
create index sesiones_sync_idx    on public.sesiones (user_id, actualizado);
create index series_sync_idx      on public.series (user_id, actualizado);

create index sesiones_fecha_idx   on public.sesiones (user_id, inicio desc);
create index series_sesion_idx    on public.series (user_id, sesion_id);
create index series_movimiento_idx on public.series (user_id, movimiento_id);
create index variantes_mov_idx    on public.variantes (user_id, movimiento_id);

-- ---------------------------------------------------------------- triggers

create trigger perfil_tocar      before update on public.perfil      for each row execute function public.tocar_actualizado();
create trigger movimientos_tocar before insert or update on public.movimientos for each row execute function public.tocar_actualizado();
create trigger variantes_tocar   before insert or update on public.variantes   for each row execute function public.tocar_actualizado();
create trigger plantillas_tocar  before insert or update on public.plantillas  for each row execute function public.tocar_actualizado();
create trigger sesiones_tocar    before insert or update on public.sesiones    for each row execute function public.tocar_actualizado();
create trigger series_tocar      before insert or update on public.series      for each row execute function public.tocar_actualizado();

-- ---------------------------------------------------------------- RLS
--
-- Con sign-in anónimo activado, TODO usuario anónimo lleva el rol
-- `authenticated`. Por eso ninguna política puede confiar en el rol solo: cada
-- una compara contra auth.uid(). Y las de update llevan USING y WITH CHECK, si
-- no se podría reasignar una fila a otro usuario.

alter table public.perfil      enable row level security;
alter table public.movimientos enable row level security;
alter table public.variantes   enable row level security;
alter table public.plantillas  enable row level security;
alter table public.sesiones    enable row level security;
alter table public.series      enable row level security;

create policy "perfil propio: leer"     on public.perfil for select to authenticated using ((select auth.uid()) = user_id);
create policy "perfil propio: crear"    on public.perfil for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "perfil propio: editar"   on public.perfil for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "perfil propio: borrar"   on public.perfil for delete to authenticated using ((select auth.uid()) = user_id);

create policy "movimientos propios: leer"   on public.movimientos for select to authenticated using ((select auth.uid()) = user_id);
create policy "movimientos propios: crear"  on public.movimientos for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "movimientos propios: editar" on public.movimientos for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "movimientos propios: borrar" on public.movimientos for delete to authenticated using ((select auth.uid()) = user_id);

create policy "variantes propias: leer"   on public.variantes for select to authenticated using ((select auth.uid()) = user_id);
create policy "variantes propias: crear"  on public.variantes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "variantes propias: editar" on public.variantes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "variantes propias: borrar" on public.variantes for delete to authenticated using ((select auth.uid()) = user_id);

create policy "plantillas propias: leer"   on public.plantillas for select to authenticated using ((select auth.uid()) = user_id);
create policy "plantillas propias: crear"  on public.plantillas for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "plantillas propias: editar" on public.plantillas for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "plantillas propias: borrar" on public.plantillas for delete to authenticated using ((select auth.uid()) = user_id);

create policy "sesiones propias: leer"   on public.sesiones for select to authenticated using ((select auth.uid()) = user_id);
create policy "sesiones propias: crear"  on public.sesiones for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "sesiones propias: editar" on public.sesiones for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "sesiones propias: borrar" on public.sesiones for delete to authenticated using ((select auth.uid()) = user_id);

create policy "series propias: leer"   on public.series for select to authenticated using ((select auth.uid()) = user_id);
create policy "series propias: crear"  on public.series for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "series propias: editar" on public.series for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "series propias: borrar" on public.series for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------- Data API
--
-- Desde abril de 2026 las tablas nuevas del esquema public NO quedan expuestas
-- solas a la Data API. Sin estos grants la app recibe 404 aunque las políticas
-- de RLS estén bien.

grant select, insert, update, delete on public.perfil      to authenticated;
grant select, insert, update, delete on public.movimientos to authenticated;
grant select, insert, update, delete on public.variantes   to authenticated;
grant select, insert, update, delete on public.plantillas  to authenticated;
grant select, insert, update, delete on public.sesiones    to authenticated;
grant select, insert, update, delete on public.series      to authenticated;

-- ---------------------------------------------------------------- análisis
--
-- security_invoker es obligatorio: sin él la vista corre con los permisos de
-- quien la creó y saltea RLS, dejando ver las series de cualquiera.
create view public.vista_series
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
where s.estado = 'hecha' and ses.fin is not null and not ses.borrado;

grant select on public.vista_series to authenticated;
