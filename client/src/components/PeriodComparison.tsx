import { useEffect, useState } from 'react';
import { api, PatternComparison, PeriodComparisonData } from '../lib/api';
import { TrendingDown, TrendingUp, CheckCircle2, AlertCircle, Minus, Sparkles } from 'lucide-react';

interface Props {
  from: string;
  to: string;
  /** Pre-fetched data for the report page (avoids a duplicate fetch). */
  data?: PeriodComparisonData;
  /** Limit visible rows on dashboards; the report shows all. */
  maxRows?: number;
}

/**
 * Comparison panel — answers "did our actions work?" by showing how each
 * (drug, error type) pair changed vs the previous review period.
 *
 * Hidden when there's no previous-period data (e.g. first review at a
 * new pharmacy) so a pharmacy isn't compared against zero.
 */
export function PeriodComparison({ from, to, data: preFetched, maxRows = 6 }: Props) {
  const [data, setData] = useState<PeriodComparisonData | null>(preFetched || null);
  const [loading, setLoading] = useState(!preFetched);

  useEffect(() => {
    if (preFetched) { setData(preFetched); return; }
    let cancelled = false;
    setLoading(true);
    api.getPeriodComparison(from, to)
      .then(r => { if (!cancelled) setData(r); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to, preFetched]);

  if (loading) return <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 h-24 animate-pulse" />;
  if (!data) return null;
  // First review: no previous period to compare against. Don't hide entirely —
  // show a placeholder so the manager knows what to expect next month.
  if (data.previousPeriod.totalIncidents === 0) {
    return (
      <div className="bg-white rounded-xl border border-dashed border-gray-300 p-4 mb-4">
        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
          <Sparkles size={14} className="text-gray-400" />
          Did our actions work?
        </h3>
        <p className="text-xs text-gray-500 mt-1.5 leading-snug">
          This is the first review at your pharmacy — there's no earlier period to compare against yet. From next month, this section will show how each near-miss pattern changed: green ticks for resolved, red arrows for patterns that came back, orange flags for new ones.
        </p>
      </div>
    );
  }
  if (data.patterns.length === 0) return null;

  const fmt = (s: string) => new Date(s).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
  const netDelta = data.currentPeriod.totalIncidents - data.previousPeriod.totalIncidents;

  // Split into two groups so wins and concerns don't blur together.
  // Good news: resolved + reduced. Needs attention: new + increased.
  // Unchanged is hidden when we have other rows; shown alone when it's all there is.
  const good = data.patterns.filter(p => p.direction === 'resolved' || p.direction === 'reduced');
  const bad = data.patterns.filter(p => p.direction === 'new' || p.direction === 'increased');
  const same = data.patterns.filter(p => p.direction === 'same');
  const goodVisible = good.slice(0, maxRows);
  const badVisible = bad.slice(0, maxRows);
  const hiddenCount = Math.max(0, good.length - goodVisible.length) + Math.max(0, bad.length - badVisible.length);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <Sparkles size={14} className="text-[#0F6E56]" />
            Did our actions work?
          </h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            How each near-miss pattern changed vs {fmt(data.previousPeriod.from)} – {fmt(data.previousPeriod.to)}.
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">Total near misses</div>
          <div className="text-sm">
            <span className="font-bold text-gray-900">{data.currentPeriod.totalIncidents}</span>
            <span className="text-gray-400"> vs {data.previousPeriod.totalIncidents}</span>
            {netDelta !== 0 && (
              <span className={`ml-2 font-semibold ${netDelta < 0 ? 'text-[#085041]' : 'text-[#791F1F]'}`}>
                {netDelta < 0 ? '↓' : '↑'}{Math.abs(netDelta)}
              </span>
            )}
          </div>
        </div>
      </div>

      {goodVisible.length > 0 && (
        <div className="mb-3">
          <h4 className="text-[11px] font-bold uppercase tracking-wide text-[#085041] mb-1.5">Good news — {good.length === 1 ? '1 pattern' : `${good.length} patterns`} improving</h4>
          <ul className="space-y-1.5">
            {goodVisible.map(p => <ComparisonRow key={`${p.drug}|${p.errorType}`} p={p} />)}
          </ul>
        </div>
      )}

      {badVisible.length > 0 && (
        <div className={goodVisible.length > 0 ? 'pt-3 border-t border-gray-100' : ''}>
          <h4 className="text-[11px] font-bold uppercase tracking-wide text-[#791F1F] mb-1.5">Needs attention — {bad.length === 1 ? '1 pattern' : `${bad.length} patterns`} to discuss</h4>
          <ul className="space-y-1.5">
            {badVisible.map(p => <ComparisonRow key={`${p.drug}|${p.errorType}`} p={p} />)}
          </ul>
        </div>
      )}

      {good.length === 0 && bad.length === 0 && same.length > 0 && (
        <ul className="space-y-1.5">
          {same.slice(0, maxRows).map(p => <ComparisonRow key={`${p.drug}|${p.errorType}`} p={p} />)}
        </ul>
      )}

      {hiddenCount > 0 && (
        <p className="text-[11px] text-gray-400 mt-2">
          {hiddenCount} more pattern{hiddenCount === 1 ? '' : 's'} not shown — see the printed report for the full list.
        </p>
      )}
    </div>
  );
}

function ComparisonRow({ p }: { p: PatternComparison }) {
  let icon, label, tone;
  if (p.direction === 'resolved') {
    icon = <CheckCircle2 size={14} className="text-[#1D9E75]" />;
    tone = 'text-[#085041]';
    label = p.actionedPreviously ? 'Resolved · action worked' : 'Resolved';
  } else if (p.direction === 'reduced') {
    icon = <TrendingDown size={14} className="text-[#1D9E75]" />;
    tone = 'text-[#085041]';
    label = p.actionedPreviously ? `Down ${Math.abs(p.delta)} · action helping` : `Down ${Math.abs(p.delta)}`;
  } else if (p.direction === 'new') {
    icon = <AlertCircle size={14} className="text-[#BA7517]" />;
    tone = 'text-[#9A6113]';
    label = 'New pattern';
  } else if (p.direction === 'increased') {
    icon = <TrendingUp size={14} className="text-[#C84B4B]" />;
    tone = 'text-[#791F1F]';
    label = `Up ${p.delta}` + (p.actionedPreviously ? ' · action not enough' : '');
  } else {
    icon = <Minus size={14} className="text-gray-400" />;
    tone = 'text-gray-500';
    label = 'Unchanged';
  }
  return (
    <li className="flex items-center gap-2 text-sm">
      <span className="flex-shrink-0">{icon}</span>
      <span className="font-medium text-gray-800 truncate">{p.drug}</span>
      <span className="text-xs text-gray-400">·</span>
      <span className="text-xs text-gray-600 truncate">{p.errorType}</span>
      <span className="ml-auto text-xs text-gray-400 whitespace-nowrap">{p.previousCount} → {p.currentCount}</span>
      <span className={`text-xs font-semibold whitespace-nowrap ${tone}`}>{label}</span>
    </li>
  );
}
