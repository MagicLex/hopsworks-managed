import React from 'react';
import { DeploymentOption } from '@/data/deployments';
import { Server, HardDrive, Cpu, Cloud, Database, Activity, Zap, Shield, Terminal, MessageSquare, FileCode, Calendar, X, Globe } from 'lucide-react';

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
    if (deployment.monthlyPrice === 0) return 'Join Free';
    if (deployment.buttonStyle === 'enterprise') return 'Contact Sales';
    return 'Join Cluster';
  };

  const getIconForCategory = (category: string) => {
    switch (category.toLowerCase()) {
      case 'compute': return Cpu;
      case 'storage': return HardDrive;
      case 'capabilities': return Zap;
      default: return Server;
    }
  };

  if (deployment.id === 'serverless') {
    return (
      <div className="bg-gray-50 border border-gray-200 p-6 flex items-center justify-between">
        <div>
          <h3 className="text-base font-medium text-gray-900 mb-1">{deployment.name}</h3>
          <p className="text-sm text-gray-600 mb-2">Limited feature store access on shared infrastructure</p>
          <div className="flex gap-4 text-xs font-mono text-gray-500">
            <span className="flex items-center gap-1"><X size={10} className="text-red-400" /> No Jupyter</span>
            <span className="flex items-center gap-1"><X size={10} className="text-red-400" /> No Orchestration</span>
            <span className="flex items-center gap-1">✓ Feature Store</span>
          </div>
          <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
            <Globe size={10} />
            <span className="font-mono">US-EAST • EU-WEST • AP-SE</span>
          </div>
        </div>
        <button 
          onClick={() => onDeploy(deployment)}
          className="px-6 py-2.5 border border-gray-400 bg-white text-gray-700 hover:bg-gray-50 font-mono text-xs uppercase transition-colors flex items-center gap-1.5"
        >
          <Zap size={12} />
          Join Free
        </button>
      </div>
    );
  }

  if (deployment.buttonStyle === 'enterprise') {
    return (
      <div className="bg-gray-100 border border-gray-300 p-8 text-center">
        <h3 className="text-lg font-medium text-gray-900 mb-2">{deployment.name}</h3>
        <p className="text-sm text-gray-600 mb-4">Contact us for bespoke deployment solutions tailored to your needs</p>
        <button 
          onClick={() => onDeploy(deployment)}
          className="px-6 py-3 border border-gray-800 bg-gray-800 text-white font-mono text-sm uppercase hover:bg-gray-900 transition-colors inline-flex items-center gap-2"
        >
          <MessageSquare size={14} />
          Contact Sales
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      {deployment.isRecommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <span className="inline-block bg-[#1eb182] text-white px-4 py-1 text-[10px] font-mono font-semibold uppercase">
            RECOMMENDED
          </span>
        </div>
      )}
      <div className={`bg-white border flex flex-col transition-all hover:border-gray-400 ${
        deployment.isRecommended ? 'border-[#1eb182]' : 'border-gray-300'
      } ${
        (deployment.id === 'small' || deployment.id === 'medium') ? 'shadow-sm' : ''
      }`}>
        <div className="flex" style={{ minHeight: '120px' }}>
          <div className="flex-none w-[180px] p-5 border-r border-gray-200 flex flex-col relative">
            <div className="absolute top-2 left-2">
              <div className="w-1.5 h-1.5 bg-[#1eb182] rounded-full animate-pulse" />
            </div>
            <div className="text-base font-medium text-gray-900 mb-1">
              {deployment.name}
            </div>
            <div className="text-sm text-gray-600 mb-2">
              {price === 0 ? (
                <span className="font-mono font-semibold text-[#1eb182]">FREE</span>
              ) : (
                <>
                  <span className="font-mono font-semibold text-gray-900">${price}</span>
                  <span className="text-gray-500">/month</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-gray-500">
              <Globe size={10} />
              <span className="font-mono">3 ZONES</span>
            </div>
          </div>
      
          <div className="flex-1 p-5 flex gap-8">
            {Object.entries(deployment.specs).map(([category, items]) => {
              const Icon = getIconForCategory(category);
              return (
                <div key={category} className="flex-1">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase text-gray-600 tracking-wider mb-2 font-mono">
                    <Icon size={12} className="text-[#1eb182]" />
                    <span>{category}</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {items.map((item, index) => {
                      let ItemIcon = Terminal;
                      if (item.includes('Jupyter')) ItemIcon = FileCode;
                      if (item.includes('orchestration')) ItemIcon = Calendar;
                      if (item.includes('No')) ItemIcon = X;
                      
                      return (
                        <div key={index} className="flex items-center gap-1.5 text-xs text-gray-700">
                          <ItemIcon size={10} className={item.includes('No') ? 'text-red-400' : 'text-gray-400'} />
                          <span className="font-mono" dangerouslySetInnerHTML={{ 
                            __html: item.replace(/(\d+(?:GB|TB)?|^\d+x?\s*\w+|\d+)/g, '<span class="text-[#1eb182] font-semibold">$1</span>')
                          }} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
      
          <div className="flex-none w-36 p-5 flex flex-col justify-between border-l border-gray-200">
            <button 
              onClick={() => onDeploy(deployment)}
              className={`w-full py-2.5 px-4 text-xs font-mono uppercase tracking-wide transition-all border text-left ${
                deployment.buttonStyle === 'enterprise' 
                  ? 'border-gray-800 bg-gray-800 text-white hover:bg-gray-900'
                  : deployment.buttonStyle === 'secondary'
                  ? 'border-gray-400 bg-white text-gray-700 hover:bg-gray-50'
                  : 'border-[#1eb182] bg-[#1eb182] text-white hover:bg-[#1a9d6e]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{getButtonText()}</span>
                <Zap size={12} />
              </div>
            </button>
          </div>
        </div>
      
        <div className="border-t border-gray-300">
          <div className="p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono uppercase text-gray-600">Cluster Health</span>
              <span className="text-[10px] font-mono text-[#1eb182]">OPERATIONAL</span>
            </div>
            <div className="flex gap-0.5">
              {[...Array(30)].map((_, i) => {
                const isToday = i === 29;
                const hasIssue = i === 15 || i === 16;
                return (
                  <div 
                    key={i} 
                    className={`flex-1 h-4 ${
                      hasIssue ? 'bg-orange-400' : 'bg-[#1eb182]'
                    } ${isToday ? 'animate-pulse' : ''}`}
                    title={`Day ${i + 1}`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between mt-1 text-[9px] font-mono text-gray-500">
              <span>30d ago</span>
              <span>Today</span>
            </div>
          </div>
        </div>
    </div>
    </div>
  );
};