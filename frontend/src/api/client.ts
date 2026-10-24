import {
  User, Product, Batch, BatchDecision, Inspection,
  DashboardMetrics, CopilotResponse, PrioritizedInspection,
  BenchmarkMetrics, EvalSample, ConfirmedDefect, CorrectiveAction, ReinspectionComparisonData
} from '../types';
import { apiUrl, API_BASE_URL, BACKEND_URL, resolveImageUrl } from '../config/api';

export { apiUrl, API_BASE_URL, BACKEND_URL, resolveImageUrl };

class ApiClient {
  private token: string | null = null;
  private currentUser: User | null = null;

  constructor() {
    this.token = localStorage.getItem('forgesight_token');
    const userStr = localStorage.getItem('forgesight_user');
    if (userStr) {
      try {
        this.currentUser = JSON.parse(userStr);
      } catch (e) {
        this.currentUser = null;
      }
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  public setAuth(token: string, user: User) {
    this.token = token;
    this.currentUser = user;
    localStorage.setItem('forgesight_token', token);
    localStorage.setItem('forgesight_user', JSON.stringify(user));
  }

  public clearAuth() {
    this.token = null;
    this.currentUser = null;
    localStorage.removeItem('forgesight_token');
    localStorage.removeItem('forgesight_user');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const url = apiUrl(endpoint);
    let res: Response;
    try {
      res = await fetch(url, {
        ...options,
        headers
      });
    } catch (networkErr: any) {
      const err: any = new Error(
        `Unable to connect to the inspection backend (${url}). Check your network connection or verify that VITE_API_URL is configured.`
      );
      err.status = 0;
      err.isNetworkError = true;
      throw err;
    }

    if (!res.ok) {
      let errorMsg = `Request failed (${res.status})`;
      let errorData: any = null;
      try {
        const errorJson = await res.json();
        errorData = errorJson.detail || errorJson;
        if (typeof errorData === 'object' && errorData !== null) {
          errorMsg = errorData.message || errorData.reason || JSON.stringify(errorData);
        } else if (typeof errorJson.detail === 'string') {
          errorMsg = errorJson.detail;
        } else {
          errorMsg = errorJson.message || errorMsg;
        }
      } catch (e) {
        // Fallback
      }
      const err: any = new Error(errorMsg);
      err.status = res.status;
      err.data = errorData;
      throw err;
    }

    return res.json();
  }

  // --- Auth ---
  public async login(username: string, password: string): Promise<{ access_token: string; user: User }> {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    const url = apiUrl('/auth/login');
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });
    } catch (networkErr: any) {
      const err: any = new Error(
        `Unable to reach authentication server at ${url}. Please verify the backend service is running.`
      );
      err.status = 0;
      err.isNetworkError = true;
      throw err;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Authentication failed');
    }

