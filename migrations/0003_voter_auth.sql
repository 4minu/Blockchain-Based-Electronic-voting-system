create table if not exists voter_otps (
  id text primary key,
  commitment text not null,
  code_hash text not null,
  mail_token_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists voter_otps_commitment_idx on voter_otps (commitment);

create table if not exists voter_sessions (
  token_hash text primary key,
  commitment text not null,
  masked_email text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists voter_sessions_commitment_idx on voter_sessions (commitment);
