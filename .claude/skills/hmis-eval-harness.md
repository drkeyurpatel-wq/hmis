---
name: hmis-eval-harness
description: "Automated patient safety evaluation for HMIS EMR changes. Runs CDSS accuracy tests, drug interaction verification, clinical workflow validation, and PHI exposure checks before any deployment."
version: "1.0.0"
observe: "PostToolUse"
feedback: "manual"
rollback: "git revert"
---

# HMIS Eval Harness — Patient Safety Verification

## Purpose

Every HMIS deployment must pass this eval harness. A single failure in the CRITICAL category blocks deployment. This is not optional — patient safety is non-negotiable.

## Eval Categories

### 1. CDSS Accuracy (CRITICAL)

```
Test Suite: cdss-accuracy
Pass Criteria: 100% (zero tolerance for false negatives)
```

| Test | Input | Expected | Category |
|------|-------|----------|----------|
| NEWS2 score = 0 | All vitals normal | risk: 'low', total: 0 | Scoring |
| NEWS2 score = 7+ | Critical vitals | risk: 'critical', escalation alert | Scoring |
| Drug interaction: Warfarin + Aspirin | Both prescribed | CRITICAL alert, block by default | Safety |
| Drug interaction: Metformin + Contrast | Both present | MAJOR alert, require override reason | Safety |
| Dose validation: Paracetamol 5g | Adult patient | BLOCK — exceeds max 4g/day | Safety |
| Dose validation: Paracetamol 1g | Adult patient | PASS — within range | Safety |
| No false negative | Known interaction pair | Alert MUST fire | Safety |
| No silent failure | Malformed drug data | Graceful error, NOT silent pass | Safety |

**Implementation:**

```typescript
// tests/cdss/accuracy.test.ts
describe('CDSS Accuracy — Patient Safety', () => {

  // Test all 20 drug interaction pairs
  DRUG_INTERACTION_PAIRS.forEach(([drugA, drugB, severity]) => {
    it(`detects ${drugA} + ${drugB} interaction (${severity})`, () => {
      const alerts = checkInteractions(drugA, [drugB]);
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].severity).toBe(severity);
    });
  });

  // Test all 19 dose validation rules
  DOSE_VALIDATION_RULES.forEach((rule) => {
    it(`validates dose: ${rule.drug} ${rule.scenario}`, () => {
      const result = validateDose(rule.drug, rule.dose, rule.route, rule.weight, rule.age);
      expect(result.valid).toBe(rule.expectedValid);
    });
  });

  // NEWS2 scoring
  NEWS2_TEST_CASES.forEach((testCase) => {
    it(`NEWS2: ${testCase.description}`, () => {
      const score = calculateNEWS2(testCase.vitals);
      expect(score.total).toBe(testCase.expectedTotal);
      expect(score.risk).toBe(testCase.expectedRisk);
    });
  });
});
```

### 2. Data Integrity (CRITICAL)

```
Test Suite: data-integrity
Pass Criteria: 100%
```

| Test | Verification |
|------|-------------|
| Encounter lock prevents edits | Locked encounter → UPDATE returns error |
| Audit trail on every write | INSERT/UPDATE/DELETE → audit_log entry exists |
| Patient ID consistency | No orphaned records across tables |
| Cascade delete protection | DELETE patient → blocked (no cascading PHI deletion) |
| Concurrent edit detection | Two users editing same encounter → conflict resolution |

### 3. PHI Exposure (CRITICAL)

```
Test Suite: phi-exposure
Pass Criteria: 100%
```

| Test | Check |
|------|-------|
| API responses | No PHI in error messages or stack traces |
| Console output | No patient data in console.log |
| URL parameters | No PHI in query strings or path params |
| Local storage | No PHI stored in browser storage |
| RLS enforcement | Unauthenticated requests return 0 patient rows |
| Cross-centre isolation | User from Centre A cannot see Centre B patients |

**Implementation:**

```typescript
// tests/security/phi-exposure.test.ts
describe('PHI Exposure — Zero Tolerance', () => {

  it('API error responses contain no PHI', async () => {
    const response = await fetch('/api/patients/invalid-id');
    const body = await response.json();
    const bodyStr = JSON.stringify(body);
    PHI_PATTERNS.forEach(pattern => {
      expect(bodyStr).not.toMatch(pattern);
    });
  });

  it('cross-centre isolation works', async () => {
    const centreAUser = await loginAs('doctor-centre-a');
    const patients = await supabase
      .from('patients')
      .select('*')
      .eq('centre_id', 'centre-b-id');
    expect(patients.data).toHaveLength(0);
  });
});
```

### 4. Clinical Workflow (HIGH)

```
Test Suite: clinical-workflow
Pass Criteria: 95%+ (5% tolerance for edge cases)
```

| Test | Scenario |
|------|----------|
| Complete encounter flow | Complaint → Exam → Diagnosis → Rx → Lock |
| Smart Complaint Builder | All 12 templates render and submit correctly |
| Smart Exam Builder | All 6 systems render and submit correctly |
| Medication Set selection | All 10 templates populate correctly |
| Drug search | Finds all 50+ Indian drugs by brand and generic name |
| ICD-10 search | Finds all 55 codes by code and description |
| Print Rx PDF | Generates valid PDF with correct patient data |
| Red flag alerts | Red flag symptoms trigger non-dismissable alert |

### 5. HL7 Integration (HIGH)

```
Test Suite: hl7-integration
Pass Criteria: 95%+
```

| Test | Verification |
|------|-------------|
| Mindray BC-5000 message parsing | Valid HL7 v2.3.1 → structured result |
| Patient ID matching | HL7 PID segment maps to correct patient |
| Result display | Lab values show with normal range highlighting |
| Malformed message handling | Invalid HL7 → logged error, NOT crash |
| MLLP framing | Start/end bytes correctly handled |

## Running the Eval Harness

```bash
# Full eval (run before any deployment)
npx jest --testPathPattern='tests/(cdss|security|clinical|hl7)' --coverage

# Quick eval (run during development)
npx jest --testPathPattern='tests/cdss/accuracy' --coverage

# CI gate (blocks deployment on failure)
npx jest --testPathPattern='tests/(cdss|security)' --bail --ci
```

## Pass/Fail Matrix

| Category | Pass Threshold | Deployment Impact |
|----------|---------------|-------------------|
| CDSS Accuracy | 100% | BLOCK on any failure |
| Data Integrity | 100% | BLOCK on any failure |
| PHI Exposure | 100% | BLOCK on any failure |
| Clinical Workflow | 95%+ | WARN below threshold |
| HL7 Integration | 95%+ | WARN below threshold |

## Eval Report Format

```
## HMIS Eval: [date] [commit hash]

### Patient Safety: [PASS / FAIL]

| Category | Tests | Passed | Failed | Status |
|----------|-------|--------|--------|--------|
| CDSS Accuracy | 39 | 39 | 0 | ✅ PASS |
| Data Integrity | 12 | 12 | 0 | ✅ PASS |
| PHI Exposure | 8 | 8 | 0 | ✅ PASS |
| Clinical Workflow | 22 | 21 | 1 | ⚠️ 95.5% |
| HL7 Integration | 6 | 6 | 0 | ✅ PASS |

### Coverage: 84% (target: 80%+)

### Verdict: SAFE TO DEPLOY / BLOCKED
```
