import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guards PostgREST select strings against the migrations.
 *
 * TypeScript checks the table name in .from() but not the column list in
 * .select() — it is just a string. Two real bugs got through that gap: a
 * query against a table that did not exist, and one naming a column that
 * did not. Both were invisible until the screen was opened.
 *
 * This reads the columns each migration creates and asserts every column
 * named in a select string exists on the table being queried.
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(here, "../../supabase/migrations");
const srcDir = resolve(here, "..");

/** table -> set of column names, from every create table in the migrations. */
function readSchema(): Map<string, Set<string>> {
  const schema = new Map<string, Set<string>>();

  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"))) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");

    const createRe = /create table if not exists public\.(\w+)\s*\(([\s\S]*?)\n\);/g;
    for (const match of sql.matchAll(createRe)) {
      const table = match[1];
      const body = match[2];
      if (!table || !body) continue;

      const columns = schema.get(table) ?? new Set<string>();
      for (const line of body.split("\n")) {
        const trimmed = line.trim();
        // Column definitions start with a name then a type; skip
        // constraints, comments and blank lines.
        const columnMatch =
          /^(\w+)\s+(uuid|text|numeric|integer|boolean|date|timestamptz|char|time|jsonb|serial)/i.exec(
            trimmed,
          );
        if (columnMatch?.[1]) columns.add(columnMatch[1]);
      }
      schema.set(table, columns);
    }

    // Columns added later by alter table.
    const alterRe = /alter table public\.(\w+)\s+add column if not exists (\w+)/g;
    for (const match of sql.matchAll(alterRe)) {
      const table = match[1];
      const column = match[2];
      if (!table || !column) continue;
      const columns = schema.get(table) ?? new Set<string>();
      columns.add(column);
      schema.set(table, columns);
    }
  }

  return schema;
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry) && !entry.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

type Usage = { file: string; table: string; column: string };

/**
 * Pulls .from("table")...select(`cols`) pairs out of a file.
 * Only top-level bare columns are checked; embedded relations carry
 * their own table and are skipped.
 */
function selectUsages(file: string): Usage[] {
  const source = readFileSync(file, "utf8");
  const usages: Usage[] = [];

  const re =
    /\.from\((["'`])(\w+)\1[^)]*\)\s*(?:\.[\w]+\([^)]*\)\s*)*?\.select\(\s*([`"'])([\s\S]*?)\3/g;

  for (const match of source.matchAll(re)) {
    const table = match[2];
    const body = match[4];
    if (!table || !body) continue;
    if (body.includes("${")) continue; // interpolated, not statically known

    // Remove embedded relations: alias:other_table!fk(col, col)
    let flat = body;
    let previous: string;
    do {
      previous = flat;
      flat = flat.replace(/[\w]+\s*:\s*[\w]+(?:![\w]+)?\s*\([^()]*\)/g, "");
      flat = flat.replace(/[\w]+(?:![\w]+)?\s*\([^()]*\)/g, "");
    } while (flat !== previous);

    for (const raw of flat.split(",")) {
      const column = raw.trim().replace(/\s+/g, "");
      if (!column || column === "*" || column.includes(":") || column.includes("(")) continue;
      if (!/^[a-z_][a-z0-9_]*$/.test(column)) continue;
      usages.push({ file, table, column });
    }
  }

  return usages;
}

describe("PostgREST select strings", () => {
  const schema = readSchema();
  const usages = sourceFiles(srcDir).flatMap(selectUsages);

  it("parses a meaningful number of tables from the migrations", () => {
    // Guards the parser: a broken regex would make every check below
    // pass vacuously by finding nothing to compare.
    expect(schema.size).toBeGreaterThan(20);
  });

  it("finds select strings to check", () => {
    expect(usages.length).toBeGreaterThan(20);
  });

  it("names only columns that exist on the table being queried", () => {
    const wrong = usages
      .filter((usage) => {
        const columns = schema.get(usage.table);
        // Views and tables this parser did not see are out of scope.
        if (!columns) return false;
        return !columns.has(usage.column);
      })
      .map((usage) => `${usage.table}.${usage.column} in ${usage.file.replace(srcDir, "src")}`);

    expect(wrong).toEqual([]);
  });
});
