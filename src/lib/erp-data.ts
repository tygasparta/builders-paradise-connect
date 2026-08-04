// Central mock data layer for Builders Paradise ERP.
// Replace with live queries when the backend is connected.

export const COMPANY = {
  name: "Builders Paradise Hardware",
  system: "Builders Paradise ERP",
  currency: "USD",
  vatRate: 0.15,
};

export const BRANCHES = [
  { id: "br-hre", name: "Harare Main", code: "HRE" },
  { id: "br-byo", name: "Bulawayo Branch", code: "BYO" },
  { id: "br-mut", name: "Mutare Depot", code: "MUT" },
];

export const WAREHOUSES = [
  { id: "wh-1", name: "Main Warehouse", branch: "br-hre" },
  { id: "wh-2", name: "Yard A — Bulk", branch: "br-hre" },
  { id: "wh-3", name: "Bulawayo Store", branch: "br-byo" },
  { id: "wh-4", name: "Mutare Depot", branch: "br-mut" },
];

export type Product = {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  brand: string;
  unit: string;
  cost: number;
  price: number;
  onHand: number;
  reserved: number;
  reorder: number;
  warehouse: string;
  movement: "fast" | "medium" | "slow";
};

export const PRODUCTS: Product[] = [
  {
    id: "p1",
    sku: "CEM-PPC-50",
    barcode: "6001234500017",
    name: "PPC Cement 50kg",
    category: "Cement & Aggregates",
    brand: "PPC",
    unit: "Bag",
    cost: 8.4,
    price: 11.5,
    onHand: 1840,
    reserved: 120,
    reorder: 400,
    warehouse: "Yard A — Bulk",
    movement: "fast",
  },
  {
    id: "p2",
    sku: "STL-RB-12",
    barcode: "6001234500024",
    name: "Rebar Y12 x 6m",
    category: "Steel & Roofing",
    brand: "ZimSteel",
    unit: "Length",
    cost: 9.8,
    price: 14.25,
    onHand: 620,
    reserved: 40,
    reorder: 200,
    warehouse: "Yard A — Bulk",
    movement: "fast",
  },
  {
    id: "p3",
    sku: "RF-IBR-35",
    barcode: "6001234500031",
    name: "IBR Roof Sheet 3.5m",
    category: "Steel & Roofing",
    brand: "Sheetpro",
    unit: "Sheet",
    cost: 21.0,
    price: 29.9,
    onHand: 148,
    reserved: 22,
    reorder: 160,
    warehouse: "Main Warehouse",
    movement: "fast",
  },
  {
    id: "p4",
    sku: "PNT-DLX-20",
    barcode: "6001234500048",
    name: "Dulux Weatherguard 20L",
    category: "Paints & Finishes",
    brand: "Dulux",
    unit: "Bucket",
    cost: 62.0,
    price: 89.0,
    onHand: 74,
    reserved: 6,
    reorder: 30,
    warehouse: "Main Warehouse",
    movement: "medium",
  },
  {
    id: "p5",
    sku: "PLB-PVC-110",
    barcode: "6001234500055",
    name: "PVC Pipe 110mm x 6m",
    category: "Plumbing",
    brand: "Pipetec",
    unit: "Length",
    cost: 17.4,
    price: 24.5,
    onHand: 96,
    reserved: 0,
    reorder: 60,
    warehouse: "Main Warehouse",
    movement: "medium",
  },
  {
    id: "p6",
    sku: "ELE-CBL-25",
    barcode: "6001234500062",
    name: "Twin & Earth Cable 2.5mm (100m)",
    category: "Electrical",
    brand: "Cafca",
    unit: "Roll",
    cost: 78.0,
    price: 108.0,
    onHand: 38,
    reserved: 4,
    reorder: 20,
    warehouse: "Main Warehouse",
    movement: "fast",
  },
  {
    id: "p7",
    sku: "TLS-GRN-115",
    barcode: "6001234500079",
    name: "Angle Grinder 115mm 900W",
    category: "Power Tools",
    brand: "Bosch",
    unit: "Each",
    cost: 54.0,
    price: 82.0,
    onHand: 27,
    reserved: 2,
    reorder: 12,
    warehouse: "Bulawayo Store",
    movement: "medium",
  },
  {
    id: "p8",
    sku: "TLS-DRL-18",
    barcode: "6001234500086",
    name: "Cordless Drill 18V Kit",
    category: "Power Tools",
    brand: "Makita",
    unit: "Each",
    cost: 132.0,
    price: 189.0,
    onHand: 11,
    reserved: 1,
    reorder: 10,
    warehouse: "Main Warehouse",
    movement: "medium",
  },
  {
    id: "p9",
    sku: "TIM-PLY-18",
    barcode: "6001234500093",
    name: "Plywood Board 18mm",
    category: "Timber & Boards",
    brand: "Timbercity",
    unit: "Board",
    cost: 34.5,
    price: 47.9,
    onHand: 210,
    reserved: 18,
    reorder: 80,
    warehouse: "Yard A — Bulk",
    movement: "medium",
  },
  {
    id: "p10",
    sku: "HW-NAIL-4",
    barcode: "6001234500109",
    name: "Wire Nails 100mm (5kg)",
    category: "Fasteners",
    brand: "Fixwell",
    unit: "Pack",
    cost: 6.2,
    price: 9.4,
    onHand: 430,
    reserved: 0,
    reorder: 100,
    warehouse: "Main Warehouse",
    movement: "fast",
  },
  {
    id: "p11",
    sku: "SAN-TOI-CC",
    barcode: "6001234500116",
    name: "Close Coupled Toilet Suite",
    category: "Sanitaryware",
    brand: "Ceramica",
    unit: "Set",
    cost: 88.0,
    price: 128.0,
    onHand: 9,
    reserved: 3,
    reorder: 15,
    warehouse: "Bulawayo Store",
    movement: "slow",
  },
  {
    id: "p12",
    sku: "GRD-WHL-90",
    barcode: "6001234500123",
    name: "Wheelbarrow 90L Heavy Duty",
    category: "Site Equipment",
    brand: "Buildmate",
    unit: "Each",
    cost: 41.0,
    price: 62.0,
    onHand: 34,
    reserved: 0,
    reorder: 20,
    warehouse: "Mutare Depot",
    movement: "slow",
  },
  {
    id: "p13",
    sku: "ADH-TILE-20",
    barcode: "6001234500130",
    name: "Tile Adhesive 20kg",
    category: "Cement & Aggregates",
    brand: "Bostik",
    unit: "Bag",
    cost: 11.2,
    price: 16.4,
    onHand: 305,
    reserved: 25,
    reorder: 120,
    warehouse: "Main Warehouse",
    movement: "fast",
  },
  {
    id: "p14",
    sku: "ELE-LMP-LED",
    barcode: "6001234500147",
    name: "LED Bulb 12W B22",
    category: "Electrical",
    brand: "Osram",
    unit: "Each",
    cost: 1.4,
    price: 2.9,
    onHand: 1260,
    reserved: 0,
    reorder: 300,
    warehouse: "Main Warehouse",
    movement: "fast",
  },
  {
    id: "p15",
    sku: "PLB-GEY-150",
    barcode: "6001234500154",
    name: "Geyser 150L Vertical",
    category: "Plumbing",
    brand: "Kwikot",
    unit: "Each",
    cost: 298.0,
    price: 415.0,
    onHand: 4,
    reserved: 1,
    reorder: 8,
    warehouse: "Main Warehouse",
    movement: "slow",
  },
];

