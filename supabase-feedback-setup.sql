-- こもれび開拓団: 感想・報告の非公開保存テーブル
-- 公開ページは INSERT のみ。SELECT / UPDATE / DELETE は許可しない。

create table if not exists public.feedback_reports (
  id uuid primary key default gen_random_uuid(),
  client_report_id text not null unique check (char_length(client_report_id) between 16 and 100),
  player_name text not null default '匿名の開拓者' check (char_length(player_name) <= 40),
  report_type text not null check (report_type in ('impression','bug','request','other')),
  message text not null check (char_length(message) between 1 and 1200),
  client_time timestamptz,
  page_path text,
  game_label text,
  created_at timestamptz not null default now()
);

alter table public.feedback_reports enable row level security;

revoke all on table public.feedback_reports from anon, authenticated;
grant insert on table public.feedback_reports to anon;

drop policy if exists "public_can_submit_feedback" on public.feedback_reports;
create policy "public_can_submit_feedback"
on public.feedback_reports
for insert
to anon
with check (
  char_length(message) between 1 and 1200
  and report_type in ('impression','bug','request','other')
);

create index if not exists feedback_reports_created_at_idx
on public.feedback_reports (created_at desc);

-- 読み取りポリシーは作らない。
-- Supabase Dashboard や、所有者が接続した管理ツールからのみ確認する。
