# Authentication Architecture

## Overview
Hopsworks-managed uses Supabase for user management with plans to integrate Auth0 as OAuth2 provider for Hopsworks SSO.

## Current Implementation

### Supabase Setup
- User registration and login
- Session management
- User profile storage

### Components
- `AuthContext`: React context providing auth state and methods
- `AuthModal`: Login/signup modal component
- `UserProfile`: User dropdown in navbar

### Flow
1. User clicks "Join Cluster" on Small deployment
2. If not authenticated, shows AuthModal
3. User signs up/logs in via Supabase
4. After auth, proceeds to cluster provisioning

## Future Auth0 Integration
- Vercel Auth0 integration for easy setup
- Auth0 acts as OAuth2 provider for Hopsworks
- Users auto-provision in Hopsworks on first SSO login