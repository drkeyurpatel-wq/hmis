'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/store/auth';
import { sb } from '@/lib/supabase/browser';
import { RoleGuard } from '@/components/ui/shared';
import {
  Search, Plus, Minus, Trash2, CreditCard, Banknote,
  QrCode, ShoppingCart, Package, RefreshCw, CheckCircle,
  Printer, Receipt,
} from 'lucide-react';

interface CartItem {
  id: string;
  name: string;
  generic_name: string;
  strength: string;
  pack_size: string;
  mrp: number;
  selling_price: number;
  stock: number;
  quantity: number;
  requires_rx: boolean;
}

type PaymentMode = 'cash' | 'upi' | 'card';
type Tab = 'pos' | 'orders' | 'inventory';

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export default function PharmacyPOSPage() {
  return <RoleGuard module="clinic_pharmacy"><PharmacyPOSInner /></RoleGuard>;
}

function PharmacyPOSInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const [activeTab, setActiveTab] = useState<Tab>('pos');

  // POS state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [discount, setDiscount] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [saleComplete, setSaleComplete] = useState(false);

  // Inventory state
  const [inventory, setInventory] = useState<any[]>([]);
  const [invLoading, setInvLoading] = useState(false);

  // Drug search
  useEffect(() => {
    if (searchTerm.length < 2) { setSearchResults([]); return; }
    const timeout = setTimeout(async () => {
      const client = sb();
      const { data } = await client
        .from('hmis_drugs')
        .select('id, name, generic_name, strength, pack_size, mrp, selling_price, stock_qty, requires_prescription')
        .or(`name.ilike.%${searchTerm}%,generic_name.ilike.%${searchTerm}%`)
        .eq('is_active', true)
        .limit(10);
      setSearchResults(data || []);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  const addToCart = (drug: any) => {
    const existing = cart.find(c => c.id === drug.id);
    if (existing) {
      setCart(cart.map(c => c.id === drug.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, {
        id: drug.id,
        name: drug.name,
        generic_name: drug.generic_name || '',
        strength: drug.strength || '',
        pack_size: drug.pack_size || '',
        mrp: parseFloat(drug.mrp) || 0,
        selling_price: parseFloat(drug.selling_price) || parseFloat(drug.mrp) || 0,
        stock: drug.stock_qty || 0,
        quantity: 1,
        requires_rx: drug.requires_prescription || false,
      }]);
    }
    setSearchTerm('');
    setSearchResults([]);
  };

  const updateQty = (id: string, delta: number) => {
    setCart(cart.map(c => c.id === id ? { ...c, quantity: Math.max(1, c.quantity + delta) } : c));
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(c => c.id !== id));
  };

  const subtotal = cart.reduce((s, c) => s + c.selling_price * c.quantity, 0);
  const total = subtotal - discount;
  const change = paymentMode === 'cash' ? (parseFloat(cashReceived) || 0) - total : 0;

  const handleSale = async () => {
    if (cart.length === 0) return;
    setProcessing(true);

    const client = sb();
    // Create a pharmacy bill
    const { data: bill, error } = await client.from('hmis_bills').insert({
      centre_id: centreId,
      bill_type: 'pharmacy',
      payor_type: 'self',
      gross_amount: subtotal,
      discount_amount: discount,
      tax_amount: 0,
      net_amount: total,
      paid_amount: total,
      balance_amount: 0,
      status: 'paid',
      bill_date: new Date().toISOString().slice(0, 10),
    }).select('id, bill_number').single();

    if (!error && bill) {
      setSaleComplete(true);
      setTimeout(() => {
        setCart([]);
        setDiscount(0);
        setCashReceived('');
        setSaleComplete(false);
      }, 3000);
    }

    setProcessing(false);
  };

  const loadInventory = useCallback(async () => {
    setInvLoading(true);
    const client = sb();
    const { data } = await client
      .from('hmis_drugs')
      .select('id, name, generic_name, strength, pack_size, mrp, stock_qty, reorder_level')
      .eq('is_active', true)
      .order('name', { ascending: true })
      .limit(200);
    setInventory(data || []);
    setInvLoading(false);
  }, []);

  return (
    <div className="w-full max-w-[1400px] mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pharmacy POS</h1>
          <p className="text-sm text-gray-500">Point of sale for clinic pharmacy</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {([
          { key: 'pos' as Tab, label: 'Point of Sale', icon: ShoppingCart },
          { key: 'orders' as Tab, label: 'App Orders', icon: Package },
          { key: 'inventory' as Tab, label: 'Inventory', icon: Package },
        ]).map(tab => (
          <button key={tab.key} onClick={() => { setActiveTab(tab.key); if (tab.key === 'inventory') loadInventory(); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
              activeTab === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* POS Tab */}
      {activeTab === 'pos' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Left: Search + Cart (60%) */}
          <div className="lg:col-span-3 space-y-3">
            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search medicine by name or scan barcode..."
                className="w-full pl-10 pr-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                autoFocus
              />
              {searchResults.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-white border rounded-xl shadow-xl z-10 max-h-64 overflow-y-auto">
                  {searchResults.map((drug: any) => (
                    <button key={drug.id} onClick={() => addToCart(drug)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-0 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-semibold text-gray-800">{drug.name}</span>
                          {drug.generic_name && <span className="text-xs text-gray-400 ml-2">{drug.generic_name}</span>}
                          <div className="text-xs text-gray-500 mt-0.5">
                            {drug.strength} &middot; {drug.pack_size}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-gray-800">₹{fmt(drug.mrp)}</div>
                          <div className={`text-[10px] ${drug.stock_qty > 5 ? 'text-green-600' : drug.stock_qty > 0 ? 'text-amber-600' : 'text-red-500'}`}>
                            Stock: {drug.stock_qty || 0}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Cart */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Cart ({cart.length} items)</h2>
              </div>
              {cart.length === 0 ? (
                <div className="p-8 text-center">
                  <ShoppingCart size={32} className="mx-auto text-gray-200 mb-2" />
                  <p className="text-sm text-gray-400">Search and add medicines to cart</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {cart.map((item) => (
                    <div key={item.id} className="px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-800">{item.name}</span>
                          {item.requires_rx && (
                            <span className="text-[9px] font-bold px-1 py-0.5 bg-red-100 text-red-600 rounded">Rx</span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400">{item.strength} &middot; ₹{fmt(item.selling_price)}/unit</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => updateQty(item.id, -1)}
                          className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center hover:bg-gray-200 cursor-pointer">
                          <Minus size={12} />
                        </button>
                        <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                        <button onClick={() => updateQty(item.id, 1)}
                          className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center hover:bg-gray-200 cursor-pointer">
                          <Plus size={12} />
                        </button>
                      </div>
                      <span className="text-sm font-bold text-gray-800 w-20 text-right tabular-nums">
                        ₹{fmt(item.selling_price * item.quantity)}
                      </span>
                      <button onClick={() => removeFromCart(item.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors cursor-pointer">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Summary + Payment (40%) */}
          <div className="lg:col-span-2 space-y-3">
            <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3 sticky top-4">
              <h2 className="text-sm font-bold text-gray-800">Bill Summary</h2>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-medium tabular-nums">₹{fmt(subtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-gray-600">
                  <span>Discount</span>
                  <input
                    type="number"
                    value={discount || ''}
                    onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-24 text-right px-2 py-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                    placeholder="0.00"
                  />
                </div>
                <div className="border-t pt-2 flex justify-between text-gray-900 font-bold text-lg">
                  <span>Total</span>
                  <span className="tabular-nums">₹{fmt(total)}</span>
                </div>
              </div>

              {/* Payment mode */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-2">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { mode: 'cash' as PaymentMode, label: 'Cash', icon: Banknote },
                    { mode: 'upi' as PaymentMode, label: 'UPI', icon: QrCode },
                    { mode: 'card' as PaymentMode, label: 'Card', icon: CreditCard },
                  ]).map(pm => (
                    <button key={pm.mode} onClick={() => setPaymentMode(pm.mode)}
                      className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                        paymentMode === pm.mode ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}>
                      <pm.icon size={18} />
                      {pm.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cash input */}
              {paymentMode === 'cash' && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Cash Received</label>
                  <input
                    type="number"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Enter amount..."
                  />
                  {change > 0 && (
                    <p className="text-sm font-bold text-green-600 mt-1">Change: ₹{fmt(change)}</p>
                  )}
                </div>
              )}

              {/* Complete Sale */}
              {saleComplete ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <CheckCircle size={32} className="mx-auto text-green-500 mb-2" />
                  <p className="text-sm font-bold text-green-700">Sale Complete</p>
                </div>
              ) : (
                <button
                  onClick={handleSale}
                  disabled={cart.length === 0 || processing}
                  className="w-full py-3 bg-teal-600 text-white rounded-lg text-sm font-bold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer">
                  {processing ? 'Processing...' : `Complete Sale — ₹${fmt(total)}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* App Orders Tab */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
          <Package size={40} className="mx-auto text-gray-200 mb-3" />
          <h2 className="text-base font-bold text-gray-700">App Orders</h2>
          <p className="text-sm text-gray-400 mt-1">
            Patient app pharmacy pickup orders will appear here.
          </p>
          <p className="text-xs text-gray-400 mt-2">Coming soon with Patient App integration.</p>
        </div>
      )}

      {/* Inventory Tab */}
      {activeTab === 'inventory' && (
        <div className="space-y-3">
          {invLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="animate-spin text-gray-300 mx-auto" size={24} />
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Medicine</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Strength</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">MRP</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">Stock</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {inventory.map((drug: any) => {
                    const isLow = (drug.stock_qty || 0) <= (drug.reorder_level || 10);
                    const isOut = (drug.stock_qty || 0) === 0;
                    return (
                      <tr key={drug.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-gray-800">{drug.name}</div>
                          {drug.generic_name && <div className="text-xs text-gray-400">{drug.generic_name}</div>}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">{drug.strength}</td>
                        <td className="px-4 py-2.5 text-right font-medium tabular-nums">₹{fmt(drug.mrp || 0)}</td>
                        <td className="px-4 py-2.5 text-right font-medium tabular-nums">{drug.stock_qty || 0}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            isOut ? 'bg-red-100 text-red-700' : isLow ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {inventory.length === 0 && (
                <div className="p-8 text-center">
                  <Package size={32} className="mx-auto text-gray-200 mb-2" />
                  <p className="text-sm text-gray-400">No drugs in inventory</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
