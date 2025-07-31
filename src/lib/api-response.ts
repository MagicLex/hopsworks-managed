import { NextApiResponse } from 'next';

export function sendError(res: NextApiResponse, status: number, message: string, details?: any) {
  return res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && details && { details })
  });
}

export function sendSuccess(res: NextApiResponse, data: any, message?: string) {
  return res.status(200).json({
    ...(message && { message }),
    ...data
  });
}

// Common error responses
export const errors = {
  methodNotAllowed: (res: NextApiResponse) => 
    sendError(res, 405, 'Method not allowed'),
  
  unauthorized: (res: NextApiResponse) => 
    sendError(res, 401, 'Not authenticated'),
  
  forbidden: (res: NextApiResponse) => 
    sendError(res, 403, 'Access denied'),
  
  notFound: (res: NextApiResponse, resource: string) => 
    sendError(res, 404, `${resource} not found`),
  
  badRequest: (res: NextApiResponse, message: string) => 
    sendError(res, 400, message),
  
  serverError: (res: NextApiResponse, message: string, error?: any) => 
    sendError(res, 500, message, error instanceof Error ? error.message : error)
};