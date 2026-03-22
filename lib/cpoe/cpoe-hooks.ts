// lib/cpoe/cpoe-hooks.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { sb } from '@/lib/supabase/browser';
import { auditCreate, auditCancel } from '@/lib/audit/audit-logger';
import { routeCPOEOrder } from '@/lib/bridge/cross-module-bridge';

export interface CPOEOrder {
  id: string; admissionId: string; patientId: string;
  orderType: 'medication' | 'lab' | 'radiology' | 'diet' | 'nursing' | 'activity' | 'consult' | 'procedure';
  orderText: string; details: any;
  priority: 'routine' | 'urgent' | 'stat' | 'asap';
  status: 'ordered' | 'verified' | 'in_progress' | 'completed' | 'cancelled' | 'held';
  orderedBy: string; orderedByName: string;
  isVerbal: boolean; cosignedBy: string | null; cosignedAt: string | null;
  createdAt: string; notes: string;
}

export interface OrderTemplate {
  id: string; name: string; description: string; category: string;
  orders: Omit<CPOEOrder, 'id' | 'admissionId' | 'patientId' | 'status' | 'orderedBy' | 'orderedByName' | 'createdAt' | 'cosignedBy' | 'cosignedAt'>[];
}

export const ORDER_TEMPLATES: OrderTemplate[] = [
  { id: 'admission_general', name: 'General Admission', description: 'Standard admission orders — vitals, diet, activity, DVT prophylaxis', category: 'admission',
    orders: [
      { orderType: 'nursing', orderText: 'Vitals Q4H (BP, HR, SpO2, Temp, RR)', details: { frequency: 'Q4H' }, priority: 'routine', isVerbal: false, notes: '' },
      { orderType: 'nursing', orderText: 'Fall risk assessment on admission', details: {}, priority: 'routine', isVerbal: false, notes: '' },
      { orderType: 'nursing', orderText: 'Strict I/O charting', details: {}, priority: 'routine', isVerbal: false, notes: '' },
      { orderType: 'diet', orderText: 'Regular diet as tolerated', details: { type: 'regular' }, priority: 'routine', isVerbal: false, notes: '' },
      { orderType: 'activity', orderText: 'Ambulate as tolerated', details: { level: 'ambulatory' }, priority: 'routine', isVerbal: false, notes: '' },
      { orderType: 'lab', orderText: 'CBC, RBS, S.Creatinine, Electrolytes', details: { tests: ['CBC', 'RBS', 'S.Creatinine', 'Na/K'] }, priority: 'routine', isVerbal: false, notes: '' },
    ]},
  { id: 'admission_icu', name: 'ICU Admission', description: 'ICU admission — continuous monitoring, arterial line, ventilator settings', category: 'admission',
    orders: [
      { orderType: 'nursing', orderText: 'Vitals Q1H (continuous monitoring)', details: { frequency: 'Q1H' }, priority: 'stat', isVerbal: false, notes: '' },
      { orderType: 'nursing', orderText: 'GCS assessment Q2H', details: { frequency: 'Q2H' }, priority: 'urgent', isVerbal: false, notes: '' },
      { orderType: 'nursing', orderText: 'Strict I/O charting — hourly urine output', details: { frequency: 'Q1H' }, priority: 'urgent', isVerbal: false, notes: '' },
      { orderType: 'nursing', orderText: 'Head of bed elevated 30°', details: {}, priority: 'routine', isVerbal: false, notes: '' },
      { orderType: 'nursing', orderText: 'DVT prophylaxis — compression stockings + Enoxaparin 40mg SC OD', details: {}, priority: 'routine', isVerbal: false, notes: '' },
      { orderType: 'nursing', orderText: 'Blood sugar monitoring Q6H', details: { frequency: 'Q6H' }, priority: 'routine', isVerbal: false, notes: '' },
      { orderType: 'diet', orderText: 'NPO / Ryle\'s tube feeding as per dietitian', details: { type: 'npo' }, priority: 'routine', isVerbal: false, notes: '' },
      { orderType: 'lab', orderText: 'CBC, ABG, RFT, LFT, Electrolytes, Coagulation', details: { tests: ['CBC', 'ABG', 'RFT', 'LFT', 'Na/K/Ca', 'PT/INR'] }, priority: 'urgent', isVerbal: false, notes: '' },
      { orderType: 'radiology', orderText: 'Portable CXR', details: { modality: 'XR', bodyPart: 'Chest' }, priority: 'urgent', isVerbal: false, notes: '' },
    ]},
  { id: 'postop_general', name: 'Post-Op General', description: 'Standard post-operative orders', category: 'post_op',
    orders: [
      { orderType: 'nursing', orderText: 'Vitals Q15min × 2hr, then Q1H × 4hr, then Q4H', details: { frequency: 'variable' }, priority: 'urgent', isVerbal: false, notes: '' },
      { orderType: 'nursing', orderText: 'Monitor wound site for bleeding', details: {}, priority: 'urgent', isVerbal: false, notes: '' },
      { orderType: 'nursing', orderText: 'Check drain output Q4H', details: {}, priority: 'routine', isVerbal: false, notes: '' },
      { orderType: 'diet', orderText: 'Sips of water after 4hr, liquid diet after 6hr if tolerating', details: { type: 'gradual' }, priority: 'routine', isVerbal: false, notes: '' },
      { orderType: 'medication', orderText: 'Inj. Paracetamol 1g IV Q8H (pain)', details: { drug: 'Paracetamol', dose: '1g', route: 'IV', frequency: 'Q8H' }, priority: 'routine', isVerbal: false, notes: '' },
      { orderType: 'medication', orderText: 'Inj. Ondansetron 4mg IV SOS (nausea)', details: { drug: 'Ondansetron', dose: '4mg', route: 'IV', frequency: 'SOS' }, priority: 'routine', isVerbal: false, notes: '' },
    ]},
  { id: 'discharge', name: 'Discharge Order Set', description: 'Pre-discharge orders — stop IV, remove catheter, final labs', category: 'discharge',
    orders: [
      { orderType: 'nursing', orderText: 'Discontinue IV access', details: {}, priority: 'routine', isVerbal: false, notes: '' },
      { orderType: 'nursing', orderText: 'Remove Foley catheter', details: {}, priority: 'routine', isVerbal: false, notes: '' },
      { orderType: 'nursing', orderText: 'Final vitals before discharge', details: {}, priority: 'routine', isVerbal: false, notes: '' },
      { orderType: 'nursing', orderText: 'Discharge teaching — medications, warning signs, follow-up', details: {}, priority: 'routine', isVerbal: false, notes: '' },
      { orderType: 'lab', orderText: 'Discharge labs — CBC, RBS if applicable', details: { tests: ['CBC', 'RBS'] }, priority: 'routine', isVerbal: false, notes: '' },
    ]},
];

