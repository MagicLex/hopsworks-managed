import { useState, useEffect } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';

export function useAdmin() {
  const { user } = useUser();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    // Check admin status from API
    fetch('/api/auth/check-admin')
      .then(res => res.json())
      .then(data => {
        setIsAdmin(data.isAdmin || false);
      })
      .catch(() => {
        setIsAdmin(false);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [user]);

  return { isAdmin, loading };
}