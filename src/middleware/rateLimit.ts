import { NextApiRequest, NextApiResponse } from 'next';
import { RateLimiterMemory } from 'rate-limiter-flexible';

// Create different rate limiters for different endpoint types
const rateLimiters = {
  // Team invites: 5 per hour per IP
  teamInvite: new RateLimiterMemory({
    points: 5,
    duration: 60 * 60, // 1 hour
    keyPrefix: 'team_invite',
  }),
  
  // Webhooks: 100 per minute per IP
  webhook: new RateLimiterMemory({
    points: 100,
    duration: 60, // 1 minute
    keyPrefix: 'webhook',
  }),
  
  // Billing operations: 20 per minute per IP
  billing: new RateLimiterMemory({
    points: 20,
    duration: 60, // 1 minute
    keyPrefix: 'billing',
  }),
  
  // General API: 60 per minute per IP
  general: new RateLimiterMemory({
    points: 60,
    duration: 60, // 1 minute
    keyPrefix: 'general',
  }),
};

export function rateLimit(type: keyof typeof rateLimiters = 'general') {
  return async function rateLimitMiddleware(
    req: NextApiRequest,
    res: NextApiResponse,
    next: () => Promise<void>
  ) {
    // Skip rate limiting in development
    if (process.env.NODE_ENV === 'development') {
      return next();
    }

    const limiter = rateLimiters[type];
    const key = req.headers['x-forwarded-for'] as string || 
                req.socket?.remoteAddress || 
                'unknown';

    try {
      await limiter.consume(key);
      return next();
    } catch (rateLimiterRes) {
      res.status(429).json({ 
        error: 'Too many requests, please try again later',
        retryAfter: Math.round((rateLimiterRes as any).msBeforeNext / 1000) || 60,
      });
    }
  };
}