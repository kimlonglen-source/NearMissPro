const BASE = '/api';

export interface PatternComparison {
  drug: string;
  errorType: string;
  currentCount: number;
  previousCount: number;
  delta: number;
  actionedPreviously: boolean;
  direction: 'resolved' | 'reduced' | 'same' | 'increased' | 'new';
}
export interface PeriodComparisonData {
  currentPeriod: { from: string; to: string; totalIncidents: number };
  previousPeriod: { from: string; to: string; totalIncidents: number };
  patterns: PatternComparison[];
}

export interface FactorRow {
  name: string;
  currentCount: number;
  previousCount: number;
  delta: number;
  direction: 'new' | 'up' | 'down' | 'same' | 'gone';
  suggestion: string;
}
export interface FactorAnalysisData {
  currentPeriod: { from: string; to: string; totalIncidents: number };
  previousPeriod: { from: string; to: string; totalIncidents: number };
  factors: FactorRow[];
}

export interface HeatmapData {
  currentPeriod: { from: string; to: string };
  times: string[];
  days: string[];
  grid: Record<string, Record<string, number>>;
  total: number;
  peak: { day: string; time: string; count: number } | null;
}

class Api {
  private token: string | null = null;

  setToken(t: string | null) {
    this.token = t;
    t ? localStorage.setItem('nmp_token', t) : localStorage.removeItem('nmp_token');
  }

  getToken() {
    if (!this.token) this.token = localStorage.getItem('nmp_token');
    return this.token;
  }

