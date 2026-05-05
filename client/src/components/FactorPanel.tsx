import { useEffect, useState } from 'react';
import { api, FactorRow, FactorAnalysisData } from '../lib/api';
import { TrendingUp, TrendingDown, Minus, Sparkles, CheckCircle2, Circle } from 'lucide-react';

interface Props {
  from: string;
  to: string;
  /** Pre-fetched data for the report page (avoids a duplicate fetch). */
  data?: FactorAnalysisData;
  /** Cap visible rows on the dashboard; the report shows all. */
  maxRows?: number;
  /** When true, render without the outer card wrapper — used when the
      panel is embedded inside another block (e.g. the period summary). */
  embedded?: boolean;
}

/**
 * "Why near misses happened" — surfaces the top contributing system
 * factors (high volume / interruption / similar packaging etc.) and
 * pairs each with one concrete NZ-grounded suggestion the manager can
 * action. Complements the per-incident view by showing system causes
 * that the per-incident AI recommendation can't see on its own.
 *
 * When there's no previous-period data to compare against (e.g. first
 * review at a new pharmacy), the comparison arrows and "New this
 * period" labels are hidden — every factor would be technically "new"
 * and showing it everywhere is just noise.
 */
export function FactorPanel({ from, to, data: preFetched, maxRows = 5, embedded = false }: Props) {
  const [data, setData] = useState<FactorAnalysisData | null>(preFetched || null);
  const [loading, setLoading] = useState(!preFetched);

  useEffect(() => {
    if (preFetched) { setData(preFetched); return; }
    let cancelled = false;
    setLoading(true);
    api.getFactorAnalysis(from, to)
      .then(r => { if (!cancelled) setData(r); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to, preFetched]);

  if (loading) {
    return embedded
      ? <div className="h-24 animate-pulse bg-gray-100 rounded" />
      : <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 h-32 animate-pulse" />;
  }
  if (!data || data.factors.length === 0) return null;

  const visible = data.factors.slice(0, maxRows);
  // No previous period to compare against — drop the comparison arrows
  // and "New this period" labels because every factor reads "0 → N New",
  // which is repetitive and meaningless for a first review.
  const showComparison = data.previousPeriod.totalIncidents > 0;

  // Inner content shared between standalone-card mode and embedded mode.
  const inner = (
    <>
      <div className="mb-3">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
          <Sparkles size={14} className="text-[#0F6E56]" />
          Why near misses happened
        </h3>
      </div>

      <ul className="space-y-3">
        {visible.map(f => <FactorRowDisplay key={f.name} f={f} showComparison={showComparison} />)}
      </ul>

      {data.factors.length > visible.length && (
        <p className="text-[11px] text-gray-400 mt-3">
          {data.factors.length - visible.length} more factor{data.factors.length - visible.length === 1 ? '' : 's'} not shown — full list in the printed report.
        </p>
      )}
    </>
  );

  // Embedded mode: no card wrapper, no margin — meant to sit inside
  // another block (e.g. the period summary section of the report).
  if (embedded) return <div>{inner}</div>;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
      {inner}
    </div>
  );
}

function FactorRowDisplay({ f, showComparison }: { f: FactorRow; showComparison: boolean }) {
  // Without a comparison period, every row is the same neutral grey — we're
  // just listing the factors at play, no judgement on direction.
  if (!showComparison) {
    return (
      <li className="flex gap-2.5">
        <Circle size={8} className="flex-shrink-0 mt-1.5 text-gray-400 fill-gray-400" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">{f.name}</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {f.currentCount} incident{f.currentCount === 1 ? '' : 's'}
            </span>
          </div>
          <p className="text-[11px] text-gray-700 leading-snug mt-1">
            <span className="font-semibold text-gray-900">Fix:</span> {f.suggestion}
          </p>
        </div>
      </li>
    );
  }

  // Comparison branch — show direction tone and delta label.
  let icon, tone, deltaLabel;
  if (f.direction === 'gone') {
    icon = <CheckCircle2 size={14} className="text-[#1D9E75]" />;
    tone = 'text-[#085041]';
    deltaLabel = 'Gone — well done';
  } else if (f.direction === 'down') {
    icon = <TrendingDown size={14} className="text-[#1D9E75]" />;
    tone = 'text-[#085041]';
    deltaLabel = `Down ${Math.abs(f.delta)}`;
  } else if (f.direction === 'up') {
    icon = <TrendingUp size={14} className="text-[#C84B4B]" />;
    tone = 'text-[#791F1F]';
    deltaLabel = `Up ${f.delta}`;
  } else if (f.direction === 'new') {
    icon = <Circle size={8} className="text-gray-400 fill-gray-400" />;
    tone = 'text-gray-500';
    deltaLabel = 'New';
  } else {
    icon = <Minus size={14} className="text-gray-400" />;
    tone = 'text-gray-500';
    deltaLabel = 'Same';
  }

  const isWin = f.direction === 'gone' || f.direction === 'down';

  return (
    <li className="flex gap-2.5">
      <span className="flex-shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-900">{f.name}</span>
          <span className="text-xs text-gray-400 whitespace-nowrap">
            {f.previousCount} → {f.currentCount}
          </span>
          <span className={`text-xs font-semibold whitespace-nowrap ${tone}`}>
            {deltaLabel}
          </span>
        </div>
        {!isWin && (
          <p className="text-[11px] text-gray-700 leading-snug mt-1">
            <span className="font-semibold text-gray-900">Fix:</span> {f.suggestion}
          </p>
        )}
      </div>
    </li>
  );
}