    const data = await res.json();
    this.setAuth(data.access_token, data.user);
    return data;
  }

  public async getMe(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  public async getUsers(): Promise<User[]> {
    return this.request<User[]>('/auth/users');
  }

  // --- Dashboard ---
  public async getDashboardMetrics(batchId?: number, productId?: number): Promise<DashboardMetrics> {
    const params = new URLSearchParams();
    if (batchId) params.append('batch_id', batchId.toString());
    if (productId) params.append('product_id', productId.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<DashboardMetrics>(`/dashboard/metrics${query}`);
  }

  // --- Products ---
  public async getProducts(): Promise<Product[]> {
    return this.request<Product[]>('/products');
  }

  public async createProduct(data: { code: string; name: string; category?: string; description?: string }): Promise<Product> {
    return this.request<Product>('/products', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // --- Batches ---
  public async getBatches(statusFilter?: string, productId?: number): Promise<Batch[]> {
    const params = new URLSearchParams();
    if (statusFilter) params.append('status_filter', statusFilter);
    if (productId) params.append('product_id', productId.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<Batch[]>(`/batches${query}`);
  }

  public async createBatch(data: { product_id: number; batch_number: string; quantity: number }): Promise<Batch> {
    return this.request<Batch>('/batches', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  public async recordBatchDecision(batchId: number, newStatus: string, reason: string): Promise<Batch> {
    return this.request<Batch>(`/batches/${batchId}/decisions`, {
      method: 'POST',
      body: JSON.stringify({ new_status: newStatus, reason })
    });
  }

  public async getBatchDecisions(batchId: number): Promise<BatchDecision[]> {
    return this.request<BatchDecision[]>(`/batches/${batchId}/decisions`);
  }

  // --- Inspections ---
  public async getInspections(batchId?: number, statusFilter?: string, search?: string): Promise<Inspection[]> {
    const params = new URLSearchParams();
    if (batchId) params.append('batch_id', batchId.toString());
    if (statusFilter) params.append('status_filter', statusFilter);
    if (search) params.append('search', search);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<Inspection[]>(`/inspections${query}`);
  }

  public async getInspection(id: number): Promise<Inspection> {
    return this.request<Inspection>(`/inspections/${id}`);
  }

  public async createInspection(formData: FormData): Promise<Inspection> {
    return this.request<Inspection>('/inspections', {
      method: 'POST',
      body: formData
    });
  }

  public async retryInference(id: number): Promise<any> {
    return this.request<any>(`/inspections/${id}/retry-inference`, {
      method: 'POST'
    });
  }

  public async getEvalSamples(): Promise<EvalSample[]> {
    return this.request<EvalSample[]>('/inspections/eval-samples');
  }

  // --- Reviews ---
  public async submitReview(inspectionId: number, data: {
    decision: string;
    reason?: string;
    notes?: string;
    defect_category?: string;
    severity?: string;
  }): Promise<Inspection> {
    return this.request<Inspection>(`/reviews/${inspectionId}`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  public async getReinspectionComparison(inspectionId: number): Promise<ReinspectionComparisonData> {
    return this.request<ReinspectionComparisonData>(`/inspections/${inspectionId}/reinspection-comparison`);
  }

  public async submitComparisonReview(inspectionId: number, data: {
    decision: string;
    notes: string;
    close_capa?: boolean;
  }): Promise<ReinspectionComparisonData> {
    return this.request<ReinspectionComparisonData>(`/inspections/${inspectionId}/comparison-review`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // --- Defects ---
  public async getDefects(statusFilter?: string, severityFilter?: string, batchId?: number): Promise<ConfirmedDefect[]> {
    const params = new URLSearchParams();
    if (statusFilter) params.append('status_filter', statusFilter);
    if (severityFilter) params.append('severity_filter', severityFilter);
    if (batchId) params.append('batch_id', batchId.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<ConfirmedDefect[]>(`/defects${query}`);
  }

  public async updateDefect(defectId: number, data: {
    review_status?: string;
    defect_category?: string;
    severity?: string;
    description?: string;
  }): Promise<ConfirmedDefect> {
    return this.request<ConfirmedDefect>(`/defects/${defectId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  // --- Actions ---
  public async getActions(statusFilter?: string, assignedUserId?: number, overdueOnly: boolean = false): Promise<CorrectiveAction[]> {
    const params = new URLSearchParams();
    if (statusFilter) params.append('status_filter', statusFilter);
    if (assignedUserId) params.append('assigned_user_id', assignedUserId.toString());
    if (overdueOnly) params.append('overdue_only', 'true');
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<CorrectiveAction[]>(`/actions${query}`);
  }

  public async createAction(data: {
    defect_id: number;
    title: string;
    description: string;
    assigned_to_user_id: number;
    target_date: string;
  }): Promise<CorrectiveAction> {
    return this.request<CorrectiveAction>('/actions', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  public async updateAction(actionId: number, data: {
    status?: string;
    title?: string;
    description?: string;
    notes?: string;
    assigned_to_user_id?: number;
    target_date?: string;
  }): Promise<CorrectiveAction> {
    return this.request<CorrectiveAction>(`/actions/${actionId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  // --- Copilot ---
  public async queryCopilot(query: string, batchNumber?: string): Promise<CopilotResponse> {
    return this.request<CopilotResponse>('/copilot/query', {
      method: 'POST',
      body: JSON.stringify({ query, batch_number: batchNumber })
    });
  }

  public async streamCopilot(
    query: string,
    batchNumber: string | undefined,
    onStage: (stage: string, step: number, total: number) => void,
    onResult: (result: CopilotResponse) => void
  ): Promise<void> {
    const url = apiUrl('/copilot/stream');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, batch_number: batchNumber })
    });

    if (!res.ok) {
      let errText = 'Failed to process copilot query';
      try {
        const errJson = await res.json();
        errText = errJson.detail || errText;
      } catch (e) {
        errText = res.statusText || errText;
      }
      throw new Error(errText);
    }

    if (!res.body) {
      throw new Error('Response body is null');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const chunks = buffer.split('\n\n');
      buffer = chunks.pop() || '';

      for (const chunk of chunks) {
        if (!chunk.trim()) continue;
        const lines = chunk.split('\n');
        let eventType = 'message';
        let dataStr = '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventType = line.replace('event:', '').trim();
          } else if (line.startsWith('data:')) {
            dataStr = line.replace('data:', '').trim();
          }
        }

        if (eventType === 'stage' && dataStr) {
          try {
            const parsed = JSON.parse(dataStr);
            onStage(parsed.stage, parsed.step, parsed.total);
          } catch (e) {}
        } else if (eventType === 'result' && dataStr) {
          try {
            const parsed: CopilotResponse = JSON.parse(dataStr);
            onResult(parsed);
          } catch (e) {}
        }
      }
    }
  }

  // --- Prioritization Innovation ---
  public async getPrioritizationQueue(): Promise<PrioritizedInspection[]> {
    return this.request<PrioritizedInspection[]>('/prioritization/queue');
  }

  public async getPrioritizationBenchmark(): Promise<BenchmarkMetrics> {
    return this.request<BenchmarkMetrics>('/prioritization/benchmark');
  }
}

export const api = new ApiClient();