export const CATEGORIES = Array.from(new Set(PRODUCTS.map((p) => p.category)));

export const inventoryValue = PRODUCTS.reduce((s, p) => s + p.onHand * p.cost, 0);
export const retailValue = PRODUCTS.reduce((s, p) => s + p.onHand * p.price, 0);
export const lowStock = PRODUCTS.filter((p) => p.onHand <= p.reorder);

export type GRN = {
  id: string;
  po: string;
  supplier: string;
  warehouse: string;
  date: string;
  status: "Draft" | "Inspection" | "Posted";
  lines: { product: string; ordered: number; received: number; cost: number }[];
};

export const GRNS: GRN[] = [
  {
    id: "GRN-2041",
    po: "PO-1188",
    supplier: "PPC Zimbabwe",
    warehouse: "Yard A — Bulk",
    date: "2026-08-03",
    status: "Posted",
    lines: [{ product: "PPC Cement 50kg", ordered: 800, received: 800, cost: 8.4 }],
  },
  {
    id: "GRN-2042",
    po: "PO-1191",
    supplier: "Sheetpro Roofing",
    warehouse: "Main Warehouse",
    date: "2026-08-04",
    status: "Inspection",
    lines: [
      { product: "IBR Roof Sheet 3.5m", ordered: 240, received: 236, cost: 21.0 },
      { product: "Wire Nails 100mm (5kg)", ordered: 100, received: 100, cost: 6.2 },
    ],
  },
  {
    id: "GRN-2043",
    po: "PO-1194",
    supplier: "Cafca Cables",
    warehouse: "Main Warehouse",
    date: "2026-08-04",
    status: "Draft",
    lines: [{ product: "Twin & Earth Cable 2.5mm (100m)", ordered: 40, received: 40, cost: 78.0 }],
  },
];

