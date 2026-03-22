-- mortuary_migration.sql
-- Mortuary body tracking, release workflow, documentation

CREATE TABLE IF NOT EXISTS hmis_mortuary (
  id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id               uuid NOT NULL REFERENCES hmis_centres(id) ON DELETE CASCADE,
  patient_id              uuid REFERENCES hmis_patients(id),
  admission_id            uuid REFERENCES hmis_admissions(id),
  death_certificate_number varchar(50),
  cause_of_death          text,
  time_of_death           timestamptz,
  declared_by             uuid REFERENCES hmis_staff(id),
  body_received_at        timestamptz DEFAULT now(),
  storage_unit            varchar(50),
  embalming_done          boolean DEFAULT false,
  post_mortem_required    boolean DEFAULT false,
  post_mortem_done        boolean DEFAULT false,
  police_intimation       boolean DEFAULT false,
  released_to             varchar(200),
  released_at             timestamptz,
  release_authorized_by   uuid REFERENCES hmis_staff(id),
  id_proof_collected      boolean DEFAULT false,
  noc_from_police         boolean DEFAULT false,
  status                  text NOT NULL DEFAULT 'received' CHECK (status IN ('received','stored','post_mortem','released')),
  notes                   text,
  created_at              timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mortuary_centre ON hmis_mortuary (centre_id, status);
CREATE INDEX IF NOT EXISTS idx_mortuary_patient ON hmis_mortuary (patient_id) WHERE patient_id IS NOT NULL;

ALTER TABLE hmis_mortuary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Access mortuary" ON hmis_mortuary FOR ALL USING (true) WITH CHECK (true);
