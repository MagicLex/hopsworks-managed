import React from 'react';
import { DeploymentOption } from '@/data/deployments';
import { Button, Card, Title, Text, Labeling, Badge, Flex, Box } from 'tailwind-quartz';
import { Server, HardDrive, Cpu, Cloud, Database, Activity, Zap, Shield, Terminal, MessageSquare, FileCode, Calendar, X, Globe } from 'lucide-react';
import { usePricing } from '@/contexts/PricingContext';

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
    if (deployment.id === 'serverless') return 'Join Free';
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

  if (deployment.id === 'serverless') {
    return (
      <Card className="p-6 bg-gray-50 border-gray-200">
        <Flex justify="between" align="center">
          <Box>
            <Title as="h3" className="text-base mb-1">{deployment.name}</Title>
            <Text className="text-sm text-gray-600 mb-2">Feature store access on shared infrastructure</Text>
            <Flex gap={16} className="text-xs font-mono text-gray-500 mb-2">
              <Flex align="center" gap={4}>
                <span className="text-green-600 font-semibold text-sm">✓ Feature Store</span>
              </Flex>
              <Flex align="center" gap={4}>
                <X size={10} className="text-red-400" />
                <span>No Jupyter</span>
              </Flex>
              <Flex align="center" gap={4}>
                <X size={10} className="text-red-400" />
                <span>No Orchestration</span>
              </Flex>
            </Flex>
            <Flex align="center" gap={4} className="text-xs text-gray-500">
              <span>🇫🇷</span>
              <Labeling className="font-mono">FRANCE (Lille)</Labeling>
            </Flex>
          </Box>
          <Button 
            onClick={() => onDeploy(deployment)}
            intent="secondary"
            size="md"
            className="font-mono uppercase tracking-wide"
          >
            Join Free
          </Button>
        </Flex>
      </Card>
    );
  }

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
            className="font-mono uppercase tracking-wide"
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
              {deployment.name}
            </Title>
            <Box className="text-sm text-gray-600 mb-2">
              {price === 0 && deployment.id === 'serverless' ? (
                <Badge variant="primary" size="sm" className="font-mono font-semibold">FREE</Badge>
              ) : deployment.id === 'payg' ? (
                <Flex align="baseline" gap={4}>
                  <Text className="font-mono font-semibold">${pricing.compute_credits.toFixed(2)}</Text>
                  <Labeling gray>/credit</Labeling>
                </Flex>
              ) : (
                <Flex align="baseline" gap={4}>
                  <Text className="font-mono font-semibold">${price}</Text>
                  <Labeling gray>/month</Labeling>
                </Flex>
              )}
            </Box>
            <Flex align="center" gap={4} className="text-[10px] text-gray-500">
              <Globe size={10} />
              <Labeling className="font-mono">US-EAST</Labeling>
            </Flex>
          </Box>
      
          <Flex className="flex-1 p-5" gap={32}>
            {Object.entries(deployment.specs).map(([category, items]) => {
              const Icon = getIconForCategory(category);
              return (
                <Box key={category} className="flex-1">
                  <Flex align="center" gap={6} className="mb-2">
                    <Icon size={12} className="text-[#1eb182]" />
                    <Labeling className="text-[10px] uppercase tracking-wider font-mono" gray>
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
      
          <Box className="flex-none w-36 p-5 border-l border-grayShade2 flex items-center">
            <Button
              onClick={() => onDeploy(deployment)}
              intent={deployment.id === 'payg' || deployment.isRecommended ? 'primary' : 'secondary'}
              size="md"
              icon="BoltIcon"
              iconPosition="left"
              className="w-full font-mono uppercase tracking-wide"
            >
              {getButtonText()}
            </Button>
          </Box>
        </Flex>
      
      </Card>
    </Box>
  );
};