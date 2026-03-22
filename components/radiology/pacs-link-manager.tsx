// components/radiology/pacs-link-manager.tsx
// Link Stradus PACS URLs to radiology orders
// This is the bridge: paste/enter Stradus URL → stored in patient file → clickable forever
'use client';
import React, { useState } from 'react';
import { useRadiologyWorklist } from '@/lib/radiology/radiology-hooks';

interface Props {
  order: any;
  centreId: string;
  pacsConfig?: any;
  onClose: () => void;
  onFlash: (msg: string) => void;
}

export default function PACSLinkManager({ order, centreId, pacsConfig, onClose, onFlash }: Props) {
  const worklist = useRadiologyWorklist(centreId);
  const [stradusUrl, setStradusUrl] = useState(order.stradus_viewer_url || '');
  const [studyUid, setStudyUid] = useState(order.pacs_study_uid || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Auto-extract study UID from pasted URL
  const handleUrlChange = (url: string) => {
    setStradusUrl(url);
    const match = url.match(/StudyInstanceUID=([^&\s]+)/i);
    if (match) setStudyUid(decodeURIComponent(match[1]));
  };

  // Auto-build URL from study UID
  const handleUidChange = (uid: string) => {
    setStudyUid(uid);
    if (uid && pacsConfig?.viewer_url && !stradusUrl) {
      setStradusUrl(`${pacsConfig.viewer_url}?StudyInstanceUID=${uid}`);
    }
  };

  const save = async () => {
    if (!stradusUrl.trim() && !studyUid.trim()) { setError('Enter a Stradus viewer URL or Study Instance UID'); return; }
    setError(''); setSaving(true);

    // Build final URL
    let finalUrl = stradusUrl.trim();
    if (!finalUrl && studyUid && pacsConfig?.viewer_url) {
      finalUrl = `${pacsConfig.viewer_url}?StudyInstanceUID=${studyUid}`;
    }

    const result = await worklist.linkStudy(order.id, finalUrl, studyUid.trim() || undefined);
    setSaving(false);

    if (!result.success) { setError(result.error || 'Failed to save'); return; }
    onFlash('Stradus link saved — images now accessible from patient file');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl w-[600px] max-h-[80vh] overflow-y-auto">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-bold">Link Stradus Images</h2>
          <div className="text-xs text-gray-500 mt-1">
            {order.test?.test_name} — {order.patient?.first_name} {order.patient?.last_name} ({order.patient?.uhid})
          </div>
          <div className="text-[10px] text-gray-400">ACC: {order.accession_number}</div>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* How to get the URL */}
          <div className="bg-blue-50 rounded-xl p-4 text-xs text-blue-700 space-y-1">
            <div className="font-semibold mb-1">How to link Stradus images:</div>
            <div>1. Open Stradus PACS in your browser</div>
            <div>2. Find the study for this patient ({order.patient?.first_name} {order.patient?.last_name})</div>
            <div>3. Copy the URL from the browser address bar</div>
            <div>4. Paste it below</div>
            <div className="mt-2 text-[10px] text-blue-500">OR enter the DICOM Study Instance UID directly — the link will be built automatically.</div>
          </div>

          {/* URL input */}
          <div>
            <label className="text-xs text-gray-500 font-medium">Stradus Viewer URL</label>
            <input type="url" value={stradusUrl} onChange={e => handleUrlChange(e.target.value)}
              className="w-full px-3 py-2.5 border rounded-lg text-sm mt-1 font-mono text-[11px]"
              placeholder="https://pacs.hospital.example.com/viewer?StudyInstanceUID=..." />
            <div className="text-[10px] text-gray-400 mt-0.5">Paste the full Stradus viewer URL here</div>
          </div>

          {/* Study UID input */}
          <div>
            <label className="text-xs text-gray-500 font-medium">Study Instance UID (optional)</label>
            <input type="text" value={studyUid} onChange={e => handleUidChange(e.target.value)}
              className="w-full px-3 py-2.5 border rounded-lg text-sm mt-1 font-mono text-[11px]"
              placeholder="1.2.840.113619.2...." />
            <div className="text-[10px] text-gray-400 mt-0.5">DICOM Study Instance UID — auto-extracted from URL if present</div>
          </div>

          {/* Preview */}
          {stradusUrl && <div className="bg-gray-50 rounded-xl p-4">
            <div className="text-xs font-medium text-gray-500 mb-1">Preview — this link will be saved to the patient file:</div>
            <a href={stradusUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline break-all">{stradusUrl}</a>
            <div className="mt-2 flex gap-2">
              <a href={stradusUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">Test Link →</a>
              <span className="text-[10px] text-gray-400 self-center">Click to verify the link opens correctly in Stradus</span>
            </div>
          </div>}

          {/* Current link if exists */}
          {order.stradus_viewer_url && <div className="bg-green-50 rounded-xl p-3 border border-green-200">
            <div className="text-[10px] text-green-600 font-medium">Currently linked:</div>
            <a href={order.stradus_viewer_url} target="_blank" rel="noopener noreferrer" className="text-xs text-green-700 break-all">{order.stradus_viewer_url}</a>
          </div>}

          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">{error}</div>}
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 text-sm rounded-lg">Cancel</button>
          <button onClick={save} disabled={saving || (!stradusUrl.trim() && !studyUid.trim())}
            className="px-6 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium disabled:opacity-40">
            {saving ? 'Saving...' : order.stradus_viewer_url ? 'Update Link' : 'Save Link'}
          </button>
        </div>
      </div>
    </div>
  );
}
