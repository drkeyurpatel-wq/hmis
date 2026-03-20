// lib/cdss/ml-engine.ts
// Machine Learning Engine for Complaint Template Evolution
//
// HOW IT WORKS:
// 1. TRACK: Every time a doctor fills a complaint, we record which attributes
//    they actually used, which they skipped, and what free-text they added.
// 2. SCORE: Each attribute gets a "usage score" per complaint per doctor.
//    Attributes used frequently get promoted. Attributes always skipped get demoted.
// 3. EVOLVE: When a doctor starts a complaint, attributes are sorted by their
//    personal usage score. High-score attributes show first. Low-score ones
//    collapse into "More questions". New free-text patterns get promoted to chips.
// 4. LEARN: Over time, if 3+ doctors add the same free-text (e.g., "after COVID"),
//    it gets proposed as a new chip option for that attribute.
//
// Storage: Supabase table `hmis_cdss_usage` + client-side IndexedDB for offline

import { createBrowserClient } from '@supabase/ssr';

function sb() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

// ============================================================
// TYPES
// ============================================================
export interface UsageEvent {
  complaint_name: string;
  doctor_id: string;
  centre_id: string;
  attributes_used: string[];       // keys of attributes that were filled
  attributes_skipped: string[];    // keys of attributes left empty
  chip_selections: Record<string, string[]>;  // which chips were selected per attribute
  free_text_entries: Record<string, string>;  // free text added per attribute
  time_spent_ms: number;           // how long the doctor spent on this complaint
  timestamp: string;
}

export interface AttributeScore {
  attribute_key: string;
  usage_count: number;
  skip_count: number;
  score: number;                   // usage_count / (usage_count + skip_count)
  top_chips: string[];             // most selected chip options (sorted by frequency)
  suggested_chips: string[];       // free-text entries that appeared 3+ times
}

export interface TemplateEvolution {
  complaint_name: string;
  doctor_id: string;               // 'global' for all-doctor aggregate
  attribute_scores: AttributeScore[];
  total_encounters: number;
  last_updated: string;
}

// ============================================================
// TRACK — record every encounter
// ============================================================
export async function trackComplaintUsage(event: UsageEvent): Promise<void> {
  try {
    await sb().from('hmis_cdss_usage').insert({
      complaint_name: event.complaint_name,
      doctor_id: event.doctor_id,
      centre_id: event.centre_id,
      attributes_used: event.attributes_used,
      attributes_skipped: event.attributes_skipped,
      chip_selections: event.chip_selections,
      free_text_entries: event.free_text_entries,
      time_spent_ms: event.time_spent_ms,
    });
  } catch {
    // Save to IndexedDB for offline sync
    saveToOfflineQueue(event);
  }
}

