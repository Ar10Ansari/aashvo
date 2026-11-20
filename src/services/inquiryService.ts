import { apiClient } from './apiClient';

export interface InquiryItem {
  id: string;
  senderId: string;
  propertyId: string | null;
  targetFlatmateId: string | null;
  senderName: string;
  senderPhone: string;
  senderEmail: string;
  moveInDate: string | null;
  message: string;
  status: 'pending' | 'accepted' | 'declined';
  targetType?: 'property' | 'flatmate';
  targetTitle?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInquiryInput {
  propertyId?: string;
  targetFlatmateId?: string;
  senderName: string;
  senderPhone: string;
  senderEmail: string;
  moveInDate?: string;
  message: string;
}

class InquiryService {
  /**
   * Submit an inquiry for a property or flatmate to NestJS/PostgreSQL.
   */
  async createInquiry(input: CreateInquiryInput): Promise<InquiryItem> {
    const payload = {
      propertyId: input.propertyId || undefined,
      targetFlatmateId: input.targetFlatmateId || undefined,
      senderName: input.senderName.trim(),
      senderPhone: input.senderPhone.trim(),
      senderEmail: input.senderEmail.trim().toLowerCase(),
      moveInDate: input.moveInDate?.trim() || undefined,
      message: input.message.trim(),
    };

    return apiClient.post<InquiryItem>('/inquiries', payload);
  }

  /**
   * List inquiries sent by current authenticated user.
   */
  async getSentInquiries(): Promise<InquiryItem[]> {
    return apiClient.get<InquiryItem[]>('/inquiries/sent');
  }

  /**
   * List inquiries received by current user (for properties or flatmate profile they own).
   */
  async getReceivedInquiries(): Promise<InquiryItem[]> {
    return apiClient.get<InquiryItem[]>('/inquiries/received');
  }

  /**
   * Accept or decline an inquiry (listing owner only).
   */
  async updateStatus(inquiryId: string, status: 'accepted' | 'declined'): Promise<InquiryItem> {
    return apiClient.patch<InquiryItem>(`/inquiries/${encodeURIComponent(inquiryId)}/status`, {
      status,
    });
  }
}

export const inquiryService = new InquiryService();
