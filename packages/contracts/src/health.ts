export interface LivenessResponse {
  status: 'ok';
  service: string;
  version: string;
  environment: string;
  uptimeSeconds: number;
  timestamp: string;
}

export interface DependencyCheckResult {
  status: 'up' | 'down';
  latencyMs?: number;
  error?: string;
}

export interface ReadinessResponse {
  status: 'ready' | 'degraded';
  service: string;
  version: string;
  timestamp: string;
  checks: {
    database: DependencyCheckResult;
  };
}

