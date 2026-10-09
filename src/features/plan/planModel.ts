import type { LngLat } from '../../geo/types';

export type Contact = {
  id: string;
  name: string;
  relation: string;
  phone: string;
};

export type FamilyPlan = {
  household: string;
  /** Who lives here, and anything responders should know (medical needs, pets). */
  members: string;
  homeAddress: string;
  /** Home location for the zone check, set from GPS or the map. */
  home: LngLat | null;
  /** Where to meet if you get separated: right outside the home, and away from it. */
  meetingNear: string;
  meetingAway: string;
  /** Someone off-island everyone checks in with when local lines are jammed. */
  outOfAreaContact: string;
  contacts: Contact[];
  /** Checklist item id → done. */
  checklist: Record<string, boolean>;
  notes: string;
  updatedAt: number;
};

export const emptyPlan = (): FamilyPlan => ({
  household: '',
  members: '',
  homeAddress: '',
  home: null,
  meetingNear: '',
  meetingAway: '',
  outOfAreaContact: '',
  contacts: [],
  checklist: {},
  notes: '',
  updatedAt: 0,
});

/**
 * Hawaiʻi's emergency agencies recommend a 14-day kit (supply ships may not arrive for
 * weeks after a major hurricane). Item ids map to `plan.items.<id>` strings.
 */
export const CHECKLIST_GROUPS = [
  {
    id: 'kit',
    items: [
      'water',
      'food',
      'meds',
      'firstAid',
      'radio',
      'flashlight',
      'batteries',
      'charger',
      'whistle',
      'cash',
    ],
  },
  { id: 'docs', items: ['ids', 'insurance', 'medicalList', 'contactsPaper'] },
  { id: 'home', items: ['knowZone', 'shutoffs', 'secureOutside', 'gasTank'] },
  { id: 'care', items: ['kupuna', 'keiki', 'pets', 'neighbors'] },
] as const;

export type ChecklistItem = (typeof CHECKLIST_GROUPS)[number]['items'][number];
export const ALL_ITEMS: readonly ChecklistItem[] = CHECKLIST_GROUPS.flatMap((g) => g.items);

export function progress(plan: FamilyPlan): { done: number; total: number } {
  return { done: ALL_ITEMS.filter((id) => plan.checklist[id]).length, total: ALL_ITEMS.length };
}

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Plain-text summary for the QR code and for sharing: what a family member needs if
 * their own phone has nothing. Leaves out empty fields.
 */
export function planToText(
  plan: FamilyPlan,
  labels: {
    title: string;
    home: string;
    meetingNear: string;
    meetingAway: string;
    outOfArea: string;
    contacts: string;
    members: string;
  },
): string {
  const lines = [`${labels.title}${plan.household ? `: ${plan.household}` : ''}`];
  const add = (label: string, value: string) =>
    value.trim() && lines.push(`${label}: ${value.trim()}`);
  add(labels.home, plan.homeAddress);
  add(labels.members, plan.members);
  add(labels.meetingNear, plan.meetingNear);
  add(labels.meetingAway, plan.meetingAway);
  add(labels.outOfArea, plan.outOfAreaContact);
  const contacts = plan.contacts.filter((c) => c.name.trim() || c.phone.trim());
  if (contacts.length) {
    lines.push(`${labels.contacts}:`);
    for (const c of contacts)
      lines.push(
        `- ${[c.name, c.relation && `(${c.relation})`, c.phone].filter(Boolean).join(' ')}`,
      );
  }
  return lines.join('\n');
}
