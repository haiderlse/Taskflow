import { BadRequestError } from './sql';

export type FieldSpec = { json: string[]; dates: string[]; bools: string[] };

const toCamel = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const toSnake = (s: string) => s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());

export const USER_SPEC: FieldSpec = {
  json: [],
  dates: ['lastLogin', 'createdAt'],
  bools: ['isActive'],
};

export const PROJECT_SPEC: FieldSpec = {
  json: ['members', 'sections', 'brief', 'statusUpdates', 'customFields', 'tags'],
  dates: ['createdAt', 'updatedAt', 'startDate', 'dueDate'],
  bools: ['isTemplate', 'isFavorite'],
};

export const TASK_SPEC: FieldSpec = {
  json: ['projectIds', 'collaboratorIds', 'dependencies', 'blockedBy', 'blocking',
         'subtasks', 'customFields', 'tags', 'attachments', 'approval',
         'subtaskItems', 'recurrence', 'activities'],
  dates: ['dueDate', 'startDate', 'completedDate', 'scheduledStart',
          'scheduledEnd', 'createdAt', 'updatedAt'],
  bools: ['isMilestone'],
};

export function rowToEntity<T>(row: Record<string, unknown>, spec: FieldSpec): T {
  const out: Record<string, unknown> = {};
  for (const [col, val] of Object.entries(row)) {
    const key = toCamel(col);
    if (val === null || val === undefined) { out[key] = null; continue; }
    if (spec.json.includes(key)) out[key] = JSON.parse(val as string);
    else if (spec.dates.includes(key)) out[key] = new Date(val as string);
    else if (spec.bools.includes(key)) out[key] = val === 1 || val === true;
    else out[key] = val;
  }
  return out as T;
}

function toIsoDate(key: string, val: unknown): string {
  // Handle Date objects directly
  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) {
      throw new BadRequestError(`${key}: invalid Date object`);
    }
    return val.toISOString();
  }
  if (typeof val === 'number') {
    // Handle numeric epoch-millis timestamp
    const date = new Date(val);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestError(`${key}: unparseable timestamp ${val}`);
    }
    return date.toISOString();
  }
  if (typeof val !== 'string') {
    throw new BadRequestError(`${key}: must be an ISO 8601 string, epoch millis or Date`);
  }
  // Detect naive datetime: has time component but no timezone designator
  // Regex allows: Z, [+-]HH:MM, or [+-]HHMM (basic format)
  if (val.match(/\d{2}:\d{2}/) && !val.match(/(?:Z|[+-]\d{2}:?\d{2})$/i)) {
    throw new BadRequestError(`${key}: naive datetime "${val}" lacks timezone; must be ISO 8601 with explicit Z or offset`);
  }
  const date = new Date(val);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestError(`${key}: unparseable datetime "${val}"`);
  }
  return date.toISOString();
}

export function entityToRow(
  entity: Record<string, unknown>,
  spec: FieldSpec
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(entity)) {
    if (val === undefined) continue; // omit so PATCH only touches provided fields
    // The JSON/date/bool specs are keyed by camelCase, so a snake_case key would
    // reach a real column with its encoding (and validation) silently skipped.
    if (key.includes('_')) throw new BadRequestError(`unknown field: ${key}`);
    const col = toSnake(key);
    if (val === null) { out[col] = null; }
    else if (spec.json.includes(key)) out[col] = JSON.stringify(val);
    else if (spec.dates.includes(key)) out[col] = toIsoDate(key, val);
    else if (spec.bools.includes(key)) {
      if (typeof val !== 'boolean') throw new BadRequestError(`${key}: must be a boolean`);
      out[col] = val ? 1 : 0;
    }
    // better-sqlite3 spreads an array argument across the remaining placeholders and
    // cannot bind booleans or objects, so plain columns accept only strings and numbers.
    else if (typeof val === 'string' || typeof val === 'number') out[col] = val;
    else throw new BadRequestError(`${key}: must be a string or number`);
  }
  return out;
}
