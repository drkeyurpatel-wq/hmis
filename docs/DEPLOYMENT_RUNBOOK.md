# Deployment Runbook

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anonymous key (public, RLS-protected) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key (server-only, bypasses RLS) |
| `ANTHROPIC_API_KEY` | Optional | Claude API for voice notes AI structuring + CDSS |
| `MSG91_AUTH_KEY` | Optional | MSG91 SMS gateway auth key |
| `MSG91_SENDER_ID` | Optional | MSG91 sender ID |
| `WHATSAPP_API_URL` | Optional | WhatsApp Business API endpoint |
| `WHATSAPP_ACCESS_TOKEN` | Optional | WhatsApp API access token |
| `RESEND_API_KEY` | Optional | Resend email API key (for report emails) |
| `MEDPAY_SUPABASE_URL` | Optional | MedPay Supabase URL (doctor payout integration) |
| `MEDPAY_SERVICE_ROLE_KEY` | Optional | MedPay service role key |

## Database Setup

```bash
# 1. Create Supabase project (or use existing)
# 2. Run base schema
psql $DATABASE_URL < sql/REBUILD_FULL.sql

# 3. Run module migrations
psql $DATABASE_URL < sql/RUN_ALL_MIGRATIONS.sql

# 4. Seed test data (optional, for staging only)
psql $DATABASE_URL < sql/SEED_DATA.sql
```

## Vercel Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Rollback (if needed)
vercel rollback
```

## Health Check

After deployment, verify:

```bash
# 1. App loads
curl -I https://your-domain.com

# 2. Supabase connection works
curl https://your-domain.com/api/onboarding

# 3. Auth works
# Login via browser at /auth/login
```

## Cron Jobs (Vercel)

| Cron | Schedule | Purpose |
|------|----------|---------|
| `/api/cron/daily-report` | `0 2 * * *` (2:30 AM IST) | Daily summary emails |
| `/api/alerts/check` | `*/15 * * * *` (every 15 min) | Clinical alert scan |

Configure in `vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/daily-report", "schedule": "0 2 * * *" },
    { "path": "/api/alerts/check", "schedule": "*/15 * * * *" }
  ]
}
```

## Monitoring

- **Vercel**: Function invocations, errors, latency → vercel.com/dashboard
- **Supabase**: Database size, connections, query performance → supabase.com/dashboard
- **Revenue Leakage**: Auto-scans on page load, also accessible via `/api/leakage/scan`

## Scaling Notes

| Metric | Current Design | Scale Limit |
|--------|---------------|-------------|
| Centres | Multi-centre via `centre_id` FK | Unlimited (DB-bound) |
| Concurrent users | Supabase connection pooling | ~200 concurrent (Supabase Pro) |
| Database size | PostgreSQL 17 | 8GB free, 100GB+ on Pro |
| File storage | Supabase Storage | 1GB free, scalable on Pro |
| API rate limit | Vercel Edge Functions | 1M/month free, scalable |
