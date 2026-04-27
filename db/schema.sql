create extension if not exists pgcrypto;

create table if not exists player_profiles (
  id uuid primary key default gen_random_uuid(),
  wallet_address text unique,
  username text not null,
  pfp text not null,
  last_socket_id text,
  matches_played integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  kills integer not null default 0,
  deaths integer not null default 0,
  unc_won numeric(18, 2) not null default 0,
  unc_spent numeric(18, 2) not null default 0,
  unc_house_fees_paid numeric(18, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table player_profiles add column if not exists losses integer not null default 0;
alter table player_profiles add column if not exists unc_won numeric(18, 2) not null default 0;
alter table player_profiles add column if not exists unc_spent numeric(18, 2) not null default 0;
alter table player_profiles add column if not exists unc_house_fees_paid numeric(18, 2) not null default 0;

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'active',
  wager text not null,
  buy_in_unc numeric(18, 2) not null default 0,
  player_count integer not null default 0,
  gross_pot_unc numeric(18, 2) not null default 0,
  house_fee_unc numeric(18, 2) not null default 0,
  payout_pool_unc numeric(18, 2) not null default 0,
  payout_status text not null default 'not_required',
  payout_signature text,
  payout_error text,
  winner_socket_id text,
  winner_profile_id uuid references player_profiles(id) on delete set null,
  second_place_bonus_socket_id text,
  second_place_bonus_profile_id uuid references player_profiles(id) on delete set null,
  end_reason text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table matches add column if not exists payout_status text not null default 'not_required';
alter table matches add column if not exists payout_signature text;
alter table matches add column if not exists payout_error text;

create table if not exists match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  socket_id text not null,
  profile_id uuid references player_profiles(id) on delete set null,
  wallet_address text,
  username text not null,
  pfp text not null,
  kills integer not null default 0,
  deaths integer not null default 0,
  health integer not null default 100,
  alive boolean not null default true,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  final_rank integer,
  result text,
  unc_paid numeric(18, 2) not null default 0,
  unc_won numeric(18, 2) not null default 0,
  house_fee_unc numeric(18, 2) not null default 0,
  unique (match_id, socket_id)
);

alter table match_players add column if not exists result text;
alter table match_players add column if not exists unc_paid numeric(18, 2) not null default 0;
alter table match_players add column if not exists unc_won numeric(18, 2) not null default 0;
alter table match_players add column if not exists house_fee_unc numeric(18, 2) not null default 0;

create table if not exists match_events (
  id bigserial primary key,
  match_id uuid references matches(id) on delete cascade,
  event_type text not null,
  actor_socket_id text,
  actor_profile_id uuid references player_profiles(id) on delete set null,
  target_socket_id text,
  target_profile_id uuid references player_profiles(id) on delete set null,
  projectile_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists match_projectiles (
  id uuid primary key,
  match_id uuid references matches(id) on delete cascade,
  owner_socket_id text not null,
  owner_profile_id uuid references player_profiles(id) on delete set null,
  spawn_pos jsonb not null,
  velocity jsonb not null,
  charge_power numeric(5, 4) not null,
  spawned_at timestamptz not null,
  resolved_at timestamptz,
  impact_pos jsonb,
  target_socket_id text,
  target_profile_id uuid references player_profiles(id) on delete set null
);

create table if not exists entry_payments (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete set null,
  socket_id text not null,
  profile_id uuid references player_profiles(id) on delete set null,
  wallet_address text not null,
  wager text not null,
  amount_unc numeric(18, 2) not null,
  signature text not null unique,
  status text not null default 'verified',
  verified_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists payouts (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete set null,
  winner_profile_id uuid references player_profiles(id) on delete set null,
  winner_wallet_address text,
  gross_pot_unc numeric(18, 2) not null default 0,
  house_fee_unc numeric(18, 2) not null default 0,
  payout_pool_unc numeric(18, 2) not null default 0,
  status text not null,
  message text,
  signatures jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_matches_status_started_at on matches (status, started_at desc);
create index if not exists idx_match_players_profile_id on match_players (profile_id);
create index if not exists idx_match_events_match_id_created_at on match_events (match_id, created_at);
create index if not exists idx_match_projectiles_match_id on match_projectiles (match_id);
create index if not exists idx_entry_payments_match_id on entry_payments (match_id);
create index if not exists idx_entry_payments_profile_id on entry_payments (profile_id);
create index if not exists idx_payouts_match_id on payouts (match_id);
create index if not exists idx_payouts_winner_profile_id on payouts (winner_profile_id);
