import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '../services/apiClient';
import {
  createPropertyInBackend,
  updatePropertyInBackend,
  deletePropertyInBackend,
  fetchMyPropertiesFromBackend,
  sendInquiryToBackend,
} from '../services/marketplaceService';
import { notificationService } from '../services/notificationService';
import { inquiryService } from '../services/inquiryService';

describe('Frontend Core Marketplace Persistence Services (P0-01, P0-02, P0-03)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('P0-01: Property Creation & Lifecycle API Calls', () => {
    it('calls POST /properties with CreatePropertyDto payload and asDraft: false when published', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        id: 'prop-uuid-123',
        title: '2BHK Apartment in DLF Phase 4',
        rentAmount: 35000,
        status: 'pending_review',
        primaryPhotoUrl: 'https://example.com/photo.webp',
        photosCount: 1,
        createdAt: new Date().toISOString(),
      });

      const result = await createPropertyInBackend(
        {
          title: '2BHK Apartment in DLF Phase 4',
          locality: 'DLF Phase 4',
          city: 'Gurugram',
          rent: 35000,
          deposit: 70000,
          images: ['https://example.com/photo.webp'],
        },
        { asDraft: false }
      );

      expect(postSpy).toHaveBeenCalledTimes(1);
      const [endpoint, payload] = postSpy.mock.calls[0];
      expect(endpoint).toBe('/properties');
      expect((payload as any).asDraft).toBe(false);
      expect((payload as any).rentAmount).toBe(35000);
      expect((payload as any).photoUrls).toHaveLength(1);
      expect(result.success).toBe(true);
      expect(result.property?.id).toBe('prop-uuid-123');
      expect(result.property?.status).toBe('pending_review');
    });

    it('calls POST /properties with asDraft: true when saved as draft', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        id: 'prop-draft-456',
        title: 'Draft Villa in Sector 57',
        rentAmount: 50000,
        status: 'paused',
        createdAt: new Date().toISOString(),
      });

      const result = await createPropertyInBackend(
        {
          title: 'Draft Villa in Sector 57',
          locality: 'Sector 57',
          city: 'Gurugram',
          rent: 50000,
        },
        { asDraft: true }
      );

      expect(postSpy).toHaveBeenCalledTimes(1);
      const [, payload] = postSpy.mock.calls[0];
      expect((payload as any).asDraft).toBe(true);
      expect(result.success).toBe(true);
      expect(result.property?.status).toBe('paused');
    });

    it('calls PATCH /properties/:id and DELETE /properties/:id for owner lifecycle updates', async () => {
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
        id: 'prop-uuid-123',
        title: 'Updated 2BHK',
        status: 'active',
      });
      const deleteSpy = vi.spyOn(apiClient, 'delete').mockResolvedValueOnce(undefined);

      const updateRes = await updatePropertyInBackend('prop-uuid-123', { status: 'active' });
      expect(patchSpy).toHaveBeenCalledWith('/properties/prop-uuid-123', { status: 'active' });
      expect(updateRes.success).toBe(true);

      const deleteRes = await deletePropertyInBackend('prop-uuid-123');
      expect(deleteSpy).toHaveBeenCalledWith('/properties/prop-uuid-123');
      expect(deleteRes.success).toBe(true);
    });

    it('calls GET /properties/mine to fetch owner properties across all statuses', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce([
        { id: 'prop-1', title: 'Listing 1', status: 'pending_review' },
        { id: 'prop-2', title: 'Listing 2', status: 'paused' },
      ]);

      const res = await fetchMyPropertiesFromBackend();
      expect(getSpy).toHaveBeenCalledWith('/properties/mine');
      expect(res.success).toBe(true);
      expect(res.properties).toHaveLength(2);
    });
  });

  describe('P0-02: Property Inquiry API Calls', () => {
    it('sends inquiry to POST /inquiries with all required DTO fields', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        id: 'inq-uuid-789',
        senderId: 'user-renter-1',
        propertyId: 'prop-uuid-123',
        senderName: 'Ananya Sharma',
        senderPhone: '+919876543210',
        senderEmail: 'ananya@example.com',
        message: 'Interested in this property',
        status: 'pending',
      });

      const res = await sendInquiryToBackend({
        targetId: 'prop-uuid-123',
        targetType: 'property',
        senderName: 'Ananya Sharma',
        senderPhone: '+919876543210',
        senderEmail: 'ananya@example.com',
        moveInDate: '2026-12-01',
        message: 'Interested in this property',
      });

      expect(postSpy).toHaveBeenCalledWith('/inquiries', {
        propertyId: 'prop-uuid-123',
        targetFlatmateId: undefined,
        senderName: 'Ananya Sharma',
        senderPhone: '+919876543210',
        senderEmail: 'ananya@example.com',
        moveInDate: '2026-12-01',
        message: 'Interested in this property',
      });
      expect(res.success).toBe(true);
      expect(res.inquiry?.id).toBe('inq-uuid-789');
    });

    it('inquiryService supports getSent, getReceived and updateStatus', async () => {
      const getSpy = vi.spyOn(apiClient, 'get')
        .mockResolvedValueOnce([{ id: 'inq-1' }])
        .mockResolvedValueOnce([{ id: 'inq-2' }]);
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({ id: 'inq-2', status: 'accepted' });

      const sent = await inquiryService.getSentInquiries();
      expect(sent).toHaveLength(1);
      expect(getSpy).toHaveBeenCalledWith('/inquiries/sent');

      const received = await inquiryService.getReceivedInquiries();
      expect(received).toHaveLength(1);
      expect(getSpy).toHaveBeenCalledWith('/inquiries/received');

      const updated = await inquiryService.updateStatus('inq-2', 'accepted');
      expect(updated.status).toBe('accepted');
      expect(patchSpy).toHaveBeenCalledWith('/inquiries/inq-2/status', { status: 'accepted' });
    });
  });

  describe('P0-03: Notification Route Consistency', () => {
    it('notificationService.markAllAsRead calls POST /notifications/read-all', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        success: true,
        markedCount: 5,
      });

      const res = await notificationService.markAllAsRead();
      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith('/notifications/read-all');
      expect(res.success).toBe(true);
      expect(res.markedCount).toBe(5);
    });
  });
});
