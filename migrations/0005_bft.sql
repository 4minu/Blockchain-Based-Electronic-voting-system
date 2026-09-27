alter table chain_blocks
  add column if not exists bft jsonb not null default '{}'::jsonb;
