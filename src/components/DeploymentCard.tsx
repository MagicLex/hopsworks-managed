import React from 'react';
import { DeploymentOption } from '@/data/deployments';

interface DeploymentCardProps {
  deployment: DeploymentOption;
  isYearly: boolean;
  onDeploy: (deployment: DeploymentOption) => void;
}

export const DeploymentCard: React.FC<DeploymentCardProps> = ({ 
  deployment, 
  isYearly, 
  onDeploy 
}) => {
  const price = isYearly ? deployment.yearlyPrice : deployment.monthlyPrice;
  
  const getButtonClass = () => {
    const base = "w-full py-2.5 px-5 rounded-sm text-sm font-medium cursor-pointer transition-colors";
    
    switch (deployment.buttonStyle) {
      case 'secondary':
        return `${base} bg-gray-100 text-gray-700 hover:bg-gray-200`;
      case 'enterprise':
        return `${base} bg-gray-800 text-white hover:bg-gray-900`;
      default:
        return `${base} bg-[#1eb182] text-white hover:bg-[#1a9d6e]`;
    }
  };
  
  const getButtonText = () => {
    if (deployment.monthlyPrice === 0) return 'Deploy Free';
    if (deployment.buttonStyle === 'enterprise') return 'Enterprise';
    return 'Deploy';
  };

  return (
    <div className={`bg-white border rounded-sm flex min-h-[140px] transition-colors hover:border-gray-300 ${
      deployment.isRecommended ? 'border-[#1eb182]' : 'border-gray-200'
    }`}>
      <div className="flex-none w-[200px] p-6 border-r border-gray-100 flex flex-col justify-center">
        <div className="text-lg font-medium text-gray-900 mb-2 flex items-center">
          {deployment.name}
          {deployment.isRecommended && (
            <span className="inline-block bg-[#e8f5f0] text-[#1eb182] px-2 py-0.5 rounded-sm text-[10px] font-semibold uppercase ml-3">
              Recommended
            </span>
          )}
        </div>
        <div className="text-sm text-gray-600">
          {price === 0 ? (
            <span className="font-semibold text-gray-900">Free</span>
          ) : (
            <>
              <span className="font-semibold text-gray-900">${price}</span>
              <span>/month</span>
            </>
          )}
        </div>
      </div>
      
      <div className="flex-1 p-6 flex gap-10 items-center">
        {Object.entries(deployment.specs).map(([category, items]) => (
          <div key={category} className="flex-1">
            <div className="text-[11px] uppercase text-gray-500 tracking-wider mb-3">
              {category}
            </div>
            <div className="flex flex-col gap-2">
              {items.map((item, index) => (
                <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="text-gray-400">◦</span>
                  <span dangerouslySetInnerHTML={{ 
                    __html: item.replace(/(\d+(?:GB|TB)?|^\d+x?\s*\w+|\d+)/g, '<span class="font-mono text-gray-900">$1</span>')
                  }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      <div className="flex-none w-40 p-6 flex items-center border-l border-gray-100">
        <button 
          onClick={() => onDeploy(deployment)}
          className={getButtonClass()}
        >
          {getButtonText()}
        </button>
      </div>
    </div>
  );
};