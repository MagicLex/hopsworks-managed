import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const baseURL = process.env.AUTH0_BASE_URL || '';
  
  // Validate the URL
  let isValidURL = false;
  let urlError = '';
  
  try {
    new URL(baseURL);
    isValidURL = true;
  } catch (e: any) {
    urlError = e.message;
  }
  
  res.status(200).json({
    baseURL: {
      value: baseURL,
      length: baseURL.length,
      isValid: isValidURL,
      error: urlError,
      trimmedValue: baseURL.trim(),
      trimmedLength: baseURL.trim().length,
      hasWhitespace: baseURL !== baseURL.trim(),
      encodedValue: encodeURIComponent(baseURL),
    },
    issuerBaseURL: {
      value: process.env.AUTH0_ISSUER_BASE_URL,
      isValid: (() => {
        try {
          new URL(process.env.AUTH0_ISSUER_BASE_URL || '');
          return true;
        } catch {
          return false;
        }
      })()
    }
  });
}