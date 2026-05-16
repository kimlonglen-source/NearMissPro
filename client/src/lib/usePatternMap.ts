import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export interface PatternEntry {
  drug: string;
  errorType: string;
  count: number;
  lastSeen: string | null;
  latestAction: { note: string; created_at: string } | null;
  actionCount: number;
}

// Map keyed by "drugLowerTrim|errorType" so we can look up whether
// any given incident is part of a recurring pattern in O(1) from the
// incident card render.
export type PatternMap = Map<string, PatternEntry>;

function keyOf(drug: string | null | undefined, errorType: string | null | undefined): string {
  return `${(drug || '').trim().toLowerCase()}|${errorType || ''}`;
}

/**
 * Fetches recurring patterns for the given date range and returns a
 * lookup map. Same data source as the dashboard banner — passing the
 * same {from, to} makes every part of the page tell one story:
 * banner, incident cards, report comparison.
 */
export function usePatternMap(from?: string, to?: string): { map: PatternMap; loading: boolean } {
  const [map, setMap] = useState<PatternMap>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getActiveHotspots(from, to)
      .then(r => {
        if (cancelled) return;
        const m = new Map<string, PatternEntry>();
        for (const h of r.hotspots) m.set(keyOf(h.drug, h.errorType), h);
        setMap(m);
      })
      .catch(() => { if (!cancelled) setMap(new Map()); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to]);

  return { map, loading };
}

// Lookup helper — returns the pattern entry for an incident if it's
// part of a recurring pattern (drug + primary error type), else null.
export function findPattern(map: PatternMap, drug: string | null | undefined, errorTypes: string[] | null | undefined): PatternEntry | null {
  const primary = errorTypes?.[0];
  if (!drug || !primary) return null;
  return map.get(keyOf(drug, primary)) || null;
}
