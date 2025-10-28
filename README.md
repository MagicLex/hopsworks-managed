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

- **[Architecture Overview](docs/ARCHITECTURE.md)** – System design, SaaS/Hopsworks boundary, and integrations
- **[Database Documentation](docs/database/)** – Schema, migrations, and stored procedures
- **[Billing System](docs/billing.md)** – OpenCost ingestion and Stripe metered billing
- **[Stripe Setup](docs/stripe-setup.md)** – Stripe products, price IDs, and webhook configuration
- **[HubSpot Integration](docs/hubspot.md)** – Corporate deal validation and prepaid onboarding
- **[Resend Integration](docs/resend.md)** – Team invite delivery workflow
- **[API Reference](docs/api.md)** – Endpoints and admin tools
- **[Deployment Guide](docs/deployment.md)** – Environment configuration and rollout steps
- **[Known Issues](docs/known-issues.md)** – Common problems and mitigations

## Admin Interface

Access the admin panel at `/admin47392` (requires admin privileges).

## Environment Variables

See [.env.example](.env.example) for required configuration.

## Development

```bash
# Run with type checking
npm run dev

# Lint
npm run lint
```

## Deployment

This project is configured for Vercel deployment. See [Deployment Guide](docs/deployment.md) for details.
