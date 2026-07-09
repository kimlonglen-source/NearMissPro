import { useEffect, useState } from 'react';
import { api } from './api';

// A near miss that was fixed before, went quiet, and has come back. Keyed by
// drug + error type so any incident in the returned pattern can be flagged
// right where it's read (review list, report), not in a separate box.
export interface RegressionInfo {
  lastActionAt: string;
  lastActionNote: string;
  alternative: string; // an AI fix that differs from what was already tried
}
export type RegressionMap = Map<string, RegressionInfo>;

const keyOf = (drug: string | null | undefined, errorType: string) =>
  `${(drug || '').trim().toLowerCase()}|${errorType}`;

export function useRegressions(from?: string, to?: string): RegressionMap {
  const [map, setMap] = useState<RegressionMap>(new Map());
  useEffect(() => {
    if (!from || !to) return;
    let cancelled = false;
    api.getRegressions(from, to)
      .then(async r => {
        const m: RegressionMap = new Map();
        await Promise.all(r.regressions.map(async reg => {
          let alternative = '';
          try {
            const s = await api.suggestIntervention(reg.drug || reg.errorType, reg.errorType);
            alternative = s.suggestion;
          } catch { /* leave blank */ }
          m.set(keyOf(reg.drug, reg.errorType), {
            lastActionAt: reg.lastActionAt, lastActionNote: reg.lastActionNote, alternative,
          });
        }));
        if (!cancelled) setMap(m);
      })
      .catch(() => { if (!cancelled) setMap(new Map()); });
    return () => { cancelled = true; };
  }, [from, to]);
  return map;
}

// True if any of the incident's error types (with its drug) is a returned fix.
export function findRegression(
  map: RegressionMap, drug: string | null | undefined, errorTypes: string[] | null | undefined,
): RegressionInfo | null {
  if (map.size === 0 || !errorTypes) return null;
  for (const et of errorTypes) {
    const hit = map.get(keyOf(drug, et));
    if (hit) return hit;
  }
  return null;
}

// The flag itself — shown right on a near miss that has come back.
export function RegressionNote({ info }: { info: RegressionInfo }) {
  const fmt = (s: string) => new Date(s).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <div className="mt-2 rounded-lg border border-[#C84B4B]/50 bg-[#FCEBEB] px-3 py-2">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#791F1F]">Came back after a fix</p>
      <p className="text-xs text-[#791F1F] mt-0.5">
        We tried "{info.lastActionNote}" on {fmt(info.lastActionAt)} — and it's happened again.
      </p>
      {info.alternative && (
        <p className="text-xs text-[#085041] mt-1">
          <span className="font-semibold">Worth trying instead:</span> {info.alternative}
        </p>
      )}
    </div>
  );
}
