# Deployment & Operations Guide

## Prerequisites
- Node.js 18+ 
- Supabase project (Free tier works for dev, Pro recommended for production)
- Vercel account (Hobby for dev, Pro for production)
- GitHub repository access
- Domain name (optional, Vercel provides `.vercel.app` subdomain)

## Fresh deployment

### 1. Supabase setup
```bash
# Create project at https://supabase.com/dashboard
# Recommended region: Mumbai (ap-south-1) for Indian hospitals
# Note your: Project URL, anon key, service role key
```

### 2. Database initialization
Run in Supabase SQL Editor (https://supabase.com/dashboard/project/{ref}/sql/new):
```sql
-- Step 1: Base schema (238 tables)
-- Copy contents of sql/REBUILD_FULL.sql

-- Step 2: Module enhancements (25 new tables, 120+ new columns)
-- Copy contents of sql/RUN_ALL_MIGRATIONS.sql
```

### 3. Vercel deployment
```bash
# Connect repo to Vercel
vercel link

# Set environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL        # https://{ref}.supabase.co
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY   # from Supabase dashboard
vercel env add SUPABASE_SERVICE_ROLE_KEY       # from Supabase dashboard

# Optional integrations
vercel env add MSG91_AUTH_KEY                   # SMS notifications
vercel env add MSG91_SENDER_ID
vercel env add WHATSAPP_API_URL                # WhatsApp notifications  
vercel env add WHATSAPP_ACCESS_TOKEN
vercel env add ANTHROPIC_API_KEY               # Voice Notes AI structuring

# Deploy
vercel --prod
```

### 4. First login
1. Create admin user in Supabase Auth dashboard
2. Add corresponding record in `hmis_staff` table
3. Navigate to deployed URL → Login
4. Complete Centre Onboarding Wizard

## Environment variables reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-side only) |
| `MSG91_AUTH_KEY` | No | MSG91 SMS gateway auth key |
| `MSG91_SENDER_ID` | No | MSG91 sender ID |
| `WHATSAPP_API_URL` | No | WhatsApp Business API endpoint |
| `WHATSAPP_ACCESS_TOKEN` | No | WhatsApp API token |
| `ANTHROPIC_API_KEY` | No | For Voice Notes AI structuring |
| `MEDPAY_SUPABASE_URL` | No | MedPay integration (if using) |
| `MEDPAY_SERVICE_ROLE_KEY` | No | MedPay service key |

## Monitoring

### Key health checks
- Vercel deployment status: `https://vercel.com/dashboard`
- Supabase database health: `https://supabase.com/dashboard/project/{ref}/reports`
- RLS policy check: Settings → System tab

### Revenue leakage scanner
Runs on-demand from Revenue Leakage module. Scans for:
- Unbilled charges, missing room charges
- Unbilled lab/pharmacy/OT
- Package overstay
- Unpaid bills >3 days

### Shift handover
Auto-generates from live data every shift change. Covers:
- IPD census, critical patients, pending labs/meds
- Surgery schedule, ER active, pending discharges

## Backup strategy
- **Supabase Free**: automatic daily backups, 7-day retention
- **Supabase Pro**: PITR (point-in-time recovery), 30-day retention  
- **Recommended**: additionally export critical data weekly via `pg_dump`

## Scaling
- **Single centre**: Supabase Free + Vercel Hobby (up to ~200 beds)
- **Multi-centre (2-5)**: Supabase Pro + Vercel Pro
- **Large group (5+)**: Supabase Enterprise + Vercel Enterprise, consider read replicas
