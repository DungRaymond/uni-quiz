begin;
create table if not exists public.questions (
  id text primary key,
  data jsonb not null check (
    jsonb_typeof(data) = 'object'
    and data ?& array['sourceNumber', 'prompt', 'options']
    and jsonb_typeof(data->'prompt') = 'string'
    and jsonb_typeof(data->'options') = 'array'
    and jsonb_array_length(data->'options') = 4
  ),
  active boolean not null default true,
  exclusion_reason text
);
create table if not exists public.question_answer_keys (
  question_id text primary key references public.questions(id) on delete cascade,
  correct_key text not null check (correct_key in ('A','B','C','D')),
  explanation text not null check (length(explanation) > 0)
);
create table if not exists public.quiz_attempts (
  id uuid primary key,
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  submitted_at timestamptz not null default now()
);

-- All access goes through Next.js server routes. Never expose service_role to clients.
alter table public.questions enable row level security;
alter table public.question_answer_keys enable row level security;
alter table public.quiz_attempts enable row level security;
revoke all on public.questions, public.question_answer_keys, public.quiz_attempts from anon, authenticated;
grant select, insert, update, delete on public.questions, public.question_answer_keys, public.quiz_attempts to service_role;
commit;
