-- Barterin core schema. Run in Supabase: SQL Editor > paste > Run.
create table public.profiles (id uuid primary key references auth.users on delete cascade, name text not null default '', city text not null default '', bio text not null default '', interests text[] not null default '{}', created_at timestamptz default now());
alter table public.profiles enable row level security;
create policy "profiles readable" on public.profiles for select using (true);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles(id, name, city) values (new.id, coalesce(new.raw_user_meta_data->>'name',''), coalesce(new.raw_user_meta_data->>'city','')); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.offers (id uuid primary key default gen_random_uuid(), owner uuid references auth.users on delete cascade, title text not null, description text not null default '', category text not null default 'Other', city text not null default '', price_idr bigint not null default 0, wants text not null default '', images text[] not null default '{}', status text not null default 'open' check (status in ('open','traded','removed')), is_sample boolean not null default false, created_at timestamptz default now());
alter table public.offers enable row level security;
create policy "offers readable" on public.offers for select using (status <> 'removed' or owner = auth.uid());
create policy "own offers insert" on public.offers for insert with check (auth.uid() = owner and not is_sample);
create policy "own offers update" on public.offers for update using (auth.uid() = owner);
create policy "own offers delete" on public.offers for delete using (auth.uid() = owner);

-- cash_idr > 0: proposer adds cash. cash_idr < 0: proposer asks owner to add cash.
create table public.trades (id uuid primary key default gen_random_uuid(), offer_id uuid not null references public.offers on delete cascade, proposer uuid not null references auth.users, owner uuid not null references auth.users, cash_idr bigint not null default 0, note text not null default '', status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled','completed')), created_at timestamptz default now());
create table public.trade_items (trade_id uuid references public.trades on delete cascade, offer_id uuid references public.offers on delete cascade, side text not null check (side in ('proposer','owner')), primary key (trade_id, offer_id));
create table public.messages (id uuid primary key default gen_random_uuid(), trade_id uuid not null references public.trades on delete cascade, sender uuid not null references auth.users, body text not null, created_at timestamptz default now());
alter table public.trades enable row level security; alter table public.trade_items enable row level security; alter table public.messages enable row level security;
create policy "parties read trades" on public.trades for select using (auth.uid() in (proposer, owner));
create policy "proposer creates trades" on public.trades for insert with check (auth.uid() = proposer and proposer <> owner);
create policy "parties update trades" on public.trades for update using (auth.uid() in (proposer, owner));
create policy "parties read items" on public.trade_items for select using (exists (select 1 from public.trades t where t.id = trade_id and auth.uid() in (t.proposer, t.owner)));
create policy "proposer adds items" on public.trade_items for insert with check (exists (select 1 from public.trades t where t.id = trade_id and t.proposer = auth.uid()));
create policy "parties read messages" on public.messages for select using (exists (select 1 from public.trades t where t.id = trade_id and auth.uid() in (t.proposer, t.owner)));
create policy "parties send messages" on public.messages for insert with check (sender = auth.uid() and exists (select 1 from public.trades t where t.id = trade_id and auth.uid() in (t.proposer, t.owner)));
alter publication supabase_realtime add table public.messages;

insert into storage.buckets (id, name, public) values ('offer-images','offer-images',true) on conflict do nothing;
create policy "images public read" on storage.objects for select using (bucket_id = 'offer-images');
create policy "images own upload" on storage.objects for insert to authenticated with check (bucket_id = 'offer-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "images own delete" on storage.objects for delete to authenticated using (bucket_id = 'offer-images' and (storage.foldername(name))[1] = auth.uid()::text);
