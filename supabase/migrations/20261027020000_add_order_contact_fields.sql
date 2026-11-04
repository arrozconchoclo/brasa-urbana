alter table public.orders
  add column if not exists email text;
