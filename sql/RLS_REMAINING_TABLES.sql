-- RLS Hardening: Remaining ~48 tables
-- Generated: 2026-04-05
-- IMPORTANT: Apply these ONE TABLE AT A TIME, verifying after each batch of 3-5
-- DO NOT run this entire file at once in production
--
-- Patterns used:
--   A = centre_id scoped (SELECT/INSERT/UPDATE filtered by user's centres)
--   B = reference/config data (authenticated read, super_admin write)
--   C = patient-scoped (authenticated read/write, no centre filter)
--
-- Helper functions:
--   public.hmis_get_user_centre_ids() -> uuid[]
--   public.hmis_is_super_admin() -> boolean


-- ============================================================================
-- PATTERN A: Tables WITH centre_id column
-- Users can only see/modify rows belonging to their assigned centres.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A1: hmis_notification_templates
-- ---------------------------------------------------------------------------
ALTER TABLE public.hmis_notification_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_notification_templates_authenticated ON public.hmis_notification_templates;
CREATE POLICY hmis_notification_templates_centre_sel ON public.hmis_notification_templates
  FOR SELECT TO authenticated
  USING (centre_id = ANY(public.hmis_get_user_centre_ids()));
CREATE POLICY hmis_notification_templates_centre_ins ON public.hmis_notification_templates
  FOR INSERT TO authenticated
  WITH CHECK (centre_id = ANY(public.hmis_get_user_centre_ids()));
CREATE POLICY hmis_notification_templates_centre_upd ON public.hmis_notification_templates
  FOR UPDATE TO authenticated
  USING (centre_id = ANY(public.hmis_get_user_centre_ids()))
  WITH CHECK (centre_id = ANY(public.hmis_get_user_centre_ids()));

-- ---------------------------------------------------------------------------
-- A2: hmis_cost_centre_budgets
-- ---------------------------------------------------------------------------
ALTER TABLE public.hmis_cost_centre_budgets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_cost_centre_budgets_authenticated ON public.hmis_cost_centre_budgets;
CREATE POLICY hmis_cost_centre_budgets_centre_sel ON public.hmis_cost_centre_budgets
  FOR SELECT TO authenticated
  USING (centre_id = ANY(public.hmis_get_user_centre_ids()));
CREATE POLICY hmis_cost_centre_budgets_centre_ins ON public.hmis_cost_centre_budgets
  FOR INSERT TO authenticated
  WITH CHECK (centre_id = ANY(public.hmis_get_user_centre_ids()));
CREATE POLICY hmis_cost_centre_budgets_centre_upd ON public.hmis_cost_centre_budgets
  FOR UPDATE TO authenticated
  USING (centre_id = ANY(public.hmis_get_user_centre_ids()))
  WITH CHECK (centre_id = ANY(public.hmis_get_user_centre_ids()));

-- ---------------------------------------------------------------------------
-- A3: hmis_cost_centre_transactions
-- ---------------------------------------------------------------------------
ALTER TABLE public.hmis_cost_centre_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_cost_centre_transactions_authenticated ON public.hmis_cost_centre_transactions;
CREATE POLICY hmis_cost_centre_transactions_centre_sel ON public.hmis_cost_centre_transactions
  FOR SELECT TO authenticated
  USING (centre_id = ANY(public.hmis_get_user_centre_ids()));
CREATE POLICY hmis_cost_centre_transactions_centre_ins ON public.hmis_cost_centre_transactions
  FOR INSERT TO authenticated
  WITH CHECK (centre_id = ANY(public.hmis_get_user_centre_ids()));
CREATE POLICY hmis_cost_centre_transactions_centre_upd ON public.hmis_cost_centre_transactions
  FOR UPDATE TO authenticated
  USING (centre_id = ANY(public.hmis_get_user_centre_ids()))
  WITH CHECK (centre_id = ANY(public.hmis_get_user_centre_ids()));

-- ---------------------------------------------------------------------------
-- A4: hmis_equipment_maintenance
-- ---------------------------------------------------------------------------
ALTER TABLE public.hmis_equipment_maintenance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_equipment_maintenance_authenticated ON public.hmis_equipment_maintenance;
CREATE POLICY hmis_equipment_maintenance_centre_sel ON public.hmis_equipment_maintenance
  FOR SELECT TO authenticated
  USING (centre_id = ANY(public.hmis_get_user_centre_ids()));
CREATE POLICY hmis_equipment_maintenance_centre_ins ON public.hmis_equipment_maintenance
  FOR INSERT TO authenticated
  WITH CHECK (centre_id = ANY(public.hmis_get_user_centre_ids()));
CREATE POLICY hmis_equipment_maintenance_centre_upd ON public.hmis_equipment_maintenance
  FOR UPDATE TO authenticated
  USING (centre_id = ANY(public.hmis_get_user_centre_ids()))
  WITH CHECK (centre_id = ANY(public.hmis_get_user_centre_ids()));

-- ---------------------------------------------------------------------------
-- A5: hmis_housekeeping_tasks
-- ---------------------------------------------------------------------------
ALTER TABLE public.hmis_housekeeping_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_housekeeping_tasks_authenticated ON public.hmis_housekeeping_tasks;
CREATE POLICY hmis_housekeeping_tasks_centre_sel ON public.hmis_housekeeping_tasks
  FOR SELECT TO authenticated
  USING (centre_id = ANY(public.hmis_get_user_centre_ids()));
CREATE POLICY hmis_housekeeping_tasks_centre_ins ON public.hmis_housekeeping_tasks
  FOR INSERT TO authenticated
  WITH CHECK (centre_id = ANY(public.hmis_get_user_centre_ids()));
CREATE POLICY hmis_housekeeping_tasks_centre_upd ON public.hmis_housekeeping_tasks
  FOR UPDATE TO authenticated
  USING (centre_id = ANY(public.hmis_get_user_centre_ids()))
  WITH CHECK (centre_id = ANY(public.hmis_get_user_centre_ids()));

-- ---------------------------------------------------------------------------
-- A6: hmis_linen_inventory
-- ---------------------------------------------------------------------------
ALTER TABLE public.hmis_linen_inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_linen_inventory_authenticated ON public.hmis_linen_inventory;
CREATE POLICY hmis_linen_inventory_centre_sel ON public.hmis_linen_inventory
  FOR SELECT TO authenticated
  USING (centre_id = ANY(public.hmis_get_user_centre_ids()));
CREATE POLICY hmis_linen_inventory_centre_ins ON public.hmis_linen_inventory
  FOR INSERT TO authenticated
  WITH CHECK (centre_id = ANY(public.hmis_get_user_centre_ids()));
CREATE POLICY hmis_linen_inventory_centre_upd ON public.hmis_linen_inventory
  FOR UPDATE TO authenticated
  USING (centre_id = ANY(public.hmis_get_user_centre_ids()))
  WITH CHECK (centre_id = ANY(public.hmis_get_user_centre_ids()));

-- ---------------------------------------------------------------------------
-- A7: hmis_integration_config
-- ---------------------------------------------------------------------------
ALTER TABLE public.hmis_integration_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_integration_config_authenticated ON public.hmis_integration_config;
CREATE POLICY hmis_integration_config_centre_sel ON public.hmis_integration_config
  FOR SELECT TO authenticated
  USING (centre_id = ANY(public.hmis_get_user_centre_ids()));
CREATE POLICY hmis_integration_config_centre_ins ON public.hmis_integration_config
  FOR INSERT TO authenticated
  WITH CHECK (centre_id = ANY(public.hmis_get_user_centre_ids()));
CREATE POLICY hmis_integration_config_centre_upd ON public.hmis_integration_config
  FOR UPDATE TO authenticated
  USING (centre_id = ANY(public.hmis_get_user_centre_ids()))
  WITH CHECK (centre_id = ANY(public.hmis_get_user_centre_ids()));

-- ---------------------------------------------------------------------------
-- A8: hmis_integration_log
-- ---------------------------------------------------------------------------
ALTER TABLE public.hmis_integration_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_integration_log_authenticated ON public.hmis_integration_log;
CREATE POLICY hmis_integration_log_centre_sel ON public.hmis_integration_log
  FOR SELECT TO authenticated
  USING (centre_id = ANY(public.hmis_get_user_centre_ids()));
CREATE POLICY hmis_integration_log_centre_ins ON public.hmis_integration_log
  FOR INSERT TO authenticated
  WITH CHECK (centre_id = ANY(public.hmis_get_user_centre_ids()));
CREATE POLICY hmis_integration_log_centre_upd ON public.hmis_integration_log
  FOR UPDATE TO authenticated
  USING (centre_id = ANY(public.hmis_get_user_centre_ids()))
  WITH CHECK (centre_id = ANY(public.hmis_get_user_centre_ids()));

-- ---------------------------------------------------------------------------
-- A9: hmis_ot_daily_stats
-- ---------------------------------------------------------------------------
ALTER TABLE public.hmis_ot_daily_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_ot_daily_stats_authenticated ON public.hmis_ot_daily_stats;
CREATE POLICY hmis_ot_daily_stats_centre_sel ON public.hmis_ot_daily_stats
  FOR SELECT TO authenticated
  USING (centre_id = ANY(public.hmis_get_user_centre_ids()));
CREATE POLICY hmis_ot_daily_stats_centre_ins ON public.hmis_ot_daily_stats
  FOR INSERT TO authenticated
  WITH CHECK (centre_id = ANY(public.hmis_get_user_centre_ids()));
CREATE POLICY hmis_ot_daily_stats_centre_upd ON public.hmis_ot_daily_stats
  FOR UPDATE TO authenticated
  USING (centre_id = ANY(public.hmis_get_user_centre_ids()))
  WITH CHECK (centre_id = ANY(public.hmis_get_user_centre_ids()));

-- ---------------------------------------------------------------------------
-- A10: pulse_daily_snapshots
-- ---------------------------------------------------------------------------
ALTER TABLE public.pulse_daily_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pulse_daily_snapshots_authenticated ON public.pulse_daily_snapshots;
CREATE POLICY pulse_daily_snapshots_centre_sel ON public.pulse_daily_snapshots
  FOR SELECT TO authenticated
  USING (centre_id = ANY(public.hmis_get_user_centre_ids()));
CREATE POLICY pulse_daily_snapshots_centre_ins ON public.pulse_daily_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (centre_id = ANY(public.hmis_get_user_centre_ids()));
CREATE POLICY pulse_daily_snapshots_centre_upd ON public.pulse_daily_snapshots
  FOR UPDATE TO authenticated
  USING (centre_id = ANY(public.hmis_get_user_centre_ids()))
  WITH CHECK (centre_id = ANY(public.hmis_get_user_centre_ids()));

-- ---------------------------------------------------------------------------
-- A11: hmis_mortuary (centre-scoped — has centre_id for facility tracking)
-- ---------------------------------------------------------------------------
ALTER TABLE public.hmis_mortuary ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_mortuary_authenticated ON public.hmis_mortuary;
CREATE POLICY hmis_mortuary_centre_sel ON public.hmis_mortuary
  FOR SELECT TO authenticated
  USING (centre_id = ANY(public.hmis_get_user_centre_ids()));
CREATE POLICY hmis_mortuary_centre_ins ON public.hmis_mortuary
  FOR INSERT TO authenticated
  WITH CHECK (centre_id = ANY(public.hmis_get_user_centre_ids()));
CREATE POLICY hmis_mortuary_centre_upd ON public.hmis_mortuary
  FOR UPDATE TO authenticated
  USING (centre_id = ANY(public.hmis_get_user_centre_ids()))
  WITH CHECK (centre_id = ANY(public.hmis_get_user_centre_ids()));


-- ============================================================================
-- PATTERN B: Reference/config tables WITHOUT centre_id
-- All authenticated users can read. Only super admins can write.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- B1: referral_sources
-- ---------------------------------------------------------------------------
ALTER TABLE public.referral_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS referral_sources_authenticated ON public.referral_sources;
CREATE POLICY referral_sources_read ON public.referral_sources
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY referral_sources_admin ON public.referral_sources
  FOR ALL TO authenticated
  USING (public.hmis_is_super_admin())
  WITH CHECK (public.hmis_is_super_admin());

-- ---------------------------------------------------------------------------
-- B2: hmis_notification_preferences
-- ---------------------------------------------------------------------------
ALTER TABLE public.hmis_notification_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_notification_preferences_authenticated ON public.hmis_notification_preferences;
CREATE POLICY hmis_notification_preferences_read ON public.hmis_notification_preferences
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY hmis_notification_preferences_admin ON public.hmis_notification_preferences
  FOR ALL TO authenticated
  USING (public.hmis_is_super_admin())
  WITH CHECK (public.hmis_is_super_admin());

-- ---------------------------------------------------------------------------
-- B3: hmis_report_subscriptions
-- ---------------------------------------------------------------------------
ALTER TABLE public.hmis_report_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_report_subscriptions_authenticated ON public.hmis_report_subscriptions;
CREATE POLICY hmis_report_subscriptions_read ON public.hmis_report_subscriptions
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY hmis_report_subscriptions_admin ON public.hmis_report_subscriptions
  FOR ALL TO authenticated
  USING (public.hmis_is_super_admin())
  WITH CHECK (public.hmis_is_super_admin());


-- ============================================================================
-- PATTERN B: brain_* tables (rule engine — reference/config data)
-- All authenticated users can read. Only super admins can modify rules.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- B4: brain_rules
-- ---------------------------------------------------------------------------
ALTER TABLE public.brain_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS brain_rules_authenticated ON public.brain_rules;
CREATE POLICY brain_rules_read ON public.brain_rules
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY brain_rules_admin ON public.brain_rules
  FOR ALL TO authenticated
  USING (public.hmis_is_super_admin())
  WITH CHECK (public.hmis_is_super_admin());

-- ---------------------------------------------------------------------------
-- B5: brain_actions
-- ---------------------------------------------------------------------------
ALTER TABLE public.brain_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS brain_actions_authenticated ON public.brain_actions;
CREATE POLICY brain_actions_read ON public.brain_actions
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY brain_actions_admin ON public.brain_actions
  FOR ALL TO authenticated
  USING (public.hmis_is_super_admin())
  WITH CHECK (public.hmis_is_super_admin());

-- ---------------------------------------------------------------------------
-- B6: brain_triggers
-- ---------------------------------------------------------------------------
ALTER TABLE public.brain_triggers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS brain_triggers_authenticated ON public.brain_triggers;
CREATE POLICY brain_triggers_read ON public.brain_triggers
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY brain_triggers_admin ON public.brain_triggers
  FOR ALL TO authenticated
  USING (public.hmis_is_super_admin())
  WITH CHECK (public.hmis_is_super_admin());

-- ---------------------------------------------------------------------------
-- B7: brain_logs
-- ---------------------------------------------------------------------------
ALTER TABLE public.brain_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS brain_logs_authenticated ON public.brain_logs;
CREATE POLICY brain_logs_read ON public.brain_logs
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY brain_logs_admin ON public.brain_logs
  FOR ALL TO authenticated
  USING (public.hmis_is_super_admin())
  WITH CHECK (public.hmis_is_super_admin());

-- ---------------------------------------------------------------------------
-- B8: brain_conditions
-- ---------------------------------------------------------------------------
ALTER TABLE public.brain_conditions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS brain_conditions_authenticated ON public.brain_conditions;
CREATE POLICY brain_conditions_read ON public.brain_conditions
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY brain_conditions_admin ON public.brain_conditions
  FOR ALL TO authenticated
  USING (public.hmis_is_super_admin())
  WITH CHECK (public.hmis_is_super_admin());


-- ============================================================================
-- PATTERN C: Patient-scoped tables (have patient_id, no centre_id)
-- All authenticated clinical users can read and write. Fine-grained
-- role checks should be handled at the application layer; RLS ensures
-- only authenticated sessions have access.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- C1: hmis_vitals
-- ---------------------------------------------------------------------------
ALTER TABLE public.hmis_vitals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_vitals_authenticated ON public.hmis_vitals;
CREATE POLICY hmis_vitals_read ON public.hmis_vitals
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY hmis_vitals_write ON public.hmis_vitals
  FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY hmis_vitals_upd ON public.hmis_vitals
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- C2: hmis_orders
-- ---------------------------------------------------------------------------
ALTER TABLE public.hmis_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_orders_authenticated ON public.hmis_orders;
CREATE POLICY hmis_orders_read ON public.hmis_orders
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY hmis_orders_write ON public.hmis_orders
  FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY hmis_orders_upd ON public.hmis_orders
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- C3: hmis_patient_allergies
-- ---------------------------------------------------------------------------
ALTER TABLE public.hmis_patient_allergies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_patient_allergies_authenticated ON public.hmis_patient_allergies;
CREATE POLICY hmis_patient_allergies_read ON public.hmis_patient_allergies
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY hmis_patient_allergies_write ON public.hmis_patient_allergies
  FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY hmis_patient_allergies_upd ON public.hmis_patient_allergies
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- C4: hmis_patient_contacts
-- ---------------------------------------------------------------------------
ALTER TABLE public.hmis_patient_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_patient_contacts_authenticated ON public.hmis_patient_contacts;
CREATE POLICY hmis_patient_contacts_read ON public.hmis_patient_contacts
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY hmis_patient_contacts_write ON public.hmis_patient_contacts
  FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY hmis_patient_contacts_upd ON public.hmis_patient_contacts
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- C5: hmis_patient_feedback
-- ---------------------------------------------------------------------------
ALTER TABLE public.hmis_patient_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_patient_feedback_authenticated ON public.hmis_patient_feedback;
CREATE POLICY hmis_patient_feedback_read ON public.hmis_patient_feedback
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY hmis_patient_feedback_write ON public.hmis_patient_feedback
  FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY hmis_patient_feedback_upd ON public.hmis_patient_feedback
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- C6: hmis_prescription_refill_requests
-- ---------------------------------------------------------------------------
ALTER TABLE public.hmis_prescription_refill_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_prescription_refill_requests_authenticated ON public.hmis_prescription_refill_requests;
CREATE POLICY hmis_prescription_refill_requests_read ON public.hmis_prescription_refill_requests
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY hmis_prescription_refill_requests_write ON public.hmis_prescription_refill_requests
  FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY hmis_prescription_refill_requests_upd ON public.hmis_prescription_refill_requests
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- C7: hmis_insurance_documents
-- ---------------------------------------------------------------------------
ALTER TABLE public.hmis_insurance_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_insurance_documents_authenticated ON public.hmis_insurance_documents;
CREATE POLICY hmis_insurance_documents_read ON public.hmis_insurance_documents
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY hmis_insurance_documents_write ON public.hmis_insurance_documents
  FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY hmis_insurance_documents_upd ON public.hmis_insurance_documents
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- C8: hmis_notification_log
-- ---------------------------------------------------------------------------
ALTER TABLE public.hmis_notification_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_notification_log_authenticated ON public.hmis_notification_log;
CREATE POLICY hmis_notification_log_read ON public.hmis_notification_log
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY hmis_notification_log_write ON public.hmis_notification_log
  FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY hmis_notification_log_upd ON public.hmis_notification_log
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- C9: hmis_conversion_followups
-- ---------------------------------------------------------------------------
ALTER TABLE public.hmis_conversion_followups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_conversion_followups_authenticated ON public.hmis_conversion_followups;
CREATE POLICY hmis_conversion_followups_read ON public.hmis_conversion_followups
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY hmis_conversion_followups_write ON public.hmis_conversion_followups
  FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY hmis_conversion_followups_upd ON public.hmis_conversion_followups
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- C10: hmis_consent_audit
-- ---------------------------------------------------------------------------
ALTER TABLE public.hmis_consent_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_consent_audit_authenticated ON public.hmis_consent_audit;
CREATE POLICY hmis_consent_audit_read ON public.hmis_consent_audit
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY hmis_consent_audit_write ON public.hmis_consent_audit
  FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY hmis_consent_audit_upd ON public.hmis_consent_audit
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- C11: hmis_patient_consents
-- ---------------------------------------------------------------------------
ALTER TABLE public.hmis_patient_consents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_patient_consents_authenticated ON public.hmis_patient_consents;
CREATE POLICY hmis_patient_consents_read ON public.hmis_patient_consents
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY hmis_patient_consents_write ON public.hmis_patient_consents
  FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY hmis_patient_consents_upd ON public.hmis_patient_consents
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- C12: hmis_cdss_overrides
-- ---------------------------------------------------------------------------
ALTER TABLE public.hmis_cdss_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_cdss_overrides_authenticated ON public.hmis_cdss_overrides;
CREATE POLICY hmis_cdss_overrides_read ON public.hmis_cdss_overrides
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY hmis_cdss_overrides_write ON public.hmis_cdss_overrides
  FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY hmis_cdss_overrides_upd ON public.hmis_cdss_overrides
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- C13: hmis_diagnoses
-- ---------------------------------------------------------------------------
ALTER TABLE public.hmis_diagnoses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_diagnoses_authenticated ON public.hmis_diagnoses;
CREATE POLICY hmis_diagnoses_read ON public.hmis_diagnoses
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY hmis_diagnoses_write ON public.hmis_diagnoses
  FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY hmis_diagnoses_upd ON public.hmis_diagnoses
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- C14: hmis_physio_fms
-- ---------------------------------------------------------------------------
ALTER TABLE public.hmis_physio_fms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_physio_fms_authenticated ON public.hmis_physio_fms;
CREATE POLICY hmis_physio_fms_read ON public.hmis_physio_fms
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY hmis_physio_fms_write ON public.hmis_physio_fms
  FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY hmis_physio_fms_upd ON public.hmis_physio_fms
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- C15: hmis_physio_outcomes
-- ---------------------------------------------------------------------------
ALTER TABLE public.hmis_physio_outcomes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_physio_outcomes_authenticated ON public.hmis_physio_outcomes;
CREATE POLICY hmis_physio_outcomes_read ON public.hmis_physio_outcomes
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY hmis_physio_outcomes_write ON public.hmis_physio_outcomes
  FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY hmis_physio_outcomes_upd ON public.hmis_physio_outcomes
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- C16: hmis_dialysis_monitoring
-- ---------------------------------------------------------------------------
ALTER TABLE public.hmis_dialysis_monitoring ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hmis_dialysis_monitoring_authenticated ON public.hmis_dialysis_monitoring;
CREATE POLICY hmis_dialysis_monitoring_read ON public.hmis_dialysis_monitoring
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY hmis_dialysis_monitoring_write ON public.hmis_dialysis_monitoring
  FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY hmis_dialysis_monitoring_upd ON public.hmis_dialysis_monitoring
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);


-- ============================================================================
-- END OF MIGRATION
-- Total: 11 Pattern A + 8 Pattern B + 16 Pattern C = 35 tables
-- Apply in batches of 3-5 tables, verify user sessions after each batch.
-- ============================================================================
