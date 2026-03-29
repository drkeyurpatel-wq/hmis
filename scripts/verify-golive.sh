#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Health1 HMIS — Go-Live Verification Script
# Run after deploying to verify everything is working
# ═══════════════════════════════════════════════════════════════

set -e
echo "╔═══════════════════════════════════════════════╗"
echo "║   Health1 HMIS — Go-Live Verification         ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""

PASS=0
FAIL=0
WARN=0

check() {
  if [ "$1" = "PASS" ]; then printf "  ✅ %s\n" "$2"; PASS=$((PASS+1));
  elif [ "$1" = "FAIL" ]; then printf "  ❌ %s\n" "$2"; FAIL=$((FAIL+1));
  else printf "  ⚠️  %s\n" "$2"; WARN=$((WARN+1)); fi
}

echo "1. BUILD"
echo "────────"
TS_ERRORS=$(npx tsc --noEmit 2>&1 | grep "error TS" | wc -l)
[ "$TS_ERRORS" -eq 0 ] && check PASS "TypeScript: 0 errors" || check FAIL "TypeScript: $TS_ERRORS errors"

BUILD_OK=$(npx next build 2>&1 | grep -c "✓ Generating")
[ "$BUILD_OK" -gt 0 ] && check PASS "Production build: clean" || check FAIL "Production build: FAILED"

PAGES=$(find app -name "page.tsx" | wc -l)
check PASS "Pages: $PAGES"

echo ""
echo "2. SECURITY"
echo "───────────"
SERVICE_IN_CLIENT=$(grep -rn "service_role" --include="*.tsx" lib/ components/ 2>/dev/null | wc -l)
[ "$SERVICE_IN_CLIENT" -eq 0 ] && check PASS "No service_role in client code" || check FAIL "service_role found in client: $SERVICE_IN_CLIENT"

PHI_IN_LOGS=$(grep -rn "console\.log.*patient\|console\.log.*name\|console\.log.*phone" --include="*.tsx" --include="*.ts" app/ components/ lib/ 2>/dev/null | grep -v tests | wc -l)
[ "$PHI_IN_LOGS" -eq 0 ] && check PASS "No PHI in console.log" || check WARN "Potential PHI in logs: $PHI_IN_LOGS"

HARDCODED_SECRETS=$(grep -rn "eyJ[a-zA-Z0-9_-]\{20,\}\|ghp_[a-zA-Z0-9]\{36\}\|sk-[a-zA-Z0-9]\{20,\}" --include="*.ts" --include="*.tsx" app/ components/ lib/ 2>/dev/null | grep -v ".claude/hooks" | grep -v "logo.ts" | wc -l)
[ "$HARDCODED_SECRETS" -eq 0 ] && check PASS "No hardcoded secrets" || check FAIL "Hardcoded secrets: $HARDCODED_SECRETS"

IGNORE_BUILD=$(grep -c "ignoreBuildErrors.*true" next.config.js 2>/dev/null)
[ "$IGNORE_BUILD" -eq 0 ] && check PASS "ignoreBuildErrors: removed" || check FAIL "ignoreBuildErrors still true!"

echo ""
echo "3. BRANDING"
echo "───────────"
HOSPITAL_HARDCODED=$(grep -rn "'Hospital'" --include="*.tsx" --include="*.ts" app/ components/ lib/ 2>/dev/null | grep -v "hospital.ts\|hospital_name\|hospitalCourse\|Hospital Course\|hospital physician\|in hospital\|hospital stay\|Hospitalization\|referring_hospital\|fhir-bundles\|hospital.ts" | wc -l)
[ "$HOSPITAL_HARDCODED" -eq 0 ] && check PASS "No hardcoded 'Hospital' text" || check WARN "Hardcoded Hospital: $HOSPITAL_HARDCODED"

LOGO_FILE=$([ -f "public/images/health1-logo.svg" ] && echo 1 || echo 0)
[ "$LOGO_FILE" -eq 1 ] && check PASS "Logo SVG exists" || check FAIL "Logo SVG missing"

LOGO_TRANSPARENT=$([ -f "public/images/health1-logo-transparent.png" ] && echo 1 || echo 0)
[ "$LOGO_TRANSPARENT" -eq 1 ] && check PASS "Transparent PNG exists" || check FAIL "Transparent PNG missing"

