create table if not exists spins (
  id uuid default uuid_generate_v4() primary key,
  spin_id text not null,
  player_id text,
  bet_amount numeric(12,2) not null,
  total_win numeric(12,2) not null,
  rng_seed text,
  initial_grid jsonb not null,
  cascades jsonb not null,
  created_at timestamptz default now()
);

create index if not exists idx_spins_created_at on spins(created_at desc);
create index if not exists idx_spins_player on spins(player_id, created_at desc);



