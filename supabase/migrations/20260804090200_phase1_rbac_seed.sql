-- =====================================================================
-- Builders Paradise ERP — Phase 1: role and permission catalogue
--
-- Structural data, not demo data. Re-runnable: upserts by code and
-- never deletes a grant an administrator has added by hand.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Permission catalogue
--
-- Naming: <module>.<resource>.<action>, or <module>.<action> where the
-- module has a single resource. Codes are stable API — the TypeScript
-- catalogue in src/lib/permissions/catalog.ts mirrors this list exactly
-- and a unit test fails if the two drift.
-- ---------------------------------------------------------------------

insert into public.permissions (code, module, name, description) values
  -- Dashboard
  ('dashboard.view',                    'dashboard',  'View dashboard',                'See the operational dashboard'),
  ('dashboard.financials.view',         'dashboard',  'View dashboard financials',     'See profit, cash and bank figures on the dashboard'),

  -- Products and inventory
  ('inventory.view',                    'inventory',  'View inventory',                'Open the inventory module'),
  ('products.view',                     'inventory',  'View products',                 'See the product catalogue'),
  ('products.create',                   'inventory',  'Create products',               'Add new products'),
  ('products.update',                   'inventory',  'Edit products',                 'Change product details'),
  ('products.archive',                  'inventory',  'Archive products',              'Deactivate a product'),
  ('products.cost_price.view',          'inventory',  'View cost prices',              'See buying cost and margin'),
  ('products.selling_price.update',     'inventory',  'Change selling prices',         'Amend the configured selling price'),
  ('inventory.balances.view',           'inventory',  'View stock balances',           'See quantity on hand by warehouse'),
  ('inventory.movements.view',          'inventory',  'View stock movements',          'See the stock movement ledger'),
  ('inventory.adjustments.view',        'inventory',  'View stock adjustments',        'See adjustment documents'),
  ('inventory.adjustments.create',      'inventory',  'Raise stock adjustments',       'Request a stock adjustment'),
  ('inventory.adjustments.approve',     'inventory',  'Approve stock adjustments',     'Authorise an adjustment'),
  ('inventory.adjustments.post',        'inventory',  'Post stock adjustments',        'Commit an adjustment to stock and the ledger'),
  ('inventory.transfers.view',          'inventory',  'View stock transfers',          'See transfers between warehouses'),
  ('inventory.transfers.create',        'inventory',  'Create stock transfers',        'Move stock between warehouses'),
  ('inventory.transfers.approve',       'inventory',  'Approve stock transfers',       'Authorise a transfer'),
  ('inventory.requisitions.view',       'inventory',  'View stock requisitions',       'See employee stock requests'),
  ('inventory.requisitions.create',     'inventory',  'Raise stock requisitions',      'Request stock as an employee'),
  ('inventory.requisitions.approve',    'inventory',  'Approve stock requisitions',    'Authorise a stock request'),
  ('inventory.requisitions.issue',      'inventory',  'Issue requisitioned stock',     'Release stock to the in-transit location'),
  ('inventory.requisitions.receive',    'inventory',  'Confirm requisition receipt',   'Confirm stock received into an employee warehouse'),
  ('inventory.counts.view',             'inventory',  'View stock counts',             'See stock count sheets'),
  ('inventory.counts.create',           'inventory',  'Create stock counts',           'Open a new count'),
  ('inventory.counts.assign',           'inventory',  'Assign stock counters',         'Allocate staff to a count'),
  ('inventory.counts.capture',          'inventory',  'Capture counted quantities',    'Enter physical counts'),
  ('inventory.counts.approve',          'inventory',  'Approve stock counts',          'Sign off count variances'),
  ('inventory.counts.post',             'inventory',  'Post stock count variances',    'Commit variances to stock and the ledger'),
  ('inventory.negative_stock.allow',    'inventory',  'Allow negative stock',          'Override the negative stock block'),

  -- Warehouses
  ('warehouses.view',                   'warehouses', 'View warehouses',               'See warehouses and locations'),
  ('warehouses.manage',                 'warehouses', 'Manage warehouses',             'Create and edit warehouses and locations'),

  -- Purchasing
  ('purchasing.view',                   'purchasing', 'View purchasing',               'Open the purchasing module'),
  ('purchase_requisitions.view',        'purchasing', 'View purchase requisitions',    'See purchase requests'),
  ('purchase_requisitions.create',      'purchasing', 'Create purchase requisitions',  'Raise a purchase request'),
  ('purchase_requisitions.approve',     'purchasing', 'Approve purchase requisitions', 'Authorise a purchase request'),
  ('purchase_orders.view',              'purchasing', 'View purchase orders',          'See purchase orders'),
  ('purchase_orders.create',            'purchasing', 'Create purchase orders',        'Raise a purchase order'),
  ('purchase_orders.approve',           'purchasing', 'Approve purchase orders',       'Authorise a purchase order'),
  ('purchase_orders.cancel',            'purchasing', 'Cancel purchase orders',        'Cancel an open purchase order'),
  ('grn.view',                          'purchasing', 'View goods received notes',     'See GRNs'),
  ('grn.create',                        'purchasing', 'Receive goods',                 'Capture a goods received note'),
  ('grn.inspect',                       'purchasing', 'Inspect delivered goods',       'Record accepted and rejected quantities'),
  ('grn.approve',                       'purchasing', 'Approve GRNs',                  'Authorise a goods received note'),
  ('grn.post',                          'purchasing', 'Post GRNs',                     'Commit a GRN to stock and the ledger'),
  ('supplier_invoices.view',            'purchasing', 'View supplier invoices',        'See supplier bills'),
  ('supplier_invoices.create',          'purchasing', 'Capture supplier invoices',     'Enter a supplier bill'),
  ('supplier_invoices.approve',         'purchasing', 'Approve supplier invoices',     'Authorise a supplier bill'),
  ('supplier_invoices.post',            'purchasing', 'Post supplier invoices',        'Commit a supplier bill to the ledger'),
  ('supplier_payments.view',            'purchasing', 'View supplier payments',        'See payments to suppliers'),
  ('supplier_payments.create',          'purchasing', 'Create supplier payments',      'Prepare a supplier payment'),
  ('supplier_payments.approve',         'purchasing', 'Approve supplier payments',     'Authorise a supplier payment'),
  ('supplier_payments.post',            'purchasing', 'Post supplier payments',        'Commit a supplier payment'),
  ('suppliers.view',                    'purchasing', 'View suppliers',                'See supplier records'),
  ('suppliers.create',                  'purchasing', 'Create suppliers',              'Add a supplier'),
  ('suppliers.update',                  'purchasing', 'Edit suppliers',                'Change supplier details'),
  ('suppliers.archive',                 'purchasing', 'Archive suppliers',             'Deactivate a supplier'),

  -- Sales
  ('sales.view',                        'sales',      'View sales',                    'Open the sales module'),
  ('quotations.view',                   'sales',      'View quotations',               'See customer quotations'),
  ('quotations.create',                 'sales',      'Create quotations',             'Raise a quotation'),
  ('sales_orders.view',                 'sales',      'View sales orders',             'See sales orders'),
  ('sales_orders.create',               'sales',      'Create sales orders',           'Raise a sales order'),
  ('sales_orders.approve',              'sales',      'Approve sales orders',          'Authorise a sales order'),
  ('sales_invoices.view',               'sales',      'View sales invoices',           'See customer invoices'),
  ('sales_invoices.create',             'sales',      'Create sales invoices',         'Raise a customer invoice'),
  ('sales_invoices.approve',            'sales',      'Approve sales invoices',        'Authorise a customer invoice'),
  ('sales_invoices.post',               'sales',      'Post sales invoices',           'Commit an invoice to the ledger'),
  ('sales_invoices.cancel',             'sales',      'Cancel sales invoices',         'Cancel an unposted invoice'),
  ('sales_returns.view',                'sales',      'View sales returns',            'See customer returns'),
  ('sales_returns.create',              'sales',      'Process sales returns',         'Capture a customer return'),
  ('sales_returns.approve',             'sales',      'Approve sales returns',         'Authorise a customer return'),
  ('credit_notes.create',               'sales',      'Create credit notes',           'Raise a credit note'),
  ('credit_notes.approve',              'sales',      'Approve credit notes',          'Authorise a credit note'),
  ('customer_receipts.view',            'sales',      'View customer receipts',        'See money received from customers'),
  ('customer_receipts.create',          'sales',      'Capture customer receipts',     'Record a customer payment'),
  ('customer_receipts.allocate',        'sales',      'Allocate customer receipts',    'Apply a receipt to invoices'),
  ('customer_receipts.post',            'sales',      'Post customer receipts',        'Commit a receipt to the ledger'),
  ('sales.discount.apply',              'sales',      'Apply discounts',               'Give a discount within your limit'),
  ('sales.discount.override',           'sales',      'Override discount limits',      'Exceed the standard discount limit'),
  ('sales.credit_sale.approve',         'sales',      'Approve credit sales',          'Authorise a sale on account'),
  ('customers.view',                    'sales',      'View customers',                'See customer records'),
  ('customers.create',                  'sales',      'Create customers',              'Add a customer'),
  ('customers.update',                  'sales',      'Edit customers',                'Change customer details'),
  ('customers.archive',                 'sales',      'Archive customers',             'Deactivate a customer'),
  ('customers.credit_limit.manage',     'sales',      'Manage credit limits',          'Set customer credit limits and terms'),

  -- Point of sale
  ('pos.operate',                       'pos',        'Operate the till',              'Ring up sales at the point of sale'),
  ('pos.session.open',                  'pos',        'Open a till session',           'Start a cashier shift'),
  ('pos.session.close',                 'pos',        'Close a till session',          'End a cashier shift and declare cash'),
  ('pos.price.override',                'pos',        'Override till prices',          'Change a selling price at the till'),
  ('pos.refund',                        'pos',        'Process till refunds',          'Refund or exchange against a sale'),
  ('pos.reprint',                       'pos',        'Reprint receipts',              'Reprint a previous receipt'),
  ('pos.cash_count',                    'pos',        'Perform cash counts',           'Count the drawer and record variance'),

  -- Accounting
  ('accounting.view',                   'accounting', 'View accounting',               'Open the accounting module'),
  ('coa.view',                          'accounting', 'View chart of accounts',        'See the chart of accounts'),
  ('coa.manage',                        'accounting', 'Manage chart of accounts',      'Create and edit ledger accounts'),
  ('gl.view',                           'accounting', 'View general ledger',           'See ledger transactions'),
  ('journals.view',                     'accounting', 'View journals',                 'See journal entries'),
  ('journals.create',                   'accounting', 'Create journals',               'Capture a manual journal'),
  ('journals.post',                     'accounting', 'Post journals',                 'Commit a journal to the ledger'),
  ('journals.reverse',                  'accounting', 'Reverse journals',              'Reverse a posted journal'),
  ('accounting.periods.manage',         'accounting', 'Manage accounting periods',     'Open and lock accounting periods'),
  ('accounting.year_end.close',         'accounting', 'Run year end',                  'Close a financial year'),

  -- Banking
  ('banking.view',                      'banking',    'View banking',                  'Open the banking module'),
  ('bank_accounts.manage',              'banking',    'Manage bank accounts',          'Create and edit bank accounts'),
  ('bank_transactions.create',          'banking',    'Capture bank transactions',     'Record bank movements'),
  ('bank_reconciliation.perform',       'banking',    'Reconcile bank accounts',       'Match statement lines'),
  ('bank_reconciliation.finalise',      'banking',    'Finalise reconciliations',      'Lock a completed reconciliation'),

  -- Expenses
  ('expenses.view',                     'expenses',   'View expenses',                 'See expense records'),
  ('expenses.create',                   'expenses',   'Raise expenses',                'Submit an expense or voucher'),
  ('expenses.approve',                  'expenses',   'Approve expenses',              'Authorise an expense'),
  ('expenses.pay',                      'expenses',   'Pay expenses',                  'Settle an approved expense'),
  ('expenses.post',                     'expenses',   'Post expenses',                 'Commit an expense to the ledger'),
  ('expense_categories.manage',         'expenses',   'Manage expense categories',     'Maintain expense categories'),

  -- Human resources
  ('hr.view',                           'hr',         'View HR',                       'Open the HR module'),
  ('employees.view',                    'hr',         'View employees',                'See the employee directory'),
  ('employees.create',                  'hr',         'Create employees',              'Add an employee record'),
  ('employees.update',                  'hr',         'Edit employees',                'Change employee details'),
  ('employees.terminate',               'hr',         'Terminate employees',           'Record an employee exit'),
  ('employees.salary.view',             'hr',         'View employee salaries',        'See salary and bank details'),
  ('departments.manage',                'hr',         'Manage departments',            'Maintain departments'),
  ('positions.manage',                  'hr',         'Manage positions',              'Maintain job positions'),
  ('attendance.view',                   'hr',         'View attendance',               'See attendance records'),
  ('attendance.manage',                 'hr',         'Manage attendance',             'Amend attendance records'),
  ('leave.view',                        'hr',         'View leave',                    'See leave requests and balances'),
  ('leave.request',                     'hr',         'Request leave',                 'Submit a leave request'),
  ('leave.approve',                     'hr',         'Approve leave',                 'Authorise a leave request'),
  ('hr.documents.manage',               'hr',         'Manage HR documents',           'Upload and manage employee documents'),

  -- Payroll
  ('payroll.view',                      'payroll',    'View payroll',                  'Open the payroll module'),
  ('payroll.runs.create',               'payroll',    'Create payroll runs',           'Open a payroll period'),
  ('payroll.runs.calculate',            'payroll',    'Calculate payroll',             'Run the payroll calculation'),
  ('payroll.runs.approve',              'payroll',    'Approve payroll',               'Authorise a payroll run'),
  ('payroll.runs.post',                 'payroll',    'Post payroll',                  'Commit payroll to the ledger'),
  ('payroll.runs.mark_paid',            'payroll',    'Mark payroll paid',             'Flag a payroll run as settled'),
  ('payroll.components.manage',         'payroll',    'Manage payroll components',     'Maintain allowances and deductions'),
  ('payslips.view_all',                 'payroll',    'View all payslips',             'See payslips for every employee'),

  -- Reports
  ('reports.view',                      'reports',    'View reports',                  'Open the reports centre'),
  ('reports.financial.view',            'reports',    'View financial reports',        'See financial statements'),
  ('reports.gross_profit.view',         'reports',    'View gross profit',             'See margin and profitability reports'),
  ('reports.export',                    'reports',    'Export reports',                'Download reports as PDF, Excel or CSV'),

  -- Approvals
  ('approvals.inbox.view',              'approvals',  'View approvals inbox',          'See items awaiting your approval'),

  -- Administration
  ('users.view',                        'admin',      'View users',                    'See system users'),
  ('users.create',                      'admin',      'Create users',                  'Invite a new system user'),
  ('users.update',                      'admin',      'Edit users',                    'Change user details and status'),
  ('users.deactivate',                  'admin',      'Deactivate users',              'Suspend a user account'),
  ('users.roles.assign',                'admin',      'Assign roles',                  'Grant and revoke user roles'),
  ('roles.view',                        'admin',      'View roles',                    'See roles and their permissions'),
  ('roles.manage',                      'admin',      'Manage roles',                  'Create roles and change permissions'),
  ('settings.company.manage',           'admin',      'Manage company settings',       'Edit company details and document settings'),
  ('settings.branches.manage',          'admin',      'Manage branches',               'Create and edit branches'),
  ('settings.system.manage',            'admin',      'Manage system settings',        'Change system-wide configuration'),
  ('audit.view',                        'admin',      'View audit trail',              'Read the audit log')
