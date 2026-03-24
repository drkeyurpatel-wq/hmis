// app/(dashboard)/px-kitchen/page.tsx
// Kitchen display: only nurse-approved food orders

'use client';

import { useCurrentStaff, useKitchenQueue } from '@/lib/px/staff-hooks';
import type { FoodOrder, FoodOrderStatus } from '@/lib/px/types';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function KitchenOrderCard({
  order,
  onStatusChange,
}: {
  order: FoodOrder;
  onStatusChange: (status: FoodOrderStatus) => void;
}) {
  const isOld = Date.now() - new Date(order.nurse_action_at || order.created_at).getTime() > 30 * 60000; // > 30 min

  return (
    <div className={`bg-white rounded-lg p-3 border ${isOld ? 'border-red-300 bg-red-50' : 'border-gray-200'} shadow-sm`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-xs font-bold text-[#1B3A5C]">
            {order.ward_name} — Bed {order.bed_label}
          </span>
          {isOld && <span className="ml-2 text-[10px] text-red-600 font-medium">OVERDUE</span>}
        </div>
        <span className="text-[10px] text-gray-400">{timeAgo(order.nurse_action_at || order.created_at)}</span>
      </div>

      {/* Patient name */}
      <p className="text-sm font-medium text-gray-800 mb-2">{order.patient_name}</p>

      {/* Items */}
      <div className="space-y-1 mb-2">
        {order.items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900 w-6 text-center">{item.qty}×</span>
            <span className="text-sm text-gray-800">{item.name}</span>
            {item.special_instructions && (
              <span className="text-[10px] text-orange-600 bg-orange-50 px-1 rounded">{item.special_instructions}</span>
            )}
          </div>
        ))}
      </div>

      {/* Dietary notes */}
      {order.dietary_restrictions && (
        <div className="text-[10px] text-red-700 bg-red-100 px-2 py-1 rounded mb-2">
          {order.dietary_restrictions}
        </div>
      )}
      {order.nurse_notes && (
        <div className="text-[10px] text-blue-700 bg-blue-50 px-2 py-1 rounded mb-2">
          Nurse: {order.nurse_notes}
        </div>
      )}

      {/* Action button */}
      <div className="mt-3">
        {order.status === 'nurse_approved' && (
          <button
            onClick={() => onStatusChange('preparing')}
            className="w-full py-2 text-xs font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
          >
            Start Preparing
          </button>
        )}
        {order.status === 'preparing' && (
          <button
            onClick={() => onStatusChange('ready')}
            className="w-full py-2 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Ready for Pickup
          </button>
        )}
        {order.status === 'ready' && (
          <button
            onClick={() => onStatusChange('delivered')}
            className="w-full py-2 text-xs font-medium bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Delivered
          </button>
        )}
      </div>
    </div>
  );
}

export default function PxKitchenPage() {
  const { staff, loading: staffLoading } = useCurrentStaff();
  const { orders, loading, updateOrderStatus } = useKitchenQueue(staff?.centre_id);

  if (staffLoading || loading) {
    return <div className="p-6 text-center text-gray-500">Loading kitchen display...</div>;
  }

  const newOrders = orders.filter((o) => o.status === 'nurse_approved');
  const preparing = orders.filter((o) => o.status === 'preparing');
  const ready = orders.filter((o) => o.status === 'ready');

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Kitchen Display</h1>
          <p className="text-sm text-gray-500">Nurse-approved food orders only</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <span className="text-2xl font-bold text-amber-600">{newOrders.length}</span>
            <p className="text-[10px] text-gray-500">New</p>
          </div>
          <div className="text-center">
            <span className="text-2xl font-bold text-orange-600">{preparing.length}</span>
            <p className="text-[10px] text-gray-500">Preparing</p>
          </div>
          <div className="text-center">
            <span className="text-2xl font-bold text-green-600">{ready.length}</span>
            <p className="text-[10px] text-gray-500">Ready</p>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs text-gray-500">Live</span>
          </div>
        </div>
      </div>

      {/* Kanban-style 3-column layout */}
      <div className="grid grid-cols-3 gap-4">
        {/* New Orders */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 bg-amber-400 rounded-full" />
            <h2 className="text-sm font-semibold text-gray-700">New ({newOrders.length})</h2>
          </div>
          <div className="space-y-3">
            {newOrders.map((order) => (
              <KitchenOrderCard
                key={order.id}
                order={order}
                onStatusChange={(status) => updateOrderStatus(order.id, status)}
              />
            ))}
            {newOrders.length === 0 && (
              <div className="text-center py-8 text-xs text-gray-400 bg-gray-50 rounded-lg">No new orders</div>
            )}
          </div>
        </div>

        {/* Preparing */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 bg-orange-400 rounded-full" />
            <h2 className="text-sm font-semibold text-gray-700">Preparing ({preparing.length})</h2>
          </div>
          <div className="space-y-3">
            {preparing.map((order) => (
              <KitchenOrderCard
                key={order.id}
                order={order}
                onStatusChange={(status) => updateOrderStatus(order.id, status)}
              />
            ))}
            {preparing.length === 0 && (
              <div className="text-center py-8 text-xs text-gray-400 bg-gray-50 rounded-lg">Nothing cooking</div>
            )}
          </div>
        </div>

        {/* Ready */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 bg-green-400 rounded-full" />
            <h2 className="text-sm font-semibold text-gray-700">Ready ({ready.length})</h2>
          </div>
          <div className="space-y-3">
            {ready.map((order) => (
              <KitchenOrderCard
                key={order.id}
                order={order}
                onStatusChange={(status) => updateOrderStatus(order.id, status)}
              />
            ))}
            {ready.length === 0 && (
              <div className="text-center py-8 text-xs text-gray-400 bg-gray-50 rounded-lg">All delivered</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
