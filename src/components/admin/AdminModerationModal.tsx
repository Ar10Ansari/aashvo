import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatINR, getFreshnessInfo } from '../../utils/formatters';
import { X, ShieldCheck, AlertTriangle } from 'lucide-react';

interface AdminModerationModalProps {
  onClose: () => void;
}

export const AdminModerationModal: React.FC<AdminModerationModalProps> = ({ onClose }) => {
  const { properties, updatePropertyStatus, reports, showToast } = useApp();
  const [activeTab, setActiveTab] = useState<'listings' | 'reports'>('listings');

  const handleApprove = (id: string) => {
    updatePropertyStatus(id, 'active');
  };

  const handlePause = (id: string) => {
    updatePropertyStatus(id, 'pending_review');
  };

  const handleMarkRented = (id: string) => {
    updatePropertyStatus(id, 'rented');
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-charcoal-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden border border-charcoal-100 max-h-[92vh] flex flex-col my-auto"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-admin-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-charcoal-100 flex items-center justify-between bg-charcoal-900 text-white">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-sand-300" />
            <h2 id="modal-admin-title" className="font-serif text-lg font-bold">
              Aashvo Safety & Editorial Moderation Console
            </h2>
            <span className="text-[11px] bg-forest-700 text-sand-200 px-2.5 py-0.5 rounded-full font-semibold">
              Live Governance
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-charcoal-400 hover:text-white rounded-full hover:bg-charcoal-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="bg-ivory-100 px-6 py-2 border-b border-charcoal-200/50 flex space-x-3 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('listings')}
            className={`py-2 px-3 rounded-lg transition-colors ${
              activeTab === 'listings' ? 'bg-white text-forest-800 shadow-sm' : 'text-charcoal-500 hover:text-charcoal-800'
            }`}
          >
            All Inventory ({properties.length})
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`py-2 px-3 rounded-lg transition-colors flex items-center space-x-1.5 ${
              activeTab === 'reports' ? 'bg-white text-red-700 shadow-sm' : 'text-charcoal-500 hover:text-charcoal-800'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Community Reports ({reports.length})</span>
          </button>
        </div>

        {/* Scrollable Moderation Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'listings' ? (
            <div className="space-y-3">
              {properties.map(p => {
                const fresh = getFreshnessInfo(p.lastVerifiedDate);
                return (
                  <div
                    key={p.id}
                    className="p-4 rounded-2xl border border-charcoal-200/80 bg-white hover:border-forest-400 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center space-x-3.5">
                      <img src={p.images[0]} alt="" className="w-14 h-14 rounded-xl object-cover bg-ivory-300" />
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-serif font-bold text-sm text-charcoal-900">{p.title}</h4>
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              p.status === 'active'
                                ? 'bg-emerald-100 text-emerald-800'
                                : p.status === 'rented'
                                ? 'bg-charcoal-100 text-charcoal-600'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {p.status}
                          </span>
                        </div>
                        <p className="text-xs text-charcoal-500 mt-0.5">
                          {p.locality} • Rent: {formatINR(p.rent)} • Deposit: {formatINR(p.deposit)} • Provider: {p.providerName} ({p.providerType})
                        </p>
                        <span className="text-[10px] text-charcoal-400 mt-0.5 block">
                          Last Freshness Check: {fresh.label}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 self-end sm:self-center">
                      {p.status !== 'active' && (
                        <button
                          onClick={() => handleApprove(p.id)}
                          className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-colors"
                        >
                          Approve / Active
                        </button>
                      )}

                      {p.status === 'active' && (
                        <button
                          onClick={() => handlePause(p.id)}
                          className="px-3 py-1.5 bg-amber-100 text-amber-800 rounded-xl text-xs font-semibold hover:bg-amber-200 transition-colors"
                        >
                          Pause for Review
                        </button>
                      )}

                      {p.status !== 'rented' && (
                        <button
                          onClick={() => handleMarkRented(p.id)}
                          className="px-3 py-1.5 bg-charcoal-100 text-charcoal-700 rounded-xl text-xs font-semibold hover:bg-charcoal-200 transition-colors"
                        >
                          Mark Rented
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {reports.length === 0 ? (
                <div className="p-8 text-center text-charcoal-400 text-xs">
                  Zero pending reports. Moderation queue is pristine.
                </div>
              ) : (
                reports.map(rep => (
                  <div
                    key={rep.id}
                    className="p-4 rounded-2xl border border-red-200 bg-red-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-xs text-red-800">{rep.reason}</span>
                        <span className="text-[10px] bg-red-200 text-red-900 px-2 py-0.5 rounded-full font-semibold">
                          {rep.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-charcoal-700 mt-1 font-medium">Listing: {rep.listingTitle}</p>
                      {rep.notes && <p className="text-xs text-charcoal-500 mt-0.5 italic">&quot;{rep.notes}&quot;</p>}
                      <span className="text-[10px] text-charcoal-400 mt-1 block">
                        Reported: {new Date(rep.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <button
                      onClick={() => showToast('Report marked as reviewed by editorial team.')}
                      className="px-3 py-1.5 bg-white border border-red-300 text-red-700 rounded-xl text-xs font-semibold hover:bg-red-100 transition-colors"
                    >
                      Dismiss / Resolve
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
