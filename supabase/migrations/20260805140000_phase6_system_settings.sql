-- =====================================================================
-- Builders Paradise ERP — System settings
--
-- Document numbering is the only reference data with no write policy:
-- units of measure, categories and brands are already maintainable by
-- product editors.
--
-- Numbering is dangerous to edit. next_number is what the whole system
-- counts on for unique document numbers, so this adds a write policy for
-- administrators AND a trigger that refuses to move the counter
-- backwards — that would hand out numbers already issued and collide on
-- the unique constraint of every document table.
--
-- Re-runnable.
-- =====================================================================

drop policy if exists doc_seq_update on public.document_sequences;
create policy doc_seq_update on public.document_sequences
  for update to authenticated
  using (public.has_permission('settings.system.manage'))
  with check (public.has_permission('settings.system.manage'));

/**
 * Refuses a numbering change that would reissue existing numbers.
 *
 * next_document_number() runs as security definer and bumps the counter
 * itself; this guard only constrains a human editing the row.
 */
create or replace function public.fn_guard_document_sequence()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.next_number < old.next_number then
    raise exception
      'Numbering for % cannot go backwards (% to %). Those numbers have already been issued and would collide.',
      old.doc_type, old.next_number, new.next_number;
  end if;

  if new.doc_type is distinct from old.doc_type then
    raise exception 'The document type of a sequence cannot be changed';
  end if;

  if new.prefix is null or btrim(new.prefix) = '' then
    raise exception 'A sequence needs a prefix';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_doc_seq_guard on public.document_sequences;
create trigger trg_doc_seq_guard
  before update on public.document_sequences
  for each row execute function public.fn_guard_document_sequence();

-- Audit numbering changes: this is exactly the sort of edit someone will
-- later need explained.
drop trigger if exists trg_doc_seq_audit on public.document_sequences;
create trigger trg_doc_seq_audit
  after insert or update or delete on public.document_sequences
  for each row execute function public.fn_audit('settings');
