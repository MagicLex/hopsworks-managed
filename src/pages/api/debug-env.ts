import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const baseUrl = process.env.AUTH0_BASE_URL || '';
  const issuerUrl = process.env.AUTH0_ISSUER_BASE_URL || '';
  
  const envVars = {
    AUTH0_BASE_URL: process.env.AUTH0_BASE_URL ? 'Set' : 'Not set',
    AUTH0_BASE_URL_LENGTH: baseUrl.length,
    AUTH0_BASE_URL_STARTS_WITH_HTTP: baseUrl.startsWith('http'),
    AUTH0_BASE_URL_FIRST_10: baseUrl.substring(0, 10),
    AUTH0_ISSUER_BASE_URL: process.env.AUTH0_ISSUER_BASE_URL ? 'Set' : 'Not set',
    AUTH0_ISSUER_BASE_URL_LENGTH: issuerUrl.length,
    AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID ? 'Set' : 'Not set',
    AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET ? 'Set' : 'Not set',
    AUTH0_SECRET: process.env.AUTH0_SECRET ? 'Set' : 'Not set',
    NODE_ENV: process.env.NODE_ENV,
  };
  
  res.status(200).json(envVars);
}