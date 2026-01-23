# PlacemakerAI Email Worker

This Cloudflare Worker receives emails via Cloudflare Email Routing and forwards them to the PlacemakerAI inbox.

## Setup Instructions

### 1. Add your domain to Cloudflare

If your domain isn't already on Cloudflare:
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click "Add a Site"
3. Enter your domain (e.g., placemakerai.io)
4. Follow the instructions to update your nameservers at Hostinger

### 2. Enable Email Routing

1. In Cloudflare Dashboard, select your domain
2. Go to **Email** > **Email Routing**
3. Click "Get started" if not already enabled
4. Add the required DNS records when prompted

### 3. Deploy the Worker

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Navigate to this directory
cd cloudflare-email-worker

# Create the webhook secret
wrangler secret put WEBHOOK_SECRET
# Enter a secure random string when prompted

# Deploy the worker
wrangler deploy
```

### 4. Set the Webhook Secret in PlacemakerAI

Add the same secret to your Vercel environment:
```
EMAIL_WEBHOOK_SECRET=your-secret-here
```

### 5. Configure Email Routing Rules

1. In Cloudflare Dashboard > Email > Email Routing
2. Go to **Routing rules**
3. Click "Create address" or "Catch-all address"
4. Set the action to **Send to a Worker**
5. Select `placemaker-email-worker`

#### Recommended Setup:
- **Catch-all**: Route all emails to the worker
  - This lets each project have its own email (e.g., project-name@placemakerai.io)

OR

- **Specific addresses**: Create addresses for each project
  - e.g., `enquiries@placemakerai.io` → Worker

### 6. Test the Integration

Send a test email to your configured address and check:
1. Cloudflare Email Routing logs (Email > Email Routing > Activity)
2. Worker logs: `wrangler tail`
3. PlacemakerAI inbox for the new enquiry

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `WEBHOOK_URL` | Yes | PlacemakerAI webhook URL |
| `WEBHOOK_SECRET` | Yes | Shared secret for authentication |
| `FORWARD_TO` | No | Optional backup email address |

## How It Works

1. Email arrives at `anything@placemakerai.io`
2. Cloudflare Email Routing triggers the worker
3. Worker parses the email and extracts:
   - Sender name and email
   - Subject line
   - Message body (plain text)
4. Worker POSTs to PlacemakerAI webhook
5. Webhook creates an Enquiry in the matching project's inbox
6. If sender matches a Stakeholder email, it's linked automatically

## Matching Emails to Projects

The webhook matches incoming emails to projects by:
1. Checking if the recipient local part matches a project's `emailFromAddress`
2. Matching against project IDs
3. Matching against project name slugs

Example: An email to `riverside-development@placemakerai.io` would match a project named "Riverside Development".
