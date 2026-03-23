# RLS Snapshot — Production Stable (2026-03-23)
# DO NOT MODIFY DATABASE RLS WITHOUT TESTING AGAINST A REAL USER SESSION FIRST

## Tables WITH RLS (109)
- hmis_appointments
- hmis_ar_entries
- hmis_ar_followups
- hmis_audit_trail
- hmis_auto_charge_runs
- hmis_bb_components
- hmis_bb_crossmatch
- hmis_bb_donations
- hmis_bb_donors
- hmis_bb_reactions
- hmis_bb_requests
- hmis_bb_transfusions
- hmis_bed_turnover
- hmis_bed_waitlist
- hmis_billing_auto_rules
- hmis_cdss_usage
- hmis_charge_log
- hmis_consent_audit
- hmis_consent_templates
- hmis_consents
- hmis_controlled_substance_log
- hmis_corporate_employees
- hmis_corporates
- hmis_cpoe_orders
- hmis_credit_notes
- hmis_discount_log
- hmis_doctor_rounds
- hmis_doctor_schedules
- hmis_duty_roster
- hmis_duty_swap_requests
- hmis_emr_encounters
- hmis_emr_templates
- hmis_equipment
- hmis_equipment_calibration
- hmis_equipment_maintenance
- hmis_equipment_pm_schedule
- hmis_estimates
- hmis_govt_scheme_config
- hmis_hc_bills
- hmis_hc_enrollments
- hmis_hc_equipment
- hmis_hc_med_admin
- hmis_hc_medications
- hmis_hc_rates
- hmis_hc_visits
- hmis_hc_wound_care
- hmis_housekeeping_schedules
- hmis_housekeeping_tasks
- hmis_icu_charts
- hmis_icu_scores
- hmis_imaging_reports
- hmis_imaging_studies
- hmis_incidents
- hmis_integration_bridge
- hmis_io_chart
- hmis_ipd_medication_orders
- hmis_lab_antibiogram
- hmis_lab_antibiotic_panels
- hmis_lab_antibiotics
- hmis_lab_audit_log
- hmis_lab_critical_alerts
- hmis_lab_culture_isolates
- hmis_lab_cultures
- hmis_lab_histo_cases
- hmis_lab_instrument_results
- hmis_lab_ncr
- hmis_lab_organisms
- hmis_lab_outsourced
- hmis_lab_profile_tests
- hmis_lab_profiles
- hmis_lab_qc_lots
- hmis_lab_qc_results
- hmis_lab_ref_ranges
- hmis_lab_reflex_rules
- hmis_lab_sample_log
- hmis_lab_sensitivity
- hmis_lab_test_parameters
- hmis_loyalty_cards
- hmis_mar
- hmis_nhcx_transactions
- hmis_ot_implants
- hmis_ot_notes
- hmis_ot_safety_checklist
- hmis_packages
- hmis_pacs_config
- hmis_patient_documents
- hmis_patient_emergency_contacts
- hmis_patient_insurance
- hmis_pharmacy_dispensing
- hmis_pharmacy_grn
- hmis_pharmacy_po
- hmis_pharmacy_returns
- hmis_pharmacy_stock
- hmis_pharmacy_transfers
- hmis_pmjay_packages
- hmis_portal_access_log
- hmis_portal_appointments
- hmis_portal_feedback
- hmis_portal_tokens
- hmis_procedural_notes
- hmis_quality_indicators
- hmis_radiology_rooms
- hmis_radiology_templates
- hmis_refunds
- hmis_settlements
- hmis_shift_definitions
- hmis_staffing_requirements
- hmis_surgical_checklist_items
- hmis_surgical_planning

