-- Teclea: actualizacion 3 - carreras en directo
-- Ejecutar una vez en Supabase > SQL Editor > New query > Run

create table if not exists races (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  title text not null,
  content text not null,
  duration_sec int not null check (duration_sec between 30 and 900),
  status text not null default 'waiting' check (status in ('waiting', 'running', 'finished')),
  starts_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists races_class_created on races (class_id, created_at desc);

create table if not exists race_participants (
  race_id uuid not null references races(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  consumed int not null default 0,
  chars int not null default 0,
  errors int not null default 0,
  finished_at timestamptz,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (race_id, student_id)
);

alter table attempts add column if not exists typed text;
alter table attempts add column if not exists race_id uuid references races(id) on delete cascade;
create unique index if not exists attempts_one_per_race
  on attempts (student_id, race_id) where mode = 'carrera';

alter table races enable row level security;
alter table race_participants enable row level security;
