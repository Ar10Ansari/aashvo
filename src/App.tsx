import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/layout/Navbar';
import { Hero } from './components/hero/Hero';
import { TrustFeatures } from './components/features/TrustFeatures';
import { DiscoverySection } from './components/discovery/DiscoverySection';
import { OurFounders } from './components/about/OurFounders';
import { Footer } from './components/layout/Footer';
import { PropertyDetailModal } from './components/property/PropertyDetailModal';
import { FlatmateDetailModal } from './components/flatmate/FlatmateDetailModal';
import { ListPropertyModal } from './components/listing/ListPropertyModal';
import { AdminModerationModal } from './components/admin/AdminModerationModal';
import { AuthModal } from './components/auth/AuthModal';
import { HelpCenterModal } from './components/help/HelpCenterModal';
import { ReportModal } from './components/help/ReportModal';
import { RentalTrustModal } from './components/rental/RentalTrustModal';
import { ConnectModal } from './components/connect/ConnectModal';
import { RentSplitCalculatorModal } from './components/calculator/RentSplitCalculatorModal';
import { SavedListingsModal } from './components/saved/SavedListingsModal';
import { MyActivityModal } from './components/activity/MyActivityModal';
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
    isHelpOpen,
    setIsHelpOpen,
    isRentalTrustOpen,
    setIsRentalTrustOpen,
    isConnectOpen,
    setIsConnectOpen,
    connectInitialTab,
    isMyActivityOpen,
    setIsMyActivityOpen,
    myActivityInitialTab,
    isCalculatorOpen,
    setIsCalculatorOpen,
    isSavedOpen,
    setIsSavedOpen,
    reportingTarget,
    setReportingTarget,
    currentUser,
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

        {/* 8. Our Founders Section */}
        <OurFounders />
      </main>

      {/* 9. Property-provider CTA banner and complete useful footer */}
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

      {isHelpOpen && (
        <HelpCenterModal
          onClose={() => setIsHelpOpen(false)}
        />
      )}

      {reportingTarget && (
        <ReportModal
          target={reportingTarget}
          onClose={() => setReportingTarget(null)}
        />
      )}

      {isRentalTrustOpen && (
        <RentalTrustModal
          isOpen={isRentalTrustOpen}
          onClose={() => setIsRentalTrustOpen(false)}
          currentUser={currentUser}
        />
      )}

      {isConnectOpen && (
        <ConnectModal
          isOpen={isConnectOpen}
          onClose={() => setIsConnectOpen(false)}
          initialTab={connectInitialTab}
        />
      )}

      {isMyActivityOpen && (
        <MyActivityModal
          isOpen={isMyActivityOpen}
          onClose={() => setIsMyActivityOpen(false)}
          initialTab={myActivityInitialTab}
        />
      )}

      {isCalculatorOpen && (
        <RentSplitCalculatorModal
          isOpen={isCalculatorOpen}
          onClose={() => setIsCalculatorOpen(false)}
        />
      )}

      {isSavedOpen && (
        <SavedListingsModal
          isOpen={isSavedOpen}
          onClose={() => setIsSavedOpen(false)}
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
