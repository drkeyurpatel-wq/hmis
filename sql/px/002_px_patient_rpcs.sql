-- ============================================================
-- Health1 HMIS — PX Module: Patient-facing RPCs
-- Migration: 002_px_patient_rpcs.sql
-- These RPCs allow anonymous (no auth) patients to create
-- orders, complaints, nurse calls, and feedback via token.
-- All token validation happens server-side inside the function.
-- ============================================================

-- 1. Create food order
CREATE OR REPLACE FUNCTION px_create_food_order(
  p_token VARCHAR,
  p_items JSONB,
  p_total_amount NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ctx RECORD;
  v_order_id UUID;
BEGIN
  -- Validate token
  SELECT * INTO v_ctx FROM px_validate_token(p_token);
  IF v_ctx.token_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired token';
  END IF;

  INSERT INTO hmis_px_food_orders (
    token_id, patient_id, centre_id, admission_id,
    bed_label, ward_name, patient_name,
    items, total_amount, status
  ) VALUES (
    v_ctx.token_id, v_ctx.patient_id, v_ctx.centre_id, v_ctx.admission_id,
    v_ctx.bed_label, v_ctx.ward_name, v_ctx.patient_name,
    p_items, p_total_amount, 'pending'
  ) RETURNING id INTO v_order_id;

  -- Log activity
  INSERT INTO hmis_px_activity_log (token_id, centre_id, patient_id, activity_type, reference_id, details, performed_by)
  VALUES (v_ctx.token_id, v_ctx.centre_id, v_ctx.patient_id, 'food_order', v_order_id,
    jsonb_build_object('total', p_total_amount), 'patient');

  RETURN v_order_id;
END;
$$;

-- 2. Create complaint
CREATE OR REPLACE FUNCTION px_create_complaint(
  p_token VARCHAR,
  p_category px_complaint_category,
  p_description TEXT,
  p_priority VARCHAR DEFAULT 'normal'
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ctx RECORD;
  v_id UUID;
BEGIN
  SELECT * INTO v_ctx FROM px_validate_token(p_token);
  IF v_ctx.token_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired token';
  END IF;

  INSERT INTO hmis_px_complaints (
    token_id, patient_id, centre_id, admission_id,
    bed_label, ward_name, patient_name,
    category, description, priority
  ) VALUES (
    v_ctx.token_id, v_ctx.patient_id, v_ctx.centre_id, v_ctx.admission_id,
    v_ctx.bed_label, v_ctx.ward_name, v_ctx.patient_name,
    p_category, p_description, p_priority
  ) RETURNING id INTO v_id;

  INSERT INTO hmis_px_activity_log (token_id, centre_id, patient_id, activity_type, reference_id, details, performed_by)
  VALUES (v_ctx.token_id, v_ctx.centre_id, v_ctx.patient_id, 'complaint', v_id,
    jsonb_build_object('category', p_category::text), 'patient');

  RETURN v_id;
END;
$$;

-- 3. Create nurse call
CREATE OR REPLACE FUNCTION px_create_nurse_call(
  p_token VARCHAR,
  p_reason VARCHAR,
  p_priority px_nurse_call_priority DEFAULT 'routine',
  p_details TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ctx RECORD;
  v_id UUID;
  v_can_call BOOLEAN;
BEGIN
  SELECT * INTO v_ctx FROM px_validate_token(p_token);
  IF v_ctx.token_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired token';
  END IF;

  -- Rate limit check
  SELECT px_can_create_nurse_call(v_ctx.token_id) INTO v_can_call;
  IF NOT v_can_call THEN
    RAISE EXCEPTION 'Please wait — you have a recent active call';
  END IF;

  INSERT INTO hmis_px_nurse_calls (
    token_id, patient_id, centre_id, admission_id,
    bed_label, ward_name, patient_name,
    reason, details, priority
  ) VALUES (
    v_ctx.token_id, v_ctx.patient_id, v_ctx.centre_id, v_ctx.admission_id,
    v_ctx.bed_label, v_ctx.ward_name, v_ctx.patient_name,
    p_reason, p_details, p_priority
  ) RETURNING id INTO v_id;

  INSERT INTO hmis_px_activity_log (token_id, centre_id, patient_id, activity_type, reference_id, details, performed_by)
  VALUES (v_ctx.token_id, v_ctx.centre_id, v_ctx.patient_id, 'nurse_call', v_id,
    jsonb_build_object('reason', p_reason, 'priority', p_priority::text), 'patient');

  RETURN v_id;
END;
$$;

-- 4. Submit feedback
CREATE OR REPLACE FUNCTION px_submit_feedback(
  p_token VARCHAR,
  p_overall_rating INT,
  p_category_ratings JSONB DEFAULT '{}',
  p_comments TEXT DEFAULT NULL,
  p_would_recommend BOOLEAN DEFAULT NULL,
  p_is_public BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ctx RECORD;
  v_id UUID;
BEGIN
  SELECT * INTO v_ctx FROM px_validate_token(p_token);
  IF v_ctx.token_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired token';
  END IF;

  IF p_overall_rating < 1 OR p_overall_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;

  INSERT INTO hmis_px_feedback (
    token_id, patient_id, centre_id, admission_id, patient_name,
    overall_rating, category_ratings, comments, would_recommend, is_public
  ) VALUES (
    v_ctx.token_id, v_ctx.patient_id, v_ctx.centre_id, v_ctx.admission_id, v_ctx.patient_name,
    p_overall_rating, p_category_ratings, p_comments, p_would_recommend, p_is_public
  ) RETURNING id INTO v_id;

  INSERT INTO hmis_px_activity_log (token_id, centre_id, patient_id, activity_type, reference_id, details, performed_by)
  VALUES (v_ctx.token_id, v_ctx.centre_id, v_ctx.patient_id, 'feedback', v_id,
    jsonb_build_object('rating', p_overall_rating), 'patient');

  RETURN v_id;
END;
$$;

-- 5. Get patient's orders (read own data)
CREATE OR REPLACE FUNCTION px_get_my_orders(p_token VARCHAR)
RETURNS SETOF hmis_px_food_orders
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ctx RECORD;
BEGIN
  SELECT * INTO v_ctx FROM px_validate_token(p_token);
  IF v_ctx.token_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT * FROM hmis_px_food_orders
  WHERE token_id = v_ctx.token_id
  ORDER BY created_at DESC
  LIMIT 20;
END;
$$;

-- 6. Get patient's nurse calls
CREATE OR REPLACE FUNCTION px_get_my_nurse_calls(p_token VARCHAR)
RETURNS SETOF hmis_px_nurse_calls
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ctx RECORD;
BEGIN
  SELECT * INTO v_ctx FROM px_validate_token(p_token);
  IF v_ctx.token_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT * FROM hmis_px_nurse_calls
  WHERE token_id = v_ctx.token_id
  ORDER BY created_at DESC
  LIMIT 10;
END;
$$;

-- 7. Get patient's complaints
CREATE OR REPLACE FUNCTION px_get_my_complaints(p_token VARCHAR)
RETURNS SETOF hmis_px_complaints
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ctx RECORD;
BEGIN
  SELECT * INTO v_ctx FROM px_validate_token(p_token);
  IF v_ctx.token_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT * FROM hmis_px_complaints
  WHERE token_id = v_ctx.token_id
  ORDER BY created_at DESC;
END;
$$;

-- 8. Get food menu (public, but through RPC for consistency)
CREATE OR REPLACE FUNCTION px_get_menu(p_centre_id UUID)
RETURNS SETOF hmis_px_food_menu
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM hmis_px_food_menu
  WHERE centre_id = p_centre_id
    AND is_available = true
  ORDER BY sort_order;
END;
$$;
