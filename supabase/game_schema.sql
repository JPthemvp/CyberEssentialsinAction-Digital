-- Cyber Essentials in Action (Digital) Game Schema
-- Run this in Supabase SQL Editor

-- Game rooms (sessions)
create table if not exists game_rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text unique not null,
  sector text not null default 'General',
  mode text not null default 'attack', -- 'attack' | 'quest'
  status text not null default 'lobby', -- 'lobby' | 'question' | 'reveal' | 'leaderboard' | 'ended'
  current_question_index integer default 0,
  current_scenario_id text default null, -- For quest mode: 'A'...'I'
  question_started_at timestamptz default null,
  created_at timestamptz default now()
);

-- Players in a room
create table if not exists game_players (
  id uuid primary key default gen_random_uuid(),
  room_code text not null references game_rooms(room_code) on delete cascade,
  player_name text not null,
  avatar_color text not null default '#6366f1',
  score integer not null default 0,
  is_host boolean not null default false,
  last_seen_at timestamptz default now(),
  created_at timestamptz default now()
);

-- Answers submitted by players
create table if not exists game_answers (
  id uuid primary key default gen_random_uuid(),
  room_code text not null,
  player_id uuid not null references game_players(id) on delete cascade,
  question_key text not null, -- e.g. 'attack_3' or 'quest_A'
  answer_index integer default null, -- for MCQ
  answer_text text default null,     -- for open ended
  is_correct boolean default null,
  response_time_ms integer default null,
  points_earned integer default 0,
  submitted_at timestamptz default now()
);

-- Enable Row Level Security (permissive for game - all public)
alter table game_rooms enable row level security;
alter table game_players enable row level security;
alter table game_answers enable row level security;

create policy "Public read game_rooms" on game_rooms for select using (true);
create policy "Public insert game_rooms" on game_rooms for insert with check (true);
create policy "Public update game_rooms" on game_rooms for update using (true);

create policy "Public read game_players" on game_players for select using (true);
create policy "Public insert game_players" on game_players for insert with check (true);
create policy "Public update game_players" on game_players for update using (true);

create policy "Public read game_answers" on game_answers for select using (true);
create policy "Public insert game_answers" on game_answers for insert with check (true);
create policy "Public update game_answers" on game_answers for update using (true);

-- Enable realtime for all game tables
alter publication supabase_realtime add table game_rooms;
alter publication supabase_realtime add table game_players;
alter publication supabase_realtime add table game_answers;
