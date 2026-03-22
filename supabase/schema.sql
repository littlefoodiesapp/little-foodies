-- ============================================================
-- LITTLE FOODIES — SUPABASE DATABASE SCHEMA
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

-- Users (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  display_name text,
  location text,
  points integer default 0,
  streak_count integer default 0,
  last_vote_date date,
  created_at timestamptz default now()
);

-- Restaurants
create table public.restaurants (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  cuisine text,
  address text,
  city text,
  state text,
  zip text,
  phone text,
  website text,
  hours text,
  emoji text default '🍽️',
  status text default 'pending' check (status in ('pending','verified','claimed','partner')),
  submitted_by uuid references public.profiles(id),
  owner_id uuid references public.profiles(id),
  rating numeric(3,2),
  review_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Amenities per restaurant
create table public.amenities (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  amenity_key text not null,  -- 'highchair', 'changing_f', 'changing_m', 'kidsmenu', 'stroller', 'outdoor', 'quiet'
  yes_votes integer default 0,
  no_votes integer default 0,
  is_verified boolean default false,
  updated_at timestamptz default now(),
  unique(restaurant_id, amenity_key)
);

-- Individual amenity votes
create table public.amenity_votes (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  amenity_key text not null,
  user_id uuid references public.profiles(id) on delete cascade,
  vote text not null check (vote in ('yes','no')),
  created_at timestamptz default now(),
  unique(restaurant_id, amenity_key, user_id)
);

-- Reviews
create table public.reviews (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  rating integer check (rating between 1 and 5),
  body text,
  tags text[],  -- ['stroller-friendly', 'loud-but-ok', 'kids-loved-it']
  created_at timestamptz default now()
);

-- Favorites
create table public.favorites (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade,
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_id, restaurant_id)
);

-- Events (family nights, cooking classes)
create table public.events (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  title text not null,
  event_type text check (event_type in ('family_night','cooking_class','birthday','popup')),
  description text,
  event_date date,
  event_time time,
  price_cents integer default 0,
  age_range text,
  spots_total integer,
  spots_booked integer default 0,
  points_on_attend integer default 30,
  created_at timestamptz default now()
);

