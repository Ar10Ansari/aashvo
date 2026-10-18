import React, { createContext, useContext, useState, useEffect } from 'react';
import { Property, Flatmate, PropertyFilterState, User, ListingReport, ConnectRequest, ListingStatus } from '../types';
import { SEED_PROPERTIES, SEED_FLATMATES } from '../data/seedData';

interface AppContextType {
  properties: Property[];
  flatmates: Flatmate[];
  filters: PropertyFilterState;
  setFilters: React.Dispatch<React.SetStateAction<PropertyFilterState>>;
  resetFilters: () => void;
  activeTab: 'places' | 'flatmates';
  setActiveTab: (tab: 'places' | 'flatmates') => void;
  selectedProperty: Property | null;
  setSelectedProperty: (prop: Property | null) => void;
  selectedFlatmate: Flatmate | null;
  setSelectedFlatmate: (flatmate: Flatmate | null) => void;
  isListPropertyOpen: boolean;
  setIsListPropertyOpen: (open: boolean) => void;
  isAdminOpen: boolean;
  setIsAdminOpen: (open: boolean) => void;
  isAuthOpen: boolean;
  setIsAuthOpen: (open: boolean) => void;
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  loginAs: (role: 'renter' | 'owner' | 'broker' | 'admin', name?: string) => void;
  logout: () => void;
  reports: ListingReport[];
  submitReport: (listingId: string, listingTitle: string, reason: string, notes: string) => void;
  updatePropertyStatus: (id: string, status: ListingStatus) => void;
  addProperty: (property: Omit<Property, 'id' | 'status' | 'lastVerifiedDate'>) => void;
  connectRequests: ConnectRequest[];
  submitConnectRequest: (req: Omit<ConnectRequest, 'id' | 'createdAt'>) => void;
  toast: string | null;
  showToast: (msg: string) => void;
}

const defaultFilters: PropertyFilterState = {
  searchQuery: '',
  locality: 'All Localities',
  city: 'All Cities',
  roomType: 'all',
  maxBudget: 60000,
  furnishing: 'all',
  providerType: 'all',
  genderPreference: 'all',
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load saved state or default
  const [properties, setProperties] = useState<Property[]>(() => {
    const saved = localStorage.getItem('aashvo_properties');
    return saved ? JSON.parse(saved) : SEED_PROPERTIES;
  });

  const [flatmates] = useState<Flatmate[]>(() => {
    const saved = localStorage.getItem('aashvo_flatmates');
    return saved ? JSON.parse(saved) : SEED_FLATMATES;
  });

  const [reports, setReports] = useState<ListingReport[]>(() => {
    const saved = localStorage.getItem('aashvo_reports');
    return saved ? JSON.parse(saved) : [
      {
        id: 'rep-1',
        listingId: 'prop-4',
        listingTitle: 'Studio Room with Attached Pantry in Saket',
        reason: 'Price clarification requested',
        notes: 'User inquired whether electricity rate includes AC power backup.',
        createdAt: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
        status: 'pending',
      }
    ];
  });

  const [connectRequests, setConnectRequests] = useState<ConnectRequest[]>([]);
  const [filters, setFilters] = useState<PropertyFilterState>(defaultFilters);
  const [activeTab, setActiveTab] = useState<'places' | 'flatmates'>('places');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedFlatmate, setSelectedFlatmate] = useState<Flatmate | null>(null);
  const [isListPropertyOpen, setIsListPropertyOpen] = useState<boolean>(false);
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  // Authenticated user simulation (starts logged in as Rohan, a young professional renter)
  const [currentUser, setCurrentUser] = useState<User | null>({
    id: 'usr-101',
    name: 'Rohan Varma',
    email: 'rohan.v@delhitech.in',
    role: 'renter',
    phone: '+91 98112 34567',
  });

  // Sync properties to localStorage
  useEffect(() => {
    localStorage.setItem('aashvo_properties', JSON.stringify(properties));
  }, [properties]);

  useEffect(() => {
    localStorage.setItem('aashvo_reports', JSON.stringify(reports));
  }, [reports]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
    showToast('Filters reset to default');
  };

  const loginAs = (role: 'renter' | 'owner' | 'broker' | 'admin', name?: string) => {
    const userMap: Record<string, User> = {
      renter: {
        id: 'usr-101',
        name: name || 'Rohan Varma',
        email: 'rohan.v@delhitech.in',
        role: 'renter',
        phone: '+91 98112 34567',
      },
      owner: {
        id: 'usr-202',
        name: name || 'Anil Mehra (DLF Owner)',
        email: 'anil.mehra@delhihomes.org',
        role: 'owner',
        phone: '+91 98101 22334',
      },
      broker: {
        id: 'usr-303',
        name: name || 'Rajesh Kumar (Verified Manager)',
        email: 'rajesh@urbanstay.in',
        role: 'broker',
        phone: '+91 97112 99887',
      },
      admin: {
        id: 'usr-001',
        name: 'Aashvo Trust & Safety Team',
        email: 'moderation@aashvo.com',
        role: 'admin',
      },
    };

    setCurrentUser(userMap[role]);
    setIsAuthOpen(false);
    showToast(`Signed in as ${userMap[role].name} (${role.toUpperCase()})`);
  };

  const logout = () => {
    setCurrentUser(null);
    showToast('Signed out successfully');
  };

  const submitReport = (listingId: string, listingTitle: string, reason: string, notes: string) => {
    const newReport: ListingReport = {
      id: `rep-${Date.now()}`,
      listingId,
      listingTitle,
      reason,
      notes,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };
    setReports(prev => [newReport, ...prev]);
    showToast('Report submitted for editorial review. Thank you for keeping Aashvo safe.');
  };

  const updatePropertyStatus = (id: string, status: ListingStatus) => {
    setProperties(prev =>
      prev.map(p => (p.id === id ? { ...p, status, lastVerifiedDate: new Date().toISOString() } : p))
    );
    showToast(`Listing status updated to ${status.toUpperCase()}`);
  };

  const addProperty = (newPropData: Omit<Property, 'id' | 'status' | 'lastVerifiedDate'>) => {
    const newProp: Property = {
      ...newPropData,
      id: `prop-${Date.now()}`,
      status: 'active', // Automatically active or pending
      lastVerifiedDate: new Date().toISOString(),
    };
    setProperties(prev => [newProp, ...prev]);
    setIsListPropertyOpen(false);
    showToast('🎉 Property listed successfully with transparent pricing!');
  };

  const submitConnectRequest = (reqData: Omit<ConnectRequest, 'id' | 'createdAt'>) => {
    const newReq: ConnectRequest = {
      ...reqData,
      id: `req-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setConnectRequests(prev => [newReq, ...prev]);
    showToast('Direct inquiry sent! The provider has been notified via WhatsApp & Email.');
  };

  return (
    <AppContext.Provider
      value={{
        properties,
        flatmates,
        filters,
        setFilters,
        resetFilters,
        activeTab,
        setActiveTab,
        selectedProperty,
        setSelectedProperty,
        selectedFlatmate,
        setSelectedFlatmate,
        isListPropertyOpen,
        setIsListPropertyOpen,
        isAdminOpen,
        setIsAdminOpen,
        isAuthOpen,
        setIsAuthOpen,
        currentUser,
        setCurrentUser,
        loginAs,
        logout,
        reports,
        submitReport,
        updatePropertyStatus,
        addProperty,
        connectRequests,
        submitConnectRequest,
        toast,
        showToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
