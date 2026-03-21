// components/emr-mobile/quick-note.tsx
// Free-text clinical note entry for mobile
'use client';
import React, { useState } from 'react';

const QUICK_PHRASES = [
  'Patient stable', 'Improving', 'Vitals within normal limits', 'Tolerating oral feeds',
  'Wound clean, dry', 'Pain controlled', 'Ambulating well', 'Continue current plan',
  'Awaiting labs', 'Reviewed with senior', 'Family counselled', 'Plan for discharge',
];

interface Props {
  onSave: (note: string) => Promise<void>;
  onFlash: (msg: string) => void;
}

export default function QuickNote({ onSave, onFlash }: Props) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const addPhrase = (p: string) => setNote(prev => prev ? `${prev}. ${p}` : p);

  const save = async () => {
    if (!note.trim()) { onFlash('Enter a note'); return; }
    setSaving(true);
    await onSave(note.trim());
    setNote('');
    onFlash('Note saved');
    setSaving(false);
  };

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border p-3">
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={5}
          className="w-full px-3 py-2 border rounded-lg text-sm resize-none" placeholder="Type clinical note..." autoFocus />
        <div className="flex flex-wrap gap-1 mt-2">
          {QUICK_PHRASES.map(p => (
            <button key={p} onClick={() => addPhrase(p)} className="px-2 py-1 bg-gray-100 text-gray-600 text-[10px] rounded-lg hover:bg-teal-50 hover:text-teal-700 active:bg-teal-100">{p}</button>
          ))}
        </div>
      </div>
      <button onClick={save} disabled={saving} className="w-full py-3 bg-teal-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50">
        {saving ? 'Saving...' : 'Save Note'}
      </button>
    </div>
  );
}
