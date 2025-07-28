# Supabase Database Setup

## Overview
We use Supabase (Postgres) for data storage and Auth0 for authentication. This separation allows us to leverage Auth0's robust auth features while maintaining full control over our user data and analytics.

## Database Schema

### Core Tables

1. **users** - Synced from Auth0
   - Stores user profile, registration info, login metrics
   - Primary key is Auth0 user ID (sub)

2. **user_credits** - Credit tracking
   - Total purchased credits
   - Used credits (CPU, GPU, storage)
   - One record per user

3. **usage_daily** - Daily usage metrics
   - CPU/GPU hours per day
   - Storage usage
   - API call counts
   - Aggregated for billing

4. **billing_history** - Payment records
   - Invoice details
   - Payment status
   - Stripe integration ready

5. **instances** - Hopsworks instances
   - Instance URL and status
   - One instance per user (MVP)

6. **feature_groups** & **model_deployments**
   - Track user's Hopsworks resources
   - Used for dashboard metrics

## Setup Instructions

1. **Run the schema SQL**:
   ```bash
   # Connect to your Supabase project
   psql -h db.PROJECT_REF.supabase.co -U postgres -d postgres < sql/schema.sql
   ```

2. **Configure Auth0 Webhook**:
   - Go to Auth0 Dashboard > Actions > Flows > Post User Registration
   - Add a custom action that calls your webhook:
   ```javascript
   exports.onExecutePostUserRegistration = async (event, api) => {
     await fetch('https://your-app.com/api/webhooks/auth0', {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         'X-Auth0-Secret': 'your_webhook_secret'
       },
       body: JSON.stringify({
         user_id: event.user.user_id,
         email: event.user.email,
         name: event.user.name,
         ip: event.request.ip,
         created_at: event.user.created_at
       })
     });
   };
   ```

3. **Set Environment Variables**:
   ```
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   AUTH0_WEBHOOK_SECRET=generate_strong_secret_here
   ```

## User Flow

1. User signs up via Auth0
2. Auth0 webhook creates user in Supabase
3. On login, AuthContext syncs user data
4. API endpoints query Supabase for metrics
5. Dashboard displays real data (or zeros for new users)

## Analytics Tracked

- Registration source and IP
- Login count and last login time
- Daily usage (CPU, GPU, storage)
- Total credits purchased vs used
- Feature groups and model deployments
- Billing history

## Security

- Row Level Security (RLS) enabled on all tables
- Users can only see their own data
- Service role key used only in API routes
- Auth0 webhook validates secret

## Future Enhancements

- Add usage alerts when approaching limits
- Integrate with Stripe for automatic billing
- Add team/organization support
- Usage prediction and cost optimization
- Detailed audit logs