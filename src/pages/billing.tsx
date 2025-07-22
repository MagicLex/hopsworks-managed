import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { Box, Flex, Title, Text, Button, Card, Badge } from 'tailwind-quartz';
import { CreditCard, Download, Calendar, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

export default function Billing() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <Box className="min-h-screen flex items-center justify-center">
        <Text>Loading...</Text>
      </Box>
    );
  }

  if (!user) return null;

  // Mock data for display
  const subscription = {
    plan: 'Starter Cluster',
    status: 'Active',
    price: 399,
    nextBilling: '2025-08-22',
    usage: {
      cpu: '24 vCPUs',
      memory: '48 GB',
      storage: '500 GB SSD'
    }
  };

  const invoices = [
    { id: 'INV-2025-001', date: '2025-07-22', amount: 399, status: 'Paid' },
    { id: 'INV-2025-002', date: '2025-06-22', amount: 399, status: 'Paid' },
    { id: 'INV-2025-003', date: '2025-05-22', amount: 399, status: 'Paid' },
  ];

  return (
    <>
      <Navbar />
      <Box className="min-h-screen py-10 px-5">
        <Box className="max-w-4xl mx-auto">
          <Link href="/dashboard">
            <Button intent="ghost" className="text-sm mb-6">
              <ArrowLeft size={16} className="mr-2" />
              Back to Dashboard
            </Button>
          </Link>

          <Title as="h1" className="text-2xl mb-8">Billing & Subscription</Title>

          <Flex direction="column" gap={24}>
            {/* Current Subscription */}
            <Card className="p-6">
              <Flex justify="between" align="start" className="mb-4">
                <Title as="h2" className="text-lg">Current Subscription</Title>
                <Badge variant="success">{subscription.status}</Badge>
              </Flex>
              
              <Flex direction="column" gap={16}>
                <Box>
                  <Text className="text-sm text-gray-600">Plan</Text>
                  <Text className="text-xl">{subscription.plan}</Text>
                </Box>
                
                <Flex gap={24}>
                  <Box>
                    <Text className="text-sm text-gray-600">Monthly Cost</Text>
                    <Text className="text-lg">${subscription.price}/mo</Text>
                  </Box>
                  <Box>
                    <Text className="text-sm text-gray-600">Next Billing Date</Text>
                    <Text className="text-lg">{subscription.nextBilling}</Text>
                  </Box>
                </Flex>

                <Box>
                  <Text className="text-sm text-gray-600 mb-2">Resource Allocation</Text>
                  <Flex gap={16} className="text-sm">
                    <Badge variant="primary">{subscription.usage.cpu}</Badge>
                    <Badge variant="primary">{subscription.usage.memory}</Badge>
                    <Badge variant="primary">{subscription.usage.storage}</Badge>
                  </Flex>
                </Box>

                <Flex gap={12}>
                  <Button intent="secondary">Update Plan</Button>
                  <Button intent="ghost" className="text-red-500">
                    Cancel Subscription
                  </Button>
                </Flex>
              </Flex>
            </Card>

            {/* Payment Method */}
            <Card className="p-6">
              <Flex align="center" gap={12} className="mb-4">
                <CreditCard size={20} className="text-[#1eb182]" />
                <Title as="h2" className="text-lg">Payment Method</Title>
              </Flex>
              
              <Card variant="readOnly" className="p-4 mb-4">
                <Flex justify="between" align="center">
                  <Flex direction="column">
                    <Text>•••• •••• •••• 4242</Text>
                    <Text className="text-sm text-gray-600">Expires 12/2025</Text>
                  </Flex>
                  <Badge variant="primary">Default</Badge>
                </Flex>
              </Card>

              <Button intent="secondary">Update Payment Method</Button>
            </Card>

            {/* Invoices */}
            <Card className="p-6">
              <Flex align="center" gap={12} className="mb-4">
                <Calendar size={20} className="text-[#1eb182]" />
                <Title as="h2" className="text-lg">Invoice History</Title>
              </Flex>
              
              <Flex direction="column" gap={8}>
                {invoices.map((invoice) => (
                  <Card key={invoice.id} variant="readOnly" className="p-4">
                    <Flex justify="between" align="center">
                      <Flex direction="column">
                        <Text>{invoice.id}</Text>
                        <Text className="text-sm text-gray-600">{invoice.date}</Text>
                      </Flex>
                      <Flex align="center" gap={16}>
                        <Text>${invoice.amount}</Text>
                        <Badge variant="success" className="text-xs">{invoice.status}</Badge>
                        <Button intent="ghost" className="text-sm">
                          <Download size={16} />
                        </Button>
                      </Flex>
                    </Flex>
                  </Card>
                ))}
              </Flex>

              <Button intent="ghost" className="mt-4">
                View All Invoices →
              </Button>
            </Card>

            {/* Usage */}
            <Card className="p-6">
              <Title as="h2" className="text-lg mb-4">Current Usage</Title>
              
              <Flex direction="column" gap={12}>
                <Box>
                  <Flex justify="between" className="mb-2">
                    <Text className="text-sm text-gray-600">CPU Utilization</Text>
                    <Text className="text-sm">18/24 vCPUs</Text>
                  </Flex>
                  <Box className="w-full bg-gray-100 rounded h-2">
                    <Box className="bg-[#1eb182] h-2 rounded" style={{width: '75%'}} />
                  </Box>
                </Box>

                <Box>
                  <Flex justify="between" className="mb-2">
                    <Text className="text-sm text-gray-600">Memory Usage</Text>
                    <Text className="text-sm">32/48 GB</Text>
                  </Flex>
                  <Box className="w-full bg-gray-100 rounded h-2">
                    <Box className="bg-[#1eb182] h-2 rounded" style={{width: '67%'}} />
                  </Box>
                </Box>

                <Box>
                  <Flex justify="between" className="mb-2">
                    <Text className="text-sm text-gray-600">Storage Used</Text>
                    <Text className="text-sm">287/500 GB</Text>
                  </Flex>
                  <Box className="w-full bg-gray-100 rounded h-2">
                    <Box className="bg-[#1eb182] h-2 rounded" style={{width: '57%'}} />
                  </Box>
                </Box>
              </Flex>
            </Card>
          </Flex>
        </Box>
      </Box>
    </>
  );
}