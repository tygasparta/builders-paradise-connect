-- =====================================================================
-- Builders Paradise ERP — Sales posting service
--
-- A sale is TWO accounting events, not one. Both happen in the same
-- transaction as the stock issue:
--
--   At selling price      Dr Accounts Receivable / Cash    (total)
--                         Cr Sales                         (net)
--                         Cr VAT Output                    (tax)
--
--   At cost               Dr Cost of Goods Sold
--                         Cr Inventory
--
-- The cost side uses the weighted average returned by the stock issue,
-- never the catalogue price. That is what makes gross profit real.
-- =====================================================================

create or replace function public.post_sales_invoice(p_invoice_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inv        public.sales_invoices%rowtype;
  v_line       record;
  v_movement   uuid;
  v_unit_cost  numeric(18, 6);
  v_line_cost  numeric(18, 4);
  v_total_cost numeric(18, 4) := 0;
  v_journal_id uuid;
  v_lines      jsonb := '[]'::jsonb;
  v_count      integer;
  v_balance    numeric;
  v_customer   public.customers%rowtype;
  v_debit_acct text;
begin
  select * into v_inv from public.sales_invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Invoice % does not exist', p_invoice_id;
  end if;
  if v_inv.status in ('posted', 'partially_paid', 'paid', 'overdue') then
    raise exception 'Invoice % has already been posted', v_inv.invoice_no;
  end if;
  if v_inv.status = 'cancelled' then
    raise exception 'Invoice % was cancelled and cannot be posted', v_inv.invoice_no;
  end if;
  if v_inv.status <> 'approved' then
    raise exception
      'Invoice % must be approved before posting (it is currently %)',
      v_inv.invoice_no, v_inv.status;
  end if;

  if auth.uid() is not null and not public.has_permission('sales_invoices.post') then
    raise exception 'Posting an invoice needs the "Post sales invoices" permission';
  end if;

  select count(*) into v_count from public.sales_invoice_lines where invoice_id = p_invoice_id;
  if v_count = 0 then
    raise exception 'Invoice % has no lines', v_inv.invoice_no;
  end if;

  ------------------------------------------------------------------
  -- Credit control. A credit sale that would breach the limit stops
  -- here, before any stock moves.
  ------------------------------------------------------------------
  if v_inv.payment_type = 'credit' then
    select * into v_customer from public.customers where id = v_inv.customer_id;

    if v_customer.status = 'on_hold' then
      raise exception
        'Customer "%" is on hold — settle the account before selling on credit', v_customer.name;
    end if;

    if v_customer.credit_limit is not null then
      v_balance := public.customer_balance(v_inv.customer_id);
      if (v_balance + v_inv.total) > v_customer.credit_limit then
        if auth.uid() is not null and not public.has_permission('sales.credit_sale.approve') then
          raise exception
            'This sale takes "%" to %, over their credit limit of %. Approval is needed.',
            v_customer.name,
            round(v_balance + v_inv.total, 2),
            round(v_customer.credit_limit, 2);
        end if;
      end if;
    end if;
  end if;

  ------------------------------------------------------------------
  -- Stock out, line by line, capturing the cost each issue left at.
  ------------------------------------------------------------------
  for v_line in
    select l.*, p.track_stock
    from public.sales_invoice_lines l
    join public.products p on p.id = l.product_id
    where l.invoice_id = p_invoice_id
    order by l.line_no
  loop
    if v_line.track_stock then
      v_movement := public.post_inventory_movement(
        p_product_id             => v_line.product_id,
        p_warehouse_id           => v_inv.warehouse_id,
        p_movement_type          => 'sale',
        p_quantity               => v_line.quantity,
        p_unit_cost              => null,
        p_source_module          => 'sales',
        p_source_document_type   => 'INVOICE',
        p_source_document_id     => v_inv.id,
        p_source_document_number => v_inv.invoice_no,
        p_movement_date          => v_inv.invoice_date
      );

      -- The engine decides the cost; we record what it decided.
      select unit_cost, total_cost into v_unit_cost, v_line_cost
      from public.inventory_movements where id = v_movement;
    else
      v_unit_cost := 0;
      v_line_cost := 0;
    end if;

    update public.sales_invoice_lines
       set unit_cost = v_unit_cost, line_cost = v_line_cost
     where id = v_line.id;

    v_total_cost := v_total_cost + coalesce(v_line_cost, 0);
  end loop;

  ------------------------------------------------------------------
  -- The revenue leg.
  ------------------------------------------------------------------
  v_debit_acct := case when v_inv.payment_type = 'cash' then '1110' else '1200' end;

  v_lines := jsonb_build_array(
    jsonb_build_object(
      'account_code', v_debit_acct,
      'debit', v_inv.total,
      'credit', 0,
      'description', 'Sale ' || v_inv.invoice_no,
      'customer_id', v_inv.customer_id
    ),
    jsonb_build_object(
      'account_code', '4100',
      'debit', 0,
      'credit', round(v_inv.subtotal - v_inv.discount_total, 4),
      'description', 'Revenue ' || v_inv.invoice_no,
      'customer_id', v_inv.customer_id
    )
  );

  if v_inv.tax_total > 0 then
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object(
        'account_code', '2220',
        'debit', 0,
        'credit', v_inv.tax_total,
        'description', 'Output tax ' || v_inv.invoice_no
      )
    );
  end if;

  ------------------------------------------------------------------
  -- The cost leg, in the same journal so the pair can never separate.
  ------------------------------------------------------------------
  if v_total_cost > 0 then
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object(
        'account_code', '5100',
        'debit', v_total_cost,
        'credit', 0,
        'description', 'Cost of sales ' || v_inv.invoice_no
      ),
      jsonb_build_object(
        'account_code', '1300',
        'debit', 0,
        'credit', v_total_cost,
        'description', 'Stock issued on ' || v_inv.invoice_no
      )
    );
  end if;

  v_journal_id := public.post_journal_entry(
    p_reference              => 'JNL-' || v_inv.invoice_no,
    p_description            => 'Sales invoice ' || v_inv.invoice_no,
    p_lines                  => v_lines,
    p_journal_date           => v_inv.invoice_date,
    p_source_module          => 'sales',
    p_source_document_type   => 'INVOICE',
    p_source_document_id     => v_inv.id,
    p_source_document_number => v_inv.invoice_no,
    p_branch_id              => v_inv.branch_id,
    p_is_system              => true
  );

  ------------------------------------------------------------------
  -- Seal it. A cash sale is settled the moment it is posted.
  ------------------------------------------------------------------
  update public.sales_invoices
     set status           = case when payment_type = 'cash' then 'paid' else 'posted' end,
         amount_paid      = case when payment_type = 'cash' then total else 0 end,
         cost_of_sales    = v_total_cost,
         posted_at        = now(),
         posted_by        = auth.uid(),
         journal_entry_id = v_journal_id
   where id = p_invoice_id;

  return v_journal_id;
