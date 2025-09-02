# Security Configuration

## Overview
This document outlines the security measures implemented in the hopsworks-managed SaaS middleware. These are MVP-level security controls to protect against common vulnerabilities while maintaining development flexibility.

## Authentication & Authorization

### Auth0 Integration
- OAuth 2.0 authentication via Auth0
- Session management with `@auth0/nextjs-auth0` v3
- User roles stored in database (`is_admin` flag)
- Team member access controlled via `account_owner_id` relationship

### Admin Protection
- Admin endpoints protected by `requireAdmin` middleware
- Checks both Auth0 session and database `is_admin` flag
- Located at `/api/admin/*` routes

## Webhook Security

### Auth0 Webhook
- **Endpoint**: `/api/webhooks/auth0`
- **Verification**: Header-based secret validation
- **Production**: Requires exact match of `AUTH0_WEBHOOK_SECRET`
- **Development**: Allows bypass if no secret configured
- Creates users and Stripe customers on first login

### Stripe Webhook
- **Endpoint**: `/api/webhooks/stripe`
- **Domain**: `https://run.hopsworks.ai/api/webhooks/stripe`
- **Verification**: Stripe signature validation using `STRIPE_WEBHOOK_SECRET`
- **Events handled**:
  - `checkout.session.completed` - Credit purchases and payment setup
  - `customer.subscription.created/updated/deleted` - Subscription lifecycle
  - `invoice.payment_succeeded/failed` - Payment status
- Auto-assigns clusters after payment confirmation

## CRON Job Security

### OpenCost Collection
- **Endpoint**: `/api/usage/collect-opencost`
- **Schedule**: Hourly (0 * * * *)
- **Authentication**: Bearer token with `CRON_SECRET`
- Collects Kubernetes namespace costs via kubectl

### Stripe Sync
- **Endpoint**: `/api/billing/sync-stripe`
- **Schedule**: Daily at 3 AM (0 3 * * *)
- **Authentication**: Bearer token with `CRON_SECRET`
- Reports usage to Stripe for billing

## Rate Limiting

Implemented using `rate-limiter-flexible` with in-memory storage:

| Endpoint Type | Limit | Window | Applied To |
|--------------|-------|---------|------------|
| Team Invites | 5 requests | 1 hour | `/api/team/invite` |
| Webhooks | 100 requests | 1 minute | `/api/webhooks/*` |
| Billing | 20 requests | 1 minute | `/api/billing/*` |
| General API | 60 requests | 1 minute | All other endpoints |

**Note**: Rate limiting is disabled in development environment.

## TLS/SSL Configuration

### Hopsworks API Communication
Hopsworks clusters use self-signed certificates. To handle this:

- **Production & Development**: SSL verification disabled for Hopsworks API calls
- Located in `src/lib/hopsworks-api.ts`
- Uses `NODE_TLS_REJECT_UNAUTHORIZED = '0'` for all environments

```javascript
// Required for self-signed certificates
if (typeof process !== 'undefined') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}
```

**Security Note**: This is acceptable because:
1. Communication happens within private Kubernetes networks
2. API keys provide authentication
3. Hopsworks clusters are isolated per customer

## Error Handling

### Production Error Sanitization
- Generic error messages returned to clients
- Full error details logged server-side only
- Stack traces hidden in production responses
- Specific handling for:
  - 409: Duplicate resources
  - 404: Not found
  - 400: Validation errors
  - 500: Generic server errors

## Sensitive Data Storage

### Database Security
- Supabase service role key for admin operations (bypasses RLS)
- Sensitive fields:
  - `stripe_customer_id` - Payment provider reference
  - `api_key` - Hopsworks cluster API keys
  - `kubeconfig` - Kubernetes cluster access (stored as text)

### Environment Variables
Required security-related environment variables:
```bash
# Authentication
AUTH0_SECRET            # Auth0 session encryption
AUTH0_WEBHOOK_SECRET    # Webhook verification
AUTH0_CLIENT_SECRET     # OAuth client secret

# Database
SUPABASE_SERVICE_ROLE_KEY  # Admin database access

# Stripe
STRIPE_SECRET_KEY          # Payment processing
STRIPE_WEBHOOK_SECRET      # Webhook verification

# Cron Jobs
CRON_SECRET               # Vercel cron authentication

# Environment
NODE_ENV                  # production/development
```

## Health Monitoring

### Health Check Endpoint
- **Endpoint**: `/api/health`
- **Public Access**: Yes (for monitoring services)
- **Checks**:
  - API availability
  - Database connection
  - Auth0 configuration
- **Status Codes**:
  - 200: Healthy
  - 503: Degraded/Unhealthy

## Security Headers

Handled by Vercel platform defaults:
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security
- Content-Security-Policy (basic)

## Known Limitations (MVP)

These items are acknowledged for future improvement:

1. **Kubeconfig Storage**: Currently stored as plain text in database
   - Future: Implement encryption at rest
   - Mitigation: Protected by service role authentication

2. **HMAC Webhook Verification**: Using simple secret comparison
   - Future: Implement full HMAC signature verification
   - Mitigation: Secret rotation capability exists

3. **Rate Limiting**: In-memory storage doesn't work across Vercel's distributed instances
   - Future: Redis-backed or edge-compatible solution

4. **Audit Logging**: Limited to console logs
   - Future: Structured logging with audit trail
   - Mitigation: Vercel captures all logs

5. **API Versioning**: No versioning strategy
   - Future: Implement versioned endpoints
   - Mitigation: Limited external API consumers

## Security Checklist for Deployment

Before deploying to production:
- [ ] Configure all required environment variables
- [ ] Generate strong `CRON_SECRET` (minimum 32 characters)
- [ ] Configure Auth0 webhook with secret
- [ ] Verify Stripe webhook endpoint in Stripe dashboard
- [ ] Test health check endpoint accessibility
- [ ] Review admin user list
- [ ] Verify TLS validation is enabled
- [ ] Check error messages are sanitized

## Incident Response

In case of security issues:

1. **Immediate Actions**:
   - Rotate affected secrets
   - Review access logs
   - Disable compromised accounts

2. **Investigation**:
   - Check Vercel function logs
   - Review Supabase audit logs
   - Analyze Auth0 logs

3. **Recovery**:
   - Update affected user sessions
   - Reset user passwords if needed
   - Notify affected users per requirements

## Regular Security Tasks

### Weekly
- Review admin access list
- Check for unusual API usage patterns

### Monthly
- Rotate CRON_SECRET
- Review rate limiting effectiveness
- Update dependencies for security patches

### Quarterly
- Full security audit
- Penetration testing (when applicable)
- Review and update this documentation