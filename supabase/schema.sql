-- Teclea: esquema de base de datos
-- Ejecutar una sola vez en Supabase > SQL Editor > New query > Run

create extension if not exists pgcrypto;

create table if not exists teachers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  name text not null,
  code text unique not null,
  baremo jsonb not null default '{"min5":120,"max10":250,"minAcc":95,"penalty":5}',
  created_at timestamptz not null default now()
);

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  full_name text not null,
  username text not null,
  alias text not null,
  pin text not null,
  failed_logins int not null default 0,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  unique (class_id, username)
);

create table if not exists tests (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  title text not null,
  content text not null,
  duration_sec int not null check (duration_sec between 30 and 1800),
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  mode text not null check (mode in ('practica', 'prueba', 'carrera')),
  lesson_id text,
  test_id uuid references tests(id) on delete cascade,
  chars int not null,
  errors int not null,
  duration_ms int not null,
  gross_ppm numeric(7,1) not null,
  net_ppm numeric(7,1) not null,
  accuracy numeric(5,1) not null,
  flagged boolean not null default false,
  flag_reason text,
  typed text,
  created_at timestamptz not null default now()
);

-- Para bases creadas con la primera version
alter table attempts add column if not exists typed text;

create unique index if not exists attempts_one_per_test
  on attempts (student_id, test_id) where mode = 'prueba';
create index if not exists attempts_class_created on attempts (class_id, created_at desc);
create index if not exists attempts_student_created on attempts (student_id, created_at desc);

-- Momento en que cada alumno empieza una prueba: evita reiniciarla para repetir.
create table if not exists test_sessions (
  student_id uuid not null references students(id) on delete cascade,
  test_id uuid not null references tests(id) on delete cascade,
  started_at timestamptz not null default now(),
  primary key (student_id, test_id)
);

create table if not exists lesson_progress (
  student_id uuid not null references students(id) on delete cascade,
  lesson_id text not null,
  best_net numeric(7,1) not null default 0,
  best_acc numeric(5,1) not null default 0,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (student_id, lesson_id)
);

-- Seguridad: RLS activado sin politicas. Nadie puede leer ni escribir con la clave publica;
-- solo el servidor de la app (service role) accede a los datos.
alter table teachers enable row level security;
alter table classes enable row level security;
alter table students enable row level security;
alter table tests enable row level security;
alter table attempts enable row level security;
alter table lesson_progress enable row level security;
alter table test_sessions enable row level security;
