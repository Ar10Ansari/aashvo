import React, { useState, useEffect } from 'react';
import {
  X,
  Bookmark,
  Trash2,
  MapPin,
} from 'lucide-react';
import { savedService } from '../../services/savedService';
import type { SavedItemType, SavedItemView } from '@aashvo/contracts';
import { useApp } from '../../context/AppContext';

interface SavedListingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProperty?: (propertyId: string) => void;
  onSelectFlatmate?: (flatmateId: string) => void;
}

export const SavedListingsModal: React.FC<SavedListingsModalProps> = ({
  isOpen,
  onClose,
  onSelectProperty,
  onSelectFlatmate,
}) => {
  const { currentUser, properties, flatmates, setSelectedProperty, setSelectedFlatmate } = useApp();
  const [activeTab, setActiveTab] = useState<string>('all');
  const [savedItems, setSavedItems] = useState<SavedItemView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSaved = async () => {
    if (!currentUser) return;
    setLoading(true);
    setError(null);
    try {
      const type = activeTab === 'all' ? undefined : (activeTab as SavedItemType);
      const items = await savedService.getSavedItems(type);
      setSavedItems(items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load saved items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSaved();
    }
  }, [isOpen, activeTab, currentUser]);

  if (!isOpen) return null;

  const handleUnsave = async (item: SavedItemView, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await savedService.unsaveItem(item.itemType, item.targetId);
      setSavedItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch {
      // Optimistic removal
      setSavedItems((prev) => prev.filter((i) => i.id !== item.id));
    }
  };

  const handleItemClick = (item: SavedItemView) => {
    onClose();
    if (item.itemType === 'property' || item.itemType === 'family_stay') {
      const found = properties.find((p) => p.id === item.targetId);
      if (found) {
        setSelectedProperty(found);
      } else if (onSelectProperty) {
        onSelectProperty(item.targetId);
      }
    } else if (item.itemType === 'flatmate_profile' || item.itemType === 'connect_profile') {
      const found = flatmates.find((f) => f.id === item.targetId);
      if (found) {
        setSelectedFlatmate(found);
      } else if (onSelectFlatmate) {
        onSelectFlatmate(item.targetId);
      }
    }
  };

  const currency = (val?: number | null) => (val ? `₹${Math.round(val).toLocaleString('en-IN')}` : '₹—');

  const tabs = [
    { id: 'all', label: 'All Saved' },
    { id: 'property', label: 'Properties' },
    { id: 'flatmate_profile', label: 'Flatmates' },
    { id: 'family_stay', label: 'Family Stays' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="saved-modal-title"
        className="bg-[#FBF9F5] rounded-3xl max-w-3xl w-full max-h-[85vh] shadow-2xl border border-charcoal-200/80 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-5 bg-[#F5F3ED] border-b border-charcoal-200/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-forest-800 text-white flex items-center justify-center shadow-xs">
              <Bookmark className="w-5 h-5 text-sand-400" />
            </div>
            <div>
              <h2 id="saved-modal-title" className="font-serif font-bold text-xl text-forest-900">
                Saved & Shortlists
              </h2>
              <p className="text-xs text-charcoal-500">
                Quickly access verified flats, rooms, and compatible flatmate profiles
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close saved modal"
            className="p-2 rounded-full text-charcoal-400 hover:text-charcoal-700 hover:bg-charcoal-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center space-x-2 px-6 py-3 bg-white border-b border-charcoal-100 overflow-x-auto text-xs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-full font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-forest-800 text-white shadow-xs'
                  : 'bg-charcoal-50 text-charcoal-600 hover:bg-charcoal-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="py-16 text-center text-xs text-charcoal-400">Loading saved listings...</div>
          ) : error ? (
            <div className="py-12 text-center text-xs text-rose-600">{error}</div>
          ) : savedItems.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-forest-50 text-forest-700 mx-auto flex items-center justify-center">
                <Bookmark className="w-6 h-6 opacity-60" />
              </div>
              <p className="font-serif font-bold text-base text-forest-900">Your shortlist is empty</p>
              <p className="text-xs text-charcoal-500 max-w-sm mx-auto">
                Explore places or flatmates and click the bookmark button to keep track of options you love.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {savedItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className="bg-white p-4 rounded-2xl border border-charcoal-200/70 hover:border-forest-600 shadow-xs hover:shadow-md transition-all cursor-pointer relative group flex flex-col justify-between"
                >
                  <div>
                    {/* Top Row: Category Pill & Availability */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-charcoal-100 text-charcoal-700">
                        {item.itemType.replace('_', ' ')}
                      </span>
                      {item.isAvailable ? (
                        <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          Available
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-charcoal-500 bg-charcoal-100 px-2 py-0.5 rounded-full">
                          No Longer Available
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h4 className="font-serif font-bold text-sm text-forest-900 line-clamp-1 group-hover:text-forest-700 transition-colors">
                      {item.title}
                    </h4>

                    {/* Subtitle / Location */}
                    {item.subtitle && (
                      <p className="text-xs text-charcoal-500 mt-1 flex items-center space-x-1">
                        <MapPin className="w-3 h-3 text-forest-700 flex-shrink-0" />
                        <span className="truncate">{item.subtitle}</span>
                      </p>
                    )}
                  </div>

                  {/* Bottom Row: Price & Actions */}
                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-charcoal-100">
                    <div>
                      <span className="text-[10px] text-charcoal-400 font-medium">Rent / Budget</span>
                      <p className="text-xs font-bold text-forest-900">{currency(item.priceMonthly)}</p>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={(e) => handleUnsave(item, e)}
                        className="p-1.5 text-charcoal-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                        title="Remove from saved"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#F5F3ED] border-t border-charcoal-200/60 flex items-center justify-between">
          <p className="text-xs text-charcoal-500">
            {savedItems.length} {savedItems.length === 1 ? 'item' : 'items'} shortlisted
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-forest-800 hover:bg-forest-900 text-white font-semibold text-xs rounded-xl shadow-sm transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
