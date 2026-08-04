/**
 * Small text helpers shared across modules.
 *
 * Counts appear constantly in an ERP — "1 branches" or "updated a branche
 * record" makes the whole system look unfinished, so this is worth getting
 * right in one place rather than at each call site.
 */

/**
 * Turns a plural table name into its singular form.
 *
 * Naive `s`-stripping breaks on `-es` plurals: `branches` becomes `branche`.
 * This handles the endings that actually occur in the schema; it is not a
 * general English singulariser and does not pretend to be.
 */
export function singularise(word: string): string {
  if (/(ch|sh|ss|x|z)es$/i.test(word)) return word.slice(0, -2);
  if (/ies$/i.test(word)) return `${word.slice(0, -3)}y`;
  if (/s$/i.test(word) && !/ss$/i.test(word)) return word.slice(0, -1);
  return word;
}

/**
 * `plural(1, "user")` → `"1 user"`, `plural(3, "user")` → `"3 users"`.
 * Pass an explicit plural for irregular words.
 */
export function plural(count: number, singular: string, pluralForm?: string): string {
  const word = count === 1 ? singular : (pluralForm ?? `${singular}s`);
  return `${count} ${word}`;
}

/** A readable label for an audited table, e.g. `branches` → `a branch record`. */
export function readableRecord(table: string | null): string {
  if (!table) return "";
  const words = table.replace(/_/g, " ").trim();
  const parts = words.split(" ");
  const last = parts[parts.length - 1];
  if (!last) return "";
  parts[parts.length - 1] = singularise(last);
  const phrase = parts.join(" ");
  const article = /^[aeiou]/i.test(phrase) ? "an" : "a";
  return `${article} ${phrase} record`;
}
