import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import {
  Building2,
  Plus,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

interface Pharmacy {
  id: string;
  name: string;
  pharmacy_code: string;
  city: string;
  is_active: boolean;
  subscription_status: string;
  created_at: string;
}

export function AdminPage() {
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    pharmacyCode: '',
    managerPin: '',
    city: '',
    region: '',
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(false);
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const res = await fetch('/api/auth/pharmacies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${api.getToken()}`,
        },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPharmacies([...pharmacies, data as Pharmacy]);
      setShowForm(false);
      setFormData({ name: '', pharmacyCode: '', managerPin: '', city: '', region: '' });
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to create pharmacy');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-sm text-gray-500">Manage pharmacies across NZ</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Add Pharmacy
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Register new pharmacy</h3>
          {formError && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm flex items-center gap-2">
              <AlertTriangle size={16} /> {formError}
            </div>
          )}
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Pharmacy name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input-field"
              required
            />
            <input
              type="text"
              placeholder="Pharmacy code (e.g. PHARM001)"
              value={formData.pharmacyCode}
              onChange={(e) => setFormData({ ...formData, pharmacyCode: e.target.value.toUpperCase() })}
              className="input-field font-mono"
              required
            />
            <input
              type="text"
              placeholder="Manager PIN (4-8 digits)"
              value={formData.managerPin}
              onChange={(e) => setFormData({ ...formData, managerPin: e.target.value.replace(/\D/g, '').slice(0, 8) })}
              className="input-field"
              inputMode="numeric"
            />
            <input
              type="text"
              placeholder="City"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="input-field"
            />
            <input
              type="text"
              placeholder="Region"
              value={formData.region}
              onChange={(e) => setFormData({ ...formData, region: e.target.value })}
              className="input-field"
            />
            <div className="md:col-span-2 flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
                {saving ? <Loader2 size={18} className="animate-spin" /> : null}
                {saving ? 'Creating...' : 'Create Pharmacy'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-brand-teal" size={32} />
        </div>
      ) : pharmacies.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Building2 size={40} className="mx-auto mb-2 opacity-50" />
          <p>No pharmacies registered yet</p>
          <p className="text-sm">Click "Add Pharmacy" to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pharmacies.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900">{p.name}</div>
                <div className="text-xs text-gray-500">
                  Code: <span className="font-mono">{p.pharmacy_code}</span> \u00b7 {p.city}
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {p.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