export const PURCHASE_ORDERS = [
  { id: "PO-1188", supplier: "PPC Zimbabwe", date: "2026-07-30", total: 6720, status: "Received" },
  {
    id: "PO-1191",
    supplier: "Sheetpro Roofing",
    date: "2026-08-01",
    total: 5660,
    status: "Partially Received",
  },
  {
    id: "PO-1194",
    supplier: "Cafca Cables",
    date: "2026-08-02",
    total: 3120,
    status: "Awaiting Receipt",
  },
  {
    id: "PO-1196",
    supplier: "Makita Distributors",
    date: "2026-08-03",
    total: 3960,
    status: "Pending Approval",
  },
  {
    id: "PO-1197",
    supplier: "Bostik SA",
    date: "2026-08-04",
    total: 2240,
    status: "Pending Approval",
  },
];

export const CUSTOMERS = [
  {
    id: "c1",
    name: "Zvomunondiita Construction",
    terms: "30 days",
    limit: 25000,
    balance: 18420.5,
    current: 9200,
    d30: 6120.5,
    d60: 2100,
    d90: 1000,
  },
  {
    id: "c2",
    name: "Harare City Council",
    terms: "45 days",
    limit: 60000,
    balance: 41200,
    current: 22000,
    d30: 12000,
    d60: 7200,
    d90: 0,
  },
  {
    id: "c3",
    name: "Mavambo Projects",
    terms: "COD",
    limit: 5000,
    balance: 0,
    current: 0,
    d30: 0,
    d60: 0,
    d90: 0,
  },
  {
    id: "c4",
    name: "Tendai Moyo (Walk-in)",
    terms: "COD",
    limit: 0,
    balance: 0,
    current: 0,
    d30: 0,
    d60: 0,
    d90: 0,
  },
  {
    id: "c5",
    name: "Green Valley Estates",
    terms: "30 days",
    limit: 40000,
    balance: 12980.75,
    current: 10980.75,
    d30: 2000,
    d60: 0,
    d90: 0,
  },
];

export const SUPPLIERS = [
  {
    id: "s1",
    name: "PPC Zimbabwe",
    terms: "30 days",
    balance: 22400,
    onTime: 96,
    spendYtd: 184000,
  },
  {
    id: "s2",
    name: "Sheetpro Roofing",
    terms: "30 days",
    balance: 9860,
    onTime: 88,
    spendYtd: 96500,
  },
  { id: "s3", name: "Cafca Cables", terms: "14 days", balance: 3120, onTime: 92, spendYtd: 48200 },
  { id: "s4", name: "Makita Distributors", terms: "COD", balance: 0, onTime: 99, spendYtd: 31500 },
  { id: "s5", name: "Bostik SA", terms: "45 days", balance: 6740, onTime: 84, spendYtd: 52300 },
];

