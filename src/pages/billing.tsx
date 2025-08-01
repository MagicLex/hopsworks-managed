import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Billing() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to dashboard billing tab
    router.push('/dashboard?tab=billing');
  }, [router]);

  return null;
}