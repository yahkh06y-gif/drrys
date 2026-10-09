// Questions the app can mark by itself (no AI): drag to order, sort into groups, connect pairs.
import type { ActiveQuestion, Grade } from '@/lib/ai';

const pct = (right: number, total: number) => `${right} of ${total}`;
// most of it right (60% or more) but not all: "almost" (orange), not "wrong"
const almost = (right: number, total: number) => right < total && total > 0 && right / total >= 0.6;

export function gradeOrder(q: ActiveQuestion, order: string[]): Grade & { marks: boolean[] } {
  const want = q.steps ?? [];
  const marks = want.map((s, i) => order[i] === s);
  const right = marks.filter(Boolean).length;
  const correct = right === want.length;
  return {
    correct,
    close: almost(right, want.length),
    marks,
    feedback: correct
      ? 'Every step is in the right place.'
      : `${pct(right, want.length)} steps are in the right place. The right order is below. Look for what each step needs from the one before it.`,
  };
}

/** assigned: item → name of the bucket the student put it in */
export function gradeSort(q: ActiveQuestion, assigned: Record<string, string>): Grade & { marks: Record<string, boolean> } {
  const marks: Record<string, boolean> = {};
  let total = 0;
  for (const b of q.buckets ?? [])
    for (const item of b.items) {
      total++;
      marks[item] = assigned[item] === b.name;
    }
  const right = Object.values(marks).filter(Boolean).length;
  const correct = right === total;
  return {
    correct,
    close: almost(right, total),
    marks,
    feedback: correct ? 'Everything is in the right group.' : `${pct(right, total)} are in the right group. The model answer shows how they split, and why.`,
  };
}

/** matched: left text → right text the student connected it to */
export function gradeMatch(q: ActiveQuestion, matched: Record<string, string>): Grade & { marks: Record<string, boolean> } {
  const marks: Record<string, boolean> = {};
  for (const p of q.pairs ?? []) marks[p.left] = matched[p.left] === p.right;
  const total = (q.pairs ?? []).length;
  const right = Object.values(marks).filter(Boolean).length;
  const correct = right === total;
  return {
    correct,
    close: almost(right, total),
    marks,
    feedback: correct ? 'All the pairs are right.' : `${pct(right, total)} pairs are right. The correct pairs are below.`,
  };
}
