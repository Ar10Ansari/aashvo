import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/layout/Navbar';
import { Hero } from './components/hero/Hero';
import { TrustFeatures } from './components/features/TrustFeatures';
import { DiscoverySection } from './components/discovery/DiscoverySection';
import { Footer } from './components/layout/Footer';
import { PropertyDetailModal } from './components/property/PropertyDetailModal';
import { FlatmateDetailModal } from './components/flatmate/FlatmateDetailModal';
import { ListPropertyModal } from './components/listing/ListPropertyModal';
import { AdminModerationModal } from './components/admin/AdminModerationModal';
import { AuthModal } from './components/auth/AuthModal';
import { Toast } from './components/ui/Toast';

const MainLayout: React.FC = () => {
  const {
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
  } = useApp();

  return (
    <div className="min-h-screen bg-[#F5F3ED] text-[#292D2A] flex flex-col font-sans selection:bg-sand-300 selection:text-forest-900">
      {/* 1. Header with Aashvo wordmark, Find a place, Find a flatmate, List a property, Sign in, and Get started */}
      <Navbar />

      {/* Main Content Area */}
      <main className="flex-1">
        {/* 2, 3, 4. Centered hero headline, supporting copy, functional search controls, and anchored architectural landscape */}
        <Hero />

        {/* 5. Transparent-cost and listing-freshness section */}
        <TrustFeatures />

        {/* 6, 7. Property discovery section & Flatmate discovery section */}
        <DiscoverySection />
      </main>

      {/* 8, 9. Property-provider CTA banner and complete useful footer */}
      <Footer />

      {/* Interactive Modals */}
      {selectedProperty && (
        <PropertyDetailModal
          property={selectedProperty}
          onClose={() => setSelectedProperty(null)}
        />
      )}

      {selectedFlatmate && (
        <FlatmateDetailModal
          flatmate={selectedFlatmate}
          onClose={() => setSelectedFlatmate(null)}
        />
      )}

      {isListPropertyOpen && (
        <ListPropertyModal
          onClose={() => setIsListPropertyOpen(false)}
        />
      )}

      {isAdminOpen && (
        <AdminModerationModal
          onClose={() => setIsAdminOpen(false)}
        />
      )}

      {isAuthOpen && (
        <AuthModal
          onClose={() => setIsAuthOpen(false)}
        />
      )}

      {/* Global Status Toast */}
      <Toast />
    </div>
  );
};

export function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}

export default App;