// ============================================================
// SCORE — calculate attribute scores for a doctor + complaint
// ============================================================
export async function getAttributeScores(
  complaintName: string,
  doctorId: string
): Promise<AttributeScore[]> {
  // Try cache first
  const cacheKey = `cdss_scores_${doctorId}_${complaintName}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) {
    const parsed = JSON.parse(cached);
    if (Date.now() - parsed.ts < 300000) return parsed.scores; // 5 min cache
  }

  const { data } = await sb().from('hmis_cdss_usage')
    .select('attributes_used, attributes_skipped, chip_selections, free_text_entries')
    .eq('complaint_name', complaintName)
    .eq('doctor_id', doctorId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (!data || data.length === 0) {
    // No personal data — try global scores
    return getGlobalScores(complaintName);
  }

  const scores = computeScores(data);

  sessionStorage.setItem(cacheKey, JSON.stringify({ scores, ts: Date.now() }));
  return scores;
}

async function getGlobalScores(complaintName: string): Promise<AttributeScore[]> {
  const { data } = await sb().from('hmis_cdss_usage')
    .select('attributes_used, attributes_skipped, chip_selections, free_text_entries')
    .eq('complaint_name', complaintName)
    .order('created_at', { ascending: false })
    .limit(500);

  if (!data || data.length === 0) return [];
  return computeScores(data);
}

function computeScores(data: any[]): AttributeScore[] {
  const attrMap: Record<string, { used: number; skipped: number; chips: Record<string, number>; freeTexts: Record<string, number> }> = {};

  for (const row of data) {
    const used: string[] = row.attributes_used || [];
    const skipped: string[] = row.attributes_skipped || [];
    const chips: Record<string, string[]> = row.chip_selections || {};
    const freeText: Record<string, string> = row.free_text_entries || {};

    for (const attr of used) {
      if (!attrMap[attr]) attrMap[attr] = { used: 0, skipped: 0, chips: {}, freeTexts: {} };
      attrMap[attr].used++;
      // Count chip selections
      if (chips[attr]) {
        for (const chip of chips[attr]) {
          attrMap[attr].chips[chip] = (attrMap[attr].chips[chip] || 0) + 1;
        }
      }
      // Count free text
      if (freeText[attr]) {
        const normalized = freeText[attr].toLowerCase().trim();
        if (normalized.length > 2) {
          attrMap[attr].freeTexts[normalized] = (attrMap[attr].freeTexts[normalized] || 0) + 1;
        }
      }
    }
    for (const attr of skipped) {
      if (!attrMap[attr]) attrMap[attr] = { used: 0, skipped: 0, chips: {}, freeTexts: {} };
      attrMap[attr].skipped++;
    }
  }

  return Object.entries(attrMap).map(([key, val]) => ({
    attribute_key: key,
    usage_count: val.used,
    skip_count: val.skipped,
    score: val.used / Math.max(1, val.used + val.skipped),
    top_chips: Object.entries(val.chips)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([chip]) => chip),
    suggested_chips: Object.entries(val.freeTexts)
      .filter(([, count]) => count >= 3)  // 3+ doctors typed the same thing
      .sort((a, b) => b[1] - a[1])
      .map(([text]) => text),
  })).sort((a, b) => b.score - a.score);
}

// ============================================================
// EVOLVE — reorder attributes based on scores
// ============================================================
export function evolveTemplate(
  templateAttributes: Record<string, any>,
  scores: AttributeScore[]
): { primary: string[]; secondary: string[]; suggested_new_chips: Record<string, string[]> } {
  const scoreMap = new Map(scores.map(s => [s.attribute_key, s]));
  const allKeys = Object.keys(templateAttributes);

  // Split into primary (score > 0.4 or no data) and secondary (score <= 0.4)
  const primary: string[] = [];
  const secondary: string[] = [];
  const suggested_new_chips: Record<string, string[]> = {};

  for (const key of allKeys) {
    const s = scoreMap.get(key);
    if (!s) {
      primary.push(key); // No data = show by default
    } else if (s.score > 0.4) {
      primary.push(key);
    } else {
      secondary.push(key);
    }

    // Collect suggested chips from free text
    if (s?.suggested_chips?.length) {
      suggested_new_chips[key] = s.suggested_chips;
    }
  }

  // Sort primary by score descending
  primary.sort((a, b) => {
    const sa = scoreMap.get(a)?.score ?? 0.5;
    const sb = scoreMap.get(b)?.score ?? 0.5;
    return sb - sa;
  });

  return { primary, secondary, suggested_new_chips };
}

// ============================================================
// REORDER CHIP OPTIONS — most-selected first
// ============================================================
export function reorderChips(
  originalOptions: string[],
  topChips: string[],
  suggestedChips: string[]
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  // Top chips first (most selected by this doctor)
  for (const chip of topChips) {
    if (originalOptions.includes(chip) && !seen.has(chip)) {
      result.push(chip);
      seen.add(chip);
    }
  }

  // Suggested new chips (from free text, marked with ★)
  for (const chip of suggestedChips) {
    const capitalized = chip.charAt(0).toUpperCase() + chip.slice(1);
    if (!seen.has(capitalized) && !seen.has(chip)) {
      result.push(`★ ${capitalized}`);
      seen.add(capitalized);
    }
  }

  // Remaining original options
  for (const chip of originalOptions) {
    if (!seen.has(chip)) {
      result.push(chip);
      seen.add(chip);
    }
  }

  return result;
}

// ============================================================
// ANALYTICS — what are doctors doing?
// ============================================================
export async function getComplaintAnalytics(centreId: string): Promise<{
  topComplaints: { name: string; count: number }[];
  avgTimePerComplaint: Record<string, number>;
  mostSkippedAttributes: { complaint: string; attribute: string; skipRate: number }[];
  suggestedNewChips: { complaint: string; attribute: string; suggestion: string; count: number }[];
}> {
  const { data } = await sb().from('hmis_cdss_usage')
    .select('*')
    .eq('centre_id', centreId)
    .order('created_at', { ascending: false })
    .limit(1000);

  if (!data || data.length === 0) {
    return { topComplaints: [], avgTimePerComplaint: {}, mostSkippedAttributes: [], suggestedNewChips: [] };
  }

  // Top complaints
  const complaintCounts: Record<string, number> = {};
  const complaintTimes: Record<string, number[]> = {};

  for (const row of data) {
    complaintCounts[row.complaint_name] = (complaintCounts[row.complaint_name] || 0) + 1;
    if (!complaintTimes[row.complaint_name]) complaintTimes[row.complaint_name] = [];
    if (row.time_spent_ms) complaintTimes[row.complaint_name].push(row.time_spent_ms);
  }

  const topComplaints = Object.entries(complaintCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, count]) => ({ name, count }));

  const avgTimePerComplaint: Record<string, number> = {};
  for (const [name, times] of Object.entries(complaintTimes)) {
    avgTimePerComplaint[name] = Math.round(times.reduce((a, b) => a + b, 0) / times.length / 1000);
  }

  // Most skipped attributes
  const skipData: Record<string, Record<string, { used: number; skipped: number }>> = {};
  for (const row of data) {
    if (!skipData[row.complaint_name]) skipData[row.complaint_name] = {};
    for (const attr of (row.attributes_skipped || [])) {
      if (!skipData[row.complaint_name][attr]) skipData[row.complaint_name][attr] = { used: 0, skipped: 0 };
      skipData[row.complaint_name][attr].skipped++;
    }
    for (const attr of (row.attributes_used || [])) {
      if (!skipData[row.complaint_name][attr]) skipData[row.complaint_name][attr] = { used: 0, skipped: 0 };
      skipData[row.complaint_name][attr].used++;
    }
  }

  const mostSkippedAttributes: { complaint: string; attribute: string; skipRate: number }[] = [];
  for (const [complaint, attrs] of Object.entries(skipData)) {
    for (const [attr, counts] of Object.entries(attrs)) {
      const total = counts.used + counts.skipped;
      if (total >= 5) {
        const skipRate = counts.skipped / total;
        if (skipRate > 0.7) {
          mostSkippedAttributes.push({ complaint, attribute: attr, skipRate: Math.round(skipRate * 100) / 100 });
        }
      }
    }
  }
  mostSkippedAttributes.sort((a, b) => b.skipRate - a.skipRate);

  // Suggested new chips from free text
  const freeTextAgg: Record<string, Record<string, Record<string, number>>> = {};
  for (const row of data) {
    const ft: Record<string, string> = row.free_text_entries || {};
    for (const [attr, text] of Object.entries(ft)) {
      const normalized = text.toLowerCase().trim();
      if (normalized.length < 3) continue;
      if (!freeTextAgg[row.complaint_name]) freeTextAgg[row.complaint_name] = {};
      if (!freeTextAgg[row.complaint_name][attr]) freeTextAgg[row.complaint_name][attr] = {};
      freeTextAgg[row.complaint_name][attr][normalized] = (freeTextAgg[row.complaint_name][attr][normalized] || 0) + 1;
    }
  }

  const suggestedNewChips: { complaint: string; attribute: string; suggestion: string; count: number }[] = [];
  for (const [complaint, attrs] of Object.entries(freeTextAgg)) {
    for (const [attr, texts] of Object.entries(attrs)) {
      for (const [text, count] of Object.entries(texts)) {
        if (count >= 3) {
          suggestedNewChips.push({ complaint, attribute: attr, suggestion: text, count });
        }
      }
    }
  }
  suggestedNewChips.sort((a, b) => b.count - a.count);

  return { topComplaints, avgTimePerComplaint, mostSkippedAttributes, suggestedNewChips };
}

// ============================================================
// OFFLINE QUEUE (IndexedDB)
// ============================================================
function saveToOfflineQueue(event: UsageEvent): void {
  if (typeof window === 'undefined') return;
  try {
    const queue = JSON.parse(localStorage.getItem('cdss_offline_queue') || '[]');
    queue.push(event);
    localStorage.setItem('cdss_offline_queue', JSON.stringify(queue));
  } catch { /* silently fail */ }
}

export async function syncOfflineQueue(): Promise<number> {
  if (typeof window === 'undefined') return 0;
  try {
    const queue = JSON.parse(localStorage.getItem('cdss_offline_queue') || '[]');
    if (queue.length === 0) return 0;

    const { error } = await sb().from('hmis_cdss_usage').insert(queue);
    if (!error) {
      localStorage.removeItem('cdss_offline_queue');
      return queue.length;
    }
    return 0;
  } catch { return 0; }
}
