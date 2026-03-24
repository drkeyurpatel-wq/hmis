# SNOMED CT Terminology Server — Setup Guide

**Status:** FOR LATER — deploy when NHCX sandbox is approved
**Source:** github.com/wardle/hermes (EPL 1.0)

## Current State
- CDSS engine: 55 ICD-10 codes (hardcoded in `lib/cdss/diagnoses.ts`)
- Drug DB: 50+ Indian drugs (hardcoded in `lib/cdss/medications.ts`)
- SmartText: matches against these local arrays

## When You Need This
- NHCX sandbox registration approved (HFR ID: IN2410013685)
- Need >200 clinical codes
- ABDM requires SNOMED CT for interoperability

## Quick Start (No Infrastructure Needed)

Use SNOMED International's free public API for prototyping:

```typescript
// lib/terminology/snomed-search.ts

const SNOWSTORM_URL = 'https://browser.ihtsdotools.org/snowstorm/snomed-ct';

export async function searchSNOMED(query: string, limit = 10) {
  if (query.length < 3) return [];
  
  const res = await fetch(
    `${SNOWSTORM_URL}/MAIN/concepts?` +
    `term=${encodeURIComponent(query)}&` +
    `activeFilter=true&` +
    `limit=${limit}`,
    { headers: { 'Accept-Language': 'en' } }
  );
  
  if (!res.ok) return [];
  const data = await res.json();
  
  return data.items?.map((item: any) => ({
    conceptId: item.conceptId,
    term: item.pt?.term || item.fsn?.term,
    semanticTag: item.fsn?.term?.match(/\(([^)]+)\)$/)?.[1] || '',
  })) || [];
}

// Get ICD-10 mapping for a SNOMED concept
export async function getICD10Map(snomedConceptId: string) {
  const res = await fetch(
    `${SNOWSTORM_URL}/MAIN/concepts/${snomedConceptId}/` +
    `maps?referenceSetId=447562003`, // ICD-10 refset
    { headers: { 'Accept-Language': 'en' } }
  );
  if (!res.ok) return null;
  return res.json();
}
```

## Self-Hosted (When Ready)

### Docker Setup
```bash
# 1. Download SNOMED CT from mlds.ihtsdotools.org (India has national license)
# 2. Index (one-time, ~10 min)
docker run -v /data/snomed:/snomed -v /data/hermes-db:/db \
  ghcr.io/wardle/hermes:latest --db /db index --dist /snomed

# 3. Run
docker run -d --name hermes -p 8080:8080 -v /data/hermes-db:/db \
  ghcr.io/wardle/hermes:latest --db /db serve --port 8080
```

### Integration with SmartText
Replace local array search with Hermes API call in `components/emr-v2/smart-text.tsx`.

### Resources
- RAM: 512MB–1GB
- Disk: ~2GB indexed
- Location: Shilaj LAN (same as middleware PC)