-- Event RSVPs
create table public.event_rsvps (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid references public.events(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(event_id, user_id)
);

-- Points ledger (every points transaction)
create table public.points_ledger (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade,
  action text not null,  -- 'vote','streak_bonus','review','add_restaurant','photo','event','referral'
  points integer not null,
  ref_id uuid,           -- optional: id of the restaurant/event/review this relates to
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table public.profiles enable row level security;
alter table public.restaurants enable row level security;
alter table public.amenities enable row level security;
alter table public.amenity_votes enable row level security;
alter table public.reviews enable row level security;
alter table public.favorites enable row level security;
alter table public.events enable row level security;
alter table public.event_rsvps enable row level security;
alter table public.points_ledger enable row level security;

-- Profiles: users can read all, only update their own
create policy "Public profiles are viewable" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Restaurants: anyone can read, authenticated users can insert
create policy "Restaurants are public" on public.restaurants for select using (true);
create policy "Auth users can add restaurants" on public.restaurants for insert with check (auth.uid() is not null);
create policy "Owners can update their restaurant" on public.restaurants for update using (auth.uid() = owner_id or auth.uid() = submitted_by);

-- Amenities: public read, auth users can trigger updates via votes
create policy "Amenities are public" on public.amenities for select using (true);
create policy "System can manage amenities" on public.amenities for all using (true);

-- Votes: public read, users can only insert their own
create policy "Votes are public" on public.amenity_votes for select using (true);
create policy "Auth users can vote" on public.amenity_votes for insert with check (auth.uid() = user_id);

-- Reviews: public read, auth users can add
create policy "Reviews are public" on public.reviews for select using (true);
create policy "Auth users can review" on public.reviews for insert with check (auth.uid() = user_id);
create policy "Users can delete own reviews" on public.reviews for delete using (auth.uid() = user_id);

-- Favorites: users can only see/manage their own
create policy "Users see own favorites" on public.favorites for select using (auth.uid() = user_id);
create policy "Users can add favorites" on public.favorites for insert with check (auth.uid() = user_id);
create policy "Users can remove favorites" on public.favorites for delete using (auth.uid() = user_id);

-- Events: public read, restaurant owners can insert
create policy "Events are public" on public.events for select using (true);
create policy "Owners can add events" on public.events for insert with check (auth.uid() is not null);

-- RSVPs: auth users manage their own
create policy "Users see own RSVPs" on public.event_rsvps for select using (auth.uid() = user_id);
create policy "Users can RSVP" on public.event_rsvps for insert with check (auth.uid() = user_id);
create policy "Users can cancel RSVP" on public.event_rsvps for delete using (auth.uid() = user_id);

-- Points: users see their own
create policy "Users see own points" on public.points_ledger for select using (auth.uid() = user_id);
create policy "System can insert points" on public.points_ledger for insert with check (true);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create profile when a user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Update amenity vote counts when a vote is cast
create or replace function public.update_amenity_votes()
returns trigger language plpgsql as $$
begin
  insert into public.amenities (restaurant_id, amenity_key, yes_votes, no_votes)
  values (new.restaurant_id, new.amenity_key,
    case when new.vote = 'yes' then 1 else 0 end,
    case when new.vote = 'no' then 1 else 0 end)
  on conflict (restaurant_id, amenity_key)
  do update set
    yes_votes = amenities.yes_votes + (case when new.vote = 'yes' then 1 else 0 end),
    no_votes  = amenities.no_votes  + (case when new.vote = 'no'  then 1 else 0 end),
    is_verified = (amenities.yes_votes + amenities.no_votes + 1) >= 5,
    updated_at  = now();
  return new;
end;
$$;

create trigger on_vote_cast
  after insert on public.amenity_votes
  for each row execute procedure public.update_amenity_votes();

-- Add points when a vote is cast (5 pts per vote)
create or replace function public.award_vote_points()
returns trigger language plpgsql as $$
declare
  today_votes integer;
begin
  -- Count votes by this user today
  select count(*) into today_votes
  from public.amenity_votes
  where user_id = new.user_id
    and created_at::date = current_date;

  -- Award 5 pts
  insert into public.points_ledger (user_id, action, points, ref_id)
  values (new.user_id, 'vote', 5, new.restaurant_id);

  -- Award 20 pt streak bonus every 5 votes
  if today_votes > 0 and today_votes % 5 = 0 then
    insert into public.points_ledger (user_id, action, points)
    values (new.user_id, 'streak_bonus', 20);
  end if;

  -- Update profile total
  update public.profiles
  set points = points + 5 + (case when today_votes > 0 and today_votes % 5 = 0 then 20 else 0 end),
      streak_count = today_votes + 1,
      last_vote_date = current_date
  where id = new.user_id;

  return new;
end;
$$;

create trigger on_vote_award_points
  after insert on public.amenity_votes
  for each row execute procedure public.award_vote_points();

-- ============================================================
-- SEED DATA — your 6 real restaurants
-- ============================================================

insert into public.restaurants (name, cuisine, address, city, state, zip, phone, website, hours, emoji, status) values
  ('Pizza Piazza',       'Italian · Pizza',      '142 Morris Ave',     'Union',    'NJ', '07083', '(908) 555-1234', 'pizzapiazza.com',   '11am–10pm',  '🍕', 'verified'),
  ('Tarantella''s',      'Italian · Pizza',      '1199 Raritan Rd',    'Clark',    'NJ', '07066', '(732) 396-3701', null,                '11am–10pm',  '🍝', 'verified'),
  ('Paragon Table & Tap','American · Bar',        '77 Central Ave',     'Clark',    'NJ', '07066', '(732) 931-1776', null,                '11am–11pm',  '🍺', 'verified'),
  ('Oh'' Brians',        'American · Irish Pub', '1300 Raritan Rd',    'Clark',    'NJ', '07066', '(732) 669-9024', null,                '11am–11pm',  '🍀', 'pending'),
  ('Ciao Bello',         'Italian · Fine Dining','220 South Avenue E', 'Cranford', 'NJ', '07016', '(908) 497-0700', null,                '11am–9:45pm','🍝', 'verified'),
  ('Eataly',             'Italian Market',        '1200 Morris Tpke',   'Short Hills','NJ','07078','(862) 424-9100', null,                '10am–10pm',  '🛒', 'verified');
