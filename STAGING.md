# Staging Environment

## URLs
- **Production:** https://hmis-brown.vercel.app (branch: `main`)
- **Staging:** https://hmis-staging-*.vercel.app (branch: `staging`)

## Supabase Projects
| | Production | Staging |
|---|---|---|
| Project ID | bmuupgrzbfmddjwcqlss | pcldnxssdxwxhwmasdhv |
| Region | Mumbai (ap-south-1) | Mumbai (ap-south-1) |
| Tables | 209 | 209 (schema cloned) |
| RLS | 109 tables | 109 tables |
| Data | Real hospital data | Test data only |

## Staging Credentials
| Role | Email | Password |
|---|---|---|
| Admin | staging-admin@health1.in | Staging@Admin2026 |
| Doctor | staging-doctor@health1.in | Staging@Doctor2026 |

## Development Workflow

### For new features:
```
1. git checkout staging
2. Make changes
3. git commit + git push origin staging
4. Vercel auto-deploys staging preview
5. Test on staging URL with staging credentials
6. Once verified, merge to main:
   git checkout main
   git merge staging
   git push origin main
7. Vercel auto-deploys production
```

### For database changes (RLS, schema, migrations):
```
1. Write migration SQL in sql/ folder
2. Apply to STAGING Supabase first (pcldnxssdxwxhwmasdhv)
3. Test with staging-admin login — verify app loads, data shows, CRUD works
4. ONLY AFTER staging verification: apply to production (bmuupgrzbfmddjwcqlss)
5. NEVER apply bulk RLS/schema changes directly to production
```

### For hotfixes:
```
1. Fix on main directly (emergency only)
2. git push origin main (auto-deploys production)
3. Cherry-pick fix into staging: git checkout staging && git cherry-pick <hash>
```

## Environment Variables (Vercel)
Configured per-branch in Vercel project settings:

### Production (branch: main)
- NEXT_PUBLIC_SUPABASE_URL = https://bmuupgrzbfmddjwcqlss.supabase.co
- NEXT_PUBLIC_SUPABASE_ANON_KEY = (production anon key)
- SUPABASE_SERVICE_ROLE_KEY = (production service role key)

### Staging (branch: staging)
- NEXT_PUBLIC_SUPABASE_URL = https://pcldnxssdxwxhwmasdhv.supabase.co
- NEXT_PUBLIC_SUPABASE_ANON_KEY = (staging anon key)
- SUPABASE_SERVICE_ROLE_KEY = (staging service role key)

## Rules
1. **NEVER** apply database changes to production without testing on staging first
2. **NEVER** bulk-apply RLS policies — test each one against a real user session
3. All schema migrations go in `sql/` folder with descriptive names
4. Git committer must be set to `drkeyurpatel-wq` for Vercel deploys
