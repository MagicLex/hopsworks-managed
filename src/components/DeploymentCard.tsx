import React from 'react';
import { DeploymentOption } from '@/data/deployments';
import { Button, Card, Title, Text, Labeling, Badge, Flex, Box } from 'tailwind-quartz';
import { Server, HardDrive, Cpu, Cloud, Database, Activity, Zap, Shield, Terminal, MessageSquare, FileCode, Calendar, X, Globe } from 'lucide-react';
import { usePricing } from '@/contexts/PricingContext';

interface DeploymentCardProps {
  deployment: DeploymentOption;
  isYearly: boolean;
  onDeploy: (deployment: DeploymentOption) => void;
  isCorporate?: boolean;
}

export const DeploymentCard: React.FC<DeploymentCardProps> = ({ 
  deployment, 
  isYearly, 
  onDeploy,
  isCorporate = false 
}) => {
  const price = isYearly ? deployment.yearlyPrice : deployment.monthlyPrice;
  const { pricing } = usePricing();
  
  const getButtonIntent = () => {
    switch (deployment.buttonStyle) {
      case 'secondary':
        return 'secondary';
      case 'enterprise':
        return 'primary';
      default:
        return 'primary';
    }
  };
  
  const getButtonText = () => {
    if (deployment.id === 'payg') return 'Get Started';
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

  if (deployment.buttonStyle === 'enterprise') {
    return (
      <Card className="p-6 bg-gray-50 border-gray-200">
        <Flex justify="between" align="center">
          <Box>
            <Title as="h3" className="text-base mb-1">{deployment.name}</Title>
            <Text className="text-sm text-gray-600">Contact us for bespoke deployment solutions tailored to your needs</Text>
          </Box>
          <Button 
            onClick={() => onDeploy(deployment)}
            intent="secondary"
            size="md"
            className="font-mono uppercase tracking-wide w-[150px] justify-center"
          >
            Contact Sales
          </Button>
        </Flex>
      </Card>
    );
  }

  return (
    <Box className="relative">
      {deployment.isRecommended && (
        <Box className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <Badge
            variant="primary"
            size="sm"
            className="bg-[#1eb182] text-white px-4 py-1 font-mono font-semibold uppercase"
          >
            RECOMMENDED
          </Badge>
        </Box>
      )}
      <Card 
        className={`flex flex-col transition-all hover:border-grayShade1 ${
          deployment.isRecommended ? 'border-[#1eb182]' : ''
        }`}
        withShadow={(deployment.id === 'small' || deployment.id === 'medium')}
      >
        <Flex style={{ minHeight: '120px' }}>
          <Box className="flex-none w-[180px] p-5 border-r border-grayShade2 relative">
            <Box className="absolute top-2 left-2">
              <Box className="w-1.5 h-1.5 bg-[#1eb182] rounded-full animate-pulse" />
            </Box>
            <Title as="h4" className="text-base mb-1">
              {isCorporate && deployment.id === 'payg' ? 'Corporate' : deployment.name}
            </Title>
            <Box className="text-sm text-gray-600 mb-2">
              {deployment.id === 'payg' ? (
                isCorporate ? (
                  <Badge variant="primary" size="sm" className="font-mono font-semibold">PREPAID</Badge>
                ) : (
                  <Flex align="baseline" gap={4}>
                    <Text className="font-mono font-semibold">${pricing.compute_credits.toFixed(2)}</Text>
                    <Labeling gray>/credit</Labeling>
                  </Flex>
                )
              ) : (
                <Flex align="baseline" gap={4}>
                  <Text className="font-mono font-semibold">${price}</Text>
                  <Labeling gray>/month</Labeling>
                </Flex>
              )}
            </Box>
            <Box className="inline-flex items-center px-2 py-0.5 bg-black text-white text-xs font-mono font-semibold uppercase tracking-wider">
              EU-WEST
            </Box>
          </Box>
      
          <Flex className="flex-1 p-5" gap={32}>
            {Object.entries(deployment.specs).map(([category, items]) => {
              const Icon = getIconForCategory(category);
              return (
                <Box key={category} className="flex-1">
                  <Flex align="center" gap={6} className="mb-2">
                    <Icon size={12} className="text-[#1eb182]" />
                    <Labeling className="text-xs uppercase tracking-wider font-mono" gray>
                      {category}
                    </Labeling>
                  </Flex>
                  <Flex direction="column" gap={6}>
                    {items.map((item, index) => {
                      let ItemIcon = Terminal;
                      if (item.includes('Jupyter')) ItemIcon = FileCode;
                      if (item.includes('orchestration')) ItemIcon = Calendar;
                      if (item.includes('No')) ItemIcon = X;
                      
                      return (
                        <Flex key={index} align="center" gap={6}>
                          <ItemIcon size={10} className={item.includes('No') ? 'text-red-400' : 'text-gray-400'} />
                          <Text className="text-xs font-mono" dangerouslySetInnerHTML={{ 
                            __html: item.replace(/(\d+(?:GB|TB)?|^\d+x?\s*\w+|\d+)/g, '<span class="text-[#1eb182] font-semibold">$1</span>')
                          }} />
                        </Flex>
                      );
                    })}
                  </Flex>
                </Box>
              );
            })}
          </Flex>
      
          <Box className="flex-none px-6 flex items-center">
            <Button
              onClick={() => onDeploy(deployment)}
              intent={deployment.id === 'payg' || deployment.isRecommended ? 'primary' : 'secondary'}
              size="md"
              className="font-mono uppercase tracking-wide whitespace-nowrap w-[150px] justify-center"
            >
              {getButtonText()}
            </Button>
          </Box>
        </Flex>
      
      </Card>
    </Box>
  );
};