
-- Enable Row Level Security (RLS) & Grant access
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;

-- 1. PROFILES
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  full_name text,
  company_name text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. DOMAINS
create table if not exists public.domains (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  domain_name text not null,
  status text check (status in ('pending', 'scanning', 'verified', 'active', 'error')) default 'pending',
  provider text default 'manual', -- 'manual' or 'cloudflare'
  cloudflare_zone_id text,
  verification_record text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. EMAIL ACCOUNTS
create table if not exists public.email_accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  email_address text not null,
  auth_token text, -- Stores the app password/token
  host text not null,
  port int not null,
  protocol text check (protocol in ('imap', 'pop3', 'sendgrid')) default 'imap',
  status text check (status in ('connected', 'error', 'syncing')) default 'connected',
  last_sync_at timestamp with time zone,
  last_error text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. EMAILS
create table if not exists public.emails (
  id uuid default gen_random_uuid() primary key,
  account_id uuid references public.email_accounts(id) on delete cascade,
  user_id uuid references public.profiles(id) not null,
  remote_id text, -- ID from the IMAP server
  from_address text not null,
  subject text,
  body_text text,
  received_at timestamp with time zone not null,
  is_read boolean default false,
  ai_summary text,
  ai_sentiment text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. TICKETS
create table if not exists public.tickets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  title text not null,
  description text,
  priority text check (priority in ('low', 'medium', 'high', 'urgent')) default 'medium',
  status text check (status in ('open', 'in-progress', 'resolved', 'closed')) default 'open',
  source_email_id uuid references public.emails(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. TASKS
create table if not exists public.tasks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  title text not null,
  status text check (status in ('pending', 'completed')) default 'pending',
  due_date timestamp with time zone,
  source_email_id uuid references public.emails(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. AUTOMATIONS
create table if not exists public.automations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  name text not null,
  condition text not null,
  action text not null,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ENABLE RLS
alter table public.profiles enable row level security;
alter table public.domains enable row level security;
alter table public.email_accounts enable row level security;
alter table public.emails enable row level security;
alter table public.tickets enable row level security;
alter table public.tasks enable row level security;
alter table public.automations enable row level security;

-- POLICIES
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

create policy "Users can manage own domains" on public.domains for all using (auth.uid() = user_id);

create policy "Users can manage own accounts" on public.email_accounts for all using (auth.uid() = user_id);

create policy "Users can manage own emails" on public.emails for all using (auth.uid() = user_id);

create policy "Users can manage own tickets" on public.tickets for all using (auth.uid() = user_id);
create policy "Users can manage own tasks" on public.tasks for all using (auth.uid() = user_id);

create policy "Users can manage own automations" on public.automations for all using (auth.uid() = user_id);

-- TRIGGERS
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- MIGRATION SAFEGUARD
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='email_accounts' and column_name='auth_token') then
    alter table public.email_accounts add column auth_token text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='email_accounts' and column_name='last_error') then
    alter table public.email_accounts add column last_error text;
  end if;
end $$;
