import { apiClient } from './apiClient';
import type {
  CreateVisitInput,
  PropertyVisitItem,
  RescheduleVisitInput,
  UpdateVisitStatusInput,
} from '@aashvo/contracts';

class VisitService {
  /**
   * Submits a viewing request for a property.
   */
  async scheduleVisit(input: CreateVisitInput): Promise<PropertyVisitItem> {
    return apiClient.post<PropertyVisitItem>('/visits', input);
  }

  /**
   * Fetches visits for the authenticated user, optionally scoped to visitor or host role.
   */
  async getMyVisits(role?: 'visitor' | 'host'): Promise<PropertyVisitItem[]> {
    const query = role ? `?role=${encodeURIComponent(role)}` : '';
    return apiClient.get<PropertyVisitItem[]>(`/visits${query}`);
  }

  /**
   * Host updates visit status (confirm, complete, cancel, reject).
   */
  async updateStatus(
    visitId: string,
    action: 'confirm' | 'reject' | 'cancel' | 'complete',
    hostNotes?: string,
  ): Promise<PropertyVisitItem> {
    const payload: UpdateVisitStatusInput = { action, hostNotes };
    return apiClient.patch<PropertyVisitItem>(`/visits/${encodeURIComponent(visitId)}/status`, payload);
  }

  /**
   * Proposes a new date and time for an existing visit.
   */
  async rescheduleVisit(
    visitId: string,
    rescheduledAt: string,
    reason?: string,
  ): Promise<PropertyVisitItem> {
    const payload: RescheduleVisitInput = { rescheduledAt, reason };
    return apiClient.patch<PropertyVisitItem>(`/visits/${encodeURIComponent(visitId)}/reschedule`, payload);
  }
}

export const visitService = new VisitService();
