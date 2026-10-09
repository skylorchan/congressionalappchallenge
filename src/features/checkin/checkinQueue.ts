import { db } from '../../data/db';

/**
 * "I'm safe" check-ins. Kōkua has no server, so it doesn't send anything itself: it
 * writes the message, keeps it in a queue on the phone, and hands it to the phone's
 * own texting or sharing app. SMS often gets through when mobile data doesn't.
 *
 * Queue rules:
 *  - Only the newest unsent check-in matters. Queuing a new one marks older unsent ones
 *    'superseded', so family never gets an out-of-date "I'm at home" after "I've left".
 *  - A check-in is 'sent' only when the user confirms it went out (a web app can't see
 *    whether the SMS app actually sent it).
 */
export type CheckInStatus = 'queued' | 'sent' | 'superseded';

export type CheckIn = {
  id: string;
  createdAt: number;
  message: string;
  status: CheckInStatus;
  sentAt?: number;
};

export async function enqueue(message: string, now: number = Date.now()): Promise<CheckIn> {
  const item: CheckIn = {
    id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    message,
    status: 'queued',
  };
  await db.transaction('rw', db.checkins, async () => {
    await db.checkins.where('status').equals('queued').modify({ status: 'superseded' });
    await db.checkins.add(item);
  });
  return item;
}

/** The one check-in waiting to go out, if any. */
export async function pending(): Promise<CheckIn | null> {
  const queued = await db.checkins.where('status').equals('queued').sortBy('createdAt');
  return queued.at(-1) ?? null;
}

export async function markSent(id: string, now: number = Date.now()): Promise<void> {
  await db.checkins.update(id, { status: 'sent', sentAt: now });
}

export async function history(limit = 5): Promise<CheckIn[]> {
  return db.checkins.orderBy('createdAt').reverse().limit(limit).toArray();
}

/** An sms: link that opens the texting app with the message and recipients filled in. */
export function smsLink(phones: string[], message: string): string {
  const to = phones
    .map((p) => p.replace(/[^\d+]/g, ''))
    .filter(Boolean)
    .join(',');
  // iOS wants "&body=", Android accepts "?body="; "?&body=" works on both.
  return `sms:${to}?&body=${encodeURIComponent(message)}`;
}
