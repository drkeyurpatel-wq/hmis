---
name: supabase-rls-patterns
description: "Row-Level Security patterns for Health1 Supabase applications. Covers PHI/PII tables, role-based access, and common pitfalls."
version: "1.0.0"
observe: "PostToolUse"
feedback: "manual"
rollback: "git revert"
---

# Supabase RLS Patterns — Health1

## Principle

Every table containing PHI, PII, or sensitive business data MUST have RLS enabled with explicit policies. No exceptions.

## PHI Tables (HMIS)

```sql
-- Enable RLS
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- Authenticated clinical staff can read patients at their centre
CREATE POLICY "clinical_staff_read_patients"
  ON patients FOR SELECT
  TO authenticated
  USING (
    centre_id IN (
      SELECT centre_id FROM staff_assignments
      WHERE user_id = auth.uid()
      AND role IN ('doctor', 'nurse', 'lab_tech', 'admin')
    )
  );

-- Only doctors can update clinical notes
CREATE POLICY "doctors_update_clinical"
  ON clinical_notes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_assignments
      WHERE user_id = auth.uid()
      AND role = 'doctor'
      AND centre_id = clinical_notes.centre_id
    )
  );

-- Audit trail: insert-only, no updates or deletes
CREATE POLICY "audit_insert_only"
  ON audit_log FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Block all other operations on audit
CREATE POLICY "audit_no_update" ON audit_log FOR UPDATE USING (false);
CREATE POLICY "audit_no_delete" ON audit_log FOR DELETE USING (false);
```

## PII Tables (MedPay / HRMS)

```sql
-- Doctor payouts: only finance team and the doctor themselves
CREATE POLICY "doctor_payout_read"
  ON doctor_payouts FOR SELECT
  TO authenticated
  USING (
    doctor_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM staff_assignments
      WHERE user_id = auth.uid()
      AND role IN ('finance', 'admin', 'md')
    )
  );

-- Employee salary: only HR, finance, and the employee
CREATE POLICY "salary_read"
  ON employee_salary FOR SELECT
  TO authenticated
  USING (
    employee_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM staff_assignments
      WHERE user_id = auth.uid()
      AND role IN ('hr', 'finance', 'admin', 'md')
    )
  );
```

## Common Pitfalls

### 1. Forgetting to enable RLS on new tables

Every `CREATE TABLE` must be followed by `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`. Without this, the table is wide open.

### 2. Using service_role in client code

```typescript
// ❌ NEVER — bypasses all RLS
const supabase = createClient(url, SERVICE_ROLE_KEY);

// ✅ ALWAYS — respects RLS
const supabase = createClient(url, ANON_KEY);
```

### 3. Overly permissive policies

```sql
-- ❌ BAD — allows any authenticated user to read all patients
CREATE POLICY "read_all" ON patients FOR SELECT
  TO authenticated USING (true);

-- ✅ GOOD — scoped to user's assigned centre
CREATE POLICY "read_own_centre" ON patients FOR SELECT
  TO authenticated
  USING (centre_id IN (
    SELECT centre_id FROM staff_assignments WHERE user_id = auth.uid()
  ));
```

### 4. Missing policies = blocked access

If RLS is enabled but no policy exists for an operation, it's blocked. This is the safe default. Always test after adding RLS.

### 5. Schema drift with TypeScript types

After any schema change:
```bash
npx supabase gen types typescript --project-id <id> > src/types/supabase.ts
```

Then verify all queries still compile.

## Testing RLS

```sql
-- Test as a specific user
SET request.jwt.claims = '{"sub": "user-uuid-here", "role": "authenticated"}';
SELECT * FROM patients; -- should only return their centre's patients

-- Reset
RESET request.jwt.claims;
```

## Health1 Centre IDs

Always scope RLS by centre_id. The 5 centres:
- Shilaj (flagship)
- Vastral
- Modasa
- Udaipur
- Gandhinagar
