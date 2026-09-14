-- Piernas pasa a ser el quinto día: su objetivo vale igual, pero no cuenta como
-- déficit mientras falte cerrar alguno de los cuatro bloques de tren superior.
-- Sin esta columna la marca se perdía al restaurar y el sugeridor volvía a
-- ofrecer piernas un lunes como si fuera lo más urgente.
alter table public.plantillas add column condicional boolean not null default false;
