create table if not exists mail_relay (
  id text primary key,
  smtp_host text not null,
  smtp_port integer not null,
  smtp_user text not null,
  smtp_pass text not null,
  mail_from text not null,
  updated_at timestamptz not null default now()
);
