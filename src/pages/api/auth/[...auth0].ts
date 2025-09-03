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
  })
});