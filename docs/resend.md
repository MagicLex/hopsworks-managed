# Resend Integration

## Overview

Resend delivers team-invite emails when account owners add new members. The invite payload includes a one-time token that points to `/team/accept-invite?token=...`.

## Environment Variables

| Name               | Purpose                                       |
|--------------------|-----------------------------------------------|
| `RESEND_API_KEY`   | Resend API token (project or domain scoped)   |
| `RESEND_FROM_EMAIL`| Verified sender address, e.g. `no-reply@...`  |

## Email Flow

1. Account owner calls `POST /api/team/invite`.
2. Backend creates a `team_invites` row and generates a 32-byte token.
3. Resend sends the invite email with `Accept Invitation` link pointing to `/team/accept-invite?token=<token>`.
4. Recipient hits `GET /api/team/accept-invite` to fetch invite metadata.
5. After Auth0 login, `POST /api/team/join` finalizes membership and removes the pending invite.

## Template

Emails are assembled server-side (inline HTML) in `src/pages/api/team/invite.ts`. Update the copy there if branding changes; Resend does not store a template for this flow.

## Operations

- Verify the sender domain in Resend before using a branded address; otherwise use the default transactional domain.
- Rotate `RESEND_API_KEY` via the Resend dashboard and update the secret in Vercel.
- Monitor delivery status and bounce reports within Resend if invites are not received.
