-- Las plantillas se leían en el orden que las devuelve la base, que es por id:
-- al restaurar volvían alfabéticas y no en el orden que vos les diste. El orden
-- en que aparecen es una decisión del usuario, así que se guarda.

alter table public.plantillas add column orden int not null default 0;
