import { describe, expect, it } from "vitest";

import { plural, readableRecord, singularise } from "./format";

describe("singularise", () => {
  it("handles -es plurals that naive s-stripping breaks", () => {
    // The bug this exists to prevent: "branches" -> "branche".
    expect(singularise("branches")).toBe("branch");
    expect(singularise("boxes")).toBe("box");
    expect(singularise("addresses")).toBe("address");
  });

  it("handles ordinary -s plurals", () => {
    expect(singularise("users")).toBe("user");
    expect(singularise("warehouses")).toBe("warehouse");
    expect(singularise("profiles")).toBe("profile");
    expect(singularise("roles")).toBe("role");
  });

  it("handles -ies plurals", () => {
    expect(singularise("categories")).toBe("category");
    expect(singularise("quantities")).toBe("quantity");
  });

  it("leaves singular words alone", () => {
    expect(singularise("branch")).toBe("branch");
    expect(singularise("stock")).toBe("stock");
  });
});

describe("plural", () => {
  it("uses the singular for exactly one", () => {
    expect(plural(1, "user")).toBe("1 user");
    expect(plural(1, "branch", "branches")).toBe("1 branch");
  });

  it("uses the plural for zero and many", () => {
    expect(plural(0, "user")).toBe("0 users");
    expect(plural(3, "user")).toBe("3 users");
    expect(plural(3, "branch", "branches")).toBe("3 branches");
  });
});

describe("readableRecord", () => {
  it("singularises the table name", () => {
    expect(readableRecord("branches")).toBe("a branch record");
    expect(readableRecord("profiles")).toBe("a profile record");
  });

  it("turns underscores into spaces", () => {
    expect(readableRecord("warehouse_locations")).toBe("a warehouse location record");
    expect(readableRecord("role_permissions")).toBe("a role permission record");
  });

  it("picks the right article", () => {
    expect(readableRecord("audit_logs")).toBe("an audit log record");
  });

  it("returns nothing for a missing table", () => {
    expect(readableRecord(null)).toBe("");
  });
});
