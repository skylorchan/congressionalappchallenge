import { useCallback, useEffect, useRef, useState } from 'react';
import { db } from '../../data/db';
import { emptyPlan, type FamilyPlan } from './planModel';

export async function loadPlan(): Promise<FamilyPlan> {
  const row = await db.plan.get('main');
  // Fill in fields added after the plan was first saved.
  return row ? { ...emptyPlan(), ...row } : emptyPlan();
}

/**
 * The family plan, saved to IndexedDB on this device as you type (debounced), so
 * nothing is lost if the phone dies or the app is closed.
 */
export function usePlan() {
  const [plan, setPlan] = useState<FamilyPlan | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<FamilyPlan | null>(null);

  useEffect(() => {
    let live = true;
    loadPlan()
      .then((p) => {
        if (!live) return;
        latest.current = p;
        setPlan(p);
      })
      .catch(() => live && setPlan(emptyPlan()));
    return () => {
      live = false;
    };
  }, []);

  // Writes the latest edit if one is waiting. Never writes otherwise, so an idle copy of
  // this hook can't overwrite newer data with what it loaded earlier.
  const flush = useCallback(() => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = null;
    if (latest.current) void db.plan.put({ ...latest.current, key: 'main' });
  }, []);

  // Save anything pending when leaving the screen.
  useEffect(() => flush, [flush]);

  const update = useCallback(
    (change: Partial<FamilyPlan> | ((p: FamilyPlan) => Partial<FamilyPlan>)) => {
      setPlan((prev) => {
        if (!prev) return prev;
        const next = {
          ...prev,
          ...(typeof change === 'function' ? change(prev) : change),
          updatedAt: Date.now(),
        };
        latest.current = next;
        return next;
      });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 400);
    },
    [flush],
  );

  return { plan, update, flush };
}
