# Setup Guide

## Prerequisites
- Node.js 18+
- Auth0 account
- Supabase account
- Vercel account (for deployment)

## Local Development Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Create `.env.local` with all required variables (see `.env.example`)

### 3. Database Setup
Database should already be configured. If setting up fresh:
- Run migrations from `supabase/migrations/` in order
- Set up admin user: `UPDATE users SET is_admin = true WHERE email = 'your-email';`

### 4. Run Development Server
```bash
npm run dev
```

## Production Deployment

### Vercel Setup
1. Link project: `vercel link`
2. Set all environment variables in Vercel dashboard
3. Deploy: `vercel --prod`

### Auth0 Configuration
- Set callback URLs to your production domain
- Configure allowed origins
- Enable user signup if needed

### Database
- Run all migrations in production Supabase
- Set up admin user: `UPDATE users SET is_admin = true WHERE email = 'your-email';`