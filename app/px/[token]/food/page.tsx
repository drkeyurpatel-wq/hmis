// app/px/[token]/food/page.tsx
// Food menu browser + cart + order submission

'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePxToken, useFoodMenu, useFoodCart, useSubmitFoodOrder, useMyOrders } from '@/lib/px/patient-hooks';
import { FOOD_ORDER_STATUS_LABELS, FOOD_ORDER_STATUS_COLORS } from '@/lib/px/types';
import type { FoodMenuItem } from '@/lib/px/types';

const CATEGORY_ICONS: Record<string, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snacks: '🍪',
  beverages: '☕',
};

const DIETARY_LABELS: Record<string, { label: string; color: string }> = {
  veg: { label: 'Veg', color: 'bg-green-100 text-green-700' },
  'non-veg': { label: 'Non-veg', color: 'bg-red-100 text-red-700' },
  jain: { label: 'Jain', color: 'bg-yellow-100 text-yellow-700' },
  'diabetic-friendly': { label: 'Diabetic', color: 'bg-blue-100 text-blue-700' },
  'low-sodium': { label: 'Low salt', color: 'bg-teal-100 text-teal-700' },
  'liquid-diet': { label: 'Liquid', color: 'bg-purple-100 text-purple-700' },
};

function BackButton({ token }: { token: string }) {
  const router = useRouter();
  return (
    <button onClick={() => router.push(`/px/${token}`)} className="flex items-center gap-1 text-sm text-gray-500 mb-3">
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Back
    </button>
  );
}

