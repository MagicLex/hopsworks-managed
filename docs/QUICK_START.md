# Quick Start

## Required Services
1. Auth0 account (use SDK v3)
2. Supabase project
3. Stripe account
4. Vercel hosting

## Setup Steps

### 1. Clone and Install
```bash
git clone <repo>
npm install
```

### 2. Environment Variables
Copy all from README.md to `.env.local`

### 3. Database Setup
Run migrations from `sql/schema.sql` in Supabase SQL editor

### 4. Stripe Products
Create in Stripe Dashboard:
- Subscription product "Hopsworks Usage"
- Add metered price "Compute Hours" ($0.0001/unit)

### 5. Webhooks
Configure in respective dashboards:
- Auth0: `https://your-domain/api/webhooks/auth0`
- Stripe: `https://your-domain/api/webhooks/stripe`

### 6. Create Admin User
```sql
UPDATE users SET is_admin = true WHERE email = 'your@email.com';
```

### 7. Add Hopsworks Cluster
In admin panel (`/admin47392`):
- Name: `demo.hops.works`
- API URL: `https://demo.hops.works`
- API Key: Get from Hopsworks admin
- Max Users: 100

## Testing

1. Sign up as new user
2. Check Stripe customer created
3. Check user assigned to cluster
4. Upload kubeconfig in admin panel → Clusters tab
5. Click "Test API" in admin panel to see Kubernetes metrics
6. Run usage collection: `POST /api/usage/collect-k8s`

## Common Issues

- **No cluster assignment**: Check cluster has capacity
- **No Kubernetes metrics**: Upload kubeconfig for the cluster
- **User not found in K8s**: Set hopsworks_username in users table
- **Credits not deducted**: Enable prepaid in user's feature_flags