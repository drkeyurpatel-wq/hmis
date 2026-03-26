// components/lab/lab-stats-bar.tsx
// 6 stat summary cards for lab dashboard
'use client';
import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface LabStats {
  total: number;
  pending: number;
  collected: number;
  processing: number;
  completed: number;
  tatBreached: number;
}

interface LabStatsBarProps {
  stats: LabStats;
  onFilterClick: (status: string) => void;
}

const STAT_CARDS: { key: keyof LabStats; label: string; color: string; filterValue: string }[] = [
  { key: 'total', label: 'Total', color: 'bg-h1-navy/5 text-h1-navy', filterValue: 'all' },
  { key: 'pending', label: 'Pending', color: 'bg-h1-yellow/10 text-h1-yellow', filterValue: 'ordered' },
  { key: 'collected', label: 'Collected', color: 'bg-h1-teal/10 text-h1-teal', filterValue: 'sample_collected' },
  { key: 'processing', label: 'Processing', color: 'bg-purple-50 text-purple-700', filterValue: 'processing' },
  { key: 'completed', label: 'Completed', color: 'bg-h1-success/10 text-h1-success', filterValue: 'completed' },
  { key: 'tatBreached', label: 'TAT Breached', color: '', filterValue: '' },
];

export default function LabStatsBar({ stats, onFilterClick }: LabStatsBarProps) {
  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
      {STAT_CARDS.map(card => {
        const value = stats[card.key];
        const isTat = card.key === 'tatBreached';
        const tatColor = isTat
          ? value > 0 ? 'bg-h1-red/10 text-h1-red' : 'bg-h1-navy/5 text-h1-text-muted'
          : card.color;

        return (
          <button
            key={card.key}
            type="button"
            onClick={() => card.filterValue && onFilterClick(card.filterValue)}
            disabled={!card.filterValue}
            className={`rounded-h1 p-3 transition-all duration-h1-fast
              ${card.filterValue ? 'cursor-pointer hover:ring-2 ring-h1-teal/30' : 'cursor-default'}
              ${tatColor}`}
          >
            <div className="text-[10px] font-medium opacity-70">{card.label}</div>
            <div className="text-xl font-bold flex items-center gap-1">
              {value}
              {isTat && value > 0 && <AlertTriangle className="w-4 h-4" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}
