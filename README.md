# Hopsworks Managed Service

A Next.js application providing managed Hopsworks clusters with usage-based billing through Stripe.

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

- **[Architecture Overview](docs/architecture.md)** - System design and tech stack
- **[Database Guide](docs/database.md)** - Schema, patterns, and queries
- **[Billing System](docs/billing.md)** - Usage tracking and Stripe integration
- **[API Reference](docs/api.md)** - Endpoints and integration patterns
- **[Deployment Guide](docs/deployment.md)** - Production setup and configuration
- **[Known Issues](docs/known-issues.md)** - Common problems and solutions

## Admin Interface

Access the admin panel at `/admin47392` (requires admin privileges).

## Environment Variables

See [.env.example](.env.example) for required configuration.

## Development

```bash
# Run with type checking
npm run dev

# Lint and format
npm run lint
npm run format

# Type check
npm run type-check
```

## Deployment

This project is configured for Vercel deployment. See [Deployment Guide](docs/DEPLOYMENT.md) for details.