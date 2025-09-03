import { handleAuth, handleLogin, handleCallback } from '@auth0/nextjs-auth0';
import { NextApiRequest } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export default handleAuth({
  signup: handleLogin({
    authorizationParams: {
      screen_hint: 'signup'
    }
  }),
  callback: handleCallback({
    afterCallback: async (req: NextApiRequest, session: any, state: any) => {
      try {
        // The session structure in afterCallback is different - user info is directly on session
        const userId = session?.sub;
        
        if (!userId) {
          console.log('No user ID in session, returning default redirect');
          return session;
        }
        
        // Check if user exists and needs payment setup
        const { data: user } = await supabaseAdmin
          .from('users')
          .select('stripe_customer_id, billing_mode, account_owner_id')
          .eq('id', userId)
          .single();
        
        // Determine redirect URL
        let redirectUrl = '/dashboard'; // default
        
        if (!user) {
          // New user - will be created by sync-user, needs payment
          redirectUrl = '/billing-setup';
        } else if (!user.account_owner_id && !user.stripe_customer_id && user.billing_mode !== 'prepaid') {
          // Existing user without payment
          redirectUrl = '/billing-setup';
        }
        
        return {
          ...session,
          returnTo: redirectUrl
        };
      } catch (error) {
        console.error('Error in auth callback:', error);
        // Return session as-is on error, default redirect
        return session;
      }
    }
  })
});