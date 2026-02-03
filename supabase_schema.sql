
-- Enable Row Level Security (RLS)
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;

-- 1. PROFILES (Linked to Auth Users)
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  full_name text,
  company_name text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. DOMAINS (Custom Business Domains)
create table public.domains (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  domain_name text not null,
  status text check (status in ('pending', 'scanning', 'verified', 'active', 'error')) default 'pending',
  provider text default 'manual', -- 'manual' or 'cloudflare'
  cloudflare_zone_id text,
  verification_record text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. EMAIL ACCOUNTS (IMAP/POP3 Connections)
create table public.email_accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  email_address text not null,
  host text not null,
  port int not null,
  protocol text check (protocol in ('imap', 'pop3')) default 'imap',
  status text check (status in ('connected', 'error', 'syncing')) default 'connected',
  last_sync_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. EMAILS (Stored Messages)
create table public.emails (
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

-- 5. TICKETS (Support Issues)
create table public.tickets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  title text not null,
  description text,
  priority text check (priority in ('low', 'medium', 'high', 'urgent')) default 'medium',
  status text check (status in ('open', 'in-progress', 'resolved', 'closed')) default 'open',
  source_email_id uuid references public.emails(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. TASKS (Extracted Logic)
create table public.tasks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  title text not null,
  status text check (status in ('pending', 'completed')) default 'pending',
  due_date timestamp with time zone,
  source_email_id uuid references public.emails(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS POLICIES (Security)

-- Profiles
alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Domains
alter table public.domains enable row level security;
create policy "Users can all domains" on public.domains for all using (auth.uid() = user_id);

-- Email Accounts
alter table public.email_accounts enable row level security;
create policy "Users can all accounts" on public.email_accounts for all using (auth.uid() = user_id);

-- Emails
alter table public.emails enable row level security;
create policy "Users can all emails" on public.emails for all using (auth.uid() = user_id);

-- Tickets & Tasks
alter table public.tickets enable row level security;
create policy "Users can all tickets" on public.tickets for all using (auth.uid() = user_id);

alter table public.tasks enable row level security;
create policy "Users can all tasks" on public.tasks for all using (auth.uid() = user_id);

-- Trigger to create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