// ============================================================
// CPOE — Unified Order Entry
// ============================================================
export function useCPOE(admissionId: string | null) {
  const [orders, setOrders] = useState<CPOEOrder[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!admissionId || !sb()) return;
    setLoading(true);
    const { data } = await sb()!.from('hmis_cpoe_orders')
      .select('*, orderer:hmis_staff!hmis_cpoe_orders_ordered_by_fkey(full_name), cosigner:hmis_staff!hmis_cpoe_orders_cosigned_by_fkey(full_name)')
      .eq('admission_id', admissionId).order('created_at', { ascending: false });

    setOrders((data || []).map((o: any) => ({
      id: o.id, admissionId: o.admission_id, patientId: o.patient_id,
      orderType: o.order_type, orderText: o.order_text, details: o.details || {},
      priority: o.priority, status: o.status,
      orderedBy: o.ordered_by, orderedByName: o.orderer?.full_name || '',
      isVerbal: o.is_verbal, cosignedBy: o.cosigned_by, cosignedAt: o.cosigned_at,
      createdAt: o.created_at, notes: o.notes || '',
    })));
    setLoading(false);
  }, [admissionId]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => ({
    total: orders.length,
    active: orders.filter(o => ['ordered', 'verified', 'in_progress'].includes(o.status)).length,
    pendingVerify: orders.filter(o => o.status === 'ordered').length,
    verbal: orders.filter(o => o.isVerbal && !o.cosignedBy).length,
    byType: orders.reduce((acc: Record<string, number>, o) => { acc[o.orderType] = (acc[o.orderType] || 0) + 1; return acc; }, {}),
  }), [orders]);

  // Place single order
  const placeOrder = useCallback(async (data: {
    patientId: string; orderType: string; orderText: string; details?: any;
    priority?: string; isVerbal?: boolean; notes?: string; staffId: string; centreId?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    if (!admissionId || !sb()) return { success: false, error: 'Not ready' };
    const { error } = await sb()!.from('hmis_cpoe_orders').insert({
      admission_id: admissionId, patient_id: data.patientId,
      order_type: data.orderType, order_text: data.orderText,
      details: data.details || {}, priority: data.priority || 'routine',
      status: 'ordered', ordered_by: data.staffId,
      is_verbal: data.isVerbal || false, notes: data.notes || '',
    });
    if (error) return { success: false, error: error.message };
    const cId = data.centreId || '';
    auditCreate(cId, data.staffId, 'cpoe_order', '', `CPOE: ${data.orderText} [${data.priority}]`);
    // Route to downstream module (pharmacy/lab/radiology)
    if (['medication', 'lab', 'radiology'].includes(data.orderType)) {
      await routeCPOEOrder({
        centreId: cId, patientId: data.patientId, admissionId: admissionId!,
        orderType: data.orderType, orderText: data.orderText, details: data.details || {},
        priority: data.priority || 'routine', staffId: data.staffId,
      });
    }
    load();
    return { success: true };
  }, [admissionId, load]);

  // Apply template (bulk orders)
  const applyTemplate = useCallback(async (template: OrderTemplate, patientId: string, staffId: string): Promise<{ success: boolean; count: number }> => {
    if (!admissionId || !sb()) return { success: false, count: 0 };
    const inserts = template.orders.map(o => ({
      admission_id: admissionId, patient_id: patientId,
      order_type: o.orderType, order_text: o.orderText,
      details: o.details || {}, priority: o.priority,
      status: 'ordered', ordered_by: staffId,
      is_verbal: o.isVerbal, notes: o.notes || '',
    }));
    const { error } = await sb()!.from('hmis_cpoe_orders').insert(inserts);
    if (error) return { success: false, count: 0 };
    load();
    return { success: true, count: inserts.length };
  }, [admissionId, load]);

  // Verify order (pharmacy/lab/radiology confirms)
  const verifyOrder = useCallback(async (orderId: string) => {
    await sb()!.from('hmis_cpoe_orders').update({ status: 'verified' }).eq('id', orderId);
    load();
  }, [load]);

  // Cancel order
  const cancelOrder = useCallback(async (orderId: string, reason: string, staffId: string) => {
    await sb()!.from('hmis_cpoe_orders').update({
      status: 'cancelled', notes: reason, cosigned_by: staffId, cosigned_at: new Date().toISOString(),
    }).eq('id', orderId);
    load();
  }, [load]);

  // Cosign verbal order
  const cosignOrder = useCallback(async (orderId: string, staffId: string) => {
    await sb()!.from('hmis_cpoe_orders').update({
      cosigned_by: staffId, cosigned_at: new Date().toISOString(),
    }).eq('id', orderId);
    load();
  }, [load]);

  return { orders, loading, stats, load, placeOrder, applyTemplate, verifyOrder, cancelOrder, cosignOrder };
}
