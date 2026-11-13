-- Teclea: actualizacion 2
-- Guarda el texto que escribe el alumno para poder mostrar la correccion.
-- Ejecutar una vez en Supabase > SQL Editor > New query > Run
alter table public.attempts add column if not exists typed text;