end;
$$;

grant execute on function public.post_sales_invoice(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Returns / credit notes — the mirror image
-- ---------------------------------------------------------------------

create or replace function public.post_sales_return(p_return_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ret        public.sales_returns%rowtype;
  v_line       record;
  v_movement   uuid;
  v_unit_cost  numeric(18, 6);
  v_line_cost  numeric(18, 4);
  v_total_cost numeric(18, 4) := 0;
  v_journal_id uuid;
  v_lines      jsonb;
  v_count      integer;
begin
  select * into v_ret from public.sales_returns where id = p_return_id for update;
  if not found then
    raise exception 'Return % does not exist', p_return_id;
  end if;
  if v_ret.status = 'posted' then
    raise exception 'Return % has already been posted', v_ret.return_no;
  end if;
  if v_ret.status <> 'approved' then
    raise exception 'Return % must be approved before posting', v_ret.return_no;
  end if;

  if auth.uid() is not null and not public.has_permission('sales_returns.approve') then
    raise exception 'Posting a return needs the "Approve sales returns" permission';
  end if;

  select count(*) into v_count from public.sales_return_lines where return_id = p_return_id;
  if v_count = 0 then
    raise exception 'Return % has no lines', v_ret.return_no;
  end if;

  ------------------------------------------------------------------
  -- Stock back in, but only if the goods are resaleable. Damaged
  -- returns are credited to the customer without restocking.
  ------------------------------------------------------------------
  for v_line in
    select l.*, p.track_stock
    from public.sales_return_lines l
    join public.products p on p.id = l.product_id
    where l.return_id = p_return_id
    order by l.line_no
  loop
    if v_ret.restock and v_line.track_stock then
      -- Return at the cost the original sale left at, so a return does
      -- not quietly revalue the remaining stock.
      v_movement := public.post_inventory_movement(
        p_product_id             => v_line.product_id,
        p_warehouse_id           => v_ret.warehouse_id,
        p_movement_type          => 'customer_return',
        p_quantity               => v_line.quantity,
        p_unit_cost              => nullif(v_line.unit_cost, 0),
        p_source_module          => 'sales',
        p_source_document_type   => 'RETURN',
        p_source_document_id     => v_ret.id,
        p_source_document_number => v_ret.return_no,
        p_movement_date          => v_ret.return_date,
        p_reason                 => v_ret.reason
      );

      select unit_cost, total_cost into v_unit_cost, v_line_cost
      from public.inventory_movements where id = v_movement;

      update public.sales_return_lines
         set unit_cost = v_unit_cost, line_cost = v_line_cost
       where id = v_line.id;

      v_total_cost := v_total_cost + coalesce(v_line_cost, 0);
    end if;
  end loop;

  ------------------------------------------------------------------
  -- Revenue reversed through Sales Returns, not by debiting Sales, so
  -- gross turnover stays visible on the income statement.
  ------------------------------------------------------------------
  v_lines := jsonb_build_array(
    jsonb_build_object(
      'account_code', '4200',
      'debit', round(v_ret.subtotal, 4),
      'credit', 0,
      'description', 'Return ' || v_ret.return_no,
      'customer_id', v_ret.customer_id
    ),
    jsonb_build_object(
      'account_code', '1200',
      'debit', 0,
      'credit', v_ret.total,
      'description', 'Credit to customer ' || v_ret.return_no,
      'customer_id', v_ret.customer_id
    )
  );

  if v_ret.tax_total > 0 then
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object(
        'account_code', '2220',
        'debit', v_ret.tax_total,
        'credit', 0,
        'description', 'Output tax reversed ' || v_ret.return_no
      )
    );
  end if;

  if v_total_cost > 0 then
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object(
        'account_code', '1300',
        'debit', v_total_cost,
        'credit', 0,
        'description', 'Stock returned on ' || v_ret.return_no
      ),
      jsonb_build_object(
        'account_code', '5100',
        'debit', 0,
        'credit', v_total_cost,
        'description', 'Cost of sales reversed ' || v_ret.return_no
      )
    );
  end if;

  v_journal_id := public.post_journal_entry(
    p_reference              => 'JNL-' || v_ret.return_no,
    p_description            => 'Sales return ' || v_ret.return_no,
    p_lines                  => v_lines,
    p_journal_date           => v_ret.return_date,
    p_source_module          => 'sales',
    p_source_document_type   => 'RETURN',
    p_source_document_id     => v_ret.id,
    p_source_document_number => v_ret.return_no,
    p_branch_id              => v_ret.branch_id,
    p_is_system              => true
  );

  update public.sales_returns
     set status = 'posted', posted_at = now(), posted_by = auth.uid(),
         cost_of_sales = v_total_cost, journal_entry_id = v_journal_id
   where id = p_return_id;

  return v_journal_id;
