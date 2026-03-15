import {
  Users, BedDouble, Calendar, CreditCard,
  TrendingUp, Activity, Clock, AlertCircle,
} from 'lucide-react';

const stats = [
  { label: 'OPD Today', value: '—', icon: Calendar, color: 'text-brand-600 bg-brand-50' },
  { label: 'IPD Active', value: '—', icon: BedDouble, color: 'text-health1-teal bg-teal-50' },
  { label: 'Revenue Today', value: '—', icon: CreditCard, color: 'text-health1-emerald bg-emerald-50' },
  { label: 'Bed Occupancy', value: '—', icon: Activity, color: 'text-health1-amber bg-amber-50' },
];

export default function DashboardPage() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="text-sm text-gray-500">
          Welcome to Health1 HMIS
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="stat-card">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-500">{stat.label}</span>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${stat.color}`}>
                  <Icon size={18} />
                </div>
              </div>
              <p className="text-2xl font-display font-bold text-gray-900">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Placeholder sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock size={16} className="text-gray-400" />
            Recent admissions
          </h2>
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">
            No admissions yet — start by registering patients
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertCircle size={16} className="text-gray-400" />
            Pending actions
          </h2>
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">
            All clear
          </div>
        </div>
      </div>
    </div>
  );
}
