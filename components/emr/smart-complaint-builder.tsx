'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Search, Plus, X, ChevronDown, ChevronRight, Sparkles, Star } from 'lucide-react';
import {
  COMPLAINT_TEMPLATES, searchTemplates, CATEGORIES,
  type ComplaintTemplate, type AttributeDef,
} from '@/lib/cdss/complaint-templates';
import {
  trackComplaintUsage, getAttributeScores, evolveTemplate, reorderChips,
  type AttributeScore,
} from '@/lib/cdss/ml-engine';

// ============================================================
// EXPORTS (used by EMR v2 page)
// ============================================================
export interface ActiveComplaint {
  id: string;
  template: ComplaintTemplate;
  values: Record<string, string | string[] | number>;
  startTime: number; // for ML tracking
}

export function generateComplaintText(complaint: ActiveComplaint): string {
  const { template, values } = complaint;
  const parts: string[] = [`C/O ${template.name}`];
  for (const [key, attr] of Object.entries(template.attributes)) {
    const val = values[key];
    if (!val || (Array.isArray(val) && val.length === 0)) continue;
    if (attr.type === 'scale') {
      parts.push(`${attr.label}: ${val}/10`);
    } else if (attr.type === 'duration') {
      parts.push(`since ${val}`);
    } else if (Array.isArray(val)) {
      parts.push(`${attr.label}: ${val.join(', ')}`);
    } else {
      parts.push(`${attr.label}: ${val}`);
    }
  }
  const freetext = values['_freetext'];
  if (freetext && typeof freetext === 'string') parts.push(`[${freetext}]`);
  return parts.join(' | ');
}

