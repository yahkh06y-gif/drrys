// Coco's first explanation ("Let me show you how we'll study"), made in the background: it starts the moment
// the student finishes "Show Coco your world", and is usually ready by the time they've made their promise.
import { explainWithWorld } from '@/lib/ai';
import { conceptFor, subfieldName } from '@/lib/onboarding';
import { TYPE_LABEL } from '@/lib/qloo';
import { useApp, type WorldItem } from '@/store';

/** The thing to explain with: a show or movie with themes first (their tags are the richest), then anything picked. */
export function bestPick(picks: WorldItem[]): WorldItem | undefined {
  const rich = (x: WorldItem) => (x.type === 'tv_show' || x.type === 'movie' ? 2 : 0) + Math.min(1, (x.tags?.length ?? 0) / 5);
  return [...picks].sort((a, b) => rich(b) - rich(a))[0];
}

let pending: { key: string; analogy: Promise<string | null> } | undefined;

/** Starts making the explanation for the student's field and world (again only if those changed). */
export function prepareFirst(): Promise<string | null> {
  const { profile, world } = useApp.getState();
  const pick = bestPick(world.picks);
  const key = `${profile.field}:${profile.subfield}:${pick?.id ?? pick?.name ?? ''}`;
  if (pending?.key === key) return pending.analogy;
  const concept = conceptFor(profile.field, profile.subfield);
  const analogy = pick
    ? explainWithWorld(
        { name: concept.name, usual: concept.usual, field: subfieldName(profile.field, profile.subfield) },
        { name: pick.name, kind: TYPE_LABEL[pick.type], themes: pick.tags?.length ? pick.tags : world.tags },
      ).catch(() => null)
    : Promise.resolve(null);
  pending = { key, analogy };
  return analogy;
}
