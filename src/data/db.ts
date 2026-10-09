import Dexie, { type EntityTable } from 'dexie';
import type { Alert } from '../features/alerts/parseAlerts';
import type { FamilyPlan } from '../features/plan/planModel';
import type { CheckIn } from '../features/checkin/checkinQueue';

/** The last successful download of the NWS alert feed. One row, key 'latest'. */
export type AlertSnapshot = {
  key: 'latest';
  /** When Kōkua downloaded it (ms since epoch). */
  fetchedAt: number;
  /** The feed's own "updated" timestamp (ISO), if it had one. */
  feedUpdated: string | null;
  alerts: Alert[];
};

export type PlanRow = FamilyPlan & { key: 'main' };

/**
 * Everything Kōkua stores lives in this one IndexedDB database on the device. Nothing
 * is sent anywhere unless the user explicitly shares or exports it.
 */
export const db = new Dexie('kokua') as Dexie & {
  alertSnapshots: EntityTable<AlertSnapshot, 'key'>;
  plan: EntityTable<PlanRow, 'key'>;
  checkins: EntityTable<CheckIn, 'id'>;
};

db.version(1).stores({
  alertSnapshots: 'key',
  plan: 'key',
  checkins: 'id, status, createdAt',
});
