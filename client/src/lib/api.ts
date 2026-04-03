const API_BASE = '/api';

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('nmp_token', token);
    } else {
      localStorage.removeItem('nmp_token');
    }
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('nmp_token');
    }
    return this.token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (res.status === 401) {
      this.setToken(null);
      localStorage.removeItem('nmp_role');
      localStorage.removeItem('nmp_pharmacy');
      window.location.href = '/login';
      throw new Error('Session expired');
    }

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data as T;
  }

  staffLogin(pharmacyCode: string) {
    return this.request<{ token: string; role: string; pharmacyName: string }>(
      '/auth/staff/login',
      { method: 'POST', body: JSON.stringify({ pharmacyCode }) }
    );
  }

  managerLogin(pharmacyCode: string, pin: string) {
    return this.request<{ token: string; role: string; pharmacyName: string }>(
      '/auth/manager/login',
      { method: 'POST', body: JSON.stringify({ pharmacyCode, pin }) }
    );
  }

  founderLogin(email: string, password: string, mfaCode?: string) {
    return this.request<{ token: string; role: string; user?: object; requiresMfa?: boolean }>(
      '/auth/founder/login',
      { method: 'POST', body: JSON.stringify({ email, password, mfaCode }) }
    );
  }

  getMe() {
    return this.request<{ auth: object }>('/auth/me');
  }

  createIncident(data: object) {
    return this.request<object>('/incidents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  getIncidents(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<{ incidents: object[]; pagination: object }>(`/incidents${query}`);
  }

  getIncident(id: string) {
    return this.request<object>(`/incidents/${id}`);
  }

  updateIncidentStatus(id: string, status: string) {
    return this.request<object>(`/incidents/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  getOptions() {
    return this.request<Record<string, Record<string, object[]>>>('/options');
  }
}

export const api = new ApiClient();
