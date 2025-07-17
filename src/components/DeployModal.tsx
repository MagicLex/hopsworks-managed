import React from 'react';
import { X, CreditCard, Zap, Globe, Terminal } from 'lucide-react';
import { DeploymentOption } from '@/data/deployments';

interface DeployModalProps {
  isOpen: boolean;
  deployment: DeploymentOption | null;
  onClose: () => void;
}

export const DeployModal: React.FC<DeployModalProps> = ({ isOpen, deployment, onClose }) => {
  if (!isOpen || !deployment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      
      <div className="relative bg-white border border-gray-400 w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="border-b border-gray-300 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Terminal size={20} className="text-[#1eb182]" />
            <h2 className="text-lg font-mono uppercase">JOIN CLUSTER: {deployment.name}</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-gray-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <div className="space-y-6">
            <div className="border border-[#1eb182] bg-[#e8f5f0] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={16} className="text-[#1eb182]" />
                <h3 className="font-mono text-sm uppercase text-gray-900">Instant Access</h3>
              </div>
              <p className="text-sm font-mono text-gray-700">
                You&apos;ll join the shared {deployment.name} cluster immediately after payment.
                Resources are pre-allocated and ready to use.
              </p>
            </div>

            <div className="border border-gray-300 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Globe size={16} className="text-[#1eb182]" />
                <h3 className="font-mono text-sm uppercase text-gray-600">Select Zone</h3>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 border border-gray-300 hover:border-[#1eb182] cursor-pointer transition-colors">
                  <input type="radio" name="zone" value="us-east-1" defaultChecked className="accent-[#1eb182]" />
                  <div className="flex-1">
                    <div className="font-mono text-sm text-gray-900">US-EAST-1</div>
                    <div className="text-xs text-gray-600">N. Virginia • Lowest latency for Americas</div>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 border border-gray-300 hover:border-[#1eb182] cursor-pointer transition-colors">
                  <input type="radio" name="zone" value="eu-west-1" className="accent-[#1eb182]" />
                  <div className="flex-1">
                    <div className="font-mono text-sm text-gray-900">EU-WEST-1</div>
                    <div className="text-xs text-gray-600">Ireland • GDPR compliant for Europe</div>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 border border-gray-300 hover:border-[#1eb182] cursor-pointer transition-colors">
                  <input type="radio" name="zone" value="ap-southeast-1" className="accent-[#1eb182]" />
                  <div className="flex-1">
                    <div className="font-mono text-sm text-gray-900">AP-SOUTHEAST-1</div>
                    <div className="text-xs text-gray-600">Singapore • Optimized for Asia-Pacific</div>
                  </div>
                </label>
              </div>
            </div>

            <div className="border border-gray-300 p-4">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard size={16} className="text-[#1eb182]" />
                <h3 className="font-mono text-sm uppercase text-gray-600">Payment Method</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-mono uppercase text-gray-500 mb-1">Card Number</label>
                  <input 
                    type="text" 
                    className="w-full border border-gray-300 px-3 py-2 font-mono text-sm focus:border-[#1eb182] outline-none"
                    placeholder="4242 4242 4242 4242"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono uppercase text-gray-500 mb-1">Expiry</label>
                    <input 
                      type="text" 
                      className="w-full border border-gray-300 px-3 py-2 font-mono text-sm focus:border-[#1eb182] outline-none"
                      placeholder="MM/YY"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono uppercase text-gray-500 mb-1">CVC</label>
                    <input 
                      type="text" 
                      className="w-full border border-gray-300 px-3 py-2 font-mono text-sm focus:border-[#1eb182] outline-none"
                      placeholder="123"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border border-gray-300 p-4 bg-gray-50">
              <h3 className="font-mono text-sm uppercase text-gray-600 mb-3">Billing Summary</h3>
              <div className="space-y-2 text-sm font-mono">
                <div className="flex justify-between">
                  <span className="text-gray-600">{deployment.name} Cluster Access</span>
                  <span className="text-gray-900">${deployment.monthlyPrice}/mo</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-300">
                  <span className="text-gray-900 font-semibold">Total Due Now</span>
                  <span className="text-[#1eb182] font-semibold">${deployment.monthlyPrice}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex gap-3 justify-end">
            <button 
              onClick={onClose}
              className="px-6 py-2 border border-gray-400 font-mono text-sm uppercase hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button 
              className="px-6 py-2 pr-4 border border-[#1eb182] bg-[#1eb182] text-white font-mono text-sm uppercase hover:bg-[#1a9d6e] transition-colors flex items-center gap-2"
            >
              <Zap size={16} />
              Start Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};