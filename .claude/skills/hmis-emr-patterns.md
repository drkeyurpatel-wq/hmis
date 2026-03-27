---
name: hmis-emr-patterns
description: "EMR development patterns for Health1 HMIS. Clinical safety, CDSS integration, Smart Builders, and UX patterns targeting 9/10 quality (Practo/eka.care level)."
---

# HMIS EMR Patterns — Health1

## Target: 9/10 Quality (Practo/eka.care Level)

### Core UX Principles

1. **Single-page vertical flow** — no tab switching during patient encounter
2. **Voice-to-text** — for clinical notes (Web Speech API)
3. **Smart diagnosis-driven autofill** — selecting ICD-10 code pre-populates templates
4. **Print-ready Rx PDF** — one click, no reformatting
5. **Speed** — page load <2s, interaction response <200ms

### EMR Page Structure

```
Patient Header (sticky)
├── Demographics + allergies + active meds (always visible)
│
Encounter Flow (vertical scroll)
├── 1. Chief Complaint (Smart Complaint Builder — 12 templates)
├── 2. History of Present Illness (voice-to-text + structured)
├── 3. Examination (Smart Exam Builder — 6 systems)
├── 4. Vitals (auto-trigger NEWS2 scoring via CDSS)
├── 5. Diagnosis (ICD-10 search — 55 codes in system)
├── 6. Medications (Drug DB — 50+ Indian drugs, interaction check)
├── 7. Medication Sets (10 pre-built templates)
├── 8. Investigations (lab orders, radiology)
├── 9. Plan & Follow-up
└── 10. Print/Sign/Lock
```

## CDSS Integration Points

### Vitals → NEWS2 Auto-Score

When vitals are entered, immediately run NEWS2:
```typescript
import { calculateNEWS2 } from '@/lib/cdss/engine';

const score = calculateNEWS2({
  respiratoryRate,
  oxygenSaturation,
  supplementalOxygen,
  temperature,
  systolicBP,
  heartRate,
  consciousness
});

// score.total: 0-20
// score.risk: 'low' | 'medium' | 'high' | 'critical'
// score.escalation: string (recommended action)
```

Display escalation alert inline — NOT as a dismissable toast.

### Medication → Drug Interaction Check

When adding a medication, check against:
1. Current medications (from patient record)
2. New medications (from this encounter)
3. Known allergies

```typescript
import { checkInteractions } from '@/lib/cdss/engine';

const alerts = checkInteractions(newDrug, [...currentMeds, ...encounterMeds]);
// alerts: { severity: 'critical' | 'major' | 'minor', pair: [Drug, Drug], message: string }[]
```

**Critical interactions MUST block prescribing** — require explicit override with documented reason.

### Dose Validation

```typescript
import { validateDose } from '@/lib/cdss/engine';

const result = validateDose(drug, dose, route, patientWeight, patientAge);
// result: { valid: boolean, message: string, suggestedRange: string }
```

## Smart Complaint Builder Pattern

12 templates, each with:
- Clickable chips for common symptoms
- Free text field for additional details
- Duration picker (onset, frequency)
- Severity scale (1-10)

```typescript
interface ComplaintTemplate {
  id: string;
  name: string;              // e.g., "Chest Pain"
  chips: string[];           // e.g., ["substernal", "radiating to left arm", "crushing"]
  requiredFields: string[];  // e.g., ["onset", "duration", "severity"]
  redFlags: string[];        // triggers immediate alert
}
```

**Red flags** in any template must trigger a visible, non-dismissable alert.

## Smart Exam Builder Pattern

6 systems, each with:
- Normal/abnormal toggle per finding
- Structured findings with dropdowns
- Free text for detailed description
- Auto-generate summary paragraph

Systems: General, CVS, Respiratory, Per Abdomen, CNS, Musculoskeletal.

## Medication Set Templates

10 pre-built sets for common conditions. When selected:
1. Pre-populate all medications with default doses
2. Run interaction check against current medications
3. Allow individual adjustment before confirming
4. Log which template was used (for analytics)

## Audit Trail Requirements

Every clinical action must be logged:
```typescript
interface AuditEntry {
  timestamp: string;
  user_id: string;
  patient_id: string;
  action: 'create' | 'update' | 'view' | 'print' | 'lock' | 'unlock';
  resource: string;       // e.g., "encounter", "prescription", "lab_order"
  resource_id: string;
  changes?: object;       // before/after for updates
  ip_address: string;
}
```

**Locked encounters cannot be edited** — only addendum is allowed.

## HL7 Integration (Mindray BC-5000)

```
Instrument → TCP:5100 (MLLP) → Middleware → Supabase → EMR display
```

Lab results auto-populate into the encounter when available. Display with:
- Normal range highlighting (green/yellow/red)
- Previous value comparison (trend arrow)
- Timestamp of collection and analysis
