-- =====================================================================
-- Fix: reverse_journal_entry() was blocked by its own immutability guard
--
-- The reversal posted its mirror journal and then ran a second UPDATE to
-- set reverses_journal_id on it. fn_block_journal_mutation() refuses any
-- update to a posted journal except marking it reversed — so reversal
-- failed with "Posted journals cannot be edited".
--
-- The guard is correct. The reversal was wrong: the link to the original
-- is part of the journal's identity at the moment it is written, not a
-- later mutation. It is now set in the INSERT.
--
-- Re-runnable. Requires 20260804120000 and 20260804120100.
-- =====================================================================

-- Adding a parameter changes the signature, which would leave the old
-- function behind as an overload and make calls ambiguous. Drop it first.
drop function if exists public.post_journal_entry(
  text, text, jsonb, date, text, text, uuid, text, uuid, boolean
);

create or replace function public.post_journal_entry(
  p_reference              text,
  p_description            text,
  p_lines                  jsonb,
  p_journal_date           date default current_date,
  p_source_module          text default null,
  p_source_document_type   text default null,
  p_source_document_id     uuid default null,
  p_source_document_number text default null,
  p_branch_id              uuid default null,
  p_is_system              boolean default true,
  -- Set when this journal reverses another. Written with the header so
  -- the finished journal is never updated.
  p_reverses_journal_id    uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_journal_id   uuid;
  v_period_id    uuid;
  v_period       public.accounting_periods%rowtype;
  v_line         jsonb;
  v_account      public.chart_of_accounts%rowtype;
  v_debit        numeric(18, 4);
  v_credit       numeric(18, 4);
  v_total_debit  numeric(18, 4) := 0;
  v_total_credit numeric(18, 4) := 0;
  v_line_no      integer := 0;
begin
  if p_lines is null or jsonb_array_length(p_lines) < 2 then
    raise exception 'A journal needs at least two lines';
  end if;

  v_period_id := public.period_for_date(coalesce(p_journal_date, current_date));
  if v_period_id is null then
    raise exception
      'No accounting period covers %. Create the period before posting.', p_journal_date;
  end if;

  select * into v_period from public.accounting_periods where id = v_period_id;
  if v_period.status <> 'open' then
    raise exception
      'Accounting period "%" is % — it cannot accept new entries', v_period.name, v_period.status;
  end if;

  -- Total first, so an unbalanced journal is refused before any row is
  -- written rather than failing halfway through.
  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_debit  := round(coalesce((v_line ->> 'debit')::numeric, 0), 4);
    v_credit := round(coalesce((v_line ->> 'credit')::numeric, 0), 4);

    if v_debit < 0 or v_credit < 0 then
      raise exception 'Journal amounts cannot be negative — use the other side instead';
    end if;
    if (v_debit > 0 and v_credit > 0) or (v_debit = 0 and v_credit = 0) then
      raise exception 'Each journal line must be either a debit or a credit, not both or neither';
    end if;

    v_total_debit  := v_total_debit + v_debit;
    v_total_credit := v_total_credit + v_credit;
  end loop;

  if v_total_debit <> v_total_credit then
    raise exception
      'Journal does not balance: debits % against credits %', v_total_debit, v_total_credit;
  end if;
  if v_total_debit = 0 then
    raise exception 'A journal with no value cannot be posted';
  end if;

  insert into public.journal_entries (
    reference, journal_date, period_id, description,
    source_module, source_document_type, source_document_id, source_document_number,
    is_system, total_debit, total_credit, branch_id, reverses_journal_id, created_by
  ) values (
    p_reference, coalesce(p_journal_date, current_date), v_period_id, p_description,
    p_source_module, p_source_document_type, p_source_document_id, p_source_document_number,
    p_is_system, v_total_debit, v_total_credit, p_branch_id, p_reverses_journal_id, auth.uid()
  )
  returning id into v_journal_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_line_no := v_line_no + 1;

    select * into v_account
    from public.chart_of_accounts
    where account_code = (v_line ->> 'account_code');

    if not found then
      raise exception 'Ledger account "%" does not exist', v_line ->> 'account_code';
    end if;
    if not v_account.is_postable then
      raise exception
        'Account % "%" is a heading and cannot be posted to', v_account.account_code, v_account.name;
    end if;
    if v_account.status <> 'active' then
      raise exception 'Account % "%" is inactive', v_account.account_code, v_account.name;
    end if;

    insert into public.journal_entry_lines (
      journal_id, line_no, account_id, description, debit, credit,
      branch_id, supplier_id, customer_id, product_id
    ) values (
      v_journal_id,
      v_line_no,
      v_account.id,
      v_line ->> 'description',
      round(coalesce((v_line ->> 'debit')::numeric, 0), 4),
      round(coalesce((v_line ->> 'credit')::numeric, 0), 4),
      coalesce((v_line ->> 'branch_id')::uuid, p_branch_id),
      (v_line ->> 'supplier_id')::uuid,
      (v_line ->> 'customer_id')::uuid,
      (v_line ->> 'product_id')::uuid
    );
  end loop;

  return v_journal_id;
end;
$$;

grant execute on function public.post_journal_entry(
  text, text, jsonb, date, text, text, uuid, text, uuid, boolean, uuid
) to authenticated;

-- ---------------------------------------------------------------------
-- Reversal: one insert, one permitted update, no second mutation.
-- ---------------------------------------------------------------------

create or replace function public.reverse_journal_entry(
  p_journal_id    uuid,
  p_reason        text,
  p_reversal_date date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_original public.journal_entries%rowtype;
  v_lines    jsonb;
  v_new_id   uuid;
begin
  select * into v_original from public.journal_entries where id = p_journal_id;
  if not found then
    raise exception 'Journal % does not exist', p_journal_id;
  end if;
  if v_original.status = 'reversed' then
    raise exception 'Journal % has already been reversed', v_original.reference;
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'account_code', a.account_code,
      'debit',  l.credit,
      'credit', l.debit,
      'description', coalesce(l.description, '') || ' (reversal)',
      'branch_id', l.branch_id,
      'supplier_id', l.supplier_id,
      'customer_id', l.customer_id,
      'product_id', l.product_id
    ) order by l.line_no
  )
  into v_lines
  from public.journal_entry_lines l
  join public.chart_of_accounts a on a.id = l.account_id
  where l.journal_id = p_journal_id;

  v_new_id := public.post_journal_entry(
    p_reference              => v_original.reference || '-REV',
    p_description            => 'Reversal of ' || v_original.reference || ' — ' || p_reason,
    p_lines                  => v_lines,
    p_journal_date           => coalesce(p_reversal_date, current_date),
    p_source_module          => v_original.source_module,
    p_source_document_type   => v_original.source_document_type,
    p_source_document_id     => v_original.source_document_id,
    p_source_document_number => v_original.source_document_number,
    p_branch_id              => v_original.branch_id,
    p_is_system              => v_original.is_system,
    p_reverses_journal_id    => p_journal_id
  );

  -- The one update the immutability guard allows.
  update public.journal_entries
     set status = 'reversed', reversed_by_journal_id = v_new_id
   where id = p_journal_id;

  return v_new_id;
end;
$$;

grant execute on function public.reverse_journal_entry(uuid, text, date) to authenticated;

-- ---------------------------------------------------------------------
-- Tidy up after the failed verification run.
--
-- The first attempt posted its test journal and then could not reverse
-- it, leaving 1000 sitting in Inventory and Accounts Payable. Journals
-- are immutable, so the correct remedy is a reversal, not a delete.
-- ---------------------------------------------------------------------

do $$
declare
  v_journal record;
begin
  for v_journal in
    select id, reference
    from public.journal_entries
    where reference like 'ZZVERIFY-%'
      and reference not like '%-REV'
      and status = 'posted'
      and reversed_by_journal_id is null
  loop
    perform public.reverse_journal_entry(
      v_journal.id, 'unreversed entry from an interrupted verification run');
    raise notice 'Reversed stranded verification journal %', v_journal.reference;
  end loop;
end;
$$;
