/**
 * The permission catalogue, mirroring
 * `supabase/migrations/20260804090200_phase1_rbac_seed.sql`.
 *
 * These strings are the contract between the UI and RLS. `catalog.test.ts`
 * parses the migration and fails if the two lists ever drift, so a permission
 * can never be checked in the UI that the database has never heard of.
 */

export const PERMISSIONS = {
  // Dashboard
  DASHBOARD_VIEW: "dashboard.view",
  DASHBOARD_FINANCIALS_VIEW: "dashboard.financials.view",

  // Inventory
  INVENTORY_VIEW: "inventory.view",
  PRODUCTS_VIEW: "products.view",
  PRODUCTS_CREATE: "products.create",
  PRODUCTS_UPDATE: "products.update",
  PRODUCTS_ARCHIVE: "products.archive",
  PRODUCTS_COST_PRICE_VIEW: "products.cost_price.view",
  PRODUCTS_SELLING_PRICE_UPDATE: "products.selling_price.update",
  INVENTORY_BALANCES_VIEW: "inventory.balances.view",
  INVENTORY_MOVEMENTS_VIEW: "inventory.movements.view",
  INVENTORY_ADJUSTMENTS_VIEW: "inventory.adjustments.view",
  INVENTORY_ADJUSTMENTS_CREATE: "inventory.adjustments.create",
  INVENTORY_ADJUSTMENTS_APPROVE: "inventory.adjustments.approve",
  INVENTORY_ADJUSTMENTS_POST: "inventory.adjustments.post",
  INVENTORY_TRANSFERS_VIEW: "inventory.transfers.view",
  INVENTORY_TRANSFERS_CREATE: "inventory.transfers.create",
  INVENTORY_TRANSFERS_APPROVE: "inventory.transfers.approve",
  INVENTORY_REQUISITIONS_VIEW: "inventory.requisitions.view",
  INVENTORY_REQUISITIONS_CREATE: "inventory.requisitions.create",
  INVENTORY_REQUISITIONS_APPROVE: "inventory.requisitions.approve",
  INVENTORY_REQUISITIONS_ISSUE: "inventory.requisitions.issue",
  INVENTORY_REQUISITIONS_RECEIVE: "inventory.requisitions.receive",
  INVENTORY_COUNTS_VIEW: "inventory.counts.view",
  INVENTORY_COUNTS_CREATE: "inventory.counts.create",
  INVENTORY_COUNTS_ASSIGN: "inventory.counts.assign",
  INVENTORY_COUNTS_CAPTURE: "inventory.counts.capture",
  INVENTORY_COUNTS_APPROVE: "inventory.counts.approve",
  INVENTORY_COUNTS_POST: "inventory.counts.post",
  INVENTORY_NEGATIVE_STOCK_ALLOW: "inventory.negative_stock.allow",

  // Warehouses
  WAREHOUSES_VIEW: "warehouses.view",
  WAREHOUSES_MANAGE: "warehouses.manage",

  // Purchasing
  PURCHASING_VIEW: "purchasing.view",
  PURCHASE_REQUISITIONS_VIEW: "purchase_requisitions.view",
  PURCHASE_REQUISITIONS_CREATE: "purchase_requisitions.create",
  PURCHASE_REQUISITIONS_APPROVE: "purchase_requisitions.approve",
  PURCHASE_ORDERS_VIEW: "purchase_orders.view",
  PURCHASE_ORDERS_CREATE: "purchase_orders.create",
  PURCHASE_ORDERS_APPROVE: "purchase_orders.approve",
  PURCHASE_ORDERS_CANCEL: "purchase_orders.cancel",
  GRN_VIEW: "grn.view",
  GRN_CREATE: "grn.create",
  GRN_INSPECT: "grn.inspect",
  GRN_APPROVE: "grn.approve",
  GRN_POST: "grn.post",
  SUPPLIER_INVOICES_VIEW: "supplier_invoices.view",
  SUPPLIER_INVOICES_CREATE: "supplier_invoices.create",
  SUPPLIER_INVOICES_APPROVE: "supplier_invoices.approve",
  SUPPLIER_INVOICES_POST: "supplier_invoices.post",
  SUPPLIER_PAYMENTS_VIEW: "supplier_payments.view",
  SUPPLIER_PAYMENTS_CREATE: "supplier_payments.create",
  SUPPLIER_PAYMENTS_APPROVE: "supplier_payments.approve",
  SUPPLIER_PAYMENTS_POST: "supplier_payments.post",
  SUPPLIERS_VIEW: "suppliers.view",
  SUPPLIERS_CREATE: "suppliers.create",
  SUPPLIERS_UPDATE: "suppliers.update",
  SUPPLIERS_ARCHIVE: "suppliers.archive",

  // Sales
  SALES_VIEW: "sales.view",
  QUOTATIONS_VIEW: "quotations.view",
  QUOTATIONS_CREATE: "quotations.create",
  SALES_ORDERS_VIEW: "sales_orders.view",
  SALES_ORDERS_CREATE: "sales_orders.create",
  SALES_ORDERS_APPROVE: "sales_orders.approve",
  SALES_INVOICES_VIEW: "sales_invoices.view",
  SALES_INVOICES_CREATE: "sales_invoices.create",
  SALES_INVOICES_APPROVE: "sales_invoices.approve",
  SALES_INVOICES_POST: "sales_invoices.post",
  SALES_INVOICES_CANCEL: "sales_invoices.cancel",
  SALES_RETURNS_VIEW: "sales_returns.view",
  SALES_RETURNS_CREATE: "sales_returns.create",
  SALES_RETURNS_APPROVE: "sales_returns.approve",
  CREDIT_NOTES_CREATE: "credit_notes.create",
  CREDIT_NOTES_APPROVE: "credit_notes.approve",
  CUSTOMER_RECEIPTS_VIEW: "customer_receipts.view",
  CUSTOMER_RECEIPTS_CREATE: "customer_receipts.create",
  CUSTOMER_RECEIPTS_ALLOCATE: "customer_receipts.allocate",
  CUSTOMER_RECEIPTS_POST: "customer_receipts.post",
  SALES_DISCOUNT_APPLY: "sales.discount.apply",
  SALES_DISCOUNT_OVERRIDE: "sales.discount.override",
  SALES_CREDIT_SALE_APPROVE: "sales.credit_sale.approve",
  CUSTOMERS_VIEW: "customers.view",
  CUSTOMERS_CREATE: "customers.create",
  CUSTOMERS_UPDATE: "customers.update",
  CUSTOMERS_ARCHIVE: "customers.archive",
  CUSTOMERS_CREDIT_LIMIT_MANAGE: "customers.credit_limit.manage",

  // Point of sale
  POS_OPERATE: "pos.operate",
  POS_SESSION_OPEN: "pos.session.open",
  POS_SESSION_CLOSE: "pos.session.close",
  POS_PRICE_OVERRIDE: "pos.price.override",
  POS_REFUND: "pos.refund",
  POS_REPRINT: "pos.reprint",
  POS_CASH_COUNT: "pos.cash_count",

  // Accounting
  ACCOUNTING_VIEW: "accounting.view",
  COA_VIEW: "coa.view",
  COA_MANAGE: "coa.manage",
  GL_VIEW: "gl.view",
  JOURNALS_VIEW: "journals.view",
  JOURNALS_CREATE: "journals.create",
  JOURNALS_POST: "journals.post",
  JOURNALS_REVERSE: "journals.reverse",
  ACCOUNTING_PERIODS_MANAGE: "accounting.periods.manage",
  ACCOUNTING_YEAR_END_CLOSE: "accounting.year_end.close",

  // Banking
  BANKING_VIEW: "banking.view",
  BANK_ACCOUNTS_MANAGE: "bank_accounts.manage",
  BANK_TRANSACTIONS_CREATE: "bank_transactions.create",
  BANK_RECONCILIATION_PERFORM: "bank_reconciliation.perform",
  BANK_RECONCILIATION_FINALISE: "bank_reconciliation.finalise",

  // Expenses
  EXPENSES_VIEW: "expenses.view",
  EXPENSES_CREATE: "expenses.create",
  EXPENSES_APPROVE: "expenses.approve",
  EXPENSES_PAY: "expenses.pay",
  EXPENSES_POST: "expenses.post",
  EXPENSE_CATEGORIES_MANAGE: "expense_categories.manage",

  // Human resources
  HR_VIEW: "hr.view",
  EMPLOYEES_VIEW: "employees.view",
  EMPLOYEES_CREATE: "employees.create",
  EMPLOYEES_UPDATE: "employees.update",
  EMPLOYEES_TERMINATE: "employees.terminate",
  EMPLOYEES_SALARY_VIEW: "employees.salary.view",
  DEPARTMENTS_MANAGE: "departments.manage",
  POSITIONS_MANAGE: "positions.manage",
  ATTENDANCE_VIEW: "attendance.view",
  ATTENDANCE_MANAGE: "attendance.manage",
  LEAVE_VIEW: "leave.view",
  LEAVE_REQUEST: "leave.request",
  LEAVE_APPROVE: "leave.approve",
  HR_DOCUMENTS_MANAGE: "hr.documents.manage",

  // Payroll
  PAYROLL_VIEW: "payroll.view",
  PAYROLL_RUNS_CREATE: "payroll.runs.create",
  PAYROLL_RUNS_CALCULATE: "payroll.runs.calculate",
  PAYROLL_RUNS_APPROVE: "payroll.runs.approve",
  PAYROLL_RUNS_POST: "payroll.runs.post",
  PAYROLL_RUNS_MARK_PAID: "payroll.runs.mark_paid",
  PAYROLL_COMPONENTS_MANAGE: "payroll.components.manage",
  PAYSLIPS_VIEW_ALL: "payslips.view_all",

  // Reports
  REPORTS_VIEW: "reports.view",
  REPORTS_FINANCIAL_VIEW: "reports.financial.view",
  REPORTS_GROSS_PROFIT_VIEW: "reports.gross_profit.view",
  REPORTS_EXPORT: "reports.export",

  // Approvals
  APPROVALS_INBOX_VIEW: "approvals.inbox.view",

  // Administration
  USERS_VIEW: "users.view",
  USERS_CREATE: "users.create",
  USERS_UPDATE: "users.update",
  USERS_DEACTIVATE: "users.deactivate",
  USERS_ROLES_ASSIGN: "users.roles.assign",
  ROLES_VIEW: "roles.view",
  ROLES_MANAGE: "roles.manage",
  SETTINGS_COMPANY_MANAGE: "settings.company.manage",
  SETTINGS_BRANCHES_MANAGE: "settings.branches.manage",
  SETTINGS_SYSTEM_MANAGE: "settings.system.manage",
  AUDIT_VIEW: "audit.view",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSION_CODES: PermissionCode[] = Object.values(PERMISSIONS);

/** Role codes seeded by the migration. */
export const ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  MANAGING_DIRECTOR: "managing_director",
  FINANCE_MANAGER: "finance_manager",
  ACCOUNTANT: "accountant",
  PROCUREMENT_OFFICER: "procurement_officer",
  WAREHOUSE_MANAGER: "warehouse_manager",
  HR_MANAGER: "hr_manager",
  PAYROLL_OFFICER: "payroll_officer",
  SALESPERSON: "salesperson",
  CASHIER: "cashier",
  STOREKEEPER: "storekeeper",
  AUDITOR: "auditor",
  EMPLOYEE: "employee",
} as const;

export type RoleCode = (typeof ROLES)[keyof typeof ROLES];

/** Human labels for the module grouping used on the roles screen. */
export const MODULE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  inventory: "Inventory",
  warehouses: "Warehouses",
  purchasing: "Purchasing",
  sales: "Sales",
  pos: "Point of Sale",
  accounting: "Accounting",
  banking: "Banking",
  expenses: "Expenses",
  hr: "Human Resources",
  payroll: "Payroll",
  reports: "Reports",
  approvals: "Approvals",
  admin: "Administration",
};