end;
$$;

grant execute on function public.post_sales_return(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table public.sales_quotations             enable row level security;
alter table public.sales_quotation_lines        enable row level security;
alter table public.sales_invoices               enable row level security;
alter table public.sales_invoice_lines          enable row level security;
alter table public.sales_returns                enable row level security;
alter table public.sales_return_lines           enable row level security;
alter table public.customer_receipts            enable row level security;
alter table public.customer_receipt_allocations enable row level security;

do $$
declare
  spec record;
begin
  for spec in
    select * from (values
      ('sales_quotations',  'quotations.view',      'quotations.create'),
      ('sales_invoices',    'sales_invoices.view',  'sales_invoices.create'),
      ('sales_returns',     'sales_returns.view',   'sales_returns.create'),
      ('customer_receipts', 'customer_receipts.view','customer_receipts.create')
    ) as x(tbl, view_perm, write_perm)
  loop
    execute format('drop policy if exists %1$s_select on public.%1$I', spec.tbl);
    execute format($p$
      create policy %1$s_select on public.%1$I
        for select to authenticated using (public.has_permission(%2$L))
    $p$, spec.tbl, spec.view_perm);

    execute format('drop policy if exists %1$s_insert on public.%1$I', spec.tbl);
    execute format($p$
      create policy %1$s_insert on public.%1$I
        for insert to authenticated with check (public.has_permission(%2$L))
    $p$, spec.tbl, spec.write_perm);

    execute format('drop policy if exists %1$s_update on public.%1$I', spec.tbl);
    execute format($p$
      create policy %1$s_update on public.%1$I
        for update to authenticated
        using (public.has_permission(%2$L))
        with check (public.has_permission(%2$L))
    $p$, spec.tbl, spec.write_perm);
  end loop;
end;
$$;

-- Line tables follow their header's permission.
do $$
declare
  spec record;
begin
  for spec in
    select * from (values
      ('sales_quotation_lines',        'quotation_id', 'sales_quotations',  'quotations.view',       'quotations.create'),
      ('sales_invoice_lines',          'invoice_id',   'sales_invoices',    'sales_invoices.view',   'sales_invoices.create'),
      ('sales_return_lines',           'return_id',    'sales_returns',     'sales_returns.view',    'sales_returns.create'),
      ('customer_receipt_allocations', 'receipt_id',   'customer_receipts', 'customer_receipts.view','customer_receipts.allocate')
    ) as x(tbl, fk, parent, view_perm, write_perm)
  loop
    execute format('drop policy if exists %1$s_select on public.%1$I', spec.tbl);
    execute format($p$
      create policy %1$s_select on public.%1$I
        for select to authenticated using (public.has_permission(%2$L))
    $p$, spec.tbl, spec.view_perm);

    execute format('drop policy if exists %1$s_write on public.%1$I', spec.tbl);
    execute format($p$
      create policy %1$s_write on public.%1$I
        for all to authenticated
        using (public.has_permission(%2$L))
        with check (public.has_permission(%2$L))
    $p$, spec.tbl, spec.write_perm);
  end loop;
end;
$$;
