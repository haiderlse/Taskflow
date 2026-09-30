import type Database from 'better-sqlite3';
import { ApiError } from '../http';
import { updateRow } from '../rows';
import { getWeek } from '../weeks/store';
import type { Week } from '../../../src/shared/exec/schemas';

/** Stamps the week reviewed once every slotted outcome has a grade (spec B, POST /weeks/:id/review). A second call changes nothing. */
export function reviewWeek(db: Database.Database, id: string, notes: string, now: string): Week | null {
  return db
    .transaction((): Week | null => {
      const week = getWeek(db, id);
      if (!week || week.reviewedAt !== null) return week;
      const ungraded = db.prepare('SELECT COUNT(*) FROM outcomes WHERE week_id = ? AND slot IS NOT NULL AND review_grade IS NULL').pluck().get(id) as number;
      if (ungraded > 0) throw new ApiError(409, 'REVIEW_NOT_READY', 'grade every outcome before the review is done');
      updateRow(db, 'weeks', id, { reviewedAt: now, reviewNotes: notes, updatedAt: now });
      return getWeek(db, id);
    })
    .immediate();
}
