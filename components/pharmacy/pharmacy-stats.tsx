// components/pharmacy/pharmacy-stats.tsx
// Dashboard stats for pharmacy module
'use client';
import React from 'react';
import { TrendingUp, AlertTriangle, Clock, Package } from 'lucide-react';

interface PharmacyStatsProps {
  todayDispensed: number;
  todayRevenue: number;
  monthRevenue: number;
  pendingRx: number;
  lowStockCount: number;
  expiringCount: number;
  stockValueCost: number;
  stockValueMRP: number;
  totalDrugs: number;
  totalBatches: number;
  expiredCount: number;
}

const fmtL = (n: number) => n >= 100000 ? `₹${(n / 100000).toFixed(2)}L` : `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function PharmacyStats({
  todayDispensed, todayRevenue, monthRevenue, pendingRx,
  lowStockCount, expiringCount, stockValueCost, stockValueMRP,
  totalDrugs, totalBatches, expiredCount,
}: PharmacyStatsProps) {
  return (
    <div className="space-y-3">
      {/* Top row — operational stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {[
          { label: 'Dispensed Today', value: todayDispensed, color: 'text-h1-teal', bg: 'bg-h1-teal/10' },
          { label: 'Revenue Today', value: fmtL(todayRevenue), color: 'text-h1-success', bg: 'bg-h1-success/10' },
          { label: 'Month Revenue', value: fmtL(monthRevenue), color: 'text-h1-success', bg: 'bg-h1-success/10' },
          { label: 'Pending Rx', value: pendingRx, color: 'text-h1-yellow', bg: 'bg-h1-yellow/10' },
          { label: 'Low Stock', value: lowStockCount, color: 'text-h1-red', bg: 'bg-h1-red/10' },
          { label: 'Expiring (90d)', value: expiringCount, color: 'text-h1-yellow', bg: 'bg-h1-yellow/10' },
        ].map((stat, i) => (
          <div key={i} className={`rounded-h1 border border-h1-border p-3 text-center ${stat.bg}`}>
            <div className="text-[10px] text-h1-text-secondary">{stat.label}</div>
            <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Bottom row — stock summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-h1-card rounded-h1 border border-h1-border p-3">
          <div className="flex items-center gap-1.5 text-h1-small text-h1-text-secondary mb-1">
            <Package className="w-3.5 h-3.5" /> Stock at Cost
          </div>
          <div className="text-h1-body font-bold text-h1-navy">{fmtL(stockValueCost)}</div>
        </div>
        <div className="bg-h1-card rounded-h1 border border-h1-border p-3">
          <div className="flex items-center gap-1.5 text-h1-small text-h1-text-secondary mb-1">
            <TrendingUp className="w-3.5 h-3.5" /> Stock at MRP
          </div>
          <div className="text-h1-body font-bold text-h1-success">{fmtL(stockValueMRP)}</div>
        </div>
        <div className="bg-h1-card rounded-h1 border border-h1-border p-3">
          <div className="text-h1-small text-h1-text-secondary mb-1">Margin</div>
          <div className="text-h1-body font-bold text-h1-teal">{fmtL(stockValueMRP - stockValueCost)}</div>
        </div>
        <div className="bg-h1-card rounded-h1 border border-h1-border p-3">
          <div className="text-h1-small text-h1-text-secondary mb-1">Catalog</div>
          <div className="text-h1-body font-bold text-h1-navy">{totalDrugs} drugs / {totalBatches} batches</div>
          {expiredCount > 0 && (
            <div className="text-[10px] text-h1-red mt-0.5 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {expiredCount} expired
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
