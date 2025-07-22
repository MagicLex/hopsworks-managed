import { handleAuth, initAuth0 } from '@auth0/nextjs-auth0';

const auth0 = initAuth0({
  baseURL: process.env.AUTH0_BASE_URL!,
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL!,
  clientID: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!,
  secret: process.env.AUTH0_SECRET!,
  clockTolerance: 60,
  httpTimeout: 5000,
  authorizationParams: {
    scope: 'openid profile email',
  },
  session: {
    rolling: true,
    rollingDuration: 86400,
    absoluteDuration: 604800
  }
});

export default auth0.handleAuth();