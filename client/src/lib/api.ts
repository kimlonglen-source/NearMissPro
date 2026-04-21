const BASE = '/api';

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
    return this.req<{ token: string; role: string; pharmacyName: string; pharmacyId: string; pinEnabled: boolean }>('/auth/staff/login', { method: 'POST', body: JSON.stringify({ name, password }) });
  }
  managerAccess() {
    return this.req<{ token?: string; role?: string; requiresPin: boolean }>('/auth/manager/access', { method: 'POST' });
  }
  verifyPin(pin: string) {
    return this.req<{ token: string; role: string }>('/auth/manager/verify-pin', { method: 'POST', body: JSON.stringify({ pin }) });
  }
  founderLogin(email: string, password: string, mfaCode?: string) {
    return this.req<{ token?: string; role?: string; requiresMfa?: boolean; email?: string }>('/auth/founder/login', { method: 'POST', body: JSON.stringify({ email, password, mfaCode }) });
  }
  getMe() { return this.req<{ pharmacyId: string; pharmacyName: string; role: string }>('/auth/me'); }

  // Pharmacy management
  createPharmacy(data: { name: string; password: string; managerEmail: string; address?: string; licenceNumber?: string }) {
    return this.req<object>('/auth/pharmacies', { method: 'POST', body: JSON.stringify(data) });
  }
  listPharmacies() { return this.req<object[]>('/auth/pharmacies'); }
  updatePharmacyStatus(id: string, status: string) {
    return this.req<object>(`/auth/pharmacies/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
  }

  // PIN management
  enablePin(pin: string) { return this.req<object>('/auth/manager/pin/enable', { method: 'POST', body: JSON.stringify({ pin }) }); }
  disablePin(currentPin: string) { return this.req<object>('/auth/manager/pin/disable', { method: 'POST', body: JSON.stringify({ currentPin }) }); }
  changePin(currentPin: string, newPin: string) { return this.req<object>('/auth/manager/pin/change', { method: 'POST', body: JSON.stringify({ currentPin, newPin }) }); }
  changePassword(currentPassword: string, newPassword: string) { return this.req<object>('/auth/manager/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }); }

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
  getPatternAlert() { return this.req<{ alert: string | null }>('/incidents/pattern-alert'); }
  checkHotspot(drug: string, errorType: string) {
    const q = new URLSearchParams({ drug, errorType }).toString();
    return this.req<{ isHotspot: boolean; count: number; days: number }>(`/incidents/hotspot-check?${q}`);
  }
  getTrend(weeks: number) {
    return this.req<{ weeks: { weekStart: string; count: number }[] }>(`/incidents/stats/trend?weeks=${weeks}`);
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
}

export const api = new Api();
