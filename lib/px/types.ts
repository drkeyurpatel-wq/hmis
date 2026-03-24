// lib/px/types.ts
// Health1 HMIS — Patient Experience Module Types

// ============================================================
// Enums
// ============================================================

export type FoodOrderStatus =
  | 'pending'
  | 'nurse_approved'
  | 'nurse_rejected'
  | 'preparing'
  | 'ready'
  | 'delivered'
  | 'cancelled';

export type ComplaintStatus = 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed';

export type ComplaintCategory =
  | 'cleanliness'
  | 'food_quality'
  | 'staff_behaviour'
  | 'noise'
  | 'equipment'
  | 'billing'
  | 'delay'
  | 'other';

export type NurseCallPriority = 'routine' | 'urgent' | 'emergency';

export type NurseCallStatus = 'pending' | 'acknowledged' | 'in_progress' | 'completed' | 'cancelled';

export type PxActivityType =
  | 'food_order'
  | 'food_status_change'
  | 'complaint'
  | 'complaint_status_change'
  | 'nurse_call'
  | 'nurse_call_status_change'
  | 'feedback'
  | 'token_created'
  | 'token_expired';

// ============================================================
// Database Row Types
// ============================================================

export interface PxToken {
  id: string;
  token: string;
  admission_id: string;
  patient_id: string;
  centre_id: string;
  bed_id: string | null;
  ward_id: string | null;
  is_active: boolean;
  created_at: string;
  expired_at: string | null;
  created_by: string | null;
}

export interface PxTokenContext {
  token_id: string;
  patient_id: string;
  admission_id: string;
  centre_id: string;
  bed_id: string | null;
  ward_id: string | null;
  patient_name: string;
  bed_label: string | null;
  ward_name: string | null;
}

export interface FoodMenuItem {
  id: string;
  centre_id: string;
  name: string;
  name_gujarati: string | null;
  category: string;
  description: string | null;
  price: number;
  dietary_tags: string[];
  image_url: string | null;
  is_available: boolean;
  available_from: string | null;
  available_until: string | null;
  sort_order: number;
}

export interface FoodOrderItem {
  menu_item_id: string;
  name: string;
  qty: number;
  price: number;
  dietary_tags: string[];
  special_instructions?: string;
}

export interface FoodOrder {
  id: string;
  token_id: string;
  patient_id: string;
  centre_id: string;
  admission_id: string;
  bed_label: string | null;
  ward_name: string | null;
  patient_name: string | null;
  items: FoodOrderItem[];
  item_count: number;
  total_amount: number;
  status: FoodOrderStatus;
  nurse_id: string | null;
  nurse_action_at: string | null;
  nurse_notes: string | null;
  kitchen_notes: string | null;
  dietary_restrictions: string | null;
  prepared_at: string | null;
  delivered_at: string | null;
  cancelled_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface PxComplaint {
  id: string;
  token_id: string;
  patient_id: string;
  centre_id: string;
  admission_id: string;
  bed_label: string | null;
  ward_name: string | null;
  patient_name: string | null;
  category: ComplaintCategory;
  description: string;
  photo_url: string | null;
  priority: string;
  status: ComplaintStatus;
  assigned_to: string | null;
  assigned_at: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  sla_hours: number;
  created_at: string;
  updated_at: string;
}

export interface NurseCall {
  id: string;
  token_id: string;
  patient_id: string;
  centre_id: string;
  admission_id: string;
  bed_label: string | null;
  ward_name: string | null;
  patient_name: string | null;
  reason: string;
  details: string | null;
  priority: NurseCallPriority;
  status: NurseCallStatus;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  completed_by: string | null;
  completed_at: string | null;
  response_seconds: number | null;
  resolution_seconds: number | null;
  created_at: string;
  updated_at: string;
}

export interface PxFeedback {
  id: string;
  token_id: string | null;
  patient_id: string;
  centre_id: string;
  admission_id: string | null;
  patient_name: string | null;
  overall_rating: number;
  category_ratings: Record<string, number>;
  comments: string | null;
  would_recommend: boolean | null;
  is_public: boolean;
  google_review_status: string;
  google_review_url: string | null;
  staff_response: string | null;
  responded_by: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PxActivityLog {
  id: string;
  token_id: string | null;
  centre_id: string;
  patient_id: string | null;
  activity_type: PxActivityType;
  reference_id: string | null;
  details: Record<string, unknown>;
  performed_by: string | null;
  created_at: string;
}

// ============================================================
// UI / Cart Types
// ============================================================

export interface CartItem extends FoodOrderItem {
  menu_item_id: string;
}

export interface PxStats {
  pending_food_orders: number;
  active_nurse_calls: number;
  open_complaints: number;
  avg_rating: number;
  total_feedback: number;
}

// ============================================================
// Label Maps
// ============================================================

export const FOOD_ORDER_STATUS_LABELS: Record<FoodOrderStatus, string> = {
  pending: 'Pending Approval',
  nurse_approved: 'Approved',
  nurse_rejected: 'Rejected',
  preparing: 'Being Prepared',
  ready: 'Ready for Pickup',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const FOOD_ORDER_STATUS_COLORS: Record<FoodOrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  nurse_approved: 'bg-blue-100 text-blue-800',
  nurse_rejected: 'bg-red-100 text-red-800',
  preparing: 'bg-orange-100 text-orange-800',
  ready: 'bg-green-100 text-green-800',
  delivered: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-gray-100 text-gray-500',
};

export const COMPLAINT_CATEGORY_LABELS: Record<ComplaintCategory, string> = {
  cleanliness: 'Cleanliness',
  food_quality: 'Food Quality',
  staff_behaviour: 'Staff Behaviour',
  noise: 'Noise',
  equipment: 'Equipment / Facility',
  billing: 'Billing Issue',
  delay: 'Delay in Service',
  other: 'Other',
};

export const COMPLAINT_STATUS_LABELS: Record<ComplaintStatus, string> = {
  open: 'Open',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const NURSE_CALL_REASONS = [
  'Need pain medication',
  'Need to use washroom',
  'IV drip issue',
  'Feeling unwell',
  'Need water/food',
  'Need help getting up',
  'Machine beeping/alarm',
  'Need blanket/pillow',
  'Visitor assistance',
  'Other',
] as const;

export const NURSE_CALL_PRIORITY_LABELS: Record<NurseCallPriority, string> = {
  routine: 'Routine',
  urgent: 'Urgent',
  emergency: 'Emergency',
};

export const NURSE_CALL_PRIORITY_COLORS: Record<NurseCallPriority, string> = {
  routine: 'bg-blue-100 text-blue-800',
  urgent: 'bg-orange-100 text-orange-800',
  emergency: 'bg-red-100 text-red-800',
};

export const FEEDBACK_CATEGORIES = [
  { key: 'cleanliness', label: 'Cleanliness', label_gu: 'સ્વચ્છતા' },
  { key: 'food', label: 'Food Quality', label_gu: 'ભોજનની ગુણવત્તા' },
  { key: 'nursing', label: 'Nursing Care', label_gu: 'નર્સિંગ સેવા' },
  { key: 'doctors', label: 'Doctor Care', label_gu: 'ડૉક્ટર સેવા' },
  { key: 'facilities', label: 'Facilities', label_gu: 'સુવિધાઓ' },
  { key: 'billing', label: 'Billing', label_gu: 'બિલિંગ' },
] as const;
