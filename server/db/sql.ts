import type Database from 'better-sqlite3';

/**
 * Thrown for any error caused by malformed or invalid client input (an
 * unknown column name, a naive datetime, etc.). The app-level error
 * handler maps this — and only this, plus SQLite constraint violations —
 * to HTTP 400. Every other error type falls through to a generic 500 so
 * internals (stack traces, file paths, driver messages) are never leaked
 * to the client.
 */
export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
  }
}

/**
 * Returns the real column names of `table`, read live from the database
 * schema via PRAGMA table_info. This is the ONLY source of truth for which
 * identifiers are safe to interpolate into SQL: the set is derived from the
 * schema itself at call time, so it can never drift from a hand-maintained
 * allowlist as schema.sql evolves.
 *
 * `table` must be a hardcoded, trusted string from route code — never a
 * value derived from a request. SQLite does not support parameter binding
 * for identifiers or PRAGMA targets, so this interpolation is safe only
 * because `table` is never attacker-controlled; the values that ARE
 * attacker-controlled (the row's keys, validated by assertValidColumns)
 * never reach this function.
 */
export function getTableColumns(db: Database.Database, table: string): Set<string> {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return new Set(rows.map((row) => row.name));
}

/**
 * Validates that every key of `row` is an exact member of `allowedColumns`
 * BEFORE any of those keys are used to build SQL text. Throws
 * BadRequestError naming the first offending key otherwise.
 *
 * This is the structural guard against SQL identifier injection: no string
 * derived from client input ever reaches string-concatenated SQL unless it
 * is first proven, by set membership against the live schema, to be a real
 * column. Set membership cannot be "subtly wrong" the way ad hoc escaping
 * of `=`, `(`, `)`, `?`, or `--` can.
 */
export function assertValidColumns(row: Record<string, unknown>, allowedColumns: Set<string>): void {
  for (const key of Object.keys(row)) {
    if (!allowedColumns.has(key)) {
      throw new BadRequestError(`unknown column: ${key}`);
    }
  }
}

/**
 * Quotes the reserved word `order` as `"order"`, matching schema.sql; every
 * other identifier passes through unchanged. Centralised here so the rule
 * is defined exactly once instead of being re-derived per router.
 */
export function quoteIdent(column: string): string {
  return column === 'order' ? '"order"' : column;
}
