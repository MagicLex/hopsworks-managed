import { NextApiResponse } from 'next';

async function sendToSlack(message: string, context?: string) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const text = `:rotating_light: *API Error*${context ? ` in \`${context}\`` : ''}\n\`\`\`${message.slice(0, 2000)}\`\`\``;

  fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  }).catch(() => {}); // Fire and forget
}

export function handleApiError(error: unknown, res: NextApiResponse, context?: string) {
  // Log the full error for debugging
  console.error(`API Error${context ? ` in ${context}` : ''}:`, error);

  // Send to Slack in production
  if (process.env.NODE_ENV === 'production') {
    const message = error instanceof Error ? `${error.message}\n${error.stack}` : String(error);
    sendToSlack(message, context);
  }

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