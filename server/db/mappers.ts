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

export function entityToRow(
  entity: Record<string, unknown>,
  spec: FieldSpec
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(entity)) {
    if (val === undefined) continue; // omit so PATCH only touches provided fields
    const col = toSnake(key);
    if (val === null) { out[col] = null; }
    else if (spec.json.includes(key)) out[col] = JSON.stringify(val);
    else if (spec.dates.includes(key)) {
      // Handle Date objects directly
      if (val instanceof Date) {
        out[col] = val.toISOString();
      } else {
        const strVal = String(val);
        // Detect naive datetime: has time component but no timezone designator
        if (strVal.match(/\d{2}:\d{2}/) && !strVal.match(/Z$|[+-]\d{2}:\d{2}$/)) {
          throw new Error(`${key}: naive datetime "${strVal}" lacks timezone; must be ISO 8601 with explicit Z or offset`);
        }
        const date = new Date(strVal);
        if (Number.isNaN(date.getTime())) {
          throw new Error(`${key}: unparseable datetime "${strVal}"`);
        }
        out[col] = date.toISOString();
      }
    }
    else if (spec.bools.includes(key)) out[col] = val ? 1 : 0;
    else out[col] = val;
  }
  return out;
}