LOGO_CONFIG=$([ -f "lib/config/logo.ts" ] && echo 1 || echo 0)
[ "$LOGO_CONFIG" -eq 1 ] && check PASS "Logo config module exists" || check FAIL "lib/config/logo.ts missing"

HOSPITAL_CONFIG=$([ -f "lib/config/hospital.ts" ] && echo 1 || echo 0)
[ "$HOSPITAL_CONFIG" -eq 1 ] && check PASS "Hospital config module exists" || check FAIL "lib/config/hospital.ts missing"

echo ""
echo "4. MODULES"
echo "──────────"
SIDEBAR_COUNT=$(grep -c "href: '/" components/layout/sidebar.tsx 2>/dev/null)
check PASS "Sidebar nav items: $SIDEBAR_COUNT"

CMDPAL_COUNT=$(grep -c "category: 'navigation'" components/ui/command-palette.tsx 2>/dev/null)
check PASS "Command palette items: $CMDPAL_COUNT"

MISSING_SIDEBAR=0
for mod in blood-bank cathlab dialysis endoscopy physiotherapy cssd housekeeping duty-roster biomedical equipment-lifecycle linen infection-control dietary ambulance mortuary visitors grievances quality documents assets referrals digital-consent surgical-planning crm homecare telemedicine voice-notes pulse command-centre pnl revenue-leakage px-coordinator px-feedback px-kitchen px-nursing handover onboarding packages emr-mobile vpms staff accounting bed-turnover; do
  found=$(grep -c "/$mod'" components/layout/sidebar.tsx 2>/dev/null)
  [ "$found" -eq 0 ] && MISSING_SIDEBAR=$((MISSING_SIDEBAR+1))
done
[ "$MISSING_SIDEBAR" -eq 0 ] && check PASS "All 43 Phase 2 modules in sidebar" || check FAIL "$MISSING_SIDEBAR modules missing from sidebar"

echo ""
echo "5. DATABASE REFERENCES"
echo "──────────────────────"
TOTAL_TABLES=$(grep -rn "from('hmis_" lib/ app/ components/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | grep -oP "from\('hmis_[a-z_]+'\)" | sort -u | wc -l)
check PASS "Unique tables referenced: $TOTAL_TABLES"

UNRESOLVED=0
for table in $(grep -rn "from('hmis_" lib/ app/ components/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | grep -oP "from\('hmis_[a-z_]+'\)" | sort -u | sed "s/from('//;s/')//"); do
  found=$(grep -cl "$table" sql/REBUILD_FULL.sql sql/RUN_ALL_MIGRATIONS.sql sql/PHASE2_COMPLETE.sql 2>/dev/null | wc -l)
  [ "$found" -eq 0 ] && UNRESOLVED=$((UNRESOLVED+1))
done
[ "$UNRESOLVED" -eq 0 ] && check PASS "All $TOTAL_TABLES tables resolved in SQL" || check FAIL "$UNRESOLVED tables have no migration"

WRONG_TABLES=$(grep -rn "from('hmis_ipd_admissions')\|from('hmis_encounters')" --include="*.ts" --include="*.tsx" app/ lib/ components/ 2>/dev/null | grep -v node_modules | wc -l)
[ "$WRONG_TABLES" -eq 0 ] && check PASS "No wrong table names" || check FAIL "$WRONG_TABLES wrong table names"

echo ""
echo "6. SQL MIGRATIONS READY"
echo "───────────────────────"
for sql in sql/RUN_ALL_MIGRATIONS.sql sql/PHASE2_COMPLETE.sql sql/DAY1_RLS_CRITICAL.sql sql/DAY1_AUDIT_TRIGGERS.sql; do
  if [ -f "$sql" ]; then
    lines=$(wc -l < "$sql")
    check PASS "$(basename $sql) ($lines lines)"
  else
    check FAIL "$(basename $sql) MISSING"
  fi
done

echo ""
echo "═══════════════════════════════════════"
echo "RESULTS: $PASS passed, $FAIL failed, $WARN warnings"
echo "═══════════════════════════════════════"
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