export const RECENT_TRANSACTIONS = [
  {
    id: "INV-8841",
    type: "Sales Invoice",
    party: "Zvomunondiita Construction",
    amount: 4820.5,
    time: "10:42",
    status: "Posted",
  },
  {
    id: "POS-33119",
    type: "POS Sale",
    party: "Walk-in Customer",
    amount: 268.4,
    time: "10:31",
    status: "Posted",
  },
  {
    id: "GRN-2042",
    type: "Goods Received",
    party: "Sheetpro Roofing",
    amount: 5576.0,
    time: "09:58",
    status: "Inspection",
  },
  {
    id: "RCT-5512",
    type: "Customer Receipt",
    party: "Green Valley Estates",
    amount: 3000.0,
    time: "09:40",
    status: "Posted",
  },
  {
    id: "JV-0912",
    type: "Journal Entry",
    party: "Stock Adjustment — Damages",
    amount: 412.8,
    time: "09:12",
    status: "Posted",
  },
  {
    id: "PAY-2214",
    type: "Supplier Payment",
    party: "PPC Zimbabwe",
    amount: 7500.0,
    time: "08:55",
    status: "Posted",
  },
];

export const MONTHLY = [
  { month: "Feb", sales: 128400, purchases: 91200, expenses: 22400 },
  { month: "Mar", sales: 142900, purchases: 98600, expenses: 24100 },
  { month: "Apr", sales: 137500, purchases: 88300, expenses: 23050 },
  { month: "May", sales: 165200, purchases: 112400, expenses: 26800 },
  { month: "Jun", sales: 158700, purchases: 104900, expenses: 25400 },
  { month: "Jul", sales: 181300, purchases: 121700, expenses: 28900 },
  { month: "Aug", sales: 96450, purchases: 61200, expenses: 14300 },
];

export const TOP_PRODUCTS = [
  { name: "PPC Cement 50kg", qty: 1420, revenue: 16330 },
  { name: "Rebar Y12 x 6m", qty: 640, revenue: 9120 },
  { name: "Tile Adhesive 20kg", qty: 510, revenue: 8364 },
  { name: "IBR Roof Sheet 3.5m", qty: 268, revenue: 8013 },
  { name: "T&E Cable 2.5mm", qty: 92, revenue: 9936 },
];

export const KPIS = {
  todaySales: 18942.6,
  todayPurchases: 8696.0,
  cashBalance: 24310.55,
  bankBalance: 168420.9,
  grossProfitMtd: 31284.4,
  grossMarginPct: 32.4,
  arOutstanding: CUSTOMERS.reduce((s, c) => s + c.balance, 0),
  apOutstanding: SUPPLIERS.reduce((s, c) => s + c.balance, 0),
};

// ---------- Accounting ----------

export type Account = {
  code: string;
  name: string;
  type: "Asset" | "Liability" | "Equity" | "Income" | "Expense";
  debit: number;
  credit: number;
};

export const CHART_OF_ACCOUNTS: Account[] = [
  { code: "1000", name: "Cash on Hand", type: "Asset", debit: 24310.55, credit: 0 },
  { code: "1010", name: "Bank — CBZ Current", type: "Asset", debit: 168420.9, credit: 0 },
  { code: "1200", name: "Accounts Receivable", type: "Asset", debit: 72601.25, credit: 0 },
  { code: "1300", name: "Inventory", type: "Asset", debit: inventoryValue, credit: 0 },
  { code: "1500", name: "Motor Vehicles", type: "Asset", debit: 84000, credit: 0 },
  { code: "2000", name: "Accounts Payable", type: "Liability", debit: 0, credit: 42120 },
  { code: "2100", name: "VAT Control", type: "Liability", debit: 0, credit: 14380.4 },
  { code: "2200", name: "PAYE & NSSA Payable", type: "Liability", debit: 0, credit: 8940.2 },
  { code: "3000", name: "Share Capital", type: "Equity", debit: 0, credit: 100000 },
  { code: "3100", name: "Retained Earnings", type: "Equity", debit: 0, credit: 186402.1 },
  { code: "4000", name: "Sales — Building Materials", type: "Income", debit: 0, credit: 812450 },
  { code: "4100", name: "Sales — Tools & Hardware", type: "Income", debit: 0, credit: 198300 },
  { code: "5000", name: "Cost of Sales", type: "Expense", debit: 684120, credit: 0 },
  { code: "5100", name: "Inventory Adjustment Expense", type: "Expense", debit: 4128.6, credit: 0 },
  { code: "6000", name: "Salaries & Wages", type: "Expense", debit: 96400, credit: 0 },
  { code: "6100", name: "Rent & Utilities", type: "Expense", debit: 28400, credit: 0 },
  { code: "6200", name: "Transport & Fuel", type: "Expense", debit: 19240, credit: 0 },
];

