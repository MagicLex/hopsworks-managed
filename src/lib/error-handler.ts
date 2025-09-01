import { NextApiResponse } from 'next';

export function handleApiError(error: unknown, res: NextApiResponse, context?: string) {
  // Log the full error for debugging
  console.error(`API Error${context ? ` in ${context}` : ''}:`, error);

  // In production, return generic error messages
  if (process.env.NODE_ENV === 'production') {
    // Check for known error types
    if (error instanceof Error) {
      // Database errors
      if (error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
        return res.status(409).json({ error: 'Resource already exists' });
      }
      
      // Not found errors
      if (error.message.includes('not found') || error.message.includes('does not exist')) {
        return res.status(404).json({ error: 'Resource not found' });
      }
      
      // Validation errors
      if (error.message.includes('invalid') || error.message.includes('required')) {
        return res.status(400).json({ error: 'Invalid request data' });
      }
    }
    
    // Generic error for production
    return res.status(500).json({ error: 'Internal server error' });
  }

  // In development, return more detailed errors
  if (error instanceof Error) {
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      stack: error.stack
    });
  }

  return res.status(500).json({ 
    error: 'Internal server error',
    details: String(error)
  });
}