// ============================================================
// COMPONENT
// ============================================================
export function SmartComplaintBuilder({ complaints, setComplaints }: {
  complaints: ActiveComplaint[];
  setComplaints: React.Dispatch<React.SetStateAction<ActiveComplaint[]>>;
}) {
  const [searchQ, setSearchQ] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showCategories, setShowCategories] = useState(false);
  const [mlScores, setMlScores] = useState<Record<string, AttributeScore[]>>({});
  const [mlEvolved, setMlEvolved] = useState<Record<string, { primary: string[]; secondary: string[]; suggested_new_chips: Record<string, string[]> }>>({});

  // Search results
  const results = useMemo(() => {
    if (!searchQ || searchQ.length < 2) return [];
    return searchTemplates(searchQ);
  }, [searchQ]);

  // Add complaint from template
  const addComplaint = (template: ComplaintTemplate) => {
    const id = `c_${Date.now()}`;
    setComplaints(prev => [...prev, { id, template, values: {}, startTime: Date.now() }]);
    setSearchQ('');
    setExpanded(id);
    // Load ML scores for this template
    loadMLScores(template.name);
  };

  const removeComplaint = (id: string) => {
    const complaint = complaints.find(c => c.id === id);
    if (complaint) {
      // Track usage before removing
      trackUsage(complaint);
    }
    setComplaints(prev => prev.filter(c => c.id !== id));
    if (expanded === id) setExpanded(null);
  };

  const updateValue = (id: string, key: string, val: string | string[] | number) => {
    setComplaints(prev => prev.map(c =>
      c.id === id ? { ...c, values: { ...c.values, [key]: val } } : c
    ));
  };

  // ML: Load scores for a complaint
  const loadMLScores = async (complaintName: string) => {
    try {
      // For now use 'global' — in production, pass actual doctor_id
      const scores = await getAttributeScores(complaintName, 'global');
      if (scores.length > 0) {
        setMlScores(prev => ({ ...prev, [complaintName]: scores }));
        // Find the template
        const template = COMPLAINT_TEMPLATES.find(t => t.name === complaintName);
        if (template) {
          const evolved = evolveTemplate(template.attributes, scores);
          setMlEvolved(prev => ({ ...prev, [complaintName]: evolved }));
        }
      }
    } catch { /* ML is optional — degrade gracefully */ }
  };

  // ML: Track usage when complaint is removed or encounter saved
  const trackUsage = (complaint: ActiveComplaint) => {
    const used: string[] = [];
    const skipped: string[] = [];
    const chipSelections: Record<string, string[]> = {};
    const freeTextEntries: Record<string, string> = {};

    for (const [key, attr] of Object.entries(complaint.template.attributes)) {
      const val = complaint.values[key];
      if (!val || (Array.isArray(val) && val.length === 0) || val === '') {
        skipped.push(key);
      } else {
        used.push(key);
        if (Array.isArray(val)) chipSelections[key] = val;
      }
    }
    const ft = complaint.values['_freetext'];
    if (ft && typeof ft === 'string') freeTextEntries['_freetext'] = ft;

    trackComplaintUsage({
      complaint_name: complaint.template.name,
      doctor_id: 'global', // Replace with actual doctor_id in production
      centre_id: 'global', // Replace with actual centre_id
      attributes_used: used,
      attributes_skipped: skipped,
      chip_selections: chipSelections,
      free_text_entries: freeTextEntries,
      time_spent_ms: Date.now() - complaint.startTime,
      timestamp: new Date().toISOString(),
    });
  };

  // Get ordered attributes for a complaint (ML-evolved or default)
  const getOrderedAttributes = (complaint: ActiveComplaint): { primary: string[]; secondary: string[] } => {
    const evolved = mlEvolved[complaint.template.name];
    if (evolved) return { primary: evolved.primary, secondary: evolved.secondary };
    return { primary: Object.keys(complaint.template.attributes), secondary: [] };
  };

  // Get reordered chips for an attribute
  const getChipOptions = (complaint: ActiveComplaint, attrKey: string, attr: AttributeDef): string[] => {
    if (!attr.options) return [];
    const scores = mlScores[complaint.template.name];
    if (!scores) return attr.options;
    const score = scores.find(s => s.attribute_key === attrKey);
    if (!score) return attr.options;
    const evolved = mlEvolved[complaint.template.name];
    const suggested = evolved?.suggested_new_chips?.[attrKey] || [];
    return reorderChips(attr.options, score.top_chips, suggested);
  };

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          placeholder="Search 105+ complaints — type headache, chest pain, fever..."
        />
        {searchQ && (
          <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
            {results.length === 0 ? (
              <div className="p-3 text-xs text-gray-400">No templates found — try different keywords</div>
            ) : results.map(t => (
              <button key={t.name} onClick={() => addComplaint(t)}
                className="w-full text-left px-4 py-2.5 hover:bg-blue-50 flex items-center justify-between border-b border-gray-50 last:border-0">
                <div>
                  <div className="text-sm font-medium text-gray-800">{t.name}</div>
                  <div className="text-[10px] text-gray-400">{Object.keys(t.attributes).length} follow-up questions • {t.category}</div>
                </div>
                <Plus size={14} className="text-blue-500" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Category browse */}
      <div>
        <button onClick={() => setShowCategories(!showCategories)} className="text-[10px] text-blue-600 hover:underline flex items-center gap-1">
          {showCategories ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Browse by specialty ({COMPLAINT_TEMPLATES.length} templates)
        </button>
        {showCategories && (
          <div className="mt-2 flex flex-wrap gap-1">
            {CATEGORIES.map(cat => (
              <div key={cat} className="group relative">
                <button className="text-[10px] bg-gray-100 hover:bg-blue-100 px-2 py-1 rounded font-medium">{cat}</button>
                <div className="absolute hidden group-hover:block z-30 top-full left-0 mt-1 bg-white border rounded-lg shadow-lg p-2 min-w-[200px] max-h-48 overflow-y-auto">
                  {COMPLAINT_TEMPLATES.filter(t => t.category === cat).map(t => (
                    <button key={t.name} onClick={() => { addComplaint(t); setShowCategories(false); }}
                      className="block w-full text-left text-xs py-1.5 px-2 hover:bg-blue-50 rounded">
                      {t.name} <span className="text-gray-400">({Object.keys(t.attributes).length}q)</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active complaints */}
      {complaints.map(complaint => {
        const isExpanded = expanded === complaint.id;
        const summary = generateComplaintText(complaint);
        const { primary, secondary } = getOrderedAttributes(complaint);
        const hasML = !!mlScores[complaint.template.name];

        return (
          <div key={complaint.id} className={cn('border rounded-xl overflow-hidden transition-all', isExpanded ? 'border-blue-300 shadow-sm' : 'border-gray-200')}>
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 cursor-pointer" onClick={() => setExpanded(isExpanded ? null : complaint.id)}>
              <span className="text-xs font-bold text-blue-700">{complaint.template.name}</span>
              <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{complaint.template.category}</span>
              {hasML && <Sparkles size={12} className="text-purple-500" />}
              <span className="flex-1 text-[10px] text-gray-400 truncate ml-2">{summary.length > 20 ? summary : ''}</span>
              <button onClick={e => { e.stopPropagation(); removeComplaint(complaint.id); }} className="text-gray-400 hover:text-red-500"><X size={14} /></button>
              {isExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
            </div>

            {/* Attributes */}
            {isExpanded && (
              <div className="px-4 py-3 space-y-3">
                {/* Primary attributes (ML-promoted or all) */}
                {primary.map(key => {
                  const attr = complaint.template.attributes[key];
                  if (!attr) return null;
                  const chipOptions = getChipOptions(complaint, key, attr);
                  return (
                    <AttributeInput key={key} attr={attr} attrKey={key} chipOptions={chipOptions}
                      value={complaint.values[key]} onChange={val => updateValue(complaint.id, key, val)} />
                  );
                })}

                {/* Secondary (ML-demoted) — collapsed */}
                {secondary.length > 0 && (
                  <details className="text-xs">
                    <summary className="text-gray-400 cursor-pointer hover:text-gray-600">
                      {secondary.length} more questions (rarely used by doctors)
                    </summary>
                    <div className="mt-2 space-y-3 pl-2 border-l-2 border-gray-100">
                      {secondary.map(key => {
                        const attr = complaint.template.attributes[key];
                        if (!attr) return null;
                        return (
                          <AttributeInput key={key} attr={attr} attrKey={key} chipOptions={attr.options || []}
                            value={complaint.values[key]} onChange={val => updateValue(complaint.id, key, val)} />
                        );
                      })}
                    </div>
                  </details>
                )}

                {/* Free text */}
                <div>
                  <label className="text-[10px] font-semibold text-gray-500">Additional notes</label>
                  <textarea
                    className="w-full px-3 py-2 text-xs text-gray-800 border border-gray-200 rounded-lg resize-none outline-none focus:ring-2 focus:ring-blue-500"
                    rows={2} value={(complaint.values['_freetext'] as string) || ''}
                    onChange={e => updateValue(complaint.id, '_freetext', e.target.value)}
                    placeholder="Any additional details not covered above..."
                  />
                </div>

                {/* Generated text preview */}
                <div className="bg-blue-50 rounded-lg p-2.5 text-xs text-blue-800 font-mono">{summary}</div>
              </div>
            )}
          </div>
        );
      })}

      {complaints.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          Search for a complaint above — 105 clinical templates with 8-10 follow-up questions each.
          <br /><span className="text-xs text-purple-400">Questions adapt based on what doctors actually use.</span>
        </div>
      )}
    </div>
  );
}

// ============================================================
// ATTRIBUTE INPUT COMPONENT
// ============================================================
function AttributeInput({ attr, attrKey, chipOptions, value, onChange }: {
  attr: AttributeDef; attrKey: string; chipOptions: string[];
  value: string | string[] | number | undefined;
  onChange: (val: string | string[] | number) => void;
}) {
  if (attr.type === 'chips') {
    const selected = Array.isArray(value) ? value : (value ? [value as string] : []);
    const toggle = (chip: string) => {
      const clean = chip.replace('★ ', '');
      if (attr.multi) {
        onChange(selected.includes(clean) ? selected.filter(s => s !== clean) : [...selected, clean]);
      } else {
        onChange(selected.includes(clean) ? [] : [clean]);
      }
    };
    return (
      <div>
        <label className="text-[10px] font-semibold text-gray-500">{attr.label}{attr.multi ? ' (multi)' : ''}</label>
        <div className="flex flex-wrap gap-1 mt-1">
          {chipOptions.map(chip => {
            const clean = chip.replace('★ ', '');
            const isSuggested = chip.startsWith('★');
            const isActive = selected.includes(clean);
            return (
              <button key={chip} onClick={() => toggle(chip)}
                className={cn('px-2 py-1 text-[11px] rounded-full border transition-all',
                  isActive ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300',
                  isSuggested && !isActive && 'border-purple-300 text-purple-700 bg-purple-50'
                )}>
                {isSuggested && <Star size={8} className="inline mr-0.5 text-purple-500" />}
                {clean}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (attr.type === 'scale') {
    const num = typeof value === 'number' ? value : 5;
    return (
      <div>
        <label className="text-[10px] font-semibold text-gray-500">{attr.label}: {num}/10</label>
        <input type="range" min="1" max="10" value={num} onChange={e => onChange(parseInt(e.target.value))}
          className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-600" />
        <div className="flex justify-between text-[8px] text-gray-400"><span>Mild</span><span>Moderate</span><span>Severe</span></div>
      </div>
    );
  }

  if (attr.type === 'duration') {
    return (
      <div>
        <label className="text-[10px] font-semibold text-gray-500">{attr.label}</label>
        <select value={(value as string) || ''} onChange={e => onChange(e.target.value)}
          className="w-full px-2 py-1.5 border rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500">
          <option value="">Select duration</option>
          <option>Few hours</option><option>1 day</option><option>2-3 days</option>
          <option>4-7 days</option><option>1-2 weeks</option><option>2-4 weeks</option>
          <option>1-3 months</option><option>3-6 months</option><option>6-12 months</option>
          <option>1-2 years</option><option>More than 2 years</option>
        </select>
      </div>
    );
  }

  // text
  return (
    <div>
      <label className="text-[10px] font-semibold text-gray-500">{attr.label}</label>
      <input type="text" value={(value as string) || ''} onChange={e => onChange(e.target.value)}
        className="w-full px-2 py-1.5 border rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500" />
    </div>
  );
}
