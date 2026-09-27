-- SOE Chainvote departmental election ledger
create table if not exists elections (
  id text primary key,
  title text not null,
  session_label text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists offices (
  id text primary key,
  election_id text not null,
  title text not null,
  sort_order integer not null
);

create table if not exists candidates (
  id text primary key,
  office_id text not null,
  full_name text not null,
  manifesto text not null,
  initials text not null,
  sort_order integer not null
);

create table if not exists otp_challenges (
  id text primary key,
  email_hash text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  consumed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists otp_rate (
  email_hash text primary key,
  last_sent_at timestamptz not null,
  send_count integer not null default 1
);

create table if not exists voter_sessions (
  id text primary key,
  token_hash text not null unique,
  email_hash text not null,
  given_name text not null,
  masked_email text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists chain_blocks (
  id text primary key,
  election_id text not null,
  block_index integer not null,
  prev_hash text not null,
  merkle_root text not null,
  block_hash text not null unique,
  ballot_count integer not null,
  created_at timestamptz not null default now(),
  unique (election_id, block_index)
);

create table if not exists ballots (
  id text primary key,
  election_id text not null,
  block_id text not null,
  office_id text not null,
  candidate_id text not null,
  ballot_hash text not null,
  salt text not null,
  created_at timestamptz not null default now()
);

create table if not exists voter_receipts (
  election_id text not null,
  email_hash text not null,
  receipt_hash text not null,
  block_hash text not null,
  queued boolean not null default false,
  cast_at timestamptz not null default now(),
  primary key (election_id, email_hash)
);

create index if not exists otp_challenges_email_idx on otp_challenges (email_hash, created_at desc);
create index if not exists ballots_block_idx on ballots (block_id);
create index if not exists ballots_candidate_idx on ballots (candidate_id);
create index if not exists chain_blocks_election_idx on chain_blocks (election_id, block_index);
