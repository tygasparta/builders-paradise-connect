import { describe, expect, it } from "vitest";

import { PERMISSIONS } from "./catalog";
import { EMPTY_PERMISSIONS, can, canAll, canAny, createPermissionSet, satisfies } from "./check";

const cashier = createPermissionSet([
  PERMISSIONS.DASHBOARD_VIEW,
  PERMISSIONS.POS_OPERATE,
  PERMISSIONS.POS_SESSION_OPEN,
  PERMISSIONS.SALES_DISCOUNT_APPLY,
  PERMISSIONS.PRODUCTS_VIEW,
]);

describe("can", () => {
  it("grants a held permission", () => {
    expect(can(cashier, PERMISSIONS.POS_OPERATE)).toBe(true);
  });

  it("denies a permission that was never granted", () => {
    expect(can(cashier, PERMISSIONS.POS_PRICE_OVERRIDE)).toBe(false);
  });

  it("denies everything for a user with no permissions", () => {
    expect(can(EMPTY_PERMISSIONS, PERMISSIONS.DASHBOARD_VIEW)).toBe(false);
  });

  it("does not treat a prefix as a wildcard", () => {
    // Holding pos.operate must never imply pos.refund.
    expect(can(cashier, PERMISSIONS.POS_REFUND)).toBe(false);
  });

  it("keeps cost price hidden from a cashier", () => {
    expect(can(cashier, PERMISSIONS.PRODUCTS_COST_PRICE_VIEW)).toBe(false);
  });
});

describe("canAny", () => {
  it("is true when one of the codes is held", () => {
    expect(canAny(cashier, [PERMISSIONS.POS_REFUND, PERMISSIONS.POS_OPERATE])).toBe(true);
  });

  it("is false when none are held", () => {
    expect(canAny(cashier, [PERMISSIONS.POS_REFUND, PERMISSIONS.JOURNALS_POST])).toBe(false);
  });

  it("is false for an empty list", () => {
    expect(canAny(cashier, [])).toBe(false);
  });
});

describe("canAll", () => {
  it("is true only when every code is held", () => {
    expect(canAll(cashier, [PERMISSIONS.POS_OPERATE, PERMISSIONS.PRODUCTS_VIEW])).toBe(true);
    expect(canAll(cashier, [PERMISSIONS.POS_OPERATE, PERMISSIONS.POS_REFUND])).toBe(false);
  });

  it("is vacuously true for an empty list", () => {
    expect(canAll(cashier, [])).toBe(true);
  });
});

describe("satisfies", () => {
  it("allows an entry with no requirement", () => {
    expect(satisfies(EMPTY_PERMISSIONS, undefined)).toBe(true);
  });

  it("treats an empty requirement array as no requirement", () => {
    // A mis-typed nav config should not lock everyone out of a screen.
    expect(satisfies(EMPTY_PERMISSIONS, [])).toBe(true);
  });

  it("accepts a single code", () => {
    expect(satisfies(cashier, PERMISSIONS.POS_OPERATE)).toBe(true);
    expect(satisfies(cashier, PERMISSIONS.JOURNALS_POST)).toBe(false);
  });

  it("treats a list as any-of", () => {
    expect(satisfies(cashier, [PERMISSIONS.JOURNALS_POST, PERMISSIONS.POS_OPERATE])).toBe(true);
    expect(satisfies(cashier, [PERMISSIONS.JOURNALS_POST, PERMISSIONS.COA_MANAGE])).toBe(false);
  });
});

describe("createPermissionSet", () => {
  it("de-duplicates codes arriving from the database", () => {
    const set = createPermissionSet([
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.SALES_VIEW,
    ]);
    expect(set.size).toBe(2);
  });

  it("produces an empty set from no rows", () => {
    expect(createPermissionSet([]).size).toBe(0);
  });
});
