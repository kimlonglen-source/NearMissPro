import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { AlertTriangle, X, Loader2, Plus } from 'lucide-react';

interface Hotspot {
  drug: string;
  errorType: string;
  count: number;
  lastSeen: string | null;
}

interface Intervention {
  id: string;
  note: string;
  created_at: string;
}

/**
 * Repeat-pattern alert — sits above the dashboard stats grid when a
 * drug+error pair has had 2+ active incidents inside the dashboard's
 * selected date range. The manager taps a row to log an intervention
 * straight into pattern_interventions so they can act WHILE the
 * pattern is current rather than waiting for the monthly review.
 *
 * Hidden when there are no patterns — keeps the dashboard quiet
 * during normal weeks.
 */
export function LiveHotspotBanner({ from, to }: { from?: string; to?: string }) {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState<Hotspot | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.getActiveHotspots(from, to);
      setHotspots(r.hotspots);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [from, to]);

  if (loading || hotspots.length === 0) return null;

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });

  return (
    <>
      <div className="rounded-xl border-2 border-[#BA7517] bg-[#FDF8EB] p-4 mb-4">
        <div className="flex items-start gap-2 mb-2">
          <AlertTriangle size={18} className="text-[#BA7517] flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-[#633806]">
              {hotspots.length} repeat pattern{hotspots.length === 1 ? '' : 's'} in this period — consider acting now
            </h3>
            <p className="text-xs text-[#633806]/70 mt-0.5">
              Each of these has happened 2 or more times in the date range you're reviewing. Tap <span className="font-semibold">Log action</span> to record a change you've made (or are making) so it's captured before the next review.
            </p>
          </div>
        </div>

        <ul className="space-y-2 mt-3">
          {hotspots.map(h => (
            <HotspotRow key={`${h.drug}|${h.errorType}`} hotspot={h} onClickLog={() => setOpenModal(h)} />
          ))}
        </ul>
      </div>

      {openModal && (
        <LogActionModal
          hotspot={openModal}
          onClose={() => setOpenModal(null)}
          onSaved={async () => { setOpenModal(null); await load(); }}
        />
      )}
    </>
  );
}

// Hotspot row — shows the count + most recent action inline, so the
// manager can see at a glance what's been done about this pattern
// without having to open the modal. Closes the feedback loop visibly
// instead of hiding it behind a click.
function HotspotRow({ hotspot: h, onClickLog }: { hotspot: Hotspot; onClickLog: () => void }) {
  const [latest, setLatest] = useState<Intervention | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api.listInterventions(h.drug, h.errorType)
      .then(r => {
        if (cancelled) return;
        setCount(r.interventions.length);
        // API returns oldest first — grab the last entry to show the
        // most recently logged action on the banner.
        setLatest(r.interventions.length > 0 ? r.interventions[r.interventions.length - 1] : null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [h.drug, h.errorType]);

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });

  return (
    <li className="bg-white rounded-lg px-3 py-2 border border-[#BA7517]/30">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-gray-900">{h.drug}</span>
        <span className="text-xs text-gray-400">·</span>
        <span className="text-xs text-gray-700">{h.errorType}</span>
        <span className="text-xs font-semibold text-[#791F1F] ml-1">{h.count} in this period</span>
        {h.lastSeen && (
          <span className="text-[11px] text-gray-400">last {fmt(h.lastSeen)}</span>
        )}
        <button
          onClick={onClickLog}
          className="ml-auto text-xs font-semibold px-3 py-1 rounded-lg bg-[#BA7517] text-white hover:bg-[#9A6113] inline-flex items-center gap-1">
          <Plus size={12} /> {count === 0 ? 'Log action' : 'Add / view actions'}
        </button>
      </div>
      {latest && (
        <p className="text-xs text-gray-600 mt-1.5 pl-1 leading-snug">
          <span className="font-semibold text-[#085041]">Last action ({fmt(latest.created_at)}):</span> {latest.note}
          {count > 1 && <span className="text-gray-400"> · +{count - 1} earlier</span>}
        </p>
      )}
    </li>
  );
}

function LogActionModal({ hotspot, onClose, onSaved }: { hotspot: Hotspot; onClose: () => void; onSaved: () => void }) {
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.listInterventions(hotspot.drug, hotspot.errorType)
      .then(r => { if (!cancelled) setInterventions(r.interventions); })
      .catch(() => { if (!cancelled) setInterventions([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [hotspot.drug, hotspot.errorType]);

  const save = async () => {
    if (!note.trim() || saving) return;
    setSaving(true);
    try {
      await api.addIntervention(hotspot.drug, hotspot.errorType, note.trim());
      onSaved();
    } finally { setSaving(false); }
  };

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="text-lg font-bold text-gray-900 leading-tight">Log an action</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {hotspot.drug} · {hotspot.errorType} · {hotspot.count} times in this period
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Prior interventions */}
        {loading ? (
          <div className="flex items-center gap-2 text-gray-500 text-xs py-3">
            <Loader2 size={12} className="animate-spin" /> Loading prior actions…
          </div>
        ) : interventions.length > 0 ? (
          <div className="bg-gray-50 rounded-lg p-3 mb-3 border border-gray-200">
            <p className="text-xs font-semibold text-gray-600 mb-1.5">Actions tried so far</p>
            <ul className="space-y-1">
              {interventions.map(iv => (
                <li key={iv.id} className="text-xs text-gray-700 leading-snug">
                  <span className="text-gray-400">{fmt(iv.created_at)} —</span> {iv.note}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-gray-400 mb-3 italic">No prior actions logged for this pattern.</p>
        )}

        <label className="text-xs font-medium text-gray-600 mb-1 block">What action are you taking?</label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value.slice(0, 500))}
          rows={3}
          placeholder="e.g. Moved Atorvastatin 10mg to a separate shelf, added a warning sticker, briefed the team."
          className="input-field text-sm w-full"
          autoFocus
        />
        <p className="text-[11px] text-gray-400 mt-1">{note.length}/500. This will appear in the monthly report's Pattern Alerts section.</p>

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200">
            Cancel
          </button>
          <button onClick={save} disabled={!note.trim() || saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[#0F6E56] text-white hover:bg-[#0B5A46] disabled:opacity-50 inline-flex items-center justify-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Saving…' : 'Save action'}
          </button>
        </div>
      </div>
    </div>
  );
}
