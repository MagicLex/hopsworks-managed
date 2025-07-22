import { handleAuth } from '@auth0/nextjs-auth0';

// Debug environment variables
console.log('AUTH0_BASE_URL:', process.env.AUTH0_BASE_URL);
console.log('AUTH0_ISSUER_BASE_URL:', process.env.AUTH0_ISSUER_BASE_URL);
console.log('AUTH0_CLIENT_ID:', process.env.AUTH0_CLIENT_ID);
console.log('AUTH0_SECRET exists:', !!process.env.AUTH0_SECRET);
console.log('AUTH0_CLIENT_SECRET exists:', !!process.env.AUTH0_CLIENT_SECRET);

// For Auth0 SDK v3, we need to use the default configuration
// The SDK will read from process.env automatically
export default handleAuth();