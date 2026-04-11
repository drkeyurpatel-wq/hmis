#!/bin/bash
# Health1 ECC v4 — Pre-push security check
echo "🔒 Running H1 security pre-push scan..."
if grep -rn "supabase_service_role\|SUPABASE_SERVICE_ROLE_KEY\|sk_live\|Bearer eyJ" --include="*.ts" --include="*.tsx" --include="*.js" src/ 2>/dev/null; then
  echo "❌ BLOCKED: Hardcoded secrets found. Remove before pushing."
  exit 1
fi
if grep -rn "console.log.*password\|console.log.*token\|console.log.*secret" --include="*.ts" --include="*.tsx" src/ 2>/dev/null; then
  echo "⚠️  WARNING: console.log with potentially sensitive data found."
fi
echo "✅ Security pre-push scan passed."
