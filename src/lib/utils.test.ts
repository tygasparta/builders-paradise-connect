import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { cn, TYPOGRAPHY_ROLES } from "./utils";

describe("cn — typography roles must not be mistaken for colours", () => {
  it("keeps the text colour when a size role is merged on top", () => {
    // The real bug: a secondary badge sets its own colour, then a screen
    // adds a size. Both must survive, or the badge renders dark on black.
    const result = cn("bg-secondary text-secondary-foreground", "text-helper");
    expect(result).toContain("text-secondary-foreground");
    expect(result).toContain("text-helper");
  });

  it("keeps the size when a colour is merged on top", () => {
    const result = cn("text-helper", "text-muted-foreground");
    expect(result).toContain("text-helper");
    expect(result).toContain("text-muted-foreground");
  });

  it("still lets one size role replace another", () => {
    // They are the same property, so the later one should win outright.
    const result = cn("text-td", "text-section");
    expect(result).toContain("text-section");
    expect(result).not.toContain("text-td");
  });

  it("still lets one colour replace another", () => {
    const result = cn("text-muted-foreground", "text-destructive");
    expect(result).toContain("text-destructive");
    expect(result).not.toContain("text-muted-foreground");
  });

  it("survives a size role sitting between two colours", () => {
    const result = cn("text-primary-foreground", "text-badge", "text-secondary-foreground");
    expect(result).toContain("text-badge");
    expect(result).toContain("text-secondary-foreground");
    expect(result).not.toContain("text-primary-foreground");
  });

  it("does not disturb Tailwind's own sizes", () => {
    const result = cn("text-sm", "text-lg");
    expect(result).toBe("text-lg");
  });
});

describe("typography roles stay in step with the stylesheet", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const css = readFileSync(resolve(here, "../styles.css"), "utf8");

  /** Base role names only — `--text-x--line-height` is a modifier, not a role. */
  const roleNames = (source: string) =>
    new Set(
      [...source.matchAll(/--text-([a-z0-9-]+):/g)]
        .flatMap((m) => (m[1] ? [m[1]] : []))
        .filter((name) => !name.includes("--")),
    );

  it("declares every role the stylesheet defines", () => {
    // A --text-* token the merge list has never heard of is exactly the
    // bug above waiting to happen again.
    const declared = roleNames(css);
    const known = new Set<string>(TYPOGRAPHY_ROLES);
    const missing = [...declared].filter((role) => !known.has(role));
    expect(missing).toEqual([]);
  });

  it("declares no role the stylesheet does not define", () => {
    const declared = roleNames(css);
    const stale = TYPOGRAPHY_ROLES.filter((role) => !declared.has(role));
    expect(stale).toEqual([]);
  });
});