function MenuItem({
  item,
  qty,
  onAdd,
  onUpdateQty,
}: {
  item: FoodMenuItem;
  qty: number;
  onAdd: () => void;
  onUpdateQty: (q: number) => void;
}) {
  return (
    <div className="bg-white rounded-lg p-3 border border-gray-100 flex justify-between items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{item.name}</span>
          {item.name_gujarati && <span className="text-xs text-gray-400">{item.name_gujarati}</span>}
        </div>
        {item.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>}
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {item.dietary_tags.map((tag) => {
            const dt = DIETARY_LABELS[tag];
            if (!dt) return null;
            return (
              <span key={tag} className={`text-[10px] px-1.5 py-0.5 rounded ${dt.color}`}>
                {dt.label}
              </span>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col items-end gap-2 shrink-0">
        <span className="text-sm font-semibold text-gray-900">
          {item.price > 0 ? `₹${item.price}` : 'Free'}
        </span>
        {qty === 0 ? (
          <button
            onClick={onAdd}
            className="px-3 py-1 text-xs font-medium text-[#1B3A5C] border border-[#1B3A5C] rounded-lg hover:bg-[#1B3A5C] hover:text-white transition-colors"
          >
            Add
          </button>
        ) : (
          <div className="flex items-center gap-2 bg-[#1B3A5C] rounded-lg">
            <button onClick={() => onUpdateQty(qty - 1)} className="px-2 py-1 text-white text-sm font-bold">
              −
            </button>
            <span className="text-white text-sm font-medium min-w-[16px] text-center">{qty}</span>
            <button onClick={() => onUpdateQty(qty + 1)} className="px-2 py-1 text-white text-sm font-bold">
              +
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FoodPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const { context } = usePxToken(token);
  const { menu, categories, loading: menuLoading } = useFoodMenu(context?.centre_id);
  const { items: cartItems, addItem, updateQty, clearCart, totalAmount, itemCount } = useFoodCart();
  const { submit, submitting, error: submitError } = useSubmitFoodOrder(token);
  const { activeOrders } = useMyOrders(token);

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [dietaryFilter, setDietaryFilter] = useState<string | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  // Filter menu items
  const filteredMenu = useMemo(() => {
    let items = menu;
    if (activeCategory !== 'all') {
      items = items.filter((m) => m.category === activeCategory);
    }
    if (dietaryFilter) {
      items = items.filter((m) => m.dietary_tags.includes(dietaryFilter));
    }
    // Check time availability
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    items = items.filter((m) => {
      if (!m.available_from || !m.available_until) return true;
      return timeStr >= m.available_from && timeStr <= m.available_until;
    });
    return items;
  }, [menu, activeCategory, dietaryFilter]);

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, FoodMenuItem[]> = {};
    filteredMenu.forEach((item) => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    return groups;
  }, [filteredMenu]);

  const cartMap = new Map(cartItems.map((i) => [i.menu_item_id, i.qty]));

  async function handleSubmitOrder() {
    if (cartItems.length === 0) return;
    const orderId = await submit(cartItems, totalAmount);
    if (orderId) {
      clearCart();
      setOrderSuccess(true);
      setShowCart(false);
    }
  }

  if (orderSuccess) {
    return (
      <div className="px-4 pt-4">
        <div className="bg-white rounded-xl p-6 text-center shadow-sm border border-gray-100">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Order placed!</h2>
          <p className="text-sm text-gray-500 mb-1">Your order has been sent to the nursing station for approval.</p>
          <p className="text-xs text-gray-400 mb-4">You'll be notified when it's being prepared.</p>
          <div className="flex gap-2">
            <button
              onClick={() => setOrderSuccess(false)}
              className="flex-1 py-2 text-sm font-medium text-[#1B3A5C] border border-[#1B3A5C] rounded-lg"
            >
              Order more
            </button>
            <button
              onClick={() => router.push(`/px/${token}/status`)}
              className="flex-1 py-2 text-sm font-medium text-white bg-[#1B3A5C] rounded-lg"
            >
              Track order
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-24">
      <BackButton token={token} />
      <h1 className="text-lg font-semibold text-gray-900 mb-1">Food Menu</h1>
      <p className="text-xs text-gray-500 mb-4">Select items and place your order. Nurse approval required.</p>

      {/* Active orders banner */}
      {activeOrders && activeOrders.length > 0 && (
        <button
          onClick={() => router.push(`/px/${token}/status`)}
          className="w-full bg-amber-50 border border-amber-200 rounded-lg p-2 mb-3 flex items-center justify-between"
        >
          <span className="text-xs font-medium text-amber-800">
            {activeOrders.length} order(s) in progress
          </span>
          <span className="text-xs text-amber-600">Track →</span>
        </button>
      )}

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-4 px-4 scrollbar-hide">
        <button
          onClick={() => setActiveCategory('all')}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            activeCategory === 'all' ? 'bg-[#1B3A5C] text-white' : 'bg-white text-gray-600 border border-gray-200'
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize ${
              activeCategory === cat ? 'bg-[#1B3A5C] text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {CATEGORY_ICONS[cat] || ''} {cat}
          </button>
        ))}
      </div>

      {/* Dietary filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 -mx-4 px-4 scrollbar-hide">
        {Object.entries(DIETARY_LABELS).map(([key, val]) => (
          <button
            key={key}
            onClick={() => setDietaryFilter(dietaryFilter === key ? null : key)}
            className={`shrink-0 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
              dietaryFilter === key ? val.color + ' ring-1 ring-offset-1' : 'bg-gray-50 text-gray-500'
            }`}
          >
            {val.label}
          </button>
        ))}
      </div>

      {/* Menu items */}
      {menuLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-100 rounded-lg h-20 animate-pulse" />
          ))}
        </div>
      ) : (
        Object.entries(grouped).map(([category, items]) => (
          <div key={category} className="mb-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 capitalize">
              {CATEGORY_ICONS[category] || ''} {category}
            </h2>
            <div className="space-y-2">
              {items.map((item) => (
                <MenuItem
                  key={item.id}
                  item={item}
                  qty={cartMap.get(item.id) || 0}
                  onAdd={() => addItem(item)}
                  onUpdateQty={(q) => updateQty(item.id, q)}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {filteredMenu.length === 0 && !menuLoading && (
        <div className="text-center py-8 text-sm text-gray-400">
          No items available for the selected filters right now.
        </div>
      )}

      {/* Cart Footer */}
      {itemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 shadow-lg z-40">
          <div className="max-w-lg mx-auto">
            {submitError && <p className="text-xs text-red-500 mb-2">{submitError}</p>}
            <button
              onClick={handleSubmitOrder}
              disabled={submitting}
              className="w-full bg-[#1B3A5C] text-white py-3 rounded-xl font-medium text-sm flex items-center justify-between px-4 disabled:opacity-50"
            >
              <span>
                {submitting ? 'Placing order...' : `Place order (${itemCount} item${itemCount > 1 ? 's' : ''})`}
              </span>
              <span className="font-semibold">₹{totalAmount}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