on conflict (code) do update
  set module      = excluded.module,
      name        = excluded.name,
      description = excluded.description;

-- ---------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------

insert into public.roles (code, name, description, is_system, rank) values
  ('super_admin',        'Super Administrator', 'Unrestricted access to every module and setting',        true,  10),
  ('admin',              'Administrator',       'Full operational access; cannot change financial periods', true,  20),
  ('managing_director',  'Managing Director',   'Company-wide visibility and final approval authority',   true,  30),
  ('finance_manager',    'Finance Manager',     'Owns accounting, banking, payments and approvals',       true,  40),
  ('accountant',         'Accountant',          'Captures and posts accounting transactions',             true,  50),
  ('procurement_officer','Procurement Officer', 'Raises purchase orders and manages suppliers',           true,  50),
  ('warehouse_manager',  'Warehouse Manager',   'Owns stock accuracy, receipts, counts and transfers',    true,  50),
  ('hr_manager',         'HR Manager',          'Owns the employee lifecycle and leave',                  true,  50),
  ('payroll_officer',    'Payroll Officer',     'Prepares and submits payroll for approval',              true,  60),
  ('salesperson',        'Salesperson',         'Quotes, sells and manages their customers',              true,  70),
  ('cashier',            'Cashier',             'Operates the till and handles till cash',                true,  70),
  ('storekeeper',        'Storekeeper',         'Receives goods and issues stock under supervision',      true,  70),
  ('auditor',            'Auditor',             'Read-only access across the business, including the audit trail', true, 80),
  ('employee',           'Employee',            'Self-service only: own profile, leave and requisitions', true,  90)
