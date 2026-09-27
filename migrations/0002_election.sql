create table if not exists elections (
  id text primary key,
  title text not null,
  department text not null,
  session_label text not null,
  reference_code text not null,
  status text not null,
  opens_at timestamptz not null,
  closes_at timestamptz not null
);

create table if not exists eligible_voters (
  commitment text primary key
);

create table if not exists chain_blocks (
  block_index integer primary key,
  timestamp_ms bigint not null,
  previous_hash text not null,
  merkle_root text not null,
  hash text not null unique,
  nonce integer not null default 0,
  payload jsonb not null
);

create table if not exists vote_receipts (
  voter_commitment text not null,
  position_id text not null,
  candidate_id text not null,
  block_hash text not null,
  created_at timestamptz not null default now(),
  primary key (voter_commitment, position_id)
);

create index if not exists vote_receipts_block_idx on vote_receipts (block_hash);
