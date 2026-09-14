-- La rutina pasa a organizarse por roles: empuje, tirón, brazos, piernas. Una
-- semana es un bloque de cada rol, y cada rol tiene un hermano con el mismo
-- perfil muscular. Sin esta columna el rol se perdía al restaurar y la app
-- volvía a mostrar ocho bloques sueltos.
alter table public.plantillas add column rol text;
