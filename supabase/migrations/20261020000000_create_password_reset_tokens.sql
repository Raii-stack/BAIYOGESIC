create table if not exists public.password_reset_token (
  token_hash text primary key,
  user_id uuid not null references public.app_user (user_id),
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists password_reset_token_user_id_idx
  on public.password_reset_token (user_id);

create index if not exists password_reset_token_active_idx
  on public.password_reset_token (token_hash, expires_at)
  where used = false;

alter table public.password_reset_token enable row level security;
