-- Dedicated HeatGuard project. All data access is through the validated Edge Function.
create table public.heatguard_pins (
  id uuid primary key, name text not null check (length(name) between 1 and 80),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  kind text not null check (kind in ('water','shade','ac')),
  actor text not null, created_at bigint not null
);
create table public.heatguard_votes (
  pin_id uuid not null references public.heatguard_pins(id) on delete cascade,
  actor text not null, kind text not null check (kind in ('confirm','report')),
  created_at bigint not null, primary key (pin_id, actor)
);
create table public.heatguard_reports (
  id uuid primary key, latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  feeling text not null check (feeling in ('comfortable','hot','very-hot')),
  actor text not null, created_at bigint not null
);
create table public.heatguard_limits (
  key text not null, bucket bigint not null, requests integer not null,
  primary key (key,bucket)
);
create index heatguard_pins_area on public.heatguard_pins(latitude,longitude,created_at);
create index heatguard_reports_area on public.heatguard_reports(latitude,longitude,created_at);
alter table public.heatguard_pins enable row level security;
alter table public.heatguard_votes enable row level security;
alter table public.heatguard_reports enable row level security;
alter table public.heatguard_limits enable row level security;
revoke all on public.heatguard_pins,public.heatguard_votes,public.heatguard_reports,public.heatguard_limits from anon,authenticated;
grant all on public.heatguard_pins,public.heatguard_votes,public.heatguard_reports,public.heatguard_limits to service_role;
create function public.heatguard_allow_request(p_key text,p_limit integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare b bigint := floor(extract(epoch from now())/60); n integer;
begin
  if length(p_key) <> 64 or p_limit not between 1 and 120 then return false; end if;
  delete from public.heatguard_limits where bucket < b-2;
  insert into public.heatguard_limits as limits(key,bucket,requests) values(p_key,b,1)
  on conflict(key,bucket) do update set requests=limits.requests+1 returning requests into n;
  return n <= p_limit;
end $$;
revoke all on function public.heatguard_allow_request(text,integer) from public,anon,authenticated;
grant execute on function public.heatguard_allow_request(text,integer) to service_role;
