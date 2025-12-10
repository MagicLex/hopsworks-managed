# Hopsworks Managed SaaS Bridge

A Next.js application that manages SaaS users, billing, and cluster access before handing them off to shared Hopsworks environments.

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Run development server
npm run dev
```

## Documentation

- **[Architecture Overview](docs/architecture/overview.md)** – System design, SaaS/Hopsworks boundary, and integrations
- **[Database Documentation](docs/reference/database/)** – Schema, migrations, and stored procedures
- **[Billing System](docs/features/billing.md)** – OpenCost ingestion and Stripe metered billing
- **[Stripe Setup](docs/integrations/stripe.md)** – Stripe products, price IDs, and webhook configuration
- **[HubSpot Integration](docs/integrations/hubspot.md)** – Corporate deal validation and prepaid onboarding
- **[Resend Integration](docs/integrations/resend.md)** – Team invite delivery workflow
- **[API Reference](docs/reference/api.md)** – Endpoints and admin tools
- **[Deployment Guide](docs/operations/deployment.md)** – Environment configuration and rollout steps
- **[Known Issues](docs/troubleshooting/known-issues.md)** – Common problems and mitigations

## Admin Interface

Access the admin panel at `/admin47392` (requires admin privileges).

## Environment Variables

See [.env.example](.env.example) for required configuration.

## Development

```bash
npm run dev        # Development server
npm run build      # Production build
npm run lint       # ESLint
```

## Testing

```bash
npm run test              # Run all tests
npm run test:watch        # Watch mode
npm run test:regression   # Regression tests only
npm run test:integration  # Integration tests (requires local Supabase)
```

See [Tests Documentation](tests/README.md) for setup and details.

## Deployment

This project is configured for Vercel deployment. See [Deployment Guide](docs/operations/deployment.md) for details.
