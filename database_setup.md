# Database Setup (Supabase SQL)

Jalankan script SQL berikut di **SQL Editor** Supabase Dashboard Anda untuk menyiapkan tabel dan keamanan (RLS).

## 1. Tabel Profiles
```sql
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text,
  email text,
  avatar_url text,
  xp int default 0,
  level int default 1,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Policies
create policy "Users can view their own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id);
```

## 2. Automasi Profile (Trigger)
Script ini akan secara otomatis membuat entry di tabel `profiles` setiap kali ada user baru yang mendaftar (via Email maupun Google). Ini lebih aman daripada melakukannya di sisi Backend API.

```sql
-- Fungsi untuk handle user baru
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'User'),
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger setelah signup
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

## 3. Tabel Game Sessions
```sql
create table public.game_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  topic text not null,
  duration int not null,
  status text check (status in ('recording', 'completed', 'failed')),
  total_score float default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.game_sessions enable row level security;

create policy "Users can manage their own sessions" on public.game_sessions
  for all using (auth.uid() = user_id);
```

## 4. Tabel Recordings & Feedback
```sql
-- Recordings
create table public.recordings (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.game_sessions on delete cascade not null,
  audio_url text,
  video_url text,
  transcript text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Feedbacks
create table public.feedbacks (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.game_sessions on delete cascade not null,
  eye_score int,
  voice_score int,
  filler_score int,
  content_score int,
  confidence_score int,
  summary text,
  improvement_tips text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```
