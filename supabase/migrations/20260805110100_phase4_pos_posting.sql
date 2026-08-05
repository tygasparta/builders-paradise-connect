-- =====================================================================
-- Builders Paradise ERP — let a cashier post a till sale
--
-- post_sales_invoice() required sales_invoices.post. A cashier holds
-- pos.operate and not that, so completing a sale at the till would have
-- been refused at the last step — after the customer had paid.
--
-- The permission check now accepts either: the invoice-posting right, or
-- pos.operate on an invoice attached to an OPEN till session. Everything
-- else about the posting is unchanged.
--
-- Re-runnable. Requires 20260805110000.
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

  -- Either the invoice-posting right, or a cashier on an open till.
  if auth.uid() is not null and not public.can_post_invoice(p_invoice_id) then
    raise exception 'Posting an invoice needs the "Post sales invoices" permission';
  end if;

  select count(*) into v_count from public.sales_invoice_lines where invoice_id = p_invoice_id;
  if v_count = 0 then
    raise exception 'Invoice % has no lines', v_inv.invoice_no;
  end if;

  ------------------------------------------------------------------
  -- Credit control, before any stock moves.
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
  -- Stock out, capturing the cost each issue left at.
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
  -- Revenue leg. A till sale debits Cash on Hand like any cash sale.
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
    p_source_module          => case when v_inv.pos_session_id is null then 'sales' else 'pos' end,
    p_source_document_type   => 'INVOICE',
    p_source_document_id     => v_inv.id,
    p_source_document_number => v_inv.invoice_no,
    p_branch_id              => v_inv.branch_id,
    p_is_system              => true
  );

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
