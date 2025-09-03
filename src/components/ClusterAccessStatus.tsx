import { Box, Card, Text, Button, Badge, Flex } from 'tailwind-quartz';
import { AlertTriangle, CheckCircle, CreditCard } from 'lucide-react';
import Link from 'next/link';

interface ClusterAccessStatusProps {
  hasCluster: boolean;
  hasPaymentMethod: boolean;
  billingMode?: string;
  clusterName?: string;
  loading?: boolean;
}

export default function ClusterAccessStatus({ 
  hasCluster, 
  hasPaymentMethod, 
  billingMode,
  clusterName,
  loading = false
}: ClusterAccessStatusProps) {
  // Show skeleton loader while loading
  if (loading) {
    return (
      <Card className="p-4">
        <Flex align="center" gap={12}>
          <Box className="w-5 h-5 bg-gray-200 rounded animate-pulse" />
          <Box className="flex-1">
            <Box className="h-5 bg-gray-200 rounded w-40 mb-2 animate-pulse" />
            <Box className="h-4 bg-gray-200 rounded w-56 animate-pulse" />
          </Box>
        </Flex>
      </Card>
    );
  }
  
  if (hasCluster) {
    return (
      <Card className="p-4 border-green-200 bg-green-50">
        <Flex align="center" gap={12}>
          <CheckCircle size={20} className="text-green-600" />
          <Box className="flex-1">
            <Text className="font-semibold text-green-800">Cluster Access Active</Text>
            <Text className="text-sm text-green-700">
              Connected to: {clusterName || 'Hopsworks Cluster'}
            </Text>
          </Box>
        </Flex>
      </Card>
    );
  }

  // For prepaid users, show different message
  if (billingMode === 'prepaid' && !hasCluster) {
    return (
      <Card className="p-4 border-blue-200 bg-blue-50">
        <Flex align="start" gap={12}>
          <AlertTriangle size={20} className="text-blue-600 mt-1" />
          <Box className="flex-1">
            <Text className="font-semibold text-blue-800 mb-2">
              Cluster Setup In Progress
            </Text>
            <Text className="text-sm text-blue-700">
              Your cluster is being provisioned. This typically takes a few minutes.
              If you continue to see this message, please contact support.
            </Text>
          </Box>
        </Flex>
      </Card>
    );
  }

  return (
    <Card className="p-4 border-yellow-200 bg-yellow-50">
      <Flex align="start" gap={12}>
        <AlertTriangle size={20} className="text-yellow-600 mt-1" />
        <Box className="flex-1">
          <Text className="font-semibold text-yellow-800 mb-2">
            Cluster Access Pending
          </Text>
          {!hasPaymentMethod ? (
            <>
              <Text className="text-sm text-yellow-700 mb-3">
                Set up a payment method to get access to Hopsworks clusters.
              </Text>
              <Link href="/billing">
                <Button 
                  intent="primary"
                  size="md"
                >
                  Set Up Payment
                </Button>
              </Link>
            </>
          ) : (
            <Text className="text-sm text-yellow-700">
              Your cluster access is being provisioned. This usually takes a few minutes.
            </Text>
          )}
        </Box>
      </Flex>
    </Card>
  );
}