on conflict (code) do update
  set name        = excluded.name,
      description = excluded.description,
      rank        = excluded.rank;

-- ---------------------------------------------------------------------
-- Role -> permission grants
--
-- Expressed as LIKE patterns so the mapping stays readable and new
-- permissions in an existing family are picked up on re-run.
-- ---------------------------------------------------------------------

with grants(role_code, pattern) as (values
  -- Super Administrator: everything.
  ('super_admin', '%'),

  -- Administrator: everything except year-end and period locking.
  ('admin', 'dashboard.%'), ('admin', 'inventory.%'), ('admin', 'products.%'),
  ('admin', 'warehouses.%'), ('admin', 'purchas%'), ('admin', 'grn.%'),
  ('admin', 'supplier%'), ('admin', 'sales%'), ('admin', 'quotations.%'),
  ('admin', 'credit_notes.%'), ('admin', 'customer%'), ('admin', 'pos.%'),
  ('admin', 'accounting.view'), ('admin', 'coa.%'), ('admin', 'gl.%'), ('admin', 'journals.%'),
  ('admin', 'banking.%'), ('admin', 'bank_%'), ('admin', 'expense%'),
  ('admin', 'hr.%'), ('admin', 'employees.%'), ('admin', 'departments.%'),
  ('admin', 'positions.%'), ('admin', 'attendance.%'), ('admin', 'leave.%'),
  ('admin', 'payroll.%'), ('admin', 'payslips.%'), ('admin', 'reports.%'),
  ('admin', 'approvals.%'), ('admin', 'users.%'), ('admin', 'roles.%'),
  ('admin', 'settings.%'), ('admin', 'audit.view'),

  -- Managing Director: sees all, approves all, captures little.
  ('managing_director', 'dashboard.%'), ('managing_director', '%.view'),
  ('managing_director', '%.view_all'), ('managing_director', '%.approve'),
  ('managing_director', 'reports.%'), ('managing_director', 'approvals.%'),
  ('managing_director', 'products.cost_price.view'), ('managing_director', 'employees.salary.view'),
  ('managing_director', 'sales.discount.override'), ('managing_director', 'audit.view'),

  -- Finance Manager
  ('finance_manager', 'dashboard.%'), ('finance_manager', '%.view'), ('finance_manager', '%.view_all'),
  ('finance_manager', 'accounting.%'), ('finance_manager', 'coa.%'), ('finance_manager', 'gl.%'),
  ('finance_manager', 'journals.%'), ('finance_manager', 'banking.%'), ('finance_manager', 'bank_%'),
  ('finance_manager', 'expenses.%'), ('finance_manager', 'expense_categories.%'),
  ('finance_manager', 'supplier_payments.%'), ('finance_manager', 'supplier_invoices.%'),
  ('finance_manager', 'customer_receipts.%'), ('finance_manager', 'customers.credit_limit.manage'),
  ('finance_manager', 'sales_invoices.approve'), ('finance_manager', 'sales_invoices.post'),
  ('finance_manager', 'sales.credit_sale.approve'), ('finance_manager', 'sales.discount.override'),
  ('finance_manager', 'credit_notes.approve'), ('finance_manager', 'reports.%'),
  ('finance_manager', 'approvals.%'), ('finance_manager', 'products.cost_price.view'),
  ('finance_manager', 'payroll.runs.approve'), ('finance_manager', 'payroll.runs.post'),
  ('finance_manager', 'inventory.adjustments.approve'), ('finance_manager', 'audit.view'),

  -- Accountant
  ('accountant', 'dashboard.view'), ('accountant', 'accounting.view'), ('accountant', 'coa.view'),
  ('accountant', 'gl.view'), ('accountant', 'journals.view'), ('accountant', 'journals.create'),
  ('accountant', 'journals.post'), ('accountant', 'banking.view'),
  ('accountant', 'bank_transactions.create'), ('accountant', 'bank_reconciliation.perform'),
  ('accountant', 'expenses.view'), ('accountant', 'expenses.create'), ('accountant', 'expenses.post'),
  ('accountant', 'supplier_invoices.view'), ('accountant', 'supplier_invoices.create'),
  ('accountant', 'supplier_invoices.post'), ('accountant', 'supplier_payments.view'),
  ('accountant', 'supplier_payments.create'), ('accountant', 'customer_receipts.%'),
  ('accountant', 'sales_invoices.view'), ('accountant', 'sales_invoices.post'),
  ('accountant', 'customers.view'), ('accountant', 'suppliers.view'),
  ('accountant', 'products.view'), ('accountant', 'products.cost_price.view'),
  ('accountant', 'inventory.view'), ('accountant', 'inventory.balances.view'),
  ('accountant', 'inventory.movements.view'), ('accountant', 'reports.%'),

  -- Procurement Officer
  ('procurement_officer', 'dashboard.view'), ('procurement_officer', 'purchasing.view'),
  ('procurement_officer', 'purchase_requisitions.%'), ('procurement_officer', 'purchase_orders.view'),
  ('procurement_officer', 'purchase_orders.create'), ('procurement_officer', 'purchase_orders.cancel'),
  ('procurement_officer', 'suppliers.%'), ('procurement_officer', 'grn.view'),
  ('procurement_officer', 'supplier_invoices.view'), ('procurement_officer', 'supplier_invoices.create'),
  ('procurement_officer', 'products.view'), ('procurement_officer', 'products.cost_price.view'),
  ('procurement_officer', 'products.create'), ('procurement_officer', 'products.update'),
  ('procurement_officer', 'inventory.view'), ('procurement_officer', 'inventory.balances.view'),
  ('procurement_officer', 'inventory.movements.view'), ('procurement_officer', 'warehouses.view'),
  ('procurement_officer', 'reports.view'), ('procurement_officer', 'reports.export'),
  ('procurement_officer', 'approvals.inbox.view'),

  -- Warehouse Manager
  ('warehouse_manager', 'dashboard.view'), ('warehouse_manager', 'inventory.%'),
  ('warehouse_manager', 'products.view'), ('warehouse_manager', 'products.create'),
  ('warehouse_manager', 'products.update'), ('warehouse_manager', 'products.cost_price.view'),
  ('warehouse_manager', 'warehouses.%'), ('warehouse_manager', 'grn.%'),
  ('warehouse_manager', 'purchasing.view'), ('warehouse_manager', 'purchase_orders.view'),
  ('warehouse_manager', 'purchase_requisitions.view'), ('warehouse_manager', 'purchase_requisitions.create'),
  ('warehouse_manager', 'suppliers.view'), ('warehouse_manager', 'reports.view'),
  ('warehouse_manager', 'reports.export'), ('warehouse_manager', 'approvals.inbox.view'),

  -- Storekeeper
  ('storekeeper', 'dashboard.view'), ('storekeeper', 'inventory.view'),
  ('storekeeper', 'inventory.balances.view'), ('storekeeper', 'inventory.movements.view'),
  ('storekeeper', 'inventory.counts.view'), ('storekeeper', 'inventory.counts.capture'),
  ('storekeeper', 'inventory.requisitions.view'), ('storekeeper', 'inventory.requisitions.create'),
  ('storekeeper', 'inventory.requisitions.issue'), ('storekeeper', 'inventory.transfers.view'),
  ('storekeeper', 'inventory.transfers.create'), ('storekeeper', 'inventory.adjustments.view'),
  ('storekeeper', 'inventory.adjustments.create'), ('storekeeper', 'grn.view'),
  ('storekeeper', 'grn.create'), ('storekeeper', 'grn.inspect'),
  ('storekeeper', 'products.view'), ('storekeeper', 'warehouses.view'),

  -- Salesperson
  ('salesperson', 'dashboard.view'), ('salesperson', 'sales.view'), ('salesperson', 'quotations.%'),
  ('salesperson', 'sales_orders.view'), ('salesperson', 'sales_orders.create'),
  ('salesperson', 'sales_invoices.view'), ('salesperson', 'sales_invoices.create'),
  ('salesperson', 'sales_returns.view'), ('salesperson', 'sales_returns.create'),
  ('salesperson', 'sales.discount.apply'), ('salesperson', 'customers.view'),
  ('salesperson', 'customers.create'), ('salesperson', 'customers.update'),
  ('salesperson', 'customer_receipts.view'), ('salesperson', 'products.view'),
  ('salesperson', 'inventory.view'), ('salesperson', 'inventory.balances.view'),
  ('salesperson', 'reports.view'),

  -- Cashier
  ('cashier', 'dashboard.view'), ('cashier', 'pos.operate'), ('cashier', 'pos.session.open'),
  ('cashier', 'pos.session.close'), ('cashier', 'pos.reprint'), ('cashier', 'pos.cash_count'),
  ('cashier', 'sales.discount.apply'), ('cashier', 'products.view'),
  ('cashier', 'inventory.balances.view'), ('cashier', 'customers.view'),
  ('cashier', 'customers.create'), ('cashier', 'customer_receipts.view'),
  ('cashier', 'customer_receipts.create'),

  -- HR Manager
  ('hr_manager', 'dashboard.view'), ('hr_manager', 'hr.%'), ('hr_manager', 'employees.%'),
  ('hr_manager', 'departments.%'), ('hr_manager', 'positions.%'), ('hr_manager', 'attendance.%'),
  ('hr_manager', 'leave.%'), ('hr_manager', 'payroll.view'), ('hr_manager', 'reports.view'),
  ('hr_manager', 'reports.export'), ('hr_manager', 'approvals.inbox.view'),
  ('hr_manager', 'users.view'),

  -- Payroll Officer
  ('payroll_officer', 'dashboard.view'), ('payroll_officer', 'payroll.view'),
  ('payroll_officer', 'payroll.runs.create'), ('payroll_officer', 'payroll.runs.calculate'),
  ('payroll_officer', 'payroll.components.manage'), ('payroll_officer', 'payslips.view_all'),
  ('payroll_officer', 'employees.view'), ('payroll_officer', 'employees.salary.view'),
  ('payroll_officer', 'hr.view'), ('payroll_officer', 'attendance.view'),
  ('payroll_officer', 'leave.view'), ('payroll_officer', 'reports.view'),
  ('payroll_officer', 'reports.export'),

  -- Auditor: read everything, change nothing.
  ('auditor', 'dashboard.%'), ('auditor', '%.view'), ('auditor', '%.view_all'),
  ('auditor', 'reports.%'), ('auditor', 'audit.view'),
  ('auditor', 'products.cost_price.view'), ('auditor', 'employees.salary.view'),

  -- Employee: self-service only.
  ('employee', 'dashboard.view'), ('employee', 'leave.request'), ('employee', 'leave.view'),
  ('employee', 'inventory.requisitions.create'), ('employee', 'inventory.requisitions.view'),
  ('employee', 'inventory.requisitions.receive'), ('employee', 'products.view')
)
insert into public.role_permissions (role_id, permission_id)
select distinct r.id, p.id
from grants g
join public.roles r on r.code = g.role_code
join public.permissions p on p.code like g.pattern
on conflict (role_id, permission_id) do nothing;

-- The auditor and managing director patterns above use '%.view', which
-- must never sweep in a write permission. Nothing named '*.view' writes,
-- but strip anything that slipped through by name to be certain.
delete from public.role_permissions rp
using public.roles r, public.permissions p
where rp.role_id = r.id
  and rp.permission_id = p.id
  and r.code = 'auditor'
  and p.code not like '%.view'
  and p.code not like '%.view_all'
  and p.code not like 'reports.%'
  and p.code not in ('audit.view', 'dashboard.view', 'dashboard.financials.view');

-- ---------------------------------------------------------------------
-- Company settings singleton
-- ---------------------------------------------------------------------

insert into public.system_settings (id, company_name, country, base_currency)
values (true, 'Builders Paradise Hardware', 'Zimbabwe', 'USD')
on conflict (id) do nothing;
