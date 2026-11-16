-- Teclea: actualizacion 4 - pruebas repetibles, examenes con intentos limitados y tiempo libre
-- Ejecutar una vez en Supabase > SQL Editor > New query > Run

-- Intentos maximos (vacio = ilimitados) y duracion opcional (vacio = sin limite de tiempo, maximo 3 horas)
alter table public.tests add column if not exists max_attempts int;
alter table public.tests drop constraint if exists tests_max_attempts_check;
alter table public.tests add constraint tests_max_attempts_check check (max_attempts is null or max_attempts >= 1);
alter table public.tests drop constraint if exists tests_duration_sec_check;
alter table public.tests alter column duration_sec drop not null;
alter table public.tests add constraint tests_duration_sec_check check (duration_sec is null or duration_sec between 30 and 10800);

-- Ya no hay una sola entrega por prueba
drop index if exists public.attempts_one_per_test;

-- Cada intento de prueba tiene su propia sesion
alter table public.test_sessions add column if not exists id uuid not null default gen_random_uuid();
alter table public.test_sessions add column if not exists submitted boolean not null default false;
alter table public.test_sessions drop constraint if exists test_sessions_pkey;
alter table public.test_sessions add primary key (id);
create index if not exists test_sessions_student_test on public.test_sessions (student_id, test_id);
update public.test_sessions s set submitted = true
  where exists (select 1 from public.attempts a where a.student_id = s.student_id and a.test_id = s.test_id and a.mode = 'prueba');

alter table public.test_sessions enable row level security;
