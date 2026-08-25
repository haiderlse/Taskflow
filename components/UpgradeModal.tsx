import React, { useState } from 'react';
import { XIcon, CheckCircleIcon, StarIcon } from './icons';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose }) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [upgraded, setUpgraded] = useState(false);

  if (!isOpen) return null;

  const handleUpgrade = (tier: string) => {
    setUpgraded(true);
    setTimeout(() => {
      setUpgraded(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-2xl p-6 space-y-6 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900 text-lg">Workspace Plans & Upgrades</h3>
            <p className="text-xs text-gray-500">Scale your team with advanced Gantt charts, D3 dependency graphs, and enterprise SLA analytics.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {upgraded ? (
          <div className="py-12 text-center space-y-2">
            <CheckCircleIcon className="w-12 h-12 text-emerald-500 mx-auto" />
            <h4 className="font-bold text-gray-900 text-base">Plan Upgraded!</h4>
            <p className="text-xs text-gray-500">Your workspace has been successfully updated to Enterprise Edition.</p>
          </div>
        ) : (
          <>
            {/* Billing Toggle */}
            <div className="flex justify-center">
              <div className="bg-slate-100 p-1 rounded-xl flex items-center space-x-2 text-xs font-semibold">
                <button
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    billingCycle === 'monthly' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingCycle('annual')}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1 ${
                    billingCycle === 'annual' ? 'bg-white text-blue-600 shadow-xs font-bold' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <span>Annual</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full">Save 20%</span>
                </button>
              </div>
            </div>

            {/* Plan Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Professional */}
              <div className="p-5 rounded-2xl border border-gray-200 bg-slate-50 space-y-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Professional</span>
                  <div className="text-3xl font-black text-gray-900">
                    ${billingCycle === 'annual' ? '12' : '15'} <span className="text-xs font-normal text-gray-500">/ user / mo</span>
                  </div>
                  <p className="text-xs text-gray-600">Ideal for growing teams needing structured flow and timeline tracking.</p>

                  <ul className="space-y-1.5 text-xs text-gray-700 pt-2">
                    <li className="flex items-center space-x-2">
                      <span className="text-blue-600 font-bold">✓</span>
                      <span>Interactive Kanban & Gantt views</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <span className="text-blue-600 font-bold">✓</span>
                      <span>D3 Directed Dependency Graphs</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <span className="text-blue-600 font-bold">✓</span>
                      <span>Time Tracking & Workload Balancing</span>
                    </li>
                  </ul>
                </div>

                <button
                  onClick={() => handleUpgrade('Professional')}
                  className="w-full py-2 bg-white hover:bg-gray-100 border border-gray-300 text-gray-800 font-bold rounded-xl text-xs shadow-xs"
                >
                  Choose Professional
                </button>
              </div>

              {/* Enterprise */}
              <div className="p-5 rounded-2xl border-2 border-blue-600 bg-blue-50/40 space-y-4 flex flex-col justify-between relative shadow-sm">
                <span className="absolute -top-3 right-4 px-2.5 py-0.5 bg-blue-600 text-white rounded-full text-[10px] font-bold uppercase tracking-wider">
                  Recommended
                </span>

                <div className="space-y-2">
                  <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Enterprise Pro</span>
                  <div className="text-3xl font-black text-gray-900">
                    ${billingCycle === 'annual' ? '28' : '35'} <span className="text-xs font-normal text-gray-500">/ user / mo</span>
                  </div>
                  <p className="text-xs text-gray-600">For organizations needing executive portfolios, OKR governance, and CFD flow analytics.</p>

                  <ul className="space-y-1.5 text-xs text-gray-700 pt-2">
                    <li className="flex items-center space-x-2">
                      <span className="text-blue-600 font-bold">✓</span>
                      <span>Everything in Professional</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <span className="text-blue-600 font-bold">✓</span>
                      <span>Cumulative Flow Diagrams & SLA Percentiles</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <span className="text-blue-600 font-bold">✓</span>
                      <span>Strategic Portfolios & Company OKRs</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <span className="text-blue-600 font-bold">✓</span>
                      <span>Dedicated Manager Approvals Workflow</span>
                    </li>
                  </ul>
                </div>

                <button
                  onClick={() => handleUpgrade('Enterprise')}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-sm"
                >
                  Upgrade to Enterprise
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default UpgradeModal;
