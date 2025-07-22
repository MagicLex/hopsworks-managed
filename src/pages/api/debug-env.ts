import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const envVars = {
    AUTH0_BASE_URL: process.env.AUTH0_BASE_URL ? 'Set' : 'Not set',
    AUTH0_ISSUER_BASE_URL: process.env.AUTH0_ISSUER_BASE_URL ? 'Set' : 'Not set',
    AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID ? 'Set' : 'Not set',
    AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET ? 'Set' : 'Not set',
    AUTH0_SECRET: process.env.AUTH0_SECRET ? 'Set' : 'Not set',
    NODE_ENV: process.env.NODE_ENV,
  };
  
  res.status(200).json(envVars);
}