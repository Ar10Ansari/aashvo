import React, { Suspense, lazy } from 'react';
import { Loader2, AlertCircle, X } from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/layout/Navbar';
import { Hero } from './components/hero/Hero';
import { TrustFeatures } from './components/features/TrustFeatures';
import { DiscoverySection } from './components/discovery/DiscoverySection';
import { OurFounders } from './components/about/OurFounders';
import { Footer } from './components/layout/Footer';
import { Toast } from './components/ui/Toast';

// Route-level code splitting & dynamic imports for heavy interactive modals
const PropertyDetailModal = lazy(() =>
  import('./components/property/PropertyDetailModal').then(m => ({ default: m.PropertyDetailModal }))
);
const FlatmateDetailModal = lazy(() =>
  import('./components/flatmate/FlatmateDetailModal').then(m => ({ default: m.FlatmateDetailModal }))
);
const ListPropertyModal = lazy(() =>
  import('./components/listing/ListPropertyModal').then(m => ({ default: m.ListPropertyModal }))
);
const AdminModerationModal = lazy(() =>
  import('./components/admin/AdminModerationModal').then(m => ({ default: m.AdminModerationModal }))
);
const AuthModal = lazy(() =>
  import('./components/auth/AuthModal').then(m => ({ default: m.AuthModal }))
);
const HelpCenterModal = lazy(() =>
  import('./components/help/HelpCenterModal').then(m => ({ default: m.HelpCenterModal }))
);
const ReportModal = lazy(() =>
  import('./components/help/ReportModal').then(m => ({ default: m.ReportModal }))
);
const RentalTrustModal = lazy(() =>
  import('./components/rental/RentalTrustModal').then(m => ({ default: m.RentalTrustModal }))
);
const ConnectModal = lazy(() =>
  import('./components/connect/ConnectModal').then(m => ({ default: m.ConnectModal }))
);
const RentSplitCalculatorModal = lazy(() =>
  import('./components/calculator/RentSplitCalculatorModal').then(m => ({ default: m.RentSplitCalculatorModal }))
);
const SavedListingsModal = lazy(() =>
  import('./components/saved/SavedListingsModal').then(m => ({ default: m.SavedListingsModal }))
);
const MyActivityModal = lazy(() =>
  import('./components/activity/MyActivityModal').then(m => ({ default: m.MyActivityModal }))
);
const OnboardingModal = lazy(() =>
  import('./components/onboarding/OnboardingModal').then(m => ({ default: m.OnboardingModal }))
);
const MyProfileModal = lazy(() =>
  import('./components/profile/MyProfileModal').then(m => ({ default: m.MyProfileModal }))
);

interface ModalFallbackProps {
  onClose?: () => void;
}

const ModalLoadingFallback: React.FC<ModalFallbackProps> = ({ onClose }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
    role="dialog"
    aria-modal="true"
    aria-label="Loading modal"
    aria-busy="true"
  >
    <div className="relative flex flex-col items-center justify-center p-6 bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-xs w-full text-center">
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
          aria-label="Close loading dialog"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
      <p className="text-sm font-medium text-slate-700">Loading dialog...</p>
      <span className="sr-only">Please wait while the dialog content is loaded</span>
    </div>
  </div>
);

interface ModalErrorBoundaryProps {
  children: React.ReactNode;
  onClose?: () => void;
}

interface ModalErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ModalErrorBoundary extends React.Component<ModalErrorBoundaryProps, ModalErrorBoundaryState> {
  constructor(props: ModalErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ModalErrorBoundaryState {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="modal-error-title"
          aria-describedby="modal-error-desc"
        >
          <div className="relative p-6 bg-white rounded-2xl shadow-2xl border border-rose-100 max-w-sm w-full text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 id="modal-error-title" className="text-base font-semibold text-slate-900 mb-1">
              Unable to load dialog
            </h3>
            <p id="modal-error-desc" className="text-xs text-slate-500 mb-5">
              A network issue interrupted loading this window. Please check your connection and try again.
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={this.handleRetry}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                Try Again
              </button>
              {this.props.onClose && (
                <button
                  onClick={() => {
                    this.setState({ hasError: false, error: null });
                    this.props.onClose!();
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
    isMyProfileOpen,
    setIsMyProfileOpen,
    openOnboardingModal,
    isOnboardingOpen,
    setIsOnboardingOpen,
    onboardingInitialStep,
    isCalculatorOpen,
    setIsCalculatorOpen,
    isSavedOpen,
    setIsSavedOpen,
    reportingTarget,
    setReportingTarget,
    currentUser,
  } = useApp();

  const closeAllModals = () => {
    setSelectedProperty(null);
    setSelectedFlatmate(null);
    setIsListPropertyOpen(false);
    setIsAdminOpen(false);
    setIsAuthOpen(false);
    setIsHelpOpen(false);
    setReportingTarget(null);
    setIsRentalTrustOpen(false);
    setIsConnectOpen(false);
    setIsMyActivityOpen(false);
    setIsMyProfileOpen(false);
    setIsOnboardingOpen(false);
    setIsCalculatorOpen(false);
    setIsSavedOpen(false);
  };

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

      {/* Interactive Modals (Code-Split, Lazy-Loaded, with Accessible Fallback & Error Recovery) */}
      <ModalErrorBoundary onClose={closeAllModals}>
        <Suspense fallback={<ModalLoadingFallback onClose={closeAllModals} />}>
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

        {isMyProfileOpen && (
          <MyProfileModal
            isOpen={isMyProfileOpen}
            onClose={() => setIsMyProfileOpen(false)}
            onOpenOnboarding={(step) => openOnboardingModal(step)}
          />
        )}

        {isOnboardingOpen && (
          <OnboardingModal
            isOpen={isOnboardingOpen}
            onClose={() => setIsOnboardingOpen(false)}
            initialStep={onboardingInitialStep}
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
        </Suspense>
      </ModalErrorBoundary>

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
