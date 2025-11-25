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

// Validate returnTo to prevent open redirect attacks
function validateReturnTo(returnTo: string | string[] | undefined): string {
  if (!returnTo || Array.isArray(returnTo)) return '/';

  // Only allow relative paths (starting with /)
  // Reject absolute URLs, protocol-relative URLs (//), and other schemes
  if (!returnTo.startsWith('/') || returnTo.startsWith('//')) {
    return '/';
  }

  // Additional safety: no backslashes (IE quirk), no control chars
  if (returnTo.includes('\\') || /[\x00-\x1f]/.test(returnTo)) {
    return '/';
  }

  return returnTo;
}

export default handleAuth({
  signup: handleLogin({
    authorizationParams: {
      screen_hint: 'signup'
    },
    getLoginState: (req: NextApiRequest) => {
      return {
        returnTo: validateReturnTo(req.query.returnTo)
      };
    }
  }),
  logout: handleLogout({
    returnTo: process.env.AUTH0_BASE_URL
  })
});