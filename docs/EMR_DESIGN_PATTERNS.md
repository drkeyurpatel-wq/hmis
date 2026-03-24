# EMR Design Patterns — Reference for 9/10 UX Target

Source: **Inspired EHRs** (github.com/goinvo/EHR, inspiredehrs.org)
+ **Medplum Charting** (medplum.com/docs/charting)

## Priority Patterns for Health1 HMIS EMR Rebuild

### 1. Medication List (Prescription Builder)
**File:** `components/emr-v2/prescription-builder.tsx` (402 lines)

Adopt from Inspired EHR:
- **Active/Discontinued visual split** — grey out stopped meds, bold active ones
- **Brand ↔ Generic toggle** — your Drug DB already has both (e.g., Ecosprin ↔ Aspirin)
- **Interaction warnings inline** — CDSS engine has 20 drug pairs, show them IN the list
- **Dose history sparkline** — mini chart showing last 3 dose changes per med

### 2. Diagnosis / Problem List (Diagnosis Builder)
**File:** `components/emr-v2/diagnosis-builder.tsx` (56 lines)

Adopt from Inspired EHR:
- **Active / Inactive / Resolved** status with dates (currently only primary/secondary/differential)
- **Hierarchy grouping** — nest related: "Diabetes" → "Diabetic Retinopathy" → "Diabetic Nephropathy"
- **ICD-10 search + SmartText** — wire `smart-text.tsx` into diagnosis builder

### 3. Vitals Panel with NEWS2 Badge
**File:** `components/emr-v2/vitals-panel.tsx` (120 lines)

Adopt from Inspired EHR:
- **Sparkline trends** — 7-day BP/HR/SpO2 inline mini-charts
- **NEWS2 color-coded badge** — your CDSS `lib/cdss/news2.ts` calculates this; show as:
  - 🟢 0-4 (Low) | 🟡 5-6 (Medium) | 🔴 7+ (High)
- **Abnormal cell highlighting** — red background for critical values
- **Table ↔ Chart toggle** — let clinician switch view

### 4. Patient Timeline (NEW — not built yet)

Create: `components/emr-v2/patient-timeline.tsx`

From Medplum charting docs:
- **Swim lanes**: Encounters | Labs | Medications | Procedures | Radiology
- **Zoom**: Day → Week → Month → Year
- **Multi-centre**: Shilaj + Vastral + Modasa encounters on ONE timeline
- Use `PatientTimeline` pattern from Medplum React components

### 5. Clinical Notes / Encounter Form
**File:** `components/emr-v2/ai-copilot.tsx` (443 lines)

Adopt from Inspired EHR:
- **Copy forward** — pull last encounter's assessment as starting point
- **Dot phrases** — ".htn" expands to hypertension assessment template
  (leverages `lib/cdss/complaint-templates.ts` which already has HPI chips)
- **Side-by-side** — previous encounter on left, current on right

### 6. Discharge Summary
**File:** `components/emr-v2/discharge-form.tsx` (188 lines)

Adopt:
- **Auto-populate from encounter** — pull confirmed diagnoses, medications, labs
- **Follow-up scheduling** — wire into appointments module
- **Patient-facing version** — simplified language for patient portal

## Design Principles (Apply Everywhere)

| Principle | Implementation |
|-----------|---------------|
| Progressive disclosure | Summary view → click to expand |
| Scan in <30 seconds | Key info visible without scrolling |
| Color = meaning | Red=critical, Yellow=warning, Green=normal, Grey=inactive |
| No dead-end modals | Every alert offers an action, not just "OK" |
| Touch-friendly | 44px min tap targets (ward round tablets) |
| Dark mode | ICU/night shift clinicians need this |

## Health Icons Integration

Use `HealthIcon` component from `components/ui/health-icon.tsx` in:
- Department sidebar navigation
- Module headers (Lab → microscope, OT → surgery, Pharmacy → pills)
- Patient banner (gender, age group icons)
- Dashboard cards

```tsx
import HealthIcon from '@/components/ui/health-icon';

// In sidebar
<HealthIcon name="specialties/cardiology" size={18} />

// In patient banner
<HealthIcon name="body/heart" size={16} variant="filled" />
```

## Resources

- **Inspired EHRs Book**: inspiredehrs.org (free, open source)
- **Medplum Charting Docs**: medplum.com/docs/charting
- **Medplum Storybook**: storybook.medplum.com (live component demos)
- **Health Icons**: healthicons.org (browse all 1000+ icons)
