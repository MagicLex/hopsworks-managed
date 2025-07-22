import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { Box, Flex, Title, Text, Button, Card, Badge } from 'tailwind-quartz';
import { Terminal, CreditCard, Download, Calendar, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

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
      <Box className="min-h-screen bg-[#0a0f0a] text-gray-100 flex items-center justify-center">
        <Text className="font-mono">LOADING...</Text>
      </Box>
    );
  }

  if (!user) return null;

  // Mock data for display
  const subscription = {
    plan: 'STARTER CLUSTER',
    status: 'ACTIVE',
    price: 399,
    nextBilling: '2025-08-22',
    usage: {
      cpu: '24 vCPUs',
      memory: '48 GB',
      storage: '500 GB SSD'
    }
  };

  const invoices = [
    { id: 'INV-2025-001', date: '2025-07-22', amount: 399, status: 'PAID' },
    { id: 'INV-2025-002', date: '2025-06-22', amount: 399, status: 'PAID' },
    { id: 'INV-2025-003', date: '2025-05-22', amount: 399, status: 'PAID' },
  ];

  return (
    <Box className="min-h-screen bg-[#0a0f0a] text-gray-100">
      <Box className="max-w-4xl mx-auto p-8">
        <Link href="/dashboard">
          <Button intent="ghost" className="font-mono text-sm mb-6">
            <ArrowLeft size={16} className="mr-2" />
            BACK TO DASHBOARD
          </Button>
        </Link>

        <Flex align="center" gap={12} className="mb-8">
          <Terminal size={24} className="text-[#1eb182]" />
          <Title as="h1" className="text-2xl font-mono uppercase">BILLING & SUBSCRIPTION</Title>
        </Flex>

        <Flex direction="column" gap={24}>
          {/* Current Subscription */}
          <Card className="bg-[#111511] border-grayShade2 p-6">
            <Flex justify="between" align="start" className="mb-4">
              <Title as="h2" className="text-lg font-mono uppercase">CURRENT SUBSCRIPTION</Title>
              <Badge variant="success" className="font-mono">{subscription.status}</Badge>
            </Flex>
            
            <Flex direction="column" gap={16}>
              <Box>
                <Text className="font-mono text-sm text-gray-400">PLAN</Text>
                <Text className="font-mono text-xl">{subscription.plan}</Text>
              </Box>
              
              <Flex gap={24}>
                <Box>
                  <Text className="font-mono text-sm text-gray-400">MONTHLY COST</Text>
                  <Text className="font-mono text-lg">${subscription.price}/mo</Text>
                </Box>
                <Box>
                  <Text className="font-mono text-sm text-gray-400">NEXT BILLING DATE</Text>
                  <Text className="font-mono text-lg">{subscription.nextBilling}</Text>
                </Box>
              </Flex>

              <Box>
                <Text className="font-mono text-sm text-gray-400 mb-2">RESOURCE ALLOCATION</Text>
                <Flex gap={16} className="font-mono text-sm">
                  <Badge variant="primary">{subscription.usage.cpu}</Badge>
                  <Badge variant="primary">{subscription.usage.memory}</Badge>
                  <Badge variant="primary">{subscription.usage.storage}</Badge>
                </Flex>
              </Box>

              <Flex gap={12}>
                <Button intent="secondary" className="font-mono uppercase">
                  UPDATE PLAN
                </Button>
                <Button intent="ghost" className="font-mono uppercase text-red-500">
                  CANCEL SUBSCRIPTION
                </Button>
              </Flex>
            </Flex>
          </Card>

          {/* Payment Method */}
          <Card className="bg-[#111511] border-grayShade2 p-6">
            <Flex align="center" gap={12} className="mb-4">
              <CreditCard size={20} className="text-[#1eb182]" />
              <Title as="h2" className="text-lg font-mono uppercase">PAYMENT METHOD</Title>
            </Flex>
            
            <Card className="bg-[#0a0f0a] border-grayShade2 p-4 mb-4">
              <Flex justify="between" align="center">
                <Flex direction="column">
                  <Text className="font-mono">•••• •••• •••• 4242</Text>
                  <Text className="font-mono text-sm text-gray-400">Expires 12/2025</Text>
                </Flex>
                <Badge variant="primary" className="font-mono">DEFAULT</Badge>
              </Flex>
            </Card>

            <Button intent="secondary" className="font-mono uppercase">
              UPDATE PAYMENT METHOD
            </Button>
          </Card>

          {/* Invoices */}
          <Card className="bg-[#111511] border-grayShade2 p-6">
            <Flex align="center" gap={12} className="mb-4">
              <Calendar size={20} className="text-[#1eb182]" />
              <Title as="h2" className="text-lg font-mono uppercase">INVOICE HISTORY</Title>
            </Flex>
            
            <Flex direction="column" gap={8}>
              {invoices.map((invoice) => (
                <Card key={invoice.id} className="bg-[#0a0f0a] border-grayShade2 p-4">
                  <Flex justify="between" align="center">
                    <Flex direction="column">
                      <Text className="font-mono">{invoice.id}</Text>
                      <Text className="font-mono text-sm text-gray-400">{invoice.date}</Text>
                    </Flex>
                    <Flex align="center" gap={16}>
                      <Text className="font-mono">${invoice.amount}</Text>
                      <Badge variant="success" className="font-mono text-xs">{invoice.status}</Badge>
                      <Button intent="ghost" className="font-mono text-sm">
                        <Download size={16} />
                      </Button>
                    </Flex>
                  </Flex>
                </Card>
              ))}
            </Flex>

            <Button intent="ghost" className="font-mono uppercase mt-4">
              VIEW ALL INVOICES →
            </Button>
          </Card>

          {/* Usage */}
          <Card className="bg-[#111511] border-grayShade2 p-6">
            <Title as="h2" className="text-lg font-mono uppercase mb-4">CURRENT USAGE</Title>
            
            <Flex direction="column" gap={12}>
              <Box>
                <Flex justify="between" className="mb-2">
                  <Text className="font-mono text-sm text-gray-400">CPU UTILIZATION</Text>
                  <Text className="font-mono text-sm">18/24 vCPUs</Text>
                </Flex>
                <Box className="w-full bg-[#0a0f0a] rounded h-2">
                  <Box className="bg-[#1eb182] h-2 rounded" style={{width: '75%'}} />
                </Box>
              </Box>

              <Box>
                <Flex justify="between" className="mb-2">
                  <Text className="font-mono text-sm text-gray-400">MEMORY USAGE</Text>
                  <Text className="font-mono text-sm">32/48 GB</Text>
                </Flex>
                <Box className="w-full bg-[#0a0f0a] rounded h-2">
                  <Box className="bg-[#1eb182] h-2 rounded" style={{width: '67%'}} />
                </Box>
              </Box>

              <Box>
                <Flex justify="between" className="mb-2">
                  <Text className="font-mono text-sm text-gray-400">STORAGE USED</Text>
                  <Text className="font-mono text-sm">287/500 GB</Text>
                </Flex>
                <Box className="w-full bg-[#0a0f0a] rounded h-2">
                  <Box className="bg-[#1eb182] h-2 rounded" style={{width: '57%'}} />
                </Box>
              </Box>
            </Flex>
          </Card>
        </Flex>
      </Box>
    </Box>
  );
}