export type Journal = {
  id: string;
  date: string;
  source: string;
  ref: string;
  memo: string;
  lines: { account: string; debit: number; credit: number }[];
};

export const JOURNALS: Journal[] = [
  {
    id: "JV-0915",
    date: "2026-08-04",
    source: "POS",
    ref: "POS-33119",
    memo: "POS sale — Harare Main",
    lines: [
      { account: "1000 Cash on Hand", debit: 268.4, credit: 0 },
      { account: "4000 Sales — Building Materials", debit: 0, credit: 233.39 },
      { account: "2100 VAT Control", debit: 0, credit: 35.01 },
      { account: "5000 Cost of Sales", debit: 176.2, credit: 0 },
      { account: "1300 Inventory", debit: 0, credit: 176.2 },
    ],
  },
  {
    id: "JV-0914",
    date: "2026-08-04",
    source: "GRN",
    ref: "GRN-2042",
    memo: "Goods received — Sheetpro Roofing",
    lines: [
      { account: "1300 Inventory", debit: 5576.0, credit: 0 },
      { account: "2000 Accounts Payable", debit: 0, credit: 5576.0 },
    ],
  },
  {
    id: "JV-0912",
    date: "2026-08-04",
    source: "Inventory",
    ref: "ADJ-0311",
    memo: "Stock adjustment — damaged goods",
    lines: [
      { account: "5100 Inventory Adjustment Expense", debit: 412.8, credit: 0 },
      { account: "1300 Inventory", debit: 0, credit: 412.8 },
    ],
  },
  {
    id: "JV-0910",
    date: "2026-08-03",
    source: "Sales",
    ref: "INV-8841",
    memo: "Credit sale — Zvomunondiita Construction",
    lines: [
      { account: "1200 Accounts Receivable", debit: 4820.5, credit: 0 },
      { account: "4000 Sales — Building Materials", debit: 0, credit: 4191.74 },
      { account: "2100 VAT Control", debit: 0, credit: 628.76 },
      { account: "5000 Cost of Sales", debit: 3260.1, credit: 0 },
      { account: "1300 Inventory", debit: 0, credit: 3260.1 },
    ],
  },
];

// ---------- Sales documents ----------

export const SALES_DOCS = [
  {
    id: "INV-8841",
    type: "Invoice",
    customer: "Zvomunondiita Construction",
    date: "2026-08-03",
    total: 4820.5,
    due: 4820.5,
    status: "Unpaid",
  },
  {
    id: "INV-8840",
    type: "Invoice",
    customer: "Green Valley Estates",
    date: "2026-08-02",
    total: 6180.75,
    due: 3180.75,
    status: "Part paid",
  },
  {
    id: "QTE-1204",
    type: "Quotation",
    customer: "Harare City Council",
    date: "2026-08-02",
    total: 21400.0,
    due: 0,
    status: "Sent",
  },
  {
    id: "SO-3312",
    type: "Sales Order",
    customer: "Mavambo Projects",
    date: "2026-08-01",
    total: 3890.0,
    due: 0,
    status: "Confirmed",
  },
  {
    id: "INV-8836",
    type: "Invoice",
    customer: "Harare City Council",
    date: "2026-07-29",
    total: 12400.0,
    due: 0,
    status: "Paid",
  },
  {
    id: "CRN-0451",
    type: "Credit Note",
    customer: "Green Valley Estates",
    date: "2026-07-28",
    total: 420.0,
    due: 0,
    status: "Applied",
  },
  {
    id: "DLV-2210",
    type: "Delivery Note",
    customer: "Zvomunondiita Construction",
    date: "2026-07-28",
    total: 0,
    due: 0,
    status: "Delivered",
  },
];

// ---------- Helpers ----------

export const money = (n: number, currency = COMPANY.currency) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(
    n,
  );

export const compact = (n: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export const qty = (n: number) => new Intl.NumberFormat("en-US").format(n);
