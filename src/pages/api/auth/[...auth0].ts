import { handleAuth, handleLogin, handleCallback, handleLogout } from '@auth0/nextjs-auth0';
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
    },
    getLoginState: (req: NextApiRequest) => {
      // Preserve returnTo parameter for signup flow
      return {
        returnTo: req.query.returnTo as string || '/'
      };
    }
  }),
  logout: handleLogout({
    returnTo: process.env.AUTH0_BASE_URL
  })
});