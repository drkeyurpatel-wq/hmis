// @ts-nocheck
'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function ChapterDetail() {
  const { chapterId } = useParams();
  const [elements, setElements] = useState<any[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const centreId = 'c0000001-0000-0000-0000-000000000001';

  useEffect(() => {
    fetch(`/api/quality/nabh/elements?chapter_id=${chapterId}&centre_id=${centreId}`).then(r => r.json()).then(setElements);
  }, [chapterId]);

  const scoreElement = async (elementId: string, score: string) => {
    setSaving(elementId);
    await fetch('/api/quality/nabh/assessments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ centre_id: centreId, element_id: elementId, score, status: 'ASSESSED' }),
    });
    setElements(prev => prev.map(e => e.id === elementId ? { ...e, assessment: { ...e.assessment, score } } : e));
    setSaving(null);
  };

  const levelColors: Record<string, string> = { CORE: 'border-l-red-500', COMMITMENT: 'border-l-blue-500', ACHIEVEMENT: 'border-l-green-500', EXCELLENCE: 'border-l-purple-500' };
  const scoreLabels: Record<string, string> = { '0': 'NA', '1': 'Not Met', '2': 'Partial', '3': 'Largely', '4': 'Fully', '5': 'Excels' };
  const scoreColors: Record<string, string> = { '0': 'bg-gray-200', '1': 'bg-red-500 text-white', '2': 'bg-orange-400 text-white', '3': 'bg-yellow-400', '4': 'bg-green-500 text-white', '5': 'bg-blue-600 text-white' };

  const grouped = elements.reduce((acc: any, e: any) => {
    const code = e.standard?.standard_code || 'Unknown';
    if (!acc[code]) acc[code] = { title: e.standard?.title || code, elements: [] };
    acc[code].elements.push(e);
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-bold">Chapter Elements ({elements.length} OEs)</h1>
      {Object.entries(grouped).map(([code, group]: [string, any]) => (
        <div key={code} className="border rounded-lg">
          <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 font-semibold text-sm">{code}: {group.title}</div>
          <div className="divide-y">
            {group.elements.map((el: any) => (
              <div key={el.id} className={`px-4 py-3 border-l-4 ${levelColors[el.level]}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{el.element_code}</code>
                      <span className="text-xs uppercase font-medium text-gray-400">{el.level}</span>
                    </div>
                    <p className="text-sm mt-1">{el.description}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {['0','1','2','3','4','5'].map(s => (
                      <button key={s} onClick={() => scoreElement(el.id, s)}
                        disabled={saving === el.id}
                        className={`w-8 h-8 rounded text-xs font-bold transition-all ${
                          el.assessment?.score === s ? scoreColors[s] + ' ring-2 ring-offset-1 ring-blue-400' : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700'
                        }`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
