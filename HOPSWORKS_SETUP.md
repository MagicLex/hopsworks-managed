# Hopsworks Identity Provider Setup

## Auth0 Application Settings

Add these URLs to your Auth0 application:

### Allowed Callback URLs
```
https://hopsworks-managed.vercel.app/api/auth/callback
https://your-hopsworks-instance.com/callback
https://your-hopsworks-instance.com/auth/callback
```

### Allowed Logout URLs
```
https://hopsworks-managed.vercel.app/
https://your-hopsworks-instance.com/
```

### Allowed Web Origins
```
https://hopsworks-managed.vercel.app
https://your-hopsworks-instance.com
```

## Hopsworks Identity Provider Configuration

1. **Connection URL**: `https://dev-fur3a3gej0xmnk7f.eu.auth0.com`
2. **Name**: `Auth0`
3. **Client Id**: `fKsp6ZBzMPuxk79fP1C1TJ4F2TBOfRvZ`
4. **Client Secret**: (from Auth0 dashboard)
5. **Given Name Claim**: `given_name`
6. **Family Name Claim**: `family_name`
7. **Email Claim**: `email`
8. **Group Claim**: `groups` (optional)
9. **Logo**: `https://cdn.auth0.com/styleguide/latest/lib/logos/img/badge.png`
10. **Verify email**: ✓
11. **Code Challenge**: ✓

## User Flow

1. User signs up/logs in via hopsworks-managed.vercel.app
2. User purchases cluster access
3. User data is stored in Supabase with cluster membership
4. User can SSO into Hopsworks using the same Auth0 credentials
5. Hopsworks validates the user via Auth0 OAuth2 flow

## Next Steps

1. Configure Hopsworks API access in your app
2. Set up webhook from payment processor to provision Hopsworks access
3. Create API endpoint to sync user permissions between your app and Hopsworks