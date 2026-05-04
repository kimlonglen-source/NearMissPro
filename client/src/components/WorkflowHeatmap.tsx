import { useEffect, useState } from 'react';
import { api, HeatmapData } from '../lib/api';
import { Clock } from 'lucide-react';

interface Props {
  from: string;
  to: string;
  /** Pre-fetched data for the report page (avoids a duplicate fetch). */
  data?: HeatmapData;
}

/**
 * Workflow heatmap — when do near misses happen across the week?
 * Reveals predictable danger zones the manager can plan around (e.g.
 * "Mondays at lunch is your peak"). Aligned to HQSC distraction-
 * reduction guidance — once you know where the time pressure is, you
 * can apply a no-interruption zone, add a checking pharmacist, or
 * shift non-urgent dispensing out of the peak window.
 */
export function WorkflowHeatmap({ from, to, data: preFetched }: Props) {
  const [data, setData] = useState<HeatmapData | null>(preFetched || null);
  const [loading, setLoading] = useState(!preFetched);

  useEffect(() => {
    if (preFetched) { setData(preFetched); return; }
    let cancelled = false;
    setLoading(true);
    api.getHeatmap(from, to)
      .then(r => { if (!cancelled) setData(r); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to, preFetched]);

  if (loading) return <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 h-40 animate-pulse" />;
  if (!data || data.total === 0) return null;

  // Find the maximum cell count so we can scale the colour intensity.
  let maxCell = 1;
  for (const t of data.times) for (const d of data.days) maxCell = Math.max(maxCell, data.grid[t][d]);

  const intensity = (n: number): string => {
    if (n === 0) return 'bg-gray-50';
    const ratio = n / maxCell;
    if (ratio >= 0.75) return 'bg-[#C84B4B] text-white';
    if (ratio >= 0.5) return 'bg-[#E08585] text-white';
    if (ratio >= 0.25) return 'bg-[#F2BCBC] text-[#791F1F]';
    return 'bg-[#FAEEDA] text-[#633806]';
  };

  // Short time labels for the row headers — full names are too long for the grid.
  const shortTime: Record<string, string> = {
    'Morning 8–12pm': 'Morning',
    'Lunch 12–2pm': 'Lunch',
    'Afternoon 2–6pm': 'Afternoon',
    'Evening 6pm+': 'Evening',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
          <Clock size={14} className="text-[#0F6E56]" />
          When are near misses happening?
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Darker cells mean more incidents. Predictable hotspots are the easiest to fix — workforce, breaks, or no-interruption rules.
        </p>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr>
              <th className="text-left font-medium text-gray-500 pr-2 pb-1"></th>
              {data.days.map(d => (
                <th key={d} className="font-medium text-gray-500 pb-1 px-1">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.times.map(t => (
              <tr key={t}>
                <td className="text-right font-medium text-gray-600 pr-2 py-1 whitespace-nowrap">{shortTime[t] || t}</td>
                {data.days.map(d => {
                  const n = data.grid[t][d];
                  return (
                    <td key={d} className="px-0.5 py-0.5">
                      <div className={`h-7 rounded flex items-center justify-center font-semibold ${intensity(n)}`}
                        title={`${d} ${shortTime[t]}: ${n} incident${n === 1 ? '' : 's'}`}>
                        {n > 0 ? n : ''}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.peak && (
        <p className="text-xs text-gray-700 mt-3 leading-snug">
          <span className="font-semibold">Peak:</span> {data.peak.day} {shortTime[data.peak.time] || data.peak.time} — {data.peak.count} incident{data.peak.count === 1 ? '' : 's'}.{' '}
          <span className="text-gray-500">Worth a roster or workspace check.</span>
        </p>
      )}
    </div>
  );
}
