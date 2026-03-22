-- Health1 HMIS — Procurement Module Migration
-- Purchase Indents + Vendor Directory

-- ============================================================
-- PURCHASE INDENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_purchase_indents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid NOT NULL REFERENCES hmis_centres(id),
  indent_number varchar(30) NOT NULL,
  department varchar(100) NOT NULL,
  -- Items
  items jsonb NOT NULL DEFAULT '[]',
  -- items: [{item_name, qty, unit, specification, urgency: routine/urgent/emergency, estimated_cost}]
  total_estimated_cost decimal(12,2) DEFAULT 0,
  -- Workflow
  requested_by uuid REFERENCES hmis_staff(id),
  approved_by uuid REFERENCES hmis_staff(id),
  approved_at timestamp with time zone,
  rejected_by uuid REFERENCES hmis_staff(id),
  rejected_at timestamp with time zone,
  rejection_reason text,
  po_id uuid REFERENCES hmis_pharmacy_po(id),
  -- Meta
  priority varchar(10) DEFAULT 'routine', -- routine, urgent, emergency
  status varchar(20) NOT NULL DEFAULT 'draft', -- draft, submitted, approved, rejected, ordered, partially_received, received, cancelled
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_indents_centre ON hmis_purchase_indents(centre_id, status);
CREATE INDEX IF NOT EXISTS idx_indents_requester ON hmis_purchase_indents(requested_by);

-- ============================================================
-- VENDOR DIRECTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS hmis_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES hmis_centres(id),
  name varchar(200) NOT NULL,
  code varchar(20),
  contact_person varchar(200),
  phone varchar(20),
  email varchar(200),
  category varchar(50), -- pharma, surgical, medical_equipment, it, facility, lab, consumables, other
  sub_category varchar(100),
  gst_number varchar(20),
  pan_number varchar(20),
  address_line1 text,
  address_line2 text,
  city varchar(100),
  state varchar(100),
  pincode varchar(10),
  bank_name varchar(100),
  bank_account varchar(30),
  bank_ifsc varchar(15),
  credit_days integer DEFAULT 30,
  rating decimal(2,1) DEFAULT 3.0, -- 1.0 to 5.0
  total_orders integer DEFAULT 0,
  total_value decimal(14,2) DEFAULT 0,
  last_order_date date,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vendors_centre ON hmis_vendors(centre_id, is_active);
CREATE INDEX IF NOT EXISTS idx_vendors_category ON hmis_vendors(category);
