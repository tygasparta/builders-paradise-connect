import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { ALL_PERMISSION_CODES, PERMISSIONS, ROLES } from "./catalog";

const here = dirname(fileURLToPath(import.meta.url));
const migration = readFileSync(
  resolve(here, "../../../supabase/migrations/20260804090200_phase1_rbac_seed.sql"),
  "utf8",
);
const coreMigration = readFileSync(
  resolve(here, "../../../supabase/migrations/20260804090000_phase1_core.sql"),
  "utf8",
);
// Later migrations add permissions of their own. The catalogue must match
// the union of them all, not just the original seed.
const financeMigration = readFileSync(
  resolve(here, "../../../supabase/migrations/20260805120000_phase5_banking_expenses.sql"),
  "utf8",
);

/** Pulls the first column out of a `values (...)` block following a marker. */
function firstColumnOf(sql: string, marker: string): string[] {
  const start = sql.indexOf(marker);
  if (start === -1) throw new Error(`Marker not found in migration: ${marker}`);
  const end = sql.indexOf("on conflict", start);
  const block = sql.slice(start, end === -1 ? undefined : end);
  return [...block.matchAll(/^\s*\('([a-z0-9_.]+)'/gm)].flatMap((m) => (m[1] ? [m[1]] : []));
}

describe("permission catalogue", () => {
  const marker = "insert into public.permissions (code, module, name, description) values";
  const sqlPermissions = [
    ...firstColumnOf(migration, marker),
    ...firstColumnOf(financeMigration, marker),
  ];

  it("parses a non-trivial number of permissions from the migration", () => {
    // Guards the parser itself: a broken regex would silently pass every
    // set-comparison below by finding nothing on both sides.
    expect(sqlPermissions.length).toBeGreaterThan(100);
  });

  it("defines no duplicate codes in TypeScript", () => {
    expect(new Set(ALL_PERMISSION_CODES).size).toBe(ALL_PERMISSION_CODES.length);
  });

  it("declares no permission the database has never heard of", () => {
    const inSql = new Set(sqlPermissions);
    const missing = ALL_PERMISSION_CODES.filter((code) => !inSql.has(code));
    expect(missing).toEqual([]);
  });

  it("exposes every permission the database seeds", () => {
    const inTs = new Set<string>(ALL_PERMISSION_CODES);
    const missing = sqlPermissions.filter((code) => !inTs.has(code));
    expect(missing).toEqual([]);
  });

  it("uses codes that satisfy the database CHECK constraint", () => {
    // permissions_code_format: '^[a-z][a-z0-9_.]{2,63}$'
    const pattern = /^[a-z][a-z0-9_.]{2,63}$/;
    for (const code of ALL_PERMISSION_CODES) {
      expect(code, `${code} violates permissions_code_format`).toMatch(pattern);
    }
  });
});

describe("role catalogue", () => {
  const sqlRoles = firstColumnOf(
    migration,
    "insert into public.roles (code, name, description, is_system, rank) values",
  );

  it("matches the roles seeded by the migration", () => {
    expect([...Object.values(ROLES)].sort()).toEqual([...sqlRoles].sort());
  });

  it("covers all fourteen roles in the specification", () => {
    expect(sqlRoles).toHaveLength(14);
  });

  it("uses codes that satisfy the database CHECK constraint", () => {
    // roles_code_format: '^[a-z][a-z0-9_]{1,39}$'
    for (const code of Object.values(ROLES)) {
      expect(code, `${code} violates roles_code_format`).toMatch(/^[a-z][a-z0-9_]{1,39}$/);
    }
  });
});

describe("permissions referenced by RLS policies", () => {
  const rls = readFileSync(
    resolve(here, "../../../supabase/migrations/20260804090100_phase1_rls.sql"),
    "utf8",
  );

  it("only guards policies with permissions that exist", () => {
    const referenced = [...rls.matchAll(/has_permission\('([a-z0-9_.]+)'\)/g)].flatMap((m) =>
      m[1] ? [m[1]] : [],
    );
    expect(referenced.length).toBeGreaterThan(0);

    const known = new Set<string>(ALL_PERMISSION_CODES);
    const unknown = [...new Set(referenced)].filter((code) => !known.has(code));
    expect(unknown).toEqual([]);
  });
});

describe("core migration integrity", () => {
  it("makes the permission helpers SECURITY DEFINER", () => {
    // Without this, an RLS policy calling has_permission() would recurse
    // through user_roles' own policy and deny everything.
    const helper = coreMigration.slice(
      coreMigration.indexOf("create or replace function public.has_permission"),
    );
    expect(helper.slice(0, 400)).toContain("security definer");
  });

  it("pins search_path on every SECURITY DEFINER function", () => {
    const definers = [...coreMigration.matchAll(/security definer([\s\S]{0,120}?)as \$\$/g)];
    expect(definers.length).toBeGreaterThan(0);
    for (const [, tail] of definers) {
      expect(tail).toContain("set search_path");
    }
  });

  it("gives the audit log no client-side write path", () => {
    const rls = readFileSync(
      resolve(here, "../../../supabase/migrations/20260804090100_phase1_rls.sql"),
      "utf8",
    );
    const auditPolicies = [
      ...rls.matchAll(/create policy (audit_logs_\w+) on public\.audit_logs\s+for (\w+)/g),
    ];
    expect(auditPolicies.length).toBeGreaterThan(0);
    for (const [, name, command] of auditPolicies) {
      expect(command, `${name} must be read-only`).toBe("select");
    }
  });
});

describe("PERMISSIONS constant shape", () => {
  it("maps every key to a lower-case dotted code", () => {
    for (const [key, value] of Object.entries(PERMISSIONS)) {
      expect(key).toMatch(/^[A-Z][A-Z0-9_]*$/);
      expect(value).toMatch(/^[a-z][a-z0-9_.]*$/);
    }
  });
});
