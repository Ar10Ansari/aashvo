import React from 'react';
import { useApp } from '../../context/AppContext';
import { X, User, Home, Briefcase, ShieldCheck } from 'lucide-react';

interface AuthModalProps {
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose }) => {
  const { loginAs } = useApp();

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-charcoal-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-charcoal-100 my-auto"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-auth-title"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-charcoal-100 flex items-center justify-between bg-ivory-100/90">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-forest-700">Aashvo Access</span>
            <h2 id="modal-auth-title" className="font-serif text-2xl font-bold text-charcoal-900">
              Sign In or Select Persona
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-charcoal-400 hover:text-charcoal-800 rounded-full hover:bg-ivory-200 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-charcoal-500">
            For local review and evaluation, you can instantly switch between verified personas or sign in with your email.
          </p>

          <div className="space-y-2.5">
            <button
              onClick={() => {
                loginAs('renter', 'Rohan Varma');
                onClose();
              }}
              className="w-full p-3.5 rounded-2xl border border-charcoal-200 hover:border-forest-600 bg-white hover:bg-forest-50/50 text-left transition-all flex items-center space-x-3 group"
            >
              <div className="w-10 h-10 rounded-xl bg-forest-100 text-forest-700 flex items-center justify-center group-hover:bg-forest-600 group-hover:text-white transition-colors">
                <User className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-serif text-sm font-bold text-charcoal-900">Rohan Varma</span>
                  <span className="text-[10px] bg-ivory-200 text-charcoal-700 px-2 py-0.5 rounded-full font-semibold">
                    RENTER
                  </span>
                </div>
                <p className="text-xs text-charcoal-500">Software Engineer looking for a place in Gurugram</p>
              </div>
            </button>

            <button
              onClick={() => {
                loginAs('owner', 'Anil Mehra (DLF Owner)');
                onClose();
              }}
              className="w-full p-3.5 rounded-2xl border border-charcoal-200 hover:border-forest-600 bg-white hover:bg-forest-50/50 text-left transition-all flex items-center space-x-3 group"
            >
              <div className="w-10 h-10 rounded-xl bg-forest-100 text-forest-700 flex items-center justify-center group-hover:bg-forest-600 group-hover:text-white transition-colors">
                <Home className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-serif text-sm font-bold text-charcoal-900">Anil Mehra</span>
                  <span className="text-[10px] bg-forest-100 text-forest-800 px-2 py-0.5 rounded-full font-semibold">
                    DIRECT OWNER
                  </span>
                </div>
                <p className="text-xs text-charcoal-500">Property Owner in DLF Phase 4 (₹0 Brokerage)</p>
              </div>
            </button>

            <button
              onClick={() => {
                loginAs('broker', 'Rajesh Kumar (Verified Manager)');
                onClose();
              }}
              className="w-full p-3.5 rounded-2xl border border-charcoal-200 hover:border-forest-600 bg-white hover:bg-forest-50/50 text-left transition-all flex items-center space-x-3 group"
            >
              <div className="w-10 h-10 rounded-xl bg-forest-100 text-forest-700 flex items-center justify-center group-hover:bg-forest-600 group-hover:text-white transition-colors">
                <Briefcase className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-serif text-sm font-bold text-charcoal-900">Rajesh Kumar</span>
                  <span className="text-[10px] bg-charcoal-100 text-charcoal-800 px-2 py-0.5 rounded-full font-semibold">
                    PROPERTY MANAGER
                  </span>
                </div>
                <p className="text-xs text-charcoal-500">Verified Manager in Saket with declared fees</p>
              </div>
            </button>

            <button
              onClick={() => {
                loginAs('admin', 'Aashvo Trust & Safety Team');
                onClose();
              }}
              className="w-full p-3.5 rounded-2xl border border-charcoal-200 hover:border-forest-600 bg-white hover:bg-forest-50/50 text-left transition-all flex items-center space-x-3 group"
            >
              <div className="w-10 h-10 rounded-xl bg-forest-100 text-forest-700 flex items-center justify-center group-hover:bg-forest-600 group-hover:text-white transition-colors">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-serif text-sm font-bold text-charcoal-900">Safety & Moderation Team</span>
                  <span className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-semibold">
                    ADMIN
                  </span>
                </div>
                <p className="text-xs text-charcoal-500">Full access to moderation queue and reports</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
