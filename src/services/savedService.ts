import { apiClient } from './apiClient';
import type { CreateSavedItemInput, SavedItemType, SavedItemView } from '@aashvo/contracts';

class SavedService {
  /**
   * Retrieves all shortlisted items for the authenticated user, optionally filtered by type.
   */
  async getSavedItems(type?: SavedItemType): Promise<SavedItemView[]> {
    const query = type ? `?type=${encodeURIComponent(type)}` : '';
    return apiClient.get<SavedItemView[]>(`/saved${query}`);
  }

  /**
   * Saves/shortlists an item (property, flatmate, connect candidate, family stay).
   */
  async saveItem(itemType: SavedItemType, targetId: string, notes?: string): Promise<SavedItemView> {
    const payload: CreateSavedItemInput = { itemType, targetId, notes };
    return apiClient.post<SavedItemView>('/saved', payload);
  }

  /**
   * Removes an item from the user's shortlisted items.
   */
  async unsaveItem(itemType: SavedItemType, targetId: string): Promise<{ success: boolean }> {
    return apiClient.delete<{ success: boolean }>(`/saved/${encodeURIComponent(itemType)}/${encodeURIComponent(targetId)}`);
  }

  /**
   * Checks whether a specific target item is already shortlisted by the user.
   */
  async checkSaved(itemType: SavedItemType, targetId: string): Promise<{ isSaved: boolean; id?: string }> {
    return apiClient.get<{ isSaved: boolean; id?: string }>(
      `/saved/check/${encodeURIComponent(itemType)}/${encodeURIComponent(targetId)}`,
    );
  }
}

export const savedService = new SavedService();