  private async req<T>(path: string, opts: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...((opts.headers as Record<string, string>) || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${BASE}${path}`, { ...opts, headers });
    if (res.status === 401) {
      this.setToken(null);
      localStorage.removeItem('nmp_role');
      window.location.href = '/login';
      throw new Error('Session expired');
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data as T;
  }

  // Auth
  staffLogin(name: string, password: string) {
    return this.req<{ token: string; role: string; pharmacyName: string; pharmacyId: string }>('/auth/staff/login', { method: 'POST', body: JSON.stringify({ name, password }) });
  }
  managerAccess(managerPassword: string) {
    return this.req<{ token: string; role: string; managerPasswordIsSeparate: boolean }>('/auth/manager/access', {
      method: 'POST',
      body: JSON.stringify({ managerPassword }),
    });
  }
  founderLogin(email: string, password: string, mfaCode?: string) {
    return this.req<{ token?: string; role?: string; requiresMfa?: boolean; email?: string }>('/auth/founder/login', { method: 'POST', body: JSON.stringify({ email, password, mfaCode }) });
  }
  getMe() { return this.req<{ pharmacyId: string; pharmacyName: string; role: string; pharmacySize?: string | null; managerPasswordIsSeparate?: boolean; managerName?: string | null; managerEmail?: string | null }>('/auth/me'); }
  setPharmacySize(pharmacySize: 'sole' | 'pharmacist_plus_tech' | 'multi' | null) {
    return this.req<{ ok: boolean; pharmacySize: string | null }>('/auth/pharmacy/settings', { method: 'PATCH', body: JSON.stringify({ pharmacySize }) });
  }
  updatePharmacyDetails(managerName: string, managerEmail: string) {
    return this.req<{ ok: boolean; managerName: string | null; managerEmail: string | null }>('/auth/pharmacy/settings', {
      method: 'PATCH',
      body: JSON.stringify({ managerName, managerEmail }),
    });
  }
  getMyAuditLog(page = 1) {
    return this.req<{ entries: { id: string; action: string; performed_by: string | null; details: Record<string, unknown> | null; created_at: string }[]; total: number; page: number; limit: number }>(`/audit/log?page=${page}`);
  }

  // Pharmacy management
  createPharmacy(data: { name: string; password: string; managerPassword: string; managerName: string; managerEmail: string; address?: string; licenceNumber?: string }) {
    return this.req<object>('/auth/pharmacies', { method: 'POST', body: JSON.stringify(data) });
  }
  listPharmacies() { return this.req<object[]>('/auth/pharmacies'); }
  updatePharmacyStatus(id: string, status: string) {
    return this.req<object>(`/auth/pharmacies/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
  }

  // Password management
  changePassword(currentPassword: string, newPassword: string) { return this.req<object>('/auth/manager/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }); }
  setManagerPassword(currentPassword: string, newPassword: string) {
    return this.req<{ success: true }>('/auth/manager/set-manager-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }
  forgotPassword(pharmacyName: string, passwordType: 'pharmacy' | 'manager') {
    return this.req<{ ok: true }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ pharmacyName, passwordType }),
    });
  }
  resetPassword(token: string, newPassword: string) {
    return this.req<{ ok: true; passwordType: 'pharmacy' | 'manager' }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    });
  }

  // Incidents
  createIncident(data: object) { return this.req<Record<string, unknown>>('/incidents', { method: 'POST', body: JSON.stringify(data) }); }
  getIncidents(params?: Record<string, string>) {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.req<{ incidents: Record<string, unknown>[]; total: number }>(`/incidents${q}`);
  }
  getIncident(id: string) { return this.req<Record<string, unknown>>(`/incidents/${id}`); }
  editIncident(id: string, data: object) { return this.req<object>(`/incidents/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
  flagIncident(id: string, note?: string) { return this.req<object>(`/incidents/${id}/flag`, { method: 'POST', body: JSON.stringify({ note }) }); }
  voidIncident(id: string, reason: string) { return this.req<object>(`/incidents/${id}/void`, { method: 'POST', body: JSON.stringify({ reason }) }); }
  restoreIncident(id: string) { return this.req<object>(`/incidents/${id}/restore`, { method: 'POST' }); }
  getMonthlyCount() { return this.req<{ count: number }>('/incidents/stats/monthly-count'); }

  // Options
  getOptions() { return this.req<Record<string, Record<string, { id: string; label: string; group_name: string; category: string }[]>>>('/options'); }

  // Recommendations
  actionRecommendation(id: string, data: { managerOutcome: string; managerText?: string; managerName?: string; privateNote?: string }) {
    return this.req<object>(`/recommendations/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }
  bulkAccept(managerName: string) { return this.req<{ updated: number }>('/recommendations/bulk-accept', { method: 'POST', body: JSON.stringify({ managerName }) }); }

  // Reports
  generateReport(data: { periodStart: string; periodEnd: string; generatedBy: string; isCustomRange?: boolean }) {
    return this.req<Record<string, unknown>>('/reports/generate', { method: 'POST', body: JSON.stringify(data) });
  }
  getReports() { return this.req<Record<string, unknown>[]>('/reports'); }
  getReport(id: string) { return this.req<Record<string, unknown>>(`/reports/${id}`); }
  updateReport(id: string, data: object) { return this.req<object>(`/reports/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
  emailReport(id: string) { return this.req<object>(`/reports/${id}/email`, { method: 'POST' }); }

  // Admin
  getAdminHealth() { return this.req<Record<string, number>>('/admin/health'); }
  getOtherEntries() { return this.req<Record<string, unknown>[]>('/admin/other-entries'); }
  actionOtherEntry(id: string, outcome: string) { return this.req<object>(`/admin/other-entries/${id}`, { method: 'PATCH', body: JSON.stringify({ outcome }) }); }
  getAuditLog(page = 1) { return this.req<{ entries: Record<string, unknown>[]; total: number }>(`/admin/audit-log?page=${page}`); }
  getPharmacyStats() { return this.req<Record<string, unknown>[]>('/admin/pharmacy-stats'); }

  // Pattern detection
  getPatternAlert(from?: string, to?: string) {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const qs = q.toString();
    return this.req<{ alert: string | null }>(`/incidents/pattern-alert${qs ? '?' + qs : ''}`);
  }
  checkHotspot(drug: string, errorType: string) {
    const q = new URLSearchParams({ drug, errorType }).toString();
    return this.req<{ isHotspot: boolean; count: number; days: number }>(`/incidents/hotspot-check?${q}`);
  }
  getTrend(weeks: number) {
    return this.req<{ weeks: { weekStart: string; count: number }[] }>(`/incidents/stats/trend?weeks=${weeks}`);
  }
  getPeriodComparison(from: string, to: string) {
    const q = new URLSearchParams({ from, to }).toString();
    return this.req<PeriodComparisonData>(`/incidents/stats/period-comparison?${q}`);
  }
  getFactorAnalysis(from: string, to: string) {
    const q = new URLSearchParams({ from, to }).toString();
    return this.req<FactorAnalysisData>(`/incidents/stats/factor-analysis?${q}`);
  }
  getHeatmap(from: string, to: string) {
    const q = new URLSearchParams({ from, to }).toString();
    return this.req<HeatmapData>(`/incidents/stats/heatmap?${q}`);
  }
  getActiveHotspots(from?: string, to?: string) {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const qs = q.toString();
    return this.req<{ hotspots: { drug: string; errorType: string; count: number; lastSeen: string | null; latestAction: { note: string; created_at: string } | null; actionCount: number }[] }>(`/incidents/stats/active-hotspots${qs ? '?' + qs : ''}`);
  }

  // Pattern interventions (shared log per drug+error pair)
  listInterventions(drug: string, errorType: string) {
    const q = new URLSearchParams({ drug, errorType }).toString();
    return this.req<{ interventions: { id: string; drug_label: string; error_type: string; note: string; created_at: string }[] }>(`/interventions?${q}`);
  }
  addIntervention(drug: string, errorType: string, note: string) {
    return this.req<{ id: string; note: string; created_at: string }>('/interventions', {
      method: 'POST', body: JSON.stringify({ drug, errorType, note }),
    });
  }
  suggestIntervention(drug: string, errorType: string) {
    return this.req<{ suggestion: string }>('/interventions/suggest', {
      method: 'POST', body: JSON.stringify({ drug, errorType }),
    });
  }

  // Custom chips — pharmacy-wide additions to the four record-form
  // sections. Saved server-side so they're the same across every staff
  // member's device. Capped at 8 per section by the server.
  listCustomOptions() {
    return this.req<{ stage: { id: string; label: string }[]; error_type: { id: string; label: string }[]; where_caught: { id: string; label: string }[]; factor: { id: string; label: string }[] }>('/custom-options');
  }
  addCustomOption(section: 'stage' | 'error_type' | 'where_caught' | 'factor', label: string) {
    return this.req<{ id: string; section: string; label: string }>('/custom-options', {
      method: 'POST',
      body: JSON.stringify({ section, label }),
    });
  }
  deleteCustomOption(id: string) {
    return this.req<{ ok: true }>(`/custom-options/${id}`, { method: 'DELETE' });
  }
  checkCustomOption(section: 'stage' | 'error_type' | 'where_caught' | 'factor', label: string) {
    return this.req<{ ok: boolean; reason?: string }>('/custom-options/check', {
      method: 'POST',
      body: JSON.stringify({ section, label }),
    });
  }

  // Marketing — public, no auth.
  trialSignup(email: string, pharmacyName?: string, notes?: string) {
    return this.req<{ ok: boolean }>('/marketing/trial-signup', {
      method: 'POST',
      body: JSON.stringify({ email, pharmacyName, notes }),
    });
  }
}

export const api = new Api();
