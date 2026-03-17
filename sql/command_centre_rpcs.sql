-- ============================================================
-- Health1 HMIS — Command Centre Server-Side Aggregation
-- Run in Supabase SQL Editor (project: bmuupgrzbfmddjwcqlss)
-- ============================================================

-- 1. Bed Census — single query, grouped by centre
CREATE OR REPLACE FUNCTION get_bed_census()
RETURNS TABLE (
    centre_id uuid,
    centre_name text,
    centre_code text,
    total_beds bigint,
    occupied bigint,
    available bigint,
    maintenance bigint,
    icu_total bigint,
    icu_occupied bigint,
    ward_type text,
    ward_occupied bigint,
    ward_total bigint
) LANGUAGE sql STABLE AS $$
    WITH bed_data AS (
        SELECT
            c.id AS centre_id,
            c.name AS centre_name,
            c.code AS centre_code,
            b.status AS bed_status,
            w.ward_type
        FROM hmis_beds b
        JOIN hmis_rooms r ON r.id = b.room_id
        JOIN hmis_wards w ON w.id = r.ward_id
        JOIN hmis_centres c ON c.id = w.centre_id
        WHERE c.is_active = true
    )
    SELECT
        bd.centre_id,
        bd.centre_name,
        bd.centre_code,
        COUNT(*) AS total_beds,
        COUNT(*) FILTER (WHERE bd.bed_status = 'occupied') AS occupied,
        COUNT(*) FILTER (WHERE bd.bed_status = 'available') AS available,
        COUNT(*) FILTER (WHERE bd.bed_status = 'maintenance') AS maintenance,
        COUNT(*) FILTER (WHERE bd.ward_type = 'icu') AS icu_total,
        COUNT(*) FILTER (WHERE bd.ward_type = 'icu' AND bd.bed_status = 'occupied') AS icu_occupied,
        bd.ward_type,
        COUNT(*) FILTER (WHERE bd.bed_status = 'occupied') AS ward_occupied,
        COUNT(*) AS ward_total
    FROM bed_data bd
    GROUP BY bd.centre_id, bd.centre_name, bd.centre_code, bd.ward_type
    ORDER BY bd.centre_name, bd.ward_type;
$$;

-- 2. Today's Operations Summary — single query
CREATE OR REPLACE FUNCTION get_daily_ops_summary(p_date date DEFAULT CURRENT_DATE)
RETURNS TABLE (
    centre_id uuid,
    opd_total bigint,
    opd_waiting bigint,
    opd_in_consult bigint,
    opd_completed bigint,
    admissions bigint,
    discharges bigint,
    discharge_pending bigint,
    ot_scheduled bigint,
    ot_in_progress bigint,
    ot_completed bigint,
    ot_cancelled bigint,
    ot_emergency bigint,
    ot_robotic bigint,
    lab_pending bigint
) LANGUAGE sql STABLE AS $$
    WITH opd AS (
        SELECT centre_id,
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'waiting') AS waiting,
            COUNT(*) FILTER (WHERE status = 'in_consultation') AS in_consult,
            COUNT(*) FILTER (WHERE status IN ('completed','checked_out')) AS completed
        FROM hmis_opd_visits
        WHERE visit_date = p_date
        GROUP BY centre_id
    ),
    ipd AS (
        SELECT centre_id,
            COUNT(*) FILTER (WHERE admission_date::date = p_date) AS admissions,
            COUNT(*) FILTER (WHERE status = 'discharged' AND actual_discharge::date = p_date) AS discharges,
            COUNT(*) FILTER (WHERE status = 'discharge_initiated') AS discharge_pending
        FROM hmis_admissions
        GROUP BY centre_id
    ),
    ot AS (
        SELECT b.ot_room_id, r.centre_id,
            COUNT(*) AS scheduled,
            COUNT(*) FILTER (WHERE b.status = 'in_progress') AS in_progress,
            COUNT(*) FILTER (WHERE b.status = 'completed') AS completed,
            COUNT(*) FILTER (WHERE b.status = 'cancelled') AS cancelled,
            COUNT(*) FILTER (WHERE b.is_emergency) AS emergency,
            COUNT(*) FILTER (WHERE b.is_robotic) AS robotic
        FROM hmis_ot_bookings b
        JOIN hmis_ot_rooms r ON r.id = b.ot_room_id
        WHERE b.scheduled_date = p_date
        GROUP BY b.ot_room_id, r.centre_id
    ),
    lab AS (
        SELECT centre_id,
            COUNT(*) FILTER (WHERE status IN ('ordered','collected','processing')) AS pending
        FROM hmis_lab_orders
        WHERE created_at::date = p_date
        GROUP BY centre_id
    ),
    centres AS (SELECT id AS centre_id FROM hmis_centres WHERE is_active = true)
    SELECT
        c.centre_id,
        COALESCE(o.total, 0) AS opd_total,
        COALESCE(o.waiting, 0) AS opd_waiting,
        COALESCE(o.in_consult, 0) AS opd_in_consult,
        COALESCE(o.completed, 0) AS opd_completed,
        COALESCE(i.admissions, 0) AS admissions,
        COALESCE(i.discharges, 0) AS discharges,
        COALESCE(i.discharge_pending, 0) AS discharge_pending,
        COALESCE(SUM(ot_agg.scheduled), 0) AS ot_scheduled,
        COALESCE(SUM(ot_agg.in_progress), 0) AS ot_in_progress,
        COALESCE(SUM(ot_agg.completed), 0) AS ot_completed,
        COALESCE(SUM(ot_agg.cancelled), 0) AS ot_cancelled,
        COALESCE(SUM(ot_agg.emergency), 0) AS ot_emergency,
        COALESCE(SUM(ot_agg.robotic), 0) AS ot_robotic,
        COALESCE(l.pending, 0) AS lab_pending
    FROM centres c
    LEFT JOIN opd o ON o.centre_id = c.centre_id
    LEFT JOIN ipd i ON i.centre_id = c.centre_id
    LEFT JOIN ot ot_agg ON ot_agg.centre_id = c.centre_id
    LEFT JOIN lab l ON l.centre_id = c.centre_id
    GROUP BY c.centre_id, o.total, o.waiting, o.in_consult, o.completed,
        i.admissions, i.discharges, i.discharge_pending, l.pending;