## Tables WITHOUT RLS (100)
- hmis_admissions
- hmis_advances
- hmis_ambulances
- hmis_anaesthesia_records
- hmis_antibiogram
- hmis_appointment_slots
- hmis_assets
- hmis_bed_transfers
- hmis_beds
- hmis_bill_items
- hmis_billing_category_map
- hmis_bills
- hmis_cathlab_inventory
- hmis_cathlab_monitoring
- hmis_cathlab_procedures
- hmis_centres
- hmis_chart_of_accounts
- hmis_claims
- hmis_crm_activities
- hmis_crm_campaigns
- hmis_crm_leads
- hmis_cssd_autoclaves
- hmis_cssd_cycles
- hmis_cssd_instrument_sets
- hmis_cssd_issue_return
- hmis_cssd_recall_log
- hmis_departments
- hmis_dialysis_machines
- hmis_dialysis_monitoring
- hmis_dialysis_patients
- hmis_dialysis_sessions
- hmis_diet_orders
- hmis_doctor_leaves
- hmis_documents
- hmis_drug_master
- hmis_endoscopy_procedures
- hmis_endoscopy_scopes
- hmis_er_visits
- hmis_fiscal_periods
- hmis_grievances
- hmis_hai_surveillance
- hmis_hand_hygiene_audit
- hmis_insurers
- hmis_integration_config
- hmis_integration_sync_log
- hmis_journal_entries
- hmis_journal_lines
- hmis_lab_orders
- hmis_lab_results
- hmis_lab_samples
- hmis_lab_test_master
- hmis_meal_service
- hmis_medpay_doctor_map
- hmis_medpay_sync_log
- hmis_menu_master
- hmis_module_config
- hmis_needle_stick_injuries
- hmis_notification_log
- hmis_notification_templates
- hmis_nursing_notes
- hmis_opd_visits
- hmis_orders
- hmis_ot_bookings
- hmis_ot_rooms
- hmis_package_master
- hmis_package_utilization
- hmis_patient_allergies
- hmis_patient_contacts
- hmis_patients
- hmis_payments
- hmis_physio_fms
- hmis_physio_outcomes
- hmis_physio_plans
- hmis_physio_prevention_programs
- hmis_physio_sessions
- hmis_pre_auth_requests
- hmis_prescriptions
- hmis_purchase_indents
- hmis_radiology_orders
- hmis_radiology_reports
- hmis_radiology_test_master
- hmis_referrals
- hmis_referring_doctors
- hmis_role_permissions
- hmis_roles
- hmis_rooms
- hmis_scope_decontamination
- hmis_sequences
- hmis_settings
- hmis_staff
- hmis_staff_centres
- hmis_surgery_notes
- hmis_tariff_master
- hmis_teleconsults
- hmis_tpas
- hmis_transport_requests
- hmis_vendors
- hmis_visitor_passes
- hmis_vitals
- hmis_wards

