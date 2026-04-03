import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Eye,
} from 'lucide-react';

interface Incident {
  id: string;
  status: string;
  dispensary_stage: string;
  error_types: string[];
  detection_point: string;
  time_of_day: string;
  created_at: string;
  reported_by: string;
}

const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-700',
  reviewed: 'bg-green-100 text-green-700',
  archived: 'bg-gray-100 text-gray-500',
};

export function DashboardPage() {
  const { pharmacyName } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const loadIncidents = async () => {
    try {
      const res = await api.getIncidents({ limit: '50' });
      setIncidents(res.incidents as Incident[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadIncidents(); }, []);

  const markReviewed = async (id: string) => {
    setUpdating(id);
    try {
      await api.updateIncidentStatus(id, 'reviewed');
      await loadIncidents();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(null);
    }
  };

  const stats = {
    total: incidents.length,
    submitted: incidents.filter((i) => i.status === 'submitted').length,
    reviewed: incidents.filter((i) => i.status === 'reviewed').length,
    thisMonth: incidents.filter((i) => {
      const d = new Date(i.created_at);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-brand-teal" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        {pharmacyName && <p className="text-sm text-gray-500">{pharmacyName}</p>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Total', value: stats.total, icon: FileText, color: 'text-gray-600' },
          { label: 'Pending review', value: stats.submitted, icon: Clock, color: 'text-blue-600' },
          { label: 'Reviewed', value: stats.reviewed, icon: CheckCircle2, color: 'text-green-600' },
          { label: 'This month', value: stats.thisMonth, icon: AlertTriangle, color: 'text-amber-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl p-4 border border-gray-200">
            <Icon size={20} className={color} />
            <div className="text-2xl font-bold mt-2">{value}</div>
            <div className="text-xs text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-bold text-gray-900 mb-3">Recent near misses</h2>
      {incidents.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <FileText size={40} className="mx-auto mb-2 opacity-50" />
          <p>No incidents recorded yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {incidents.map((incident) => (
            <div
              key={incident.id}
              className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[incident.status] || ''}`}>
                    {incident.status}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(incident.created_at).toLocaleDateString('en-NZ', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="text-sm font-medium text-gray-900 capitalize">
                  {incident.dispensary_stage.replace('_', ' ')} \u2014 {incident.error_types.join(', ').replace(/_/g, ' ')}
                </div>
                <div className="text-xs text-gray-500 capitalize">
                  Caught: {incident.detection_point.replace(/_/g, ' ')} \u00b7 {incident.time_of_day}
                </div>
              </div>

              {incident.status === 'submitted' && (
                <button
                  onClick={() => markReviewed(incident.id)}
                  disabled={updating === incident.id}
                  className="ml-4 px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-teal text-white hover:bg-brand-teal-light transition-colors disabled:opacity-50"
                >
                  {updating === incident.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <span className="flex items-center gap-1"><Eye size={14} /> Review</span>
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