$$;

-- 3. Revenue Summary — single query
CREATE OR REPLACE FUNCTION get_revenue_summary(p_date date DEFAULT CURRENT_DATE)
RETURNS TABLE (
    centre_id uuid,
    bills_count bigint,
    gross_amount numeric,
    discount_amount numeric,
    net_amount numeric,
    paid_amount numeric,
    balance_amount numeric,
    cash_collected numeric,
    upi_collected numeric,
    card_collected numeric,
    neft_collected numeric,
    insurance_billed numeric,
    collection_rate numeric
) LANGUAGE sql STABLE AS $$
    SELECT
        b.centre_id,
        COUNT(*) AS bills_count,
        COALESCE(SUM(b.gross_amount), 0) AS gross_amount,
        COALESCE(SUM(b.discount_amount), 0) AS discount_amount,
        COALESCE(SUM(b.net_amount), 0) AS net_amount,
        COALESCE(SUM(b.paid_amount), 0) AS paid_amount,
        COALESCE(SUM(b.balance_amount), 0) AS balance_amount,
        0::numeric AS cash_collected,
        0::numeric AS upi_collected,
        0::numeric AS card_collected,
        0::numeric AS neft_collected,
        COALESCE(SUM(b.net_amount) FILTER (WHERE b.payor_type != 'self'), 0) AS insurance_billed,
        CASE WHEN SUM(b.net_amount) > 0
            THEN ROUND(SUM(b.paid_amount) / SUM(b.net_amount) * 100, 1)
            ELSE 0 END AS collection_rate
    FROM hmis_bills b
    WHERE b.bill_date = p_date AND b.status != 'cancelled'
    GROUP BY b.centre_id;
$$;

-- 4. Insurance Pipeline — single query
CREATE OR REPLACE FUNCTION get_insurance_pipeline()
RETURNS TABLE (
    centre_id uuid,
    preauth_pending bigint,
    preauth_approved bigint,
    claims_pending bigint,
    claims_approved bigint,
    claims_settled bigint,
    claims_rejected bigint,
    total_claimed numeric,
    total_approved numeric,
    total_settled numeric,
    total_outstanding numeric
) LANGUAGE sql STABLE AS $$
    SELECT
        cl.centre_id,
        COUNT(*) FILTER (WHERE cl.status IN ('preauth_initiated','preauth_submitted')) AS preauth_pending,
        COUNT(*) FILTER (WHERE cl.status = 'preauth_approved') AS preauth_approved,
        COUNT(*) FILTER (WHERE cl.status IN ('claim_submitted','query_raised','query_responded')) AS claims_pending,
        COUNT(*) FILTER (WHERE cl.status IN ('approved','partially_approved')) AS claims_approved,
        COUNT(*) FILTER (WHERE cl.status = 'settled') AS claims_settled,
        COUNT(*) FILTER (WHERE cl.status = 'rejected') AS claims_rejected,
        COALESCE(SUM(cl.claimed_amount), 0) AS total_claimed,
        COALESCE(SUM(cl.approved_amount), 0) AS total_approved,
        COALESCE(SUM(cl.settled_amount), 0) AS total_settled,
        COALESCE(SUM(cl.claimed_amount) - COALESCE(SUM(cl.settled_amount), 0), 0) AS total_outstanding
    FROM hmis_claims cl
    WHERE cl.status NOT IN ('cancelled','settled','rejected')
    GROUP BY cl.centre_id;
$$;
