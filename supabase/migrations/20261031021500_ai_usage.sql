-- Daily AI call count per student, for the cap in supabase/functions/ai. Only the server (service role) touches it.
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users on delete cascade,
  day date not null default current_date,
  calls int not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;

create or replace function public.ai_tick(p_user uuid) returns int
language sql security definer set search_path = public as $$
  insert into public.ai_usage (user_id, day, calls) values (p_user, current_date, 1)
  on conflict (user_id, day) do update set calls = public.ai_usage.calls + 1
  returning calls;
$$;
revoke execute on function public.ai_tick(uuid) from public, anon, authenticated;
grant execute on function public.ai_tick(uuid) to service_role;
