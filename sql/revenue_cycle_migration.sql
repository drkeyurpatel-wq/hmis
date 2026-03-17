-- ============================================================
-- Health1 HMIS — Revenue Cycle Management Enhancement
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Corporate Master + MOU
CREATE TABLE IF NOT EXISTS hmis_corporates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    company_name varchar(200) NOT NULL,
    company_code varchar(20) UNIQUE,
    gst_number varchar(20),
    pan_number varchar(15),
    contact_person varchar(100),
    contact_email varchar(100),
    contact_phone varchar(15),
    billing_address text,
    credit_limit decimal(12,2) DEFAULT 500000,
    credit_period_days int DEFAULT 30,
    current_outstanding decimal(12,2) DEFAULT 0,
    payment_terms text,
    discount_percentage decimal(5,2) DEFAULT 0,
    mou_valid_from date,
    mou_valid_to date,
    mou_document_url text,
    status varchar(10) DEFAULT 'active' CHECK (status IN ('active','suspended','terminated')),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_corporate_employees (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    corporate_id uuid NOT NULL REFERENCES hmis_corporates(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    employee_id varchar(50),
    relationship varchar(20) DEFAULT 'self' CHECK (relationship IN ('self','spouse','child','parent','dependent')),
    coverage_type varchar(20) DEFAULT 'full' CHECK (coverage_type IN ('full','partial','opd_only','ipd_only','emergency_only')),
    max_coverage decimal(12,2),
    is_active boolean DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Loyalty Program
CREATE TABLE IF NOT EXISTS hmis_loyalty_cards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    card_number varchar(20) NOT NULL UNIQUE,
    card_type varchar(15) NOT NULL CHECK (card_type IN ('silver','gold','platinum','staff','freedom_fighter','senior_citizen','bpl')),
    discount_opd decimal(5,2) DEFAULT 0,
    discount_ipd decimal(5,2) DEFAULT 0,
    discount_pharmacy decimal(5,2) DEFAULT 0,
    discount_lab decimal(5,2) DEFAULT 0,
    points_balance int DEFAULT 0,
    issued_date date NOT NULL DEFAULT CURRENT_DATE,
    valid_until date,
    is_active boolean DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_loyalty_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id uuid NOT NULL REFERENCES hmis_loyalty_cards(id),
    bill_id uuid REFERENCES hmis_bills(id),
    transaction_type varchar(10) NOT NULL CHECK (transaction_type IN ('earn','redeem','expire','adjust')),
    points int NOT NULL,
    description text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Accounts Receivable Tracking
CREATE TABLE IF NOT EXISTS hmis_ar_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    bill_id uuid REFERENCES hmis_bills(id),
    claim_id uuid REFERENCES hmis_claims(id),
    corporate_id uuid REFERENCES hmis_corporates(id),
    patient_id uuid NOT NULL REFERENCES hmis_patients(id),
    ar_type varchar(20) NOT NULL CHECK (ar_type IN ('insurance_cashless','insurance_reimbursement','corporate_credit','govt_pmjay','govt_cghs','govt_echs','govt_esi','patient_credit','other')),
    original_amount decimal(12,2) NOT NULL,
    collected_amount decimal(12,2) DEFAULT 0,
    written_off_amount decimal(12,2) DEFAULT 0,
    balance_amount decimal(12,2) NOT NULL,
    due_date date,
    aging_bucket varchar(10) CHECK (aging_bucket IN ('current','30','60','90','120','180','365','bad_debt')),
    last_followup_date date,
    followup_notes text,
    status varchar(15) DEFAULT 'open' CHECK (status IN ('open','partial','settled','written_off','disputed','legal')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_ar_followups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ar_entry_id uuid NOT NULL REFERENCES hmis_ar_entries(id),
    followup_date date NOT NULL DEFAULT CURRENT_DATE,
    followup_type varchar(15) NOT NULL CHECK (followup_type IN ('call','email','letter','legal_notice','visit','portal_check','escalation')),
    contact_person varchar(100),
    response text,
    next_action text,
    next_followup_date date,
    created_by uuid NOT NULL REFERENCES hmis_staff(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Settlement & Reconciliation
CREATE TABLE IF NOT EXISTS hmis_settlements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    settlement_type varchar(20) NOT NULL CHECK (settlement_type IN ('insurance','tpa','pmjay','cghs','echs','esi','corporate')),
    insurer_id uuid REFERENCES hmis_insurers(id),
    tpa_id uuid REFERENCES hmis_tpas(id),
    corporate_id uuid REFERENCES hmis_corporates(id),
    settlement_number varchar(50),
    utr_number varchar(50),
    settlement_date date NOT NULL,
    total_claims int NOT NULL DEFAULT 0,
    claimed_amount decimal(14,2) NOT NULL DEFAULT 0,
    approved_amount decimal(14,2) DEFAULT 0,
    settled_amount decimal(14,2) NOT NULL DEFAULT 0,
    tds_amount decimal(12,2) DEFAULT 0,
    disallowance_amount decimal(12,2) DEFAULT 0,
    net_received decimal(14,2) NOT NULL DEFAULT 0,
    bank_account varchar(30),
    payment_mode varchar(20),
    remarks text,
    reconciled boolean DEFAULT false,
    reconciled_by uuid REFERENCES hmis_staff(id),
    reconciled_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hmis_settlement_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_id uuid NOT NULL REFERENCES hmis_settlements(id) ON DELETE CASCADE,
    claim_id uuid NOT NULL REFERENCES hmis_claims(id),
    bill_id uuid NOT NULL REFERENCES hmis_bills(id),
    patient_name varchar(100),
    bill_number varchar(20),
    claimed_amount decimal(12,2) NOT NULL,
    approved_amount decimal(12,2),
    settled_amount decimal(12,2),
    tds decimal(10,2) DEFAULT 0,
    disallowance decimal(10,2) DEFAULT 0,
    disallowance_reason text,
    status varchar(10) DEFAULT 'settled' CHECK (status IN ('settled','partial','rejected','disputed'))
);

-- 5. Government Scheme Config
CREATE TABLE IF NOT EXISTS hmis_govt_scheme_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    scheme_code varchar(20) NOT NULL CHECK (scheme_code IN ('pmjay','cghs','echs','esi','mjpjay','bsby','mahatma_jyoti','other')),
    scheme_name varchar(100) NOT NULL,
    empanelment_number varchar(50),
    empanelment_valid_from date,
    empanelment_valid_to date,
    nodal_officer varchar(100),
    nodal_phone varchar(15),
    portal_url text,
    portal_login varchar(50),
    package_rates jsonb,
    max_claim_days int DEFAULT 15,
    submission_portal varchar(20) CHECK (submission_portal IN ('rohini','echs_portal','esi_portal','state_portal','direct','other')),
    auto_claim boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(centre_id, scheme_code)
);

-- 6. Integration Bridge Tables
CREATE TABLE IF NOT EXISTS hmis_integration_bridge (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id uuid NOT NULL REFERENCES hmis_centres(id),
    source_system varchar(20) NOT NULL CHECK (source_system IN ('billing','medpay','vpms','cashflow','tally')),
    target_system varchar(20) NOT NULL CHECK (target_system IN ('billing','medpay','vpms','cashflow','tally')),
    entity_type varchar(30) NOT NULL,
    entity_id uuid NOT NULL,
    external_ref varchar(100),
    sync_status varchar(10) DEFAULT 'pending' CHECK (sync_status IN ('pending','synced','failed','skipped')),
    sync_data jsonb,
    error_message text,
    synced_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
DO $$
DECLARE tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['hmis_corporates','hmis_corporate_employees','hmis_loyalty_cards','hmis_loyalty_transactions','hmis_ar_entries','hmis_ar_followups','hmis_settlements','hmis_settlement_items','hmis_govt_scheme_config','hmis_integration_bridge'] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_pol', tbl);
        EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (auth.uid() IS NOT NULL)', tbl || '_pol', tbl);
    END LOOP;
END $$;

-- ============================================================
-- SEED: Insurers, TPAs, Corporates, Govt Schemes, Loyalty Types
-- ============================================================

-- Major Indian Insurers
INSERT INTO hmis_insurers (name, code) VALUES
  ('Star Health','STAR'),('ICICI Lombard','ICICI'),('HDFC Ergo','HDFC'),
  ('Bajaj Allianz','BAJAJ'),('Max Bupa (Niva)','NIVA'),('Care Health','CARE'),
  ('New India Assurance','NIA'),('United India','UI'),('Oriental Insurance','OIC'),
  ('National Insurance','NIC'),('Manipal Cigna','MANIPAL'),('Aditya Birla','BIRLA'),
  ('SBI General','SBI'),('Tata AIG','TATA'),('Cholamandalam','CHOLA'),
  ('Reliance General','REL'),('Universal Sompo','USOMPO'),('MagmaHDI','MAGMA'),
  ('Go Digit','DIGIT'),('Acko','ACKO'),
  ('Bajaj General (PMJAY)','BAJAJ_PMJAY')
ON CONFLICT (code) DO NOTHING;

-- TPAs
INSERT INTO hmis_tpas (name, code) VALUES
  ('Medi Assist','MEDIASSIST'),('Paramount Health','PARAMOUNT'),
  ('FHPL (Family Health Plan)','FHPL'),('Vipul Medcorp','VIPUL'),
  ('Raksha TPA','RAKSHA'),('MDIndia','MDINDIA'),
  ('Heritage Health','HERITAGE'),('Ericson','ERICSON'),
  ('Medsave','MEDSAVE'),('Safeway','SAFEWAY'),
  ('Anmol Medicare','ANMOL'),('Good Health','GOODHEALTH'),
  ('East West Assist','EASTWEST'),('United Health Care','UHC'),
  ('Dedicated Healthcare','DHC')
ON CONFLICT (code) DO NOTHING;

-- Sample Corporates
INSERT INTO hmis_corporates (centre_id, company_name, company_code, credit_limit, credit_period_days, discount_percentage)
SELECT c.id, corp.name, corp.code, corp.limit_val, corp.days, corp.disc
FROM hmis_centres c, (VALUES
  ('Adani Group','ADANI',1000000,30,5),
  ('Torrent Pharma','TORRENT',500000,30,5),
  ('Zydus Lifesciences','ZYDUS',500000,30,5),
  ('Cadila Healthcare','CADILA',500000,30,5),
  ('Gujarat Gas','GGAS',300000,30,3),
  ('GSPC','GSPC',300000,30,3),
  ('ONGC','ONGC',500000,45,0),
  ('IOCL','IOCL',500000,45,0),
  ('TCS Ahmedabad','TCS',1000000,30,5),
  ('Infosys Ahmedabad','INFY',500000,30,5),
  ('AMUL (GCMMF)','AMUL',300000,30,3)
) AS corp(name, code, limit_val, days, disc)
WHERE c.code = 'SHJ' OR c.name ILIKE '%shilaj%'
LIMIT 11;

-- Govt scheme configs
INSERT INTO hmis_govt_scheme_config (centre_id, scheme_code, scheme_name, submission_portal, max_claim_days)
SELECT c.id, s.code, s.name, s.portal, s.days
FROM hmis_centres c, (VALUES
  ('pmjay','Ayushman Bharat PM-JAY','rohini',15),
  ('cghs','Central Govt Health Scheme','direct',30),
  ('echs','Ex-Servicemen Contributory Health Scheme','echs_portal',21),
  ('esi','Employees State Insurance','esi_portal',15),
  ('mjpjay','Mukhyamantri Amrutum (MA) / MJPJAY','state_portal',15)
) AS s(code, name, portal, days)
WHERE c.code = 'SHJ' OR c.name ILIKE '%shilaj%'
ON CONFLICT (centre_id, scheme_code) DO NOTHING;