## All Policies (112)
| Table | Policy | Command | Permissive |
|---|---|---|---|
| hmis_appointments | hmis_appointments_pol | ALL | PERMISSIVE |
| hmis_ar_entries | hmis_ar_entries_pol | ALL | PERMISSIVE |
| hmis_ar_followups | hmis_ar_followups_pol | ALL | PERMISSIVE |
| hmis_audit_trail | hmis_audit_trail_pol | ALL | PERMISSIVE |
| hmis_auto_charge_runs | hmis_auto_charge_runs_pol | ALL | PERMISSIVE |
| hmis_bb_components | hmis_bb_components_pol_auth | ALL | PERMISSIVE |
| hmis_bb_crossmatch | hmis_bb_crossmatch_pol_auth | ALL | PERMISSIVE |
| hmis_bb_donations | hmis_bb_donations_pol_auth | ALL | PERMISSIVE |
| hmis_bb_donors | hmis_bb_donors_pol_auth | ALL | PERMISSIVE |
| hmis_bb_reactions | hmis_bb_reactions_pol_auth | ALL | PERMISSIVE |
| hmis_bb_requests | hmis_bb_requests_pol_auth | ALL | PERMISSIVE |
| hmis_bb_transfusions | hmis_bb_transfusions_pol_auth | ALL | PERMISSIVE |
| hmis_bed_turnover | bed_turnover_tenant | ALL | PERMISSIVE |
| hmis_bed_waitlist | bed_waitlist_tenant | ALL | PERMISSIVE |
| hmis_billing_auto_rules | hmis_billing_auto_rules_pol_auth | ALL | PERMISSIVE |
| hmis_cdss_usage | hmis_cdss_usage_pol | ALL | PERMISSIVE |
| hmis_charge_log | hmis_charge_log_pol | ALL | PERMISSIVE |
| hmis_consent_audit | consent_audit_tenant | ALL | PERMISSIVE |
| hmis_consent_templates | consent_tpl_tenant | ALL | PERMISSIVE |
| hmis_consents | hmis_consents_pol_auth | ALL | PERMISSIVE |
| hmis_controlled_substance_log | hmis_controlled_substance_log_pol | ALL | PERMISSIVE |
| hmis_corporate_employees | hmis_corporate_employees_pol | ALL | PERMISSIVE |
| hmis_corporates | hmis_corporates_pol | ALL | PERMISSIVE |
| hmis_cpoe_orders | hmis_cpoe_orders_pol | ALL | PERMISSIVE |
| hmis_credit_notes | hmis_credit_notes_pol_auth | ALL | PERMISSIVE |
| hmis_discount_log | hmis_discount_log_pol_auth | ALL | PERMISSIVE |
| hmis_doctor_rounds | hmis_doctor_rounds_pol_auth | ALL | PERMISSIVE |
| hmis_doctor_schedules | hmis_doctor_schedules_pol | ALL | PERMISSIVE |
| hmis_duty_roster | duty_roster_tenant | ALL | PERMISSIVE |
| hmis_duty_swap_requests | duty_swap_tenant | ALL | PERMISSIVE |
| hmis_emr_encounters | emr_encounters_centre_read | SELECT | PERMISSIVE |
| hmis_emr_encounters | emr_encounters_doctor_all | ALL | PERMISSIVE |
| hmis_emr_templates | emr_templates_own | ALL | PERMISSIVE |
| hmis_emr_templates | emr_templates_shared_read | SELECT | PERMISSIVE |
| hmis_equipment | Access equipment | ALL | PERMISSIVE |
| hmis_equipment_calibration | calib_access | ALL | PERMISSIVE |
| hmis_equipment_maintenance | Access maintenance | ALL | PERMISSIVE |
| hmis_equipment_pm_schedule | Access pm schedule | ALL | PERMISSIVE |
| hmis_estimates | hmis_estimates_pol_auth | ALL | PERMISSIVE |
| hmis_govt_scheme_config | hmis_govt_scheme_config_pol | ALL | PERMISSIVE |
| hmis_hc_bills | hmis_hc_bills_pol_auth | ALL | PERMISSIVE |
| hmis_hc_enrollments | hmis_hc_enrollments_pol_auth | ALL | PERMISSIVE |
| hmis_hc_equipment | hmis_hc_equipment_pol_auth | ALL | PERMISSIVE |
| hmis_hc_med_admin | hmis_hc_med_admin_pol_auth | ALL | PERMISSIVE |
| hmis_hc_medications | hmis_hc_medications_pol_auth | ALL | PERMISSIVE |
| hmis_hc_rates | hmis_hc_rates_pol_auth | ALL | PERMISSIVE |
| hmis_hc_visits | hmis_hc_visits_pol_auth | ALL | PERMISSIVE |
| hmis_hc_wound_care | hmis_hc_wound_care_pol_auth | ALL | PERMISSIVE |
| hmis_housekeeping_schedules | Access housekeeping schedules | ALL | PERMISSIVE |
| hmis_housekeeping_tasks | Access housekeeping tasks | ALL | PERMISSIVE |
| hmis_icu_charts | hmis_icu_charts_pol_auth | ALL | PERMISSIVE |
| hmis_icu_scores | hmis_icu_scores_pol_auth | ALL | PERMISSIVE |
| hmis_imaging_reports | hmis_imaging_reports_pol | ALL | PERMISSIVE |
| hmis_imaging_studies | hmis_imaging_studies_pol | ALL | PERMISSIVE |
| hmis_incidents | hmis_incidents_pol | ALL | PERMISSIVE |
| hmis_integration_bridge | hmis_integration_bridge_pol | ALL | PERMISSIVE |
| hmis_io_chart | hmis_io_chart_pol_auth | ALL | PERMISSIVE |
| hmis_ipd_medication_orders | hmis_ipd_medication_orders_pol_auth | ALL | PERMISSIVE |
| hmis_lab_antibiogram | hmis_lab_antibiogram_pol_auth | ALL | PERMISSIVE |
| hmis_lab_antibiotic_panels | hmis_lab_antibiotic_panels_pol_auth | ALL | PERMISSIVE |
| hmis_lab_antibiotics | hmis_lab_antibiotics_pol_auth | ALL | PERMISSIVE |
| hmis_lab_audit_log | hmis_lab_audit_log_pol_auth | ALL | PERMISSIVE |
| hmis_lab_critical_alerts | hmis_lab_critical_alerts_pol_auth | ALL | PERMISSIVE |
| hmis_lab_culture_isolates | hmis_lab_culture_isolates_pol_auth | ALL | PERMISSIVE |
| hmis_lab_cultures | hmis_lab_cultures_pol_auth | ALL | PERMISSIVE |
| hmis_lab_histo_cases | hmis_lab_histo_cases_pol_auth | ALL | PERMISSIVE |
| hmis_lab_instrument_results | hmis_lab_instrument_results_pol | ALL | PERMISSIVE |
| hmis_lab_ncr | hmis_lab_ncr_pol_auth | ALL | PERMISSIVE |
| hmis_lab_organisms | hmis_lab_organisms_pol_auth | ALL | PERMISSIVE |
| hmis_lab_outsourced | hmis_lab_outsourced_pol_auth | ALL | PERMISSIVE |
| hmis_lab_profile_tests | hmis_lab_profile_tests_pol_auth | ALL | PERMISSIVE |
| hmis_lab_profiles | hmis_lab_profiles_pol_auth | ALL | PERMISSIVE |
| hmis_lab_qc_lots | hmis_lab_qc_lots_pol_auth | ALL | PERMISSIVE |
| hmis_lab_qc_results | hmis_lab_qc_results_pol_auth | ALL | PERMISSIVE |
| hmis_lab_ref_ranges | hmis_lab_ref_ranges_pol_auth | ALL | PERMISSIVE |
| hmis_lab_reflex_rules | hmis_lab_reflex_rules_pol_auth | ALL | PERMISSIVE |
| hmis_lab_sample_log | hmis_lab_sample_log_pol_auth | ALL | PERMISSIVE |
| hmis_lab_sensitivity | hmis_lab_sensitivity_pol_auth | ALL | PERMISSIVE |
| hmis_lab_test_parameters | hmis_lab_test_parameters_pol_auth | ALL | PERMISSIVE |
| hmis_loyalty_cards | hmis_loyalty_cards_pol | ALL | PERMISSIVE |
| hmis_mar | hmis_mar_pol_auth | ALL | PERMISSIVE |
| hmis_module_config | module_config_tenant | ALL | PERMISSIVE |
| hmis_nhcx_transactions | nhcx_txn_pol | ALL | PERMISSIVE |
| hmis_ot_implants | hmis_ot_implants_pol | ALL | PERMISSIVE |
| hmis_ot_notes | hmis_ot_notes_pol_auth | ALL | PERMISSIVE |
| hmis_ot_safety_checklist | hmis_ot_safety_checklist_pol | ALL | PERMISSIVE |
| hmis_packages | hmis_packages_pol | ALL | PERMISSIVE |
| hmis_pacs_config | hmis_pacs_config_pol | ALL | PERMISSIVE |
| hmis_patient_documents | hmis_patient_documents_pol | ALL | PERMISSIVE |
| hmis_patient_emergency_contacts | hmis_patient_emergency_contacts_pol | ALL | PERMISSIVE |
| hmis_patient_insurance | hmis_patient_insurance_pol | ALL | PERMISSIVE |
| hmis_pharmacy_dispensing | pharm_disp_centre | ALL | PERMISSIVE |
| hmis_pharmacy_grn | hmis_pharmacy_grn_pol | ALL | PERMISSIVE |
| hmis_pharmacy_po | hmis_pharmacy_po_pol | ALL | PERMISSIVE |
| hmis_pharmacy_returns | hmis_pharmacy_returns_pol | ALL | PERMISSIVE |
| hmis_pharmacy_stock | pharm_stock_centre | ALL | PERMISSIVE |
| hmis_pharmacy_transfers | hmis_pharmacy_transfers_pol | ALL | PERMISSIVE |
| hmis_pmjay_packages | hmis_pmjay_packages_pol | ALL | PERMISSIVE |
| hmis_portal_access_log | hmis_portal_access_log_pol_auth | ALL | PERMISSIVE |
| hmis_portal_appointments | hmis_portal_appointments_pol_auth | ALL | PERMISSIVE |
| hmis_portal_feedback | hmis_portal_feedback_pol_auth | ALL | PERMISSIVE |
| hmis_portal_tokens | hmis_portal_tokens_pol_auth | ALL | PERMISSIVE |
| hmis_procedural_notes | hmis_procedural_notes_pol_auth | ALL | PERMISSIVE |
| hmis_quality_indicators | hmis_quality_indicators_pol | ALL | PERMISSIVE |
| hmis_radiology_rooms | hmis_radiology_rooms_pol | ALL | PERMISSIVE |
| hmis_radiology_templates | hmis_radiology_templates_pol | ALL | PERMISSIVE |
| hmis_refunds | hmis_refunds_pol | ALL | PERMISSIVE |
| hmis_settlements | hmis_settlements_pol | ALL | PERMISSIVE |
| hmis_shift_definitions | shift_def_tenant | ALL | PERMISSIVE |
| hmis_staffing_requirements | staffing_req_tenant | ALL | PERMISSIVE |
| hmis_surgical_checklist_items | surgical_checklist_tenant | ALL | PERMISSIVE |
| hmis_surgical_planning | surgical_planning_tenant | ALL | PERMISSIVE |
