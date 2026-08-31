-- Allow the campaign prize amount to be updated after the first grant.

create policy "ledger update self" on public.ledger
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
