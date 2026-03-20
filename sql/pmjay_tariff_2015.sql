-- Health1 HMIS — PMJAY HBP 2022 Tariff (1976 procedures)
-- Shilaj = NABH → 10% incentive on PACKAGE price (not implant)
-- rate_self = package + 10% NABH + implant (max of multiple implants)
-- rate_pmjay = base Tier3 package

-- Widen rate columns to handle high-value transplants
ALTER TABLE hmis_tariff_master ALTER COLUMN rate_self TYPE decimal(12,2);
ALTER TABLE hmis_tariff_master ALTER COLUMN rate_insurance TYPE decimal(12,2);
ALTER TABLE hmis_tariff_master ALTER COLUMN rate_pmjay TYPE decimal(12,2);
ALTER TABLE hmis_tariff_master ALTER COLUMN rate_cghs TYPE decimal(12,2);

INSERT INTO hmis_tariff_master (centre_id, service_code, service_name, category, rate_self, rate_insurance, rate_pmjay, rate_cghs, is_active)
SELECT c.id, v.service_code, v.service_name, v.category, v.rate_self, v.rate_insurance, v.rate_pmjay, v.rate_cghs, true
FROM hmis_centres c,
(VALUES
  ('PMJAY-BM001A', 'Criteria 1: % Total Body Surface Area Burns (TBSA):less than 20% in adults and less than 10% in children younger  than 12 years. Dressing without anesthesia', 'pmjay_ent', 7700, 7700, 7000, 7000),
  ('PMJAY-BM001B', 'Criteria 2: % Total Body Surface Area Burns (TBSA): Upto 25%; Includes % TBSA skin grafted, flap cover, follow-up dressings etc. as deemed necessary; Surgical procedures are requir', 'pmjay_ent', 55000, 55000, 50000, 50000),
  ('PMJAY-BM001C', 'Criteria 3: % Total Body Surface Area Burns (TBSA): 25-40 %; Includes % TBSA skin grafted, flap cover, follow-up dressings etc. as deemed necessary; Surgical procedures are require', 'pmjay_ent', 68750, 68750, 62500, 62500),
  ('PMJAY-BM001D', 'Criteria 4: % Total Body Surface Area Burns (TBSA):40- 60 %; Includes % TBSA skin grafted, flap cover, follow-up dressings etc. as deemed necessary; Surgical procedures are require', 'pmjay_ent', 110000, 110000, 100000, 100000),
  ('PMJAY-BM001E', 'Criteria 5: % Total Body Surface Area Burns (TBSA):60-80 %; Includes % TBSA skin grafted, flap cover, follow-up dressings etc. as deemed necessary; Surgical procedures are required', 'pmjay_ent', 110000, 110000, 100000, 100000),
  ('PMJAY-BM002A', 'Criteria 1:  % Total Body Surface Area Burns (TBSA): less than 20% in adults and less than 10% in children younger  than 12 years. Dressing without anesthesia', 'pmjay_ent', 7700, 7700, 7000, 7000),
  ('PMJAY-BM002B', 'Criteria 2: % Total Body Surface Area Burns (TBSA): Upto 25%; Includes % TBSA skin grafted, flap cover, follow-up dressings etc. as deemed necessary; Surgical procedures are requir', 'pmjay_ent', 55000, 55000, 50000, 50000),
  ('PMJAY-BM002C', 'Criteria 3: % Total Body Surface Area Burns (TBSA): 25-40 %; Includes % TBSA skin grafted, flap cover, follow-up dressings etc. as deemed necessary; Surgical procedures are require', 'pmjay_ent', 68750, 68750, 62500, 62500),
  ('PMJAY-BM002D', 'Criteria 4: % Total Body Surface Area Burns (TBSA):40- 60 %; Includes % TBSA skin grafted, flap cover, follow-up dressings etc. as deemed necessary; Surgical procedures are require', 'pmjay_ent', 110000, 110000, 100000, 100000),
  ('PMJAY-BM002E', 'Criteria 5: % Total Body Surface Area Burns (TBSA):60-80 %; Includes % TBSA skin grafted, flap cover, follow-up dressings etc. as deemed necessary; Surgical procedures are required', 'pmjay_ent', 110000, 110000, 100000, 100000),
  ('PMJAY-BM003A', '% Total Body Surface Area Burns (TBSA) - any % 
(not requiring admission). 
Needs at least 5-6 dressing', 'pmjay_ent', 7700, 7700, 7000, 7000),
  ('PMJAY-BM003B', '% Total Body Surface Area Burns (TBSA): Upto 40 %; Includes % TBSA skin grafted, flap cover, follow-up dressings etc. as deemed necessary; Surgical procedures are required for deep', 'pmjay_ent', 55000, 55000, 50000, 50000),
  ('PMJAY-BM003C', '% Total Body Surface Area Burns (TBSA): 40 % - 60 %; Includes % TBSA skin grafted, flap cover, follow-up dressings etc. as deemed necessary; Surgical procedures are required for de', 'pmjay_ent', 68750, 68750, 62500, 62500),
  ('PMJAY-BM003D', '% Total Body Surface Area Burns (TBSA): >  60 %; Includes % TBSA skin grafted, flap cover, follow-up dressings etc. as deemed necessary; Surgical procedures are required for deep b', 'pmjay_ent', 110000, 110000, 100000, 100000),
  ('PMJAY-BM004A', 'Electrical contact burns: Low voltage - without part of limb / limb loss; Includes % TBSA skin grafted, flap cover, follow-up dressings etc. as deemed necessary; Surgical procedure', 'pmjay_ent', 41250, 41250, 37500, 37500),
  ('PMJAY-BM004B', 'Electrical contact burns: Low voltage - with part of limb / limb loss; Includes % TBSA skin grafted, flap cover, follow-up dressings Amputation  etc. as deemed necessary; Surgical', 'pmjay_ent', 55000, 55000, 50000, 50000),
  ('PMJAY-BM004C', 'Electrical contact burns: High voltage - with part of limb / limb loss; Includes % TBSA skin grafted, flap cover,fasciotomy +/- /amputation/Central IV Line/debridement/early skin g', 'pmjay_ent', 82500, 82500, 75000, 75000),
  ('PMJAY-BM004D', 'Electrical contact burns: High voltage - without part of limb / limb loss; Includes % TBSA skin grafted, flap cover, fasciotomy +/- /debridement/early skin grafting/flap cover: ped', 'pmjay_ent', 68750, 68750, 62500, 62500),
  ('PMJAY-BM005A', 'Chemical burns: Without significant facial scarring and/or loss of function; Includes % TBSA skin grafted, flap cover, follow-up dressings etc. as deemed necessary; Surgical proced', 'pmjay_ent', 55000, 55000, 50000, 50000),
  ('PMJAY-BM005B', 'Chemical burns: With significant facial scarring and/or loss of function; Includes % TBSA skin grafted, flap cover,debridement,skin grafting,follow-up dressings etc. as deemed nece', 'pmjay_ent', 82500, 82500, 75000, 75000),
  ('PMJAY-BM006A', 'Post Burn Contracture surgeries for Functional Improvement (Package including splints, pressure garments, silicone - gel sheet and physiotherapy): Excluding Neck contracture; Contr', 'pmjay_ent', 68750, 68750, 62500, 62500),
  ('PMJAY-BM006B', 'Post Burn Contracture surgeries for Functional Improvement (Package including splints, pressure garments,contracture release & split skin graft with or without flap reconstruction,', 'pmjay_ent', 68750, 68750, 62500, 62500),
  ('PMJAY-ER001A', 'Laceration - Suturing / Dressing', 'pmjay_emergency', 2200, 2200, 2000, 2000),
  ('PMJAY-ER002A', 'Emergency with stable
cardiopulmonary status', 'pmjay_emergency', 2200, 2200, 2000, 2000),
  ('PMJAY-ER002B', 'Emergency with unstable cardiopulmonary status with
resuccitation', 'pmjay_emergency', 12100, 12100, 11000, 11000),
  ('PMJAY-ER003A', 'Animal bites (Excluding Snake Bite)', 'pmjay_emergency', 1870, 1870, 1700, 1700),
  ('PMJAY-SB001A', 'Fracture - Conservative Management - 
Without plaster', 'pmjay_ortho', 2530, 2530, 2300, 2300),
  ('PMJAY-SU073A', 'Emergency management of Hematuria(per  day) LOS-1-5 days', 'pmjay_urology', 2970, 2970, 2700, 2700),
  ('PMJAY-HD001A', 'Lymphangiography', 'pmjay_diagnostics', 30012, 30012, 10920, 10920),
  ('PMJAY-HD002A', 'Diagnostic venography (DVA)', 'pmjay_diagnostics', 6072, 6072, 5520, 5520),
  ('PMJAY-HD003A', 'IVUS(Intravascular Ultrasound)', 'pmjay_cardiology', 5060, 5060, 4600, 4600),
  ('PMJAY-HD004A', 'Diskography', 'pmjay_diagnostics', 6072, 6072, 5520, 5520),
  ('PMJAY-HD005A', 'USG guided percutaneous biopsy', 'pmjay_diagnostics', 5772, 5772, 2520, 2520),
  ('PMJAY-HD006A', 'USG guided percutaneous FNAC', 'pmjay_diagnostics', 792, 792, 720, 720),
  ('PMJAY-HD007A', 'USG guided percutaneous needle aspiration', 'pmjay_diagnostics', 792, 792, 720, 720),
  ('PMJAY-HD008A', 'CT guided percutaneous biopsy', 'pmjay_diagnostics', 7092, 7092, 3720, 3720),
  ('PMJAY-HD009A', 'CT guided percutaneous FNAC', 'pmjay_diagnostics', 3432, 3432, 3120, 3120),
  ('PMJAY-HD010A', 'CT guided percutaneous needle aspiration', 'pmjay_diagnostics', 3432, 3432, 3120, 3120),
  ('PMJAY-HD011A', 'Genetic workup', 'pmjay_diagnostics', 22000, 22000, 20000, 20000),
  ('PMJAY-HD012A', 'Metabolic work up', 'pmjay_diagnostics', 33000, 33000, 30000, 30000),
  ('PMJAY-HD013A', 'Vedio EEG Monitoring Test (VEEG)', 'pmjay_diagnostics', 3960, 3960, 3600, 3600),
  ('PMJAY-HP001A', 'USG guided percutaneous Radiofrequency Ablation (RFA)', 'pmjay_other', 104304, 104304, 26640, 26640),
  ('PMJAY-HP002A', 'USG guided percutaneous Microwave Ablation (MWA)', 'pmjay_other', 128704, 128704, 30640, 30640),
  ('PMJAY-HP003A', 'CT guided percutaneous Radiofrequency Ablation (RFA)', 'pmjay_other', 106944, 106944, 29040, 29040),
  ('PMJAY-HP004A', 'CT guided percutaneous Microwave Ablation (MWA)', 'pmjay_other', 131344, 131344, 33040, 33040),
  ('PMJAY-HP005A', 'USG guided percutaneous catheter drainage', 'pmjay_other', 7902, 7902, 5820, 5820),
  ('PMJAY-HP006A', 'CT guided percutaneous catheter drainage', 'pmjay_other', 7902, 7902, 5820, 5820),
  ('PMJAY-HP007A', 'Cerebral angiogram under local anesthesia', 'pmjay_other', 6380, 6380, 5800, 5800),
  ('PMJAY-HP008A', 'Cerebral angiogram under general anesthesia', 'pmjay_other', 20790, 20790, 18900, 18900),
  ('PMJAY-HP009A', 'Spinal Angiogram under general anesthesia', 'pmjay_other', 20790, 20790, 18900, 18900),
  ('PMJAY-HP010A', 'Plasmapheresis', 'pmjay_other', 77000, 77000, 70000, 70000),
  ('PMJAY-ID001B', 'Test for Confirmation of COVID-19 Infection', 'pmjay_medicine', 3300, 3300, 3000, 3000),
  ('PMJAY-IN001A', 'Carotico-cavernous Fistula (CCF) embolization with coils.
[includes 5 coils, guide catheter, micro-catheter, micro-guidewire,
general items]', 'pmjay_ent', 326250, 326250, 187500, 187500),
  ('PMJAY-IN001B', 'Carotid-cavernous Fistula (CCF) embolization with balloon (includes one balloon, guide catheter, micro-catheter, micro-
guidewire, general items)', 'pmjay_ent', 114180, 114180, 93800, 93800),
  ('PMJAY-IN002A', 'Intracranial balloon angioplasty with
stenting', 'pmjay_ent', 220000, 220000, 200000, 200000),
  ('PMJAY-IN003A', 'Intracranial thrombolysis / clot
retrieval', 'pmjay_ent', 220000, 220000, 200000, 200000),
  ('PMJAY-IN004A', 'Balloon test occlusion', 'pmjay_ent', 96250, 96250, 87500, 87500),
  ('PMJAY-IN005A', 'Parent vessel occlusion - Basic', 'pmjay_ent', 41250, 41250, 37500, 37500),
  ('PMJAY-IN006A', 'Primary percutaneous transhepatic biliary stenting (SEMS)', 'pmjay_ent', 64500, 64500, 25000, 25000),
  ('PMJAY-IN006B', 'Percutaneous transhepatic biliary stenting (SEMS) after prior PTBD', 'pmjay_ent', 39050, 39050, 35500, 35500),
  ('PMJAY-IN007A', 'Percutaneous cholangioplasty', 'pmjay_ent', 26520, 26520, 15200, 15200),
  ('PMJAY-IN008A', 'Hepatic venous wedge pressure measurement (HVPG)', 'pmjay_ent', 19140, 19140, 17400, 17400),
  ('PMJAY-IN010A', 'Tunelled longterm indwelling catheter for refractory ascites/pleural effusion', 'pmjay_ent', 50370, 50370, 16700, 16700),
  ('PMJAY-IN011A', 'Peripherally inserted central catheter (PICC)', 'pmjay_ent', 17790, 17790, 8900, 8900),
  ('PMJAY-IN014A', 'Primary percutaneous antegrade uretric stenting', 'pmjay_ent', 33320, 33320, 24200, 24200),
  ('PMJAY-IN015A', 'Percutaneous antegrade uretric stenting after prior PCN', 'pmjay_ent', 24960, 24960, 16600, 16600),
  ('PMJAY-IN016A', 'Lymphatic occlusion of chylous leak', 'pmjay_ent', 42430, 42430, 21300, 21300),
  ('PMJAY-IN017A', 'PVA embolization (without microcatheter)', 'pmjay_ent', 33000, 33000, 25000, 25000),
  ('PMJAY-IN017B', 'PVA embolization (with microcatheter)', 'pmjay_ent', 46500, 46500, 25000, 25000),
  ('PMJAY-IN018A', 'Glue embolization (without microcatheter)', 'pmjay_ent', 45500, 45500, 25000, 25000),
  ('PMJAY-IN018B', 'Glue embolization (with microcatheter)', 'pmjay_ent', 46500, 46500, 25000, 25000),
  ('PMJAY-IN019A', 'Gelfoam embolization (without microcatheter)', 'pmjay_ent', 27500, 27500, 25000, 25000),
  ('PMJAY-IN019B', 'Gelfoam embolization (with microcatheter)', 'pmjay_ent', 46500, 46500, 25000, 25000),
  ('PMJAY-IN020A', 'Coil embolization (without microcatheter)', 'pmjay_ent', 49200, 49200, 25000, 25000),
  ('PMJAY-IN020B', 'Coil embolization (with microcatheter)', 'pmjay_ent', 49200, 49200, 25000, 25000),
  ('PMJAY-IN021A', 'Alcohol embolisation', 'pmjay_ent', 46500, 46500, 25000, 25000),
  ('PMJAY-IN022A', 'Vascular plug assisted embolization', 'pmjay_ent', 98010, 98010, 49100, 49100),
  ('PMJAY-IN023A', 'Angioplasty (arterial)', 'pmjay_ent', 49290, 49290, 35900, 35900),
  ('PMJAY-IN023B', 'Angioplasty (arterial) using microguidewire and guiding catheter', 'pmjay_ent', 71070, 71070, 55700, 55700),
  ('PMJAY-IN023C', 'Angioplasty and bare metal stenting (arterial)', 'pmjay_ent', 90020, 90020, 48200, 48200),
  ('PMJAY-IN023D', 'Angioplasty and bare metal stenting (arterial) CTO lesion', 'pmjay_ent', 120710, 120710, 76100, 76100),
  ('PMJAY-IN023E', 'Angioplasty and covered stent placement (arterial)', 'pmjay_ent', 163970, 163970, 62700, 62700),
  ('PMJAY-IN024A', 'Catheter directed thrombolysis (arterial/venous)', 'pmjay_ent', 78510, 78510, 44100, 44100),
  ('PMJAY-IN025A', 'Thrombectomy followed by thrombolysis (arterial/venous)', 'pmjay_ent', 155060, 155060, 54600, 54600),
  ('PMJAY-IN026A', 'Angioplasty (venous)', 'pmjay_ent', 37410, 37410, 25100, 25100),
  ('PMJAY-IN026B', 'Angioplasty and stenting hepatic vein', 'pmjay_ent', 106080, 106080, 62800, 62800),
  ('PMJAY-IN026C', 'Angioplasty and bare metal stenting (venous)', 'pmjay_ent', 85730, 85730, 44300, 44300),
  ('PMJAY-IN026D', 'Angioplasty (IVC/central vein) with high pressure balloon', 'pmjay_ent', 82930, 82930, 58300, 58300),
  ('PMJAY-IN026E', 'Angioplasty and covered stent placement (venous)', 'pmjay_ent', 157040, 157040, 56400, 56400),
  ('PMJAY-IN027A', 'Angioplasty  Below knee angioplasty', 'pmjay_ent', 96860, 96860, 66600, 66600),
  ('PMJAY-IN028A', 'Angioplasty (complex): cutting balloon/drug coated balloon', 'pmjay_ent', 115150, 115150, 66500, 66500),
  ('PMJAY-IN029A', 'Angioplasty with medicated SFA stent /Specialised stent  (arterial) CTO lesion', 'pmjay_ent', 247500, 247500, 225000, 225000),
  ('PMJAY-IN030A', 'Angioplasty (central vein/ CIV ) with high pressure balloon and specilaised venous stent', 'pmjay_ent', 228580, 228580, 207800, 207800),
  ('PMJAY-IN031A', 'Fenestration of dissecting aneurysm', 'pmjay_ent', 78030, 78030, 37300, 37300),
  ('PMJAY-IN032A', 'TEVAR for aortic aneurysm/ dissection', 'pmjay_ent', 442180, 442180, 83800, 83800),
  ('PMJAY-IN033A', 'Post EVAR endoleak management', 'pmjay_ent', 30030, 30030, 27300, 27300),
  ('PMJAY-IN034A', 'IVC filter placement', 'pmjay_cardiology', 71340, 71340, 19400, 19400),
  ('PMJAY-IN034B', 'IVC filter placement with Catheter directed thrombolysis (arterial/venous)', 'pmjay_cardiology', 89820, 89820, 36200, 36200),
  ('PMJAY-IN034C', 'IVC filter Retrieval', 'pmjay_cardiology', 45840, 45840, 14400, 14400),
  ('PMJAY-IN035A', 'Retrieval of intravascular foreign body', 'pmjay_ent', 58590, 58590, 16900, 16900),
  ('PMJAY-IN036A', 'Joint/bursa intervention', 'pmjay_ent', 7590, 7590, 6900, 6900),
  ('PMJAY-IN037A', 'Sacroiliac joint denervation', 'pmjay_ent', 20790, 20790, 18900, 18900),
  ('PMJAY-IN038A', 'Facet joint intra-articular intervention- CS/Thoracic/LS', 'pmjay_ent', 7590, 7590, 6900, 6900),
  ('PMJAY-IN039A', 'Median branch rhizotomy- CS/Thoracic/LS', 'pmjay_ent', 20790, 20790, 18900, 18900),
  ('PMJAY-IN040A', 'Radiofrequency ablation-Trigeminal nerve/genicular nerve /celiac plexus /stellate Ganglion/sympathetic nerve (any branch)', 'pmjay_ent', 20790, 20790, 18900, 18900),
  ('PMJAY-IN041A', 'PRP -suprascapular /tennis elbow/other tendon', 'pmjay_ent', 7590, 7590, 6900, 6900),
  ('PMJAY-IN042A', 'Percutaneous Discotomy/nucleotomy using laser or nucleuotome', 'pmjay_ent', 58590, 58590, 16900, 16900),
  ('PMJAY-IN043A', 'Neural foraminal block', 'pmjay_ent', 7590, 7590, 6900, 6900),
  ('PMJAY-IN044A', 'Radiofrequency Ablation (RFA) of bone tumor /metastases/osteoid osteoma/liver/kidney/thyroid/breast', 'pmjay_ent', 109980, 109980, 31800, 31800),
  ('PMJAY-IN045A', 'Microwave ablation of bone tumor /osteoid osteoma//liver/kidney/thyroid/breast', 'pmjay_ent', 138780, 138780, 39800, 39800),
  ('PMJAY-IN046A', 'Stroke-Stent Retreiver', 'pmjay_ent', 320100, 320100, 291000, 291000),
  ('PMJAY-IN046B', 'Stroke-Aspiration Catheter', 'pmjay_ent', 341330, 341330, 310300, 310300),
  ('PMJAY-IN047A', 'Intervention for Acute stroke (Aspiration & stent retrieval)', 'pmjay_ent', 432520, 432520, 393200, 393200),
  ('PMJAY-IN048A', 'Aneurysm-3 Coil', 'pmjay_ent', 151030, 151030, 137300, 137300),
  ('PMJAY-IN048B', 'Aneurysm-5 Coil', 'pmjay_ent', 297440, 297440, 270400, 270400),
  ('PMJAY-IN048C', 'Aneurysm-7 Coil', 'pmjay_ent', 353870, 353870, 321700, 321700),
  ('PMJAY-IN048D', '3 Coil + Balloon', 'pmjay_ent', 168740, 168740, 153400, 153400),
  ('PMJAY-IN048E', '5 Coil + Balloon', 'pmjay_ent', 379940, 379940, 345400, 345400),
  ('PMJAY-IN048F', '3 Coil + Balloon+Stent', 'pmjay_ent', 243540, 243540, 221400, 221400),
  ('PMJAY-IN048G', '5 Coil + Balloon+Stent', 'pmjay_ent', 475530, 475530, 432300, 432300),
  ('PMJAY-IN048H', '7 Coil + Balloon+Stent', 'pmjay_ent', 521730, 521730, 474300, 474300),
  ('PMJAY-IN049A', 'Pial AVF (Single hole)', 'pmjay_ent', 132440, 132440, 120400, 120400),
  ('PMJAY-IN049B', 'AVF', 'pmjay_ent', 143440, 143440, 130400, 130400),
  ('PMJAY-IN049C', 'AVM (nidus upto 3 cm)', 'pmjay_ent', 172370, 172370, 156700, 156700),
  ('PMJAY-IN050A', 'Carotid stenting', 'pmjay_cardiology', 137500, 137500, 125000, 125000),
  ('PMJAY-IN050B', 'Carotid stenting-membrane layered', 'pmjay_cardiology', 194370, 194370, 176700, 176700),
  ('PMJAY-IN051A', 'Intracranial stenting for Intracranial atheroscelorosis disease (ICAD)', 'pmjay_ent', 400730, 400730, 364300, 364300),
  ('PMJAY-IN052A', 'Dural sinus stenting', 'pmjay_ent', 146190, 146190, 132900, 132900),
  ('PMJAY-IN053A', 'Carotid stenting with protection device', 'pmjay_ent', 228690, 228690, 207900, 207900),
  ('PMJAY-IN054A', 'Vasospasm management-post coiling/clipping  (Cost per session)', 'pmjay_ent', 88990, 88990, 80900, 80900),
  ('PMJAY-IN055A', 'Retinoblastoma under GA', 'pmjay_ent', 99220, 99220, 90200, 90200),
  ('PMJAY-IN056A', 'Percutaneous cholecystostomy', 'pmjay_ent', 24310, 24310, 22100, 22100),
  ('PMJAY-IN057A', 'PAIR / percutaneous sclerotherapy for Hydatid cyst', 'pmjay_ent', 10120, 10120, 9200, 9200),
  ('PMJAY-IN058A', 'Oesophageal /gastric / duodenal / colonic stenting/balloon dilatation', 'pmjay_ent', 63290, 63290, 23900, 23900),
  ('PMJAY-IN059A', 'Transjugular Liver biopsy', 'pmjay_ent', 34360, 34360, 17600, 17600),
  ('PMJAY-IN060A', 'Percutaneous gastrostomy', 'pmjay_ent', 12690, 12690, 7900, 7900),
  ('PMJAY-IN061A', 'Transarterial chemoembolization - conventional (cTACE)', 'pmjay_ent', 52000, 52000, 30000, 30000),
  ('PMJAY-IN061B', 'Transarterial chemoembolization - Drug eluting beads (DEB-TACE)', 'pmjay_ent', 83000, 83000, 30000, 30000),
  ('PMJAY-IN062A', 'Transjugular intrahepatic portosystemic shunt creation (TIPSS)/Direct transjugular Intrahepatic Portosystemic shunt(DIPSS)', 'pmjay_ent', 199170, 199170, 94700, 94700),
  ('PMJAY-IN063A', 'Balloon-occluded retrograde transvenous obliteration (BRTO)', 'pmjay_ent', 74100, 74100, 51000, 51000),
  ('PMJAY-IN064A', 'Plug-assisted retrograde transvenous obliteration (PARTO)', 'pmjay_ent', 107360, 107360, 57600, 57600),
  ('PMJAY-IN065A', 'Pre-operative portal vein embolization', 'pmjay_ent', 54740, 54740, 33400, 33400),
  ('PMJAY-IN066A', 'USG guided percutaneous ganglion/plexus block (Neuronolysis)', 'pmjay_ent', 12540, 12540, 11400, 11400),
  ('PMJAY-IN067A', 'CT guided percutaneous ganglion/plexus block (Neuronolysis)', 'pmjay_ent', 15840, 15840, 14400, 14400),
  ('PMJAY-IN068A', 'Vertebroplasty/Cementoplasty', 'pmjay_ent', 52360, 52360, 27600, 27600),
  ('PMJAY-IN069A', 'Kyphoplasty', 'pmjay_ent', 95670, 95670, 39700, 39700),
  ('PMJAY-IN070A', 'Vaccum assisted breast biopsy', 'pmjay_ent', 26770, 26770, 10700, 10700),
  ('PMJAY-IN071A', 'USG guided percutaneous Microwave Ablation (MWA)- benign breast /thyroid tumor', 'pmjay_ent', 135480, 135480, 36800, 36800),
  ('PMJAY-IN072A', 'Diagnostic angiography (DSA)', 'pmjay_neurosurgery', 9570, 9570, 8700, 8700),
  ('PMJAY-IN073A', 'Varicose vein: endovenous treatment (for one limb)', 'pmjay_ent', 27500, 27500, 25000, 25000),
  ('PMJAY-IN074A', 'Percutaneous Injection sclerotherapy for low flow vascular malformation', 'pmjay_ent', 12540, 12540, 11400, 11400),
  ('PMJAY-IN075A', 'Varicocele embolization', 'pmjay_ent', 43970, 43970, 22700, 22700),
  ('PMJAY-IN076A', 'Fistuloplasty / Thrombectomy of dialysis fistula', 'pmjay_ent', 49500, 49500, 45000, 45000),
  ('PMJAY-IN077A', 'AVM (1 vial)', 'pmjay_ent', 147620, 147620, 134200, 134200),
  ('PMJAY-IN077B', 'AVM (3 vial)', 'pmjay_ent', 147620, 147620, 134200, 134200),
  ('PMJAY-IN077C', 'AVM (5 vial)', 'pmjay_ent', 147620, 147620, 134200, 134200),
  ('PMJAY-IN078A', 'Tumor Embolization', 'pmjay_ent', 99110, 99110, 90100, 90100),
  ('PMJAY-MC002A', 'For Deep vein thrombosis (DVT)', 'pmjay_cardiology', 42350, 42350, 38500, 38500),
  ('PMJAY-MC002B', 'For Mesenteric Thrombosis', 'pmjay_cardiology', 42350, 42350, 38500, 38500),
  ('PMJAY-MC002C', 'For Peripheral vessels', 'pmjay_cardiology', 42350, 42350, 38500, 38500),
  ('PMJAY-MG0100A', 'Chronic PD catheter Insertion', 'pmjay_ent', 4510, 4510, 4100, 4100),
  ('PMJAY-MG082A', 'Bone marrow aspiration of biopsy', 'pmjay_ent', 1320, 1320, 1200, 1200),
  ('PMJAY-MG083A', 'Lumbar puncture', 'pmjay_ent', 110, 110, 100, 100),
  ('PMJAY-MG084A', 'Joint Aspiration', 'pmjay_ent', 220, 220, 200, 200),
  ('PMJAY-MG085A', 'DVT Pneumatic Compression Stockings (Add on package in ICU)', 'pmjay_ent', 990, 990, 900, 900),
  ('PMJAY-MG097A', 'Endobronchial Ultrasound guided fine needle biopsy', 'pmjay_ent', 17270, 17270, 15700, 15700),
  ('PMJAY-SU008A', 'Nephrostomy - Percutaneous ultrasound guided', 'pmjay_urology', 20680, 20680, 18800, 18800),
  ('PMJAY-MC001A', 'Right Heart Catheterization', 'pmjay_cardiology', 13750, 13750, 12500, 12500),
  ('PMJAY-MC001B', 'Left Heart Catheterization', 'pmjay_cardiology', 13750, 13750, 12500, 12500),
  ('PMJAY-MC003A', 'Coarctation of Aorta', 'pmjay_cardiology', 86130, 86130, 48300, 48300),
  ('PMJAY-MC003B', 'Pulmonary Artery Stenosis', 'pmjay_cardiology', 86130, 86130, 48300, 48300),
  ('PMJAY-MC004A', 'Balloon Pulmonary Valvotomy', 'pmjay_cardiology', 65230, 65230, 29300, 29300),
  ('PMJAY-MC004B', 'Balloon Aortic Valvotomy', 'pmjay_cardiology', 65230, 65230, 29300, 29300),
  ('PMJAY-MC005A', 'Balloon Mitral Valvotomy', 'pmjay_cardiology', 104170, 104170, 44700, 44700),
  ('PMJAY-MC006A', 'Balloon Atrial Septostomy', 'pmjay_cardiology', 88550, 88550, 30500, 30500),
  ('PMJAY-MC007A', 'ASD Device Closure', 'pmjay_cardiology', 112820, 112820, 46200, 46200),
  ('PMJAY-MC008A', 'VSD Device Closure', 'pmjay_cardiology', 124140, 124140, 47400, 47400),
  ('PMJAY-MC009A', 'PDA Device Closure', 'pmjay_cardiology', 74880, 74880, 40800, 40800),
  ('PMJAY-MC010A', 'PDA stenting', 'pmjay_cardiology', 89568, 89568, 50400, 50400),
  ('PMJAY-MC011A', 'PTCA, inclusive of diagnostic angiogram', 'pmjay_cardiology', 91714, 91714, 50800, 50800),
  ('PMJAY-MC012A', 'Electrophysiological Study', 'pmjay_cardiology', 84170, 84170, 34700, 34700),
  ('PMJAY-MC012B', 'Electrophysiological Study 
with Radio Frequency Ablation', 'pmjay_cardiology', 114170, 114170, 34700, 34700),
  ('PMJAY-MC013A', 'Percutaneous Transluminal Septal Myocardial Ablation', 'pmjay_cardiology', 46750, 46750, 42500, 42500),
  ('PMJAY-MC014A', 'Temporary Pacemaker implantation', 'pmjay_ctvs', 26400, 26400, 24000, 24000),
  ('PMJAY-MC015A', 'Permanent Pacemaker Implantation - 
Single Chamber', 'pmjay_ctvs', 78770, 78770, 30700, 30700),
  ('PMJAY-MC016A', 'Permanent Pacemaker Implantation - 
Double Chamber', 'pmjay_ctvs', 120430, 120430, 41300, 41300),
  ('PMJAY-MC017A', 'Peripheral Angioplasty', 'pmjay_cardiology', 68520, 68520, 43200, 43200),
  ('PMJAY-MC018A', 'Bronchial artery Embolisation 
(for Haemoptysis)', 'pmjay_cardiology', 45100, 45100, 41000, 41000),
  ('PMJAY-MC019A', 'Pericardiocentesis', 'pmjay_cardiology', 16720, 16720, 15200, 15200),
  ('PMJAY-MC020A', 'Systemic Thrombolysis (for MI)', 'pmjay_cardiology', 24640, 24640, 22400, 22400),
  ('PMJAY-MC021A', 'Arteriovenous Malformation (AVM) in the Limbs', 'pmjay_cardiology', 61880, 61880, 50800, 50800),
  ('PMJAY-MG075A', 'High end radiological diagnostic 
(CT, MRI, Imaging including nuclear imaging)', 'pmjay_cardiology', 5500, 5500, 5000, 5000),
  ('PMJAY-MG076A', 'High end histopathology (Biopsies) and advanced serology investigations', 'pmjay_cardiology', 5500, 5500, 5000, 5000),
  ('PMJAY-MG0105A', 'Pulmonary Thromboembolism - Add on', 'pmjay_medicine', 27500, 27500, 25000, 25000),
  ('PMJAY-MG0106A', 'Diffuse alveolar Hemorrhage Associated with SLE/Vasculitis/GP Syndrome', 'pmjay_medicine', 149600, 149600, 136000, 136000),
  ('PMJAY-MG0107A', 'Severe/Refractory Vasculitis', 'pmjay_medicine', 82500, 82500, 75000, 75000),
  ('PMJAY-MG0120A', 'Comprehensive medical rehabilitation for spinal injury/ traumatic brain injury, CVA, Cerebral palsy with or without orthosis', 'pmjay_urology', 27500, 27500, 25000, 25000),
  ('PMJAY-MG0120B', 'Comprehensive medical rehabilitation for of complication secondary to specified disanility/multiple disability including procedures,  chemodenevaration with or with out orthosis', 'pmjay_urology', 38500, 38500, 35000, 35000),
  ('PMJAY-MG0120C', 'Single event multiple level surgery for spasticity management in cerebral palsy', 'pmjay_urology', 16500, 16500, 15000, 15000),
  ('PMJAY-MG0120D', 'Medical rehabilitation of muscular dystrophy', 'pmjay_urology', 7700, 7700, 7000, 7000),
  ('PMJAY-MG0120E', 'Medical Rehabilitation intellectual dissability', 'pmjay_urology', 7700, 7700, 7000, 7000),
  ('PMJAY-MG0120F', 'Medical Rehabilitation  special learning  disability', 'pmjay_urology', 7700, 7700, 7000, 7000),
  ('PMJAY-MG0120G', 'Medical Rehabilitation multiple  disability', 'pmjay_urology', 7700, 7700, 7000, 7000),
  ('PMJAY-MG073A', 'Plasmapheresis', 'pmjay_ent', 2200, 2200, 2000, 2000),
  ('PMJAY-MG074A', 'Whole Blood transfusion', 'pmjay_surg_oncology', 2200, 2200, 2000, 2000),
  ('PMJAY-MG074B', 'Blood component including platelet transfusion (RDP, PC, SDP)', 'pmjay_surg_oncology', 2200, 2200, 2000, 2000),
  ('PMJAY-MG077A', 'Continuous renal replacement therapy in AKI (initiation cost for disposable)per day for maximum of 5 in one admission', 'pmjay_ent', 36300, 36300, 33000, 33000),
  ('PMJAY-MG099A', 'Platelet pheresis', 'pmjay_ent', 12100, 12100, 11000, 11000),
  ('PMJAY-SE043A', 'Vision Refraction-IOP & Fundus', 'pmjay_ophthalmology', 880, 880, 800, 800),
  ('PMJAY-SE043B', 'Vision Refraction-IOP & Fundus OCT & Visual Fields', 'pmjay_ophthalmology', 1650, 1650, 1500, 1500),
  ('PMJAY-SE044A', 'Vision refraction,fundus photo and OCT', 'pmjay_ophthalmology', 1100, 1100, 1000, 1000),
  ('PMJAY-MM008A', 'Package (Cognitive Tests, Complete Haemogram, Liver Function Test, Renal Function Test, Serum Electrolytes, Electro Cardiogram (ECG), CT / MRI Brain, Electroencephalogram, Thyroid', 'pmjay_ent', 7260, 7260, 6600, 6600),
  ('PMJAY-MM009A', 'Electro Convulsive Therapy (ECT) - per session', 'pmjay_ent', 3630, 3630, 3300, 3300),
  ('PMJAY-MM012A', 'Psychological, Behavioural and Developmental and Educational Interventions (Typically Includes Child Counselling / Psychotherapy, Family Counselling / Psychotherapy / Training Such', 'pmjay_ent', 3630, 3630, 3300, 3300),
  ('PMJAY-MM013A', 'Common Medications Used in Management of Child & Adult Psycholoigical DisordersiIncluding Anti-ADHD Medication', 'pmjay_ent', 2420, 2420, 2200, 2200),
  ('PMJAY-MM014A', 'Psychological Assessments (Includes IQ Testing, Specific Learning Disability Assessments, Assessments For Autism Spectrum Disorder, Developmental  Assessments, Projective Tests and', 'pmjay_ent', 3080, 3080, 2800, 2800),
  ('PMJAY-MN001A', 'Neonates 1800-2500g  and  Neonates of any weight requiring closer monitoring or short-term care on mother''s bedside for conditions like, but not limited to: 
 o Birth asphyxia (nee', 'pmjay_neonatology', 1100, 1100, 1000, 1000),
  ('PMJAY-MN007A', 'Includes but not limited to minimum six follow-up visits at 40 weeks PMA,  and corrected ages of 3,6,9, 12  and 18 months for  Assessment and Management of growth and development.', 'pmjay_neonatology', 1100, 1100, 1000, 1000),
  ('PMJAY-MN008A', 'Laser Therapy for Retinopathy of Prematurity
(Irrespective of no. of eyes affected)
per session', 'pmjay_neonatology', 2090, 2090, 1900, 1900),
  ('PMJAY-MN009A', 'Advanced Surgery for Retinopathy
of Prematurity', 'pmjay_neonatology', 20680, 20680, 18800, 18800),
  ('PMJAY-MN010A', 'Ventriculoperitoneal Shunt Surgery (VP) or Omaya Reservoir or External Drainage for
Hydrocephalus', 'pmjay_neonatology', 6930, 6930, 6300, 6300),
  ('PMJAY-MN012A', 'ROP screening(per screening for both eyes(documentation of findingsto be  done in a structured format)', 'pmjay_neonatology', 605, 605, 550, 550),
  ('PMJAY-MN013A', 'Brainstem Evoked Response Audiometry(BERA) per Bera', 'pmjay_neonatology', 1815, 1815, 1650, 1650),
  ('PMJAY-MO001A', 'Cyclophosphamide + Epirubcin
Cyclophosphamide - 600 mg /m2 D1
Epirubicin -90mg/m2 D1 every 21 days', 'pmjay_med_oncology', 8910, 8910, 8100, 8100),
  ('PMJAY-MO001B', 'Weekly Paclitaxel for Adjuvant Therapy
Paclitaxel 80mg/m2 every week', 'pmjay_med_oncology', 7260, 7260, 6600, 6600),
  ('PMJAY-MO001C', 'Weekly Paclitaxel in metastatic setting
Paclitaxel 80mg/m2 every week', 'pmjay_med_oncology', 7260, 7260, 6600, 6600),
  ('PMJAY-MO001D', 'Cyclophosphamide + Methotrexate + 5 - FU
Cyclophosphamide - 100mg/m2 orally D1-D14 Methotrexate 40mg/m2 IV D1
D8 5FU 600 mg/m2 D1, D8 every 28 days', 'pmjay_med_oncology', 4290, 4290, 3900, 3900),
  ('PMJAY-MO001E', 'Docetaxel + Cyclophosphamide
Docetaxel 75mg/m2 D1
Cyclophosphamide 600 mg/m2 D1 every 21 days', 'pmjay_med_oncology', 11220, 11220, 10200, 10200),
  ('PMJAY-MO001F', 'Trastuzumab
Trastuzumab 8 mg/Kg in Cycle 1 D1
Trastuzumab 6 mg/kg D1 from C2 every 21 days (Maximum 17 Cycles will be given)', 'pmjay_med_oncology', 25740, 25740, 23400, 23400),
  ('PMJAY-MO001G', 'Tamoxifen
Tamoxifem 20 mg orally daily', 'pmjay_med_oncology', 1430, 1430, 1300, 1300),
  ('PMJAY-MO001H', 'Letrozole
Letrozole 2.5 mg orally daily', 'pmjay_med_oncology', 4730, 4730, 4300, 4300),
  ('PMJAY-MO001I', 'Carboplatin + Paclitaxel
Paclitaxel 175mg/m2 D1
Carboplatin AUC 5-6 D1 every 21 days', 'pmjay_med_oncology', 18040, 18040, 16400, 16400),
  ('PMJAY-MO001J', 'Capecitabine
Capecitabine - 1000mg/m2 orally twice daily D1-D14 every 21 days', 'pmjay_med_oncology', 9020, 9020, 8200, 8200),
  ('PMJAY-MO001K', 'Carboplatin + Gemcitabine
Gemcitabine - 1000mg/m2 D1 D8
Carboplatin AUC 2 D1 D8
Gemcitabine - 1000mg/m2 D1 D8 
Carboplatin AUC 5-6 D1 only', 'pmjay_med_oncology', 16830, 16830, 15300, 15300),
  ('PMJAY-MO001L', 'Cyclophosphamide + Adriamycin
Cyclophosphamide - 600 mg /m2 D1
Adriamycin - 60mg/m2 D1 every 21 days', 'pmjay_med_oncology', 5500, 5500, 5000, 5000),
  ('PMJAY-MO001M', 'Fulvestrant
Fulvestrant 500 mg D1 D15 D28 then every 28 days.per dose13200  (39600 in cycle1 ) then 13200 per month -  (per dose 45000 in cycle1 ) then 15000 per month', 'pmjay_med_oncology', 14520, 14520, 13200, 13200),
  ('PMJAY-MO001N', 'Paclitaxel
Paclitaxel 175 mg/m2 D1 every 21 days', 'pmjay_med_oncology', 14300, 14300, 13000, 13000),
  ('PMJAY-MO001O', 'Exemestane
Exemestane 25 mg orally daily (q 3 monthsly)', 'pmjay_med_oncology', 4730, 4730, 4300, 4300),
  ('PMJAY-MO001P', 'Lapatinib
Lapatinib 500 mg BD  orally , daily per month', 'pmjay_med_oncology', 18260, 18260, 16600, 16600),
  ('PMJAY-MO002A', 'Zoledronic Acid
Zoledronic acid 4 mg IV Monthly', 'pmjay_med_oncology', 4290, 4290, 3900, 3900),
  ('PMJAY-MO003A', 'Cisplatin + Irinotecan
Cisplatin 60mg/m2 D1
Irinotecan 60 mg/m2 D1 D8 D15 every 28 days', 'pmjay_med_oncology', 15840, 15840, 14400, 14400),
  ('PMJAY-MO003B', 'Lipodox + Carboplatin
Lipopdox 30 mg/m2 D1
Carboplatin AUC 5-6 D1 every 28 days', 'pmjay_med_oncology', 20900, 20900, 19000, 19000),
  ('PMJAY-MO003C', 'Etoposide 50 mg/m2 OD D1-D21 every 28 days', 'pmjay_med_oncology', 4180, 4180, 3800, 3800),
  ('PMJAY-MO003D', 'Irinotecan
Irinotecan 60 -90 mg/m2 D1 D8 every 21 days', 'pmjay_med_oncology', 13310, 13310, 12100, 12100),
  ('PMJAY-MO003E', 'Lipodox
Lipodox 40 mg/m2 IV every 28 days', 'pmjay_med_oncology', 21780, 21780, 19800, 19800),
  ('PMJAY-MO003F', 'Carboplatin + Gemcitabine
Gemcitabine - 1000mg/m2 D1 D8 
Carboplatin AUC 2 D1 D8
Gemcitabine - 1000mg/m2 D1 D8
Carboplatin AUC 5-6 D1 only', 'pmjay_med_oncology', 16830, 16830, 15300, 15300),
  ('PMJAY-MO003G', 'Carboplatin + Paclitaxel
Paclitaxel 175mg/m2 D1
Carboplatin AUC 5-6 D1 every 21 days', 'pmjay_med_oncology', 18040, 18040, 16400, 16400),
  ('PMJAY-MO003H', 'Cyclophosphamide 50 mg/m2 OD D1-D21 every 28 days', 'pmjay_med_oncology', 3410, 3410, 3100, 3100),
  ('PMJAY-MO003I', 'Tamoxifen
Tamoxifem 20 mg orally daily (3 months)', 'pmjay_med_oncology', 1540, 1540, 1400, 1400),
  ('PMJAY-MO003J', 'Letrozole
Letrozole 2.5 mg orally daily (3 months)', 'pmjay_med_oncology', 4730, 4730, 4300, 4300),
  ('PMJAY-MO003K', 'Single agent Carboplatin 
Carboplatin AUC 5-6 D1 every 21 days ( maximum -6 cycle)', 'pmjay_med_oncology', 8470, 8470, 7700, 7700),
  ('PMJAY-MO003L', 'Cisplatin
Cisplatin 40 mg/m2 every week (maximum- 6 cycles)', 'pmjay_med_oncology', 2860, 2860, 2600, 2600),
  ('PMJAY-MO004A', 'Carboplatin (AUC 7)
Carboplatin AUC 7 every 21 days', 'pmjay_med_oncology', 8910, 8910, 8100, 8100),
  ('PMJAY-MO004B', 'Bleomycin + Etoposide + Cisplatin
Bleomycin 30 units D1 D8 D15
Cisplatin 20 mg/m2 IV D1-D5
Etoposide 100mg/m2 D1-D5 every 21 days', 'pmjay_med_oncology', 14960, 14960, 13600, 13600),
  ('PMJAY-MO004C', 'Etoposide + Cisplatin
Cisplatin 20 mg/m2 IV D1-D5
Etoposide 100mg/m2 D1-D5 every 21 days', 'pmjay_med_oncology', 13200, 13200, 12000, 12000),
  ('PMJAY-MO004D', 'Gemcitabine + Oxaliplatin
Gemcitabine 1000mg/m2 D1 D8
Oxaiplatin 130mg/m2 D1 every 21 days', 'pmjay_med_oncology', 21230, 21230, 19300, 19300),
  ('PMJAY-MO004E', 'Gemcitabine + Paclitaxel
Gemcitabine 1000mg/m2 D1 D8 D15
Paclitaxel 100 mg/m2 D1 D8 D15 every 28 days', 'pmjay_med_oncology', 21230, 21230, 19300, 19300),
  ('PMJAY-MO004F', 'Paclitaxel + Ifosfamide + Cisplatin
Paclitaxel 240 mg/m2 D1
Ifosfamide 1500mg/m2 D2-D5
Mesna 300 mg/m2 0h 4h 8h D2-D5
Cisplatin 25mg/m2 D2-D5 every 21 days', 'pmjay_med_oncology', 29590, 29590, 26900, 26900),
  ('PMJAY-MO004G', 'Vinblastin + Ifosfamide + Cisplatin
Vinblastine 0.11 mg/kg IV D1-D2
Mesna 240mg/m2 0h 4h 8h D1-D5
Ifosfamide 1200mg/m2 D1-D5
Cisplatin 20 mg/m2 D1-D5 every 21 days', 'pmjay_med_oncology', 16500, 16500, 15000, 15000),
  ('PMJAY-MO005A', 'Etoposide + Methotrexate + Dactinomycin- Cyclophosphamide + Vincristine
Etoposide 100mg/m2 IV D1 D2
Dactinomycin 0.5 mg IV push D1 D2
Methotrexate 300 mg /m2 D1
Leucovorin 15 mg PO', 'pmjay_med_oncology', 14630, 14630, 13300, 13300),
  ('PMJAY-MO005B', 'Etoposide + Methotrexate + Dactinomycin + Cisplatin
Etoposide 100mg/m2 IV D1 D2 D8
Dactinomycin 0.5 mg IV push D1 D2 Methotrexate 300 mg /m2 D1
Leucovorin 15 mg PO every 12 hrs for', 'pmjay_med_oncology', 15510, 15510, 14100, 14100),
  ('PMJAY-MO005C', 'Methotrexate
Methotrexate 1/mg/kg IM every other day x 4 days D1 3 D5 D7
Alternating every other day with
Leucovorin 15 mg PO repeat every 14 days', 'pmjay_med_oncology', 1540, 1540, 1400, 1400),
  ('PMJAY-MO005D', 'Dactinomycin
Inj Dactinomycin  0.5 mg D1- D5 every 14 days', 'pmjay_med_oncology', 8470, 8470, 7700, 7700),
  ('PMJAY-MO006A', 'Carboplatin + Paclitaxel
Paclitaxel 175mg/m2 D1
Carboplatin AUC 5-6 D1 every 21 days', 'pmjay_med_oncology', 18040, 18040, 16400, 16400),
  ('PMJAY-MO006B', 'Cisplatin
Cisplatin 40 mg/m2 every week', 'pmjay_med_oncology', 2860, 2860, 2600, 2600),
  ('PMJAY-MO007A', 'Carboplatin + Paclitaxel
Paclitaxel 175mg/m2 D1
Carboplatin AUC 5 D1 every 21 days', 'pmjay_med_oncology', 18040, 18040, 16400, 16400),
  ('PMJAY-MO007B', 'Cisplatin + Doxorubicin
Doxorubicin 60 mg/m2 D1
Cisplatin 50mg/m2 every 3 weeks', 'pmjay_med_oncology', 5390, 5390, 4900, 4900),
  ('PMJAY-MO007C', 'Lipodox + Carboplatin
Lipopdox 30 mg/m2 D1
Carboplatin AUC 5 D1 every 28 days', 'pmjay_med_oncology', 20900, 20900, 19000, 19000),
  ('PMJAY-MO007D', 'Carboplatin + Gemcitabine
Gemcitabine - 1000mg/m2 D1 D8
Carboplatin AUC 2 D1 D8
Gemcitabine - 1000mg/m2 D1 D8 
Carboplatin AUC 5-6 D1 only every 3 weeks', 'pmjay_med_oncology', 16830, 16830, 15300, 15300),
  ('PMJAY-MO007E', 'Anastrozole 
1 mg orally daily (for 3 months)', 'pmjay_med_oncology', 4730, 4730, 4300, 4300),
  ('PMJAY-MO008A', 'Cisplatin + 5 FU
5 FU 1000mg/m2 D1-D4
Cisplatin 75mg/m2 D1 every 3 weeks', 'pmjay_med_oncology', 11770, 11770, 10700, 10700),
  ('PMJAY-MO008B', 'Cisplatin
Cisplatin 40 mg/m2 every week', 'pmjay_med_oncology', 2860, 2860, 2600, 2600),
  ('PMJAY-MO008C', 'Carboplatin + Paclitaxel
Paclitaxel 175mg/m2 D1
Carboplatin AUC 5 D1 every 21 days', 'pmjay_med_oncology', 17600, 17600, 16000, 16000),
  ('PMJAY-MO009A', 'Vincristine + Topotecan + Cyclophosphamide + Irinotecan + Temozolamide
Vincristine 1.5mg/m2( day 1)
Topotecan 1.5mg/m2 (day 1-5)
Cyclophosphamide 250mg/m2 (days 1-5)
Given every 3', 'pmjay_med_oncology', 28050, 28050, 25500, 25500),
  ('PMJAY-MO009B', 'Vincristine + Ifosfamide + Etoposide
Vincristine + Doxorubicin + Cyclophosphamide
Vincristine + Cyclophosphamide + Dactinomycin.
4 cycles VIE, 6 cycles VAC, 4 cycles VCD
Vincristin', 'pmjay_med_oncology', 11990, 11990, 10900, 10900),
  ('PMJAY-MO009C', 'Vincristine + Adriamycin + Cyclophosphamide
Ifosfamide + Etoposide
Ifosfamide: 1800mg/m2 (days1-5)
Etposide: 100mg/sq.m (days 1-5)
Given every 2-3 weekly
Vincristine 1.5mg/m2 (day', 'pmjay_med_oncology', 15400, 15400, 14000, 14000),
  ('PMJAY-MO010A', 'Doxorubicin + Cisplatin
Cisplatin 100mg/m2
Doxorubicin 75mg/m2 given every 3 weeks', 'pmjay_med_oncology', 14520, 14520, 13200, 13200),
  ('PMJAY-MO010B', 'Methotrexate + Doxorubicin + Cisplatin for Relapsed Osteogenic Sarcoma
Cisplatin 120mg/sq.m
Doxorubicin 75mg/m2
Methotrexate 8-12 gram/m2
Each cycle for 5 weeks', 'pmjay_med_oncology', 32670, 32670, 29700, 29700),
  ('PMJAY-MO010C', 'OGS - 12
Ifosfamide 1800 mg/m2 D1-D5
Mesna 600mg/m2 0h 3h 6h 9h D1-D5
Adriamycin 25mg/m2 D1- D3
Cisplatin 33 mg/m2 D1-D3 every 21 days', 'pmjay_med_oncology', 35860, 35860, 32600, 32600),
  ('PMJAY-MO010D', 'OGS - 12
Ifosfamide 1800 mg/m2 D1-D5
Mesna 600mg/m2 0h 3h 6h 9h D1-D5
Cisplatin 33 mg/m2 D1-D3 every 21 days', 'pmjay_med_oncology', 34650, 34650, 31500, 31500),
  ('PMJAY-MO011A', 'Gemcitabine + Docetaxel
Gemcitabine 900 mg/m2 D1 D8
Docetaxel 100 mg/m2 D8 every 21 days', 'pmjay_med_oncology', 29040, 29040, 26400, 26400),
  ('PMJAY-MO011B', 'Ifosfamide + Adriamycin
Doxorubicin 30mg/m2 D1 D2
Ifosfamide 2000 to 3000mg/m2
Mesna 400 to 600 mg/m2 0h 4h 8h D1 - D3
Every 21 days', 'pmjay_med_oncology', 16610, 16610, 15100, 15100),
  ('PMJAY-MO011C', 'Doxorubicin 60-75/m2, every 21 days', 'pmjay_med_oncology', 4840, 4840, 4400, 4400),
  ('PMJAY-MO012A', 'Dacarbazine + Cisplatin
Dacarbazine 250mg/m2 D1-D5
Cisplatin 75 mg/m2 Every 21 days', 'pmjay_med_oncology', 8690, 8690, 7900, 7900),
  ('PMJAY-MO012B', 'Temozolamide
Temozolamide 200mg/m2 D1-D5 every 28 days', 'pmjay_med_oncology', 6050, 6050, 5500, 5500),
  ('PMJAY-MO012C', 'Imatinib 
Tab Imatinib 400/800 mg daily', 'pmjay_med_oncology', 6050, 6050, 5500, 5500),
  ('PMJAY-MO013A', '5 Fluorouracil (FU)+ Mitomycin C
5 Fluorouracil(FU) 1000mg/m2 D1-D4 D29-D32
Mitomycin 10mg/m2 D1', 'pmjay_med_oncology', 13310, 13310, 12100, 12100),
  ('PMJAY-MO013B', 'Capecitabine + Mitomycin C
Capecitabine 825mg/m2 PO twice daily till completion of RT
Mitomycin 10mg/2 D1', 'pmjay_med_oncology', 20460, 20460, 18600, 18600),
  ('PMJAY-MO013C', 'Cisplatin + 5 FU
5 FU 1000mg/m2 D1-D4
Cisplatin 75mg/m2 D1 every 4 weeks', 'pmjay_med_oncology', 11770, 11770, 10700, 10700),
  ('PMJAY-MO013D', 'Carboplatin + Paclitaxel
Paclitaxel 175mg/m2 D1
Carboplatin AUC 5-6 D1 every 21 days', 'pmjay_med_oncology', 18040, 18040, 16400, 16400),
  ('PMJAY-MO013E', 'Cisplatin + Paclitaxel
Paclitaxel 175 mg/m2 D1
Cisplatin 75mg/m2 D1 every 21 days', 'pmjay_med_oncology', 16170, 16170, 14700, 14700),
  ('PMJAY-MO014A', '5 FU + Leucovorin
5 FU 1200mg/m2 D1 D2
Leucovorin 400mg/m2 D1 every 14 days', 'pmjay_med_oncology', 6710, 6710, 6100, 6100),
  ('PMJAY-MO014B', 'Capecitabine + Irinotecan
Capecitabine 1000mg/m2 D1-D14
Irinotecan 200 mg/m2 D1 every 21 days', 'pmjay_med_oncology', 15180, 15180, 13800, 13800),
  ('PMJAY-MO014C', '5 FU + Leucovorin + Oxaliplatin
5 FU 1200mg/m2 D1 D2
Leucovorin 400mg/m2 D1
Oxaliplatin 85 mg/m2 D1 every 14 days', 'pmjay_med_oncology', 16610, 16610, 15100, 15100),
  ('PMJAY-MO014D', '5FU + Leucovorin + Irinotecan
5 FU 1200mg/m2 D1 D2
Leucovorin 400mg/m2 D1
Irinotecan 180mg/m2 85 mg/m2 D1 every 14 days', 'pmjay_med_oncology', 11660, 11660, 10600, 10600),
  ('PMJAY-MO014E', 'Capecitabine + Oxaliplatin
Capecitabine 1000mg/m2 D1-D14
Oxaliplatin 130 mg/m2 D1 every 21 days', 'pmjay_med_oncology', 15180, 15180, 13800, 13800),
  ('PMJAY-MO014F', 'Capecitabine along with RT
Capecitabine 825 mg/m2 twice daily', 'pmjay_med_oncology', 8800, 8800, 8000, 8000),
  ('PMJAY-MO014G', 'Capecitabine
Capecitabine 1000mg/m2 D1-D14 every 21 days', 'pmjay_med_oncology', 8910, 8910, 8100, 8100),
  ('PMJAY-MO014H', '5FU + Leucovorin + Oxaliplatin + Irinotecan
5 FU 1200mg/m2 D1 D2
Leucovorin 400mg/m2 D1
Oxaliplatin 85 mg/m2 D1
Irinotecan 180mg/m2 every 14 days', 'pmjay_med_oncology', 22770, 22770, 20700, 20700),
  ('PMJAY-MO015A', 'Carboplatin + Paclitaxel
Paclitaxel 175mg/m2 D1
Carboplatin AUC 5-6 D1 every 21 days', 'pmjay_med_oncology', 18040, 18040, 16400, 16400),
  ('PMJAY-MO015B', 'Cisplatin + 5 FU
5 FU 1000mg/m2 D1-D4
Cisplatin 75mg/m2 D1 every 4 weeks', 'pmjay_med_oncology', 11770, 11770, 10700, 10700),
  ('PMJAY-MO015C', 'Cisplatin + 5 FU
Cisplatin 75mg/m2 D1 D29
5FU 1000mg/m2 D1-D4 D29 D32 every 35 days', 'pmjay_med_oncology', 17160, 17160, 15600, 15600),
  ('PMJAY-MO015D', 'Paclitaxel + Carboplatin
Paclitaxel 50mg/m2 D1
Carboplatin AUC 2 D1 every week', 'pmjay_med_oncology', 9350, 9350, 8500, 8500),
  ('PMJAY-MO015E', 'Paclitaxel + Carboplatin
Paclitaxel 50mg/m2 D1
Carboplatin AUC 2 D1 every week', 'pmjay_med_oncology', 9350, 9350, 8500, 8500),
  ('PMJAY-MO016A', 'Cisplatin + Docetaxel
Docetaxel 40mg/m2 D1
Cisplatin 40 mg/m2 D1
Leucovorin 400mg/m2 D1
5FU 1000mg/m2 D1 D2 every 14 days', 'pmjay_med_oncology', 16830, 16830, 15300, 15300),
  ('PMJAY-MO016B', 'Irinotecan
Irinotecan 60- 90 mg/m2 D1 D8 every 21 days', 'pmjay_med_oncology', 13310, 13310, 12100, 12100),
  ('PMJAY-MO016C', '5 FU
5 FU 250 mg/m2 D1-D5 over 24 hrs every week', 'pmjay_med_oncology', 11440, 11440, 10400, 10400),
  ('PMJAY-MO016D', 'Capecitabine
Capecitabine 825 mg/m2 twice daily', 'pmjay_med_oncology', 8800, 8800, 8000, 8000),
  ('PMJAY-MO016E', 'Capecitabine + Oxaliplatin
Capecitabine 1000mg/m2 D1-D14
Oxaliplatin 130 mg/m2 D1 every 21 days', 'pmjay_med_oncology', 15180, 15180, 13800, 13800),
  ('PMJAY-MO016F', 'Docetaxel + Cisplatin + 5 FU
Docetaxel 40mg/m2 D1
Cisplatin 40 mg/m2 D1
Leucovorin 400mg/m2 D1
5FU 1000mg/m2 D1 D2 every 14 days', 'pmjay_med_oncology', 17600, 17600, 16000, 16000),
  ('PMJAY-MO016G', 'Docetaxel + Cisplatin + Capecitabine
Docetaxel 40mg/m2 D1
Cisplatin 40 mg/m2 D1
Capecitabine 825mg/m2 twice daily every 14 days', 'pmjay_med_oncology', 17600, 17600, 16000, 16000),
  ('PMJAY-MO016H', 'Docetaxel + Oxaliplatin + 5 FU
Docetaxel 50mg/m2 D1
Oxaliplatin 85 mg/m2 D1
Leucovorin 400mg/m2 D1
5FU 1200mg/m2 D1 D2 every 14 days', 'pmjay_med_oncology', 22440, 22440, 20400, 20400),
  ('PMJAY-MO016I', 'Docetaxel + Oxaliplatin + Capecitabine
Docetaxel 50mg/m2 D1
Oxaliplatin 85 mg/m2 D1
Capecitabine 825 mg/m2 Twice daily every 14 days', 'pmjay_med_oncology', 22440, 22440, 20400, 20400),
  ('PMJAY-MO016J', '5FU + Leucovorin + Irinotecan
5 FU 1200mg/m2 D1 D2
Leucovorin 400mg/m2 D1
Irinotecan 180mg/m2 85 mg/m2 D1 every 14 days', 'pmjay_med_oncology', 11660, 11660, 10600, 10600),
  ('PMJAY-MO016K', '5FU + Leucovorin + Oxaliplatin
5 FU 1200mg/m2 D1 D2
Leucovorin 400mg/m2 D1
Oxaliplatin 85 mg/m2 D1 every 14 days', 'pmjay_med_oncology', 16610, 16610, 15100, 15100),
  ('PMJAY-MO016L', 'Paclitaxel
Paclitaxel 80mg/m2 every week', 'pmjay_med_oncology', 7260, 7260, 6600, 6600),
  ('PMJAY-MO017A', 'Doxorubicin (TACE)
Doxorubicin 30-75 mg/m2 one course', 'pmjay_med_oncology', 27280, 27280, 24800, 24800),
  ('PMJAY-MO017B', 'Sorafenib
Sorafenib 400mg PO twice daily', 'pmjay_med_oncology', 10890, 10890, 9900, 9900),
  ('PMJAY-MO017C', 'Lenvatinib 12 mg daily', 'pmjay_med_oncology', 20570, 20570, 18700, 18700),
  ('PMJAY-MO018A', 'Gemcitabine + Nanopaclitaxel
Gemcitabine 1000mg/m2 D1 D8 D16
Albumin bound Paclitaxel 125mg/m2 D1 D8 D15 every 28 days', 'pmjay_med_oncology', 34430, 34430, 31300, 31300),
  ('PMJAY-MO018B', 'Gemcitabine
Gemcitabine 1000mg /m2 D1 D8 every 21 days', 'pmjay_med_oncology', 10890, 10890, 9900, 9900),
  ('PMJAY-MO018C', 'Gemcitabine
Gemcitabine 300mg/m2 weekly', 'pmjay_med_oncology', 4840, 4840, 4400, 4400),
  ('PMJAY-MO018D', '5FU + Leucovorin + Oxaliplatin + Irinotecan
5 FU 1200mg/m2 D1 D2
Leucovorin 400mg/m2 D1
Oxaliplatin 85 mg/m2 D1
Irinotecan 180mg/m2 every 14 days', 'pmjay_med_oncology', 22770, 22770, 20700, 20700),
  ('PMJAY-MO018E', 'Capecitabine
Capecitabine 825 mg/m2 twice daily', 'pmjay_med_oncology', 8800, 8800, 8000, 8000),
  ('PMJAY-MO018F', 'Capecitabine + Gemcitabine
Gemcitabine 1000mg/m2 D1 D8 D15
Capecitabine 830mg/m2 twice daily D1-D21 every 28 days', 'pmjay_med_oncology', 41360, 41360, 37600, 37600),
  ('PMJAY-MO019A', 'Capecitabine
Capecitabine 1000 - 1250 mg/m2 twice daily D1 -D14 every 21 days', 'pmjay_med_oncology', 8910, 8910, 8100, 8100),
  ('PMJAY-MO019B', 'Cisplatin + Gemcitabine
Gemcitabine 1000 mg/m2 D1 D8
Cisplatin 25 mg/m2 D1 D8 every 21 days', 'pmjay_med_oncology', 14740, 14740, 13400, 13400),
  ('PMJAY-MO019C', '5FU + Leucovorin + Irinotecan
5 FU 1200mg/m2 D1 D2
Leucovorin 400mg/m2 D1
Irinotecan 180mg/m2 85 mg/m2 D1 every 14 days', 'pmjay_med_oncology', 11660, 11660, 10600, 10600),
  ('PMJAY-MO019D', 'Gemcitabine
Gemcitabine 300 mg/m2 D 1every week (till RT ends) - per week', 'pmjay_med_oncology', 4840, 4840, 4400, 4400),
  ('PMJAY-MO019E', 'Gemcitabine
Gemcitabine 1000mg /m2 D1 D8 every 21 days', 'pmjay_med_oncology', 10890, 10890, 9900, 9900),
  ('PMJAY-MO019F', 'Oxaliplatin + Gemcitabine
Gemcitabine 1000 mg/m2 D1
Oxaliplatin 100 mg/m2 D1 every 14 days', 'pmjay_med_oncology', 21120, 21120, 19200, 19200),
  ('PMJAY-MO019G', 'Capecitabine + Irinotecan
Capecitabine 1000mg/m2 D1-D14
Irinotecan 200 mg/m2 D1 every 21 days', 'pmjay_med_oncology', 15180, 15180, 13800, 13800),
  ('PMJAY-MO019H', '5FU + Leucovorin + Oxaliplatin
5 FU 1200mg/m2 D1 D2
Leucovorin 400mg/m2 D1
Oxaliplatin 85 mg/m2 D1 every 14 days', 'pmjay_med_oncology', 16610, 16610, 15100, 15100),
  ('PMJAY-MO020A', 'Imatinib
Imatinib 400 mg once daily', 'pmjay_med_oncology', 18150, 18150, 16500, 16500),
  ('PMJAY-MO020B', 'Sunitinib
Sunitinb 37.5 mg once daily', 'pmjay_med_oncology', 12100, 12100, 11000, 11000),
  ('PMJAY-MO021A', 'Temozolamide
Temozolomide 150 - 200 mg/m2 D1-D5 every 28 days', 'pmjay_med_oncology', 6050, 6050, 5500, 5500),
  ('PMJAY-MO021B', 'Temozolamide
Temozolomide 75mg/m2 once daily', 'pmjay_med_oncology', 36300, 36300, 33000, 33000),
  ('PMJAY-MO022A', 'Gemcitabine + Cisplatin
Gemcitabine 1000 mg/m2 D1 D8
Cisplatin 75 mg/m2 D1 every 21 days', 'pmjay_med_oncology', 14740, 14740, 13400, 13400),
  ('PMJAY-MO022B', 'Pemetrexed + Cisplatin
Pemetrexed 500mg/m2 D1
Cisplatin 75 mg/m2 D1 every 21 days', 'pmjay_med_oncology', 11440, 11440, 10400, 10400),
  ('PMJAY-MO022C', 'Pemetrexed + Carboplatin
Pemetrexed 500mg/m2 D1
Carboplatin AUC 5-6 D1 every 21 days', 'pmjay_med_oncology', 12320, 12320, 11200, 11200),
  ('PMJAY-MO023A', 'Cisplatin + Etoposide
Etoposide 100mg/m2 D1 - D3
Cisplatin 75-100 mg/m2 D1 every 21 days', 'pmjay_med_oncology', 8580, 8580, 7800, 7800),
  ('PMJAY-MO023B', 'Cisplatin + Adriamycin + Cyclophosphamide
Cisplatin 50 mg/m2 D1
Doxorubicin 50 mg/m2 D1
Cyclophosphamide 500 mg/m2 D1 every 21 days', 'pmjay_med_oncology', 7150, 7150, 6500, 6500),
  ('PMJAY-MO024A', 'Cisplatin + Docetaxel
Docetaxel 75 mg/m2 D1
Cisplatin 75 mg/m2 D1 every 21 days', 'pmjay_med_oncology', 15070, 15070, 13700, 13700),
  ('PMJAY-MO024B', 'Cisplatin
Cisplatin 100mg/m2 every 21 days', 'pmjay_med_oncology', 11880, 11880, 10800, 10800),
  ('PMJAY-MO024C', 'Carboplatin + Gemcitabine
Gemcitabine 1000 mg/m2 D1 D8
Carboplatin AUC 5-6 D1 every 21 days', 'pmjay_med_oncology', 16830, 16830, 15300, 15300),
  ('PMJAY-MO024D', 'Docetaxel + Cisplatin + 5 FU
Docetaxel 75 mg/m2 D1
Cisplatin 75 mg/m2 D1
5 FU 750 mg/m2 D1- D5 every 21 days', 'pmjay_med_oncology', 17600, 17600, 16000, 16000),
  ('PMJAY-MO024E', 'Docetaxel
Docetaxel 20mg/m2 every week', 'pmjay_med_oncology', 3960, 3960, 3600, 3600),
  ('PMJAY-MO024F', 'Docetaxel
Docetaxel 75 mg/m2 D1 every 21 days', 'pmjay_med_oncology', 10340, 10340, 9400, 9400),
  ('PMJAY-MO024G', 'Etoposide + Carboplatin
Etoposide 100mg/m2 D1 - D3
Carboplatin AUC 5-6 D1 every 21 days', 'pmjay_med_oncology', 9350, 9350, 8500, 8500),
  ('PMJAY-MO024H', 'Etoposide + Cisplatin
Etoposide 100mg/m2 D1 - D3
Cisplatin 75-100 mg/m2 D1 every 21 days', 'pmjay_med_oncology', 8250, 8250, 7500, 7500),
  ('PMJAY-MO024I', 'Gemcitabine
Gemcitabine 1000 mg/m2 D1 D8 every 21 days', 'pmjay_med_oncology', 10890, 10890, 9900, 9900),
  ('PMJAY-MO024J', 'Gemcitabine + Cisplatin
Gemcitabine 1000 mg/m2 D1 D8
Cisplatin 75 mg/m2 D1 every 21 days', 'pmjay_med_oncology', 14740, 14740, 13400, 13400),
  ('PMJAY-MO024K', 'Paclitaxel + Carboplatin
Paclitaxel 80mg/m2 D1
Carboplatin AUC 2 D1 every week', 'pmjay_med_oncology', 9350, 9350, 8500, 8500),
  ('PMJAY-MO024L', 'Paclitaxel + Carboplatin (AUC 5)
Paclitaxel 175mg/m2 every 21 days', 'pmjay_med_oncology', 17600, 17600, 16000, 16000),
  ('PMJAY-MO024M', 'Paclitaxel
Paclitaxel 80mg/m2 every week', 'pmjay_med_oncology', 7260, 7260, 6600, 6600),
  ('PMJAY-MO024N', 'Paclitaxel
Paclitaxel 175mg/m2 every 21 days', 'pmjay_med_oncology', 14300, 14300, 13000, 13000),
  ('PMJAY-MO024O', 'Carboplatin
Carboplatin AUC 2 every week', 'pmjay_med_oncology', 3300, 3300, 3000, 3000),
  ('PMJAY-MO024P', 'Cisplatin
Cisplatin 40mg/m2 every week', 'pmjay_med_oncology', 2860, 2860, 2600, 2600),
  ('PMJAY-MO025A', 'Sunitinib
50 mg once daily 4 weeks on 2 weeks off', 'pmjay_med_oncology', 12100, 12100, 11000, 11000),
  ('PMJAY-MO025B', 'Cabozantinib 60 mg od x 1 month
every 4 weeks', 'pmjay_med_oncology', 15730, 15730, 14300, 14300),
  ('PMJAY-MO026A', 'Cisplatin + Methotrexate + Vinblastin
Methotrexate 30mg/m2 D1 D8
Vinblastine 4 mg/m2 D1 D8
Doxorubicin 30 mg/m2 D2
Cisplatin 100 mg/m2 D2
Leucovorin 15 mg PO D2 D9 every 21 days', 'pmjay_med_oncology', 8250, 8250, 7500, 7500),
  ('PMJAY-MO026B', 'Carboplatin + Gemcitabine
Gemcitabine 1000 mg/m2 D1 D8
Carboplatin AUC 5-6 D1 every 21 days', 'pmjay_med_oncology', 16830, 16830, 15300, 15300),
  ('PMJAY-MO026C', 'Cisplatin + Gemcitabine
Gemcitabine 1000 mg/m2 D1 D8
Cisplatin 75 mg/m2 D1 every 21 days', 'pmjay_med_oncology', 14740, 14740, 13400, 13400),
  ('PMJAY-MO026D', 'Cisplatin + 5 FU
5 FU 1000mg/m2 D1-D4
Cisplatin 75mg/m2 D1 every 4 weeks', 'pmjay_med_oncology', 11770, 11770, 10700, 10700),
  ('PMJAY-MO026E', 'Cisplatin + Paclitaxel
Paclitaxel 175 mg /m2 D1
Cisplatin 75 mg /m2 D1 every 21 days', 'pmjay_med_oncology', 16170, 16170, 14700, 14700),
  ('PMJAY-MO026F', 'Docetaxel
Docetaxel 75 mg/m2 D1 every 21 days', 'pmjay_med_oncology', 10340, 10340, 9400, 9400),
  ('PMJAY-MO026G', 'Gemcitabine + Paclitaxel
Gemcitabine 2500 mg/m2 D1
Paclitaxel 150 mg/m2 D1 every 14 days', 'pmjay_med_oncology', 18810, 18810, 17100, 17100),
  ('PMJAY-MO026H', 'Gemcitabine
Gemcitabine 1000mg /m2 D1 D8 every 21 days', 'pmjay_med_oncology', 10890, 10890, 9900, 9900),
  ('PMJAY-MO026I', 'Methotrexate + Vinblastin + Doxorubicin + Cisplatin
Methotrexate 30mg/m2 D1
Vinblastine 3 mg/m2 D2
Doxorubicin 30 mg/m2 D2
Cuisplatin 70 mg/m2 D2 every 14 days', 'pmjay_med_oncology', 9130, 9130, 8300, 8300),
  ('PMJAY-MO026J', 'Paclitaxel + Carboplatin
Paclitaxel 175mg/m2 D1
Carboplatin AUC 5-6 D1 every 21 days', 'pmjay_med_oncology', 17600, 17600, 16000, 16000),
  ('PMJAY-MO026K', 'Paclitaxel
Paclitaxel 80 mg/m2 D1 every week', 'pmjay_med_oncology', 7260, 7260, 6600, 6600),
  ('PMJAY-MO027A', 'Cisplatin + Paclitaxel
Paclitaxel 175 mg/m2 D1
Cisplatin 75 mg/m2 D1 every 21 days', 'pmjay_med_oncology', 16170, 16170, 14700, 14700),
  ('PMJAY-MO027B', '5 FU + Cisplatin
5 FU 1000mg/m2 D1-D4
Cisplatin 75mg/m2 D1 every 4 weeks', 'pmjay_med_oncology', 9900, 9900, 9000, 9000),
  ('PMJAY-MO027C', 'Capecitabine
Capecitabine 1000-1250 mg/m2 PO twice daily D1 -D14 every 21 days', 'pmjay_med_oncology', 8910, 8910, 8100, 8100),
  ('PMJAY-MO027D', 'Paclitaxel + Carboplatin
Paclitaxel 175mg/m2 D1
Carboplatin AUC 5-6 D1 every 21 days', 'pmjay_med_oncology', 17600, 17600, 16000, 16000),
  ('PMJAY-MO027E', 'Paclitaxel
Paclitaxel 80 mg/m2 D1 every week', 'pmjay_med_oncology', 7260, 7260, 6600, 6600),
  ('PMJAY-MO027F', 'Paclitaxel
Paclitaxel 175 mg/m2 D1 every 21 days', 'pmjay_med_oncology', 14300, 14300, 13000, 13000),
  ('PMJAY-MO027G', 'Paclitaxel + Carboplatin
Paclitaxel 80 mg/m2 D1
Carboplatin AUC 2 D1 every week', 'pmjay_med_oncology', 9350, 9350, 8500, 8500),
  ('PMJAY-MO028A', 'Docetaxel
Docetaxel 60 mg/m2 D1 every 14 days', 'pmjay_med_oncology', 9680, 9680, 8800, 8800),
  ('PMJAY-MO028B', 'Docetaxel
Docetaxel 75 mg/m2 D1 every 21 days', 'pmjay_med_oncology', 10340, 10340, 9400, 9400),
  ('PMJAY-MO028C', 'Etoposide + Carboplatin
Etoposide 100mg/m2 D1 - D3
Carboplatin AUC 5-6 D1 every 21 days', 'pmjay_med_oncology', 9350, 9350, 8500, 8500),
  ('PMJAY-MO028D', 'LHRH Agonist
Leuprolide 22.5 ug every 3 months', 'pmjay_med_oncology', 18590, 18590, 16900, 16900),
  ('PMJAY-MO028E', 'Mitoxantrone + Prednisolone
Mitoxantrone 12mg/m2 every 3 weeks
Prednsiolone 10 mg daily', 'pmjay_med_oncology', 5170, 5170, 4700, 4700),
  ('PMJAY-MO028F', 'Paclitaxel + Carboplatin
Paclitaxel 80mg/m2 D1
Carboplatin AUC 2 D1 every week', 'pmjay_med_oncology', 9350, 9350, 8500, 8500),
  ('PMJAY-MO028G', 'Paclitaxel + Carboplatin
Paclitaxel 175mg/m2 D1
Carboplatin AUC 5-6 D1 every 21 days', 'pmjay_med_oncology', 17600, 17600, 16000, 16000),
  ('PMJAY-MO028H', 'Docetaxel
Docetaxel 20mg/m2 D1 every week', 'pmjay_med_oncology', 3960, 3960, 3600, 3600),
  ('PMJAY-MO028I', 'Abiraterone 1000 mg + Prednisolone 10mg  daily 
Once every month', 'pmjay_med_oncology', 15730, 15730, 14300, 14300),
  ('PMJAY-MO029A', 'Rituximab + Cyclophosphamide + Etoposide + Prednsiolone
Rituximab 375mg/m2
Cyclophosphamide 750 mg/m2
Vincristine 1.4 mg/m2, on Day1
Etoposide 65mg/m2 Day 1 to 3
Prednisolone 100 m', 'pmjay_med_oncology', 31790, 31790, 28900, 28900),
  ('PMJAY-MO029B', 'Rituximab + Cyclophosphamide + Doxorubicin + Prednsiolone
Rituximab 375mg/m2
Cyclophosphamide 750 mg/m2
Doxorubicin 50mg/m2
Vincristine 1.4 mg/m2 on Day1
Prednisolone 100 mg Day 1-', 'pmjay_med_oncology', 32670, 32670, 29700, 29700),
  ('PMJAY-MO030A', 'Rituxmab + Dexamethasone + High Dose Cytarabine + Cisplatin
Rituximab 375mg/m2 Day 1
Cytarabine 2g/m2 BD on day 2
Dexamethasone 40 mg Day 1 - 4
Cisplatin 75mg/m2 or 
Carboplatin AU', 'pmjay_med_oncology', 42240, 42240, 38400, 38400),
  ('PMJAY-MO031A', 'GDP - R
Rituximab 375mg/m2 Day 1
Gemcitabine 1000mg/m2 on day 1 and 8
Dexamethasone 40 mg Day 1 - 4
Cisplatin 75mg/m2 on day 1
Cycle to be repeated every 21days
Total- 6 cycles', 'pmjay_med_oncology', 42790, 42790, 38900, 38900),
  ('PMJAY-MO031B', 'ICE - R
Rituximab 375mg/m2
Ifosfamide 1.66g/m2 on day 1 - 3
Mesna 1.66g/m2 day 1 - 3
Carboplatin AUC 5 on day 1
Etoposide 100mg/m2 on day 1 - 3
Cycle every 21days for 6 cycles', 'pmjay_med_oncology', 38610, 38610, 35100, 35100),
  ('PMJAY-MO032A', 'Etoposide + Prednsiolone + Vincristine + Cyclophosphamide + Doxorubicin
Rituximab 375mg/m2 Day 1
Etoposide 50mg/m2
VCR 0.4mg/m2
Doxorubicin 10mg/m2 Day1 - 4
Cyclophosphamide 750mg/', 'pmjay_med_oncology', 38390, 38390, 34900, 34900),
  ('PMJAY-MO033A', 'Codox - M - IVAC- cyclophosphamide, vincristine, doxorubicin, high-dose methotrexate / ifosfamide, etoposide, high-dose cytarabine)
GMALL (German multicenter acute lymphoblastic le', 'pmjay_med_oncology', 41800, 41800, 38000, 38000),
  ('PMJAY-MO034A', 'Bendamustine + Rituximab
Bendamustine 90mg/m2 on day 1, 2
Rituximab 375mg/m2 on day 1
Repeat every 28 days, Total 6 cycles', 'pmjay_med_oncology', 30250, 30250, 27500, 27500),
  ('PMJAY-MO034B', 'Lenalidomide + Rituximab
Rituximab 375mg/m2 Day 1
Lenlidomide 25 mg D1-28, for 8 cycles', 'pmjay_med_oncology', 27280, 27280, 24800, 24800),
  ('PMJAY-MO035A', 'Rituximab
Rituximab 375mg/m2 per week for 6 weeks', 'pmjay_med_oncology', 19360, 19360, 17600, 17600),
  ('PMJAY-MO035B', 'Rituximab + Cyclophosphamide + Vincristine + Prednisolone
Rituximab 375 mg/m2
Cyclophosphamide 750mg/m2
Vincristine 1.4mg/m2 Day 1
Prednisolone 100 mg Day 1 - 5
Repeat every 21days', 'pmjay_med_oncology', 21230, 21230, 19300, 19300),
  ('PMJAY-MO036A', 'Fludarabine + Cyclophosphamide
Fludarabine 25mg/m2 D1-3
Cyclophosphamide 250 mg/m2 D1-3 every 28 days for 6 cycles', 'pmjay_med_oncology', 22000, 22000, 20000, 20000),
  ('PMJAY-MO036B', 'Rituxmab + Chlorambucil
Rituximab 375mg/m2 Day 1
Chlorambucil 10 mg/m2 D1-7
Repeat every 28 days for 12 cycles', 'pmjay_med_oncology', 20790, 20790, 18900, 18900),
  ('PMJAY-MO036C', 'Rituximab + Fludarabine + Cyclophosphamide
Rituximab 375mg/m2 on day 1
Fludarabine 25mg/m2 D1 - 3
Cyclophosphamide 250 mg/m2 D1 - 3
Every 28 days for 6 cycles', 'pmjay_med_oncology', 49280, 49280, 44800, 44800),
  ('PMJAY-MO036D', 'Lenalidomide
lenalidomide-10-25 mg/day day 1 to 21 every 28 days', 'pmjay_med_oncology', 5830, 5830, 5300, 5300),
  ('PMJAY-MO037A', 'CHOEP
Cyclophosphamide 750mg/m2 D1
Vincristine 1.4mg/m2 D1
Adriamycin 50 mg/m2 D1
Etoposide 100mg/m2 D1-3
Prednisolone 100 mg D1-5
Every 21days. Total 6 cycles', 'pmjay_med_oncology', 6380, 6380, 5800, 5800),
  ('PMJAY-MO037B', 'CHOP
Cyclophosphamide 750mg/m2 D1
Vincristine 1.4mg/m2 D1
Adriamycin 50 mg/m2 D1
Prednisolone 100 mg D1-5
Every 21days. Total 6 cycles', 'pmjay_med_oncology', 6270, 6270, 5700, 5700),
  ('PMJAY-MO037C', 'SMILE
Methotrexate 2gm/m2 D1
Ifosfamide 1500mg/m2 D2-4
Etoposide 100mg/m2 D2-4
L-asparginase 6000U/m2 D8,10,12,14,16,18,20
Dexamethasone 40mg D1-4 every 28 days', 'pmjay_med_oncology', 23870, 23870, 21700, 21700),
  ('PMJAY-MO038A', 'GELOX
Gemcitabine 1000mg/m2 D1 and D8
Oxaliplatin 130mg/m2 D1
L- asparginase 6000 U/m2 D1-7
Repeat every 21 days', 'pmjay_med_oncology', 23430, 23430, 21300, 21300),
  ('PMJAY-MO038B', 'LVP
L-asparginase 6000U/m2 D1-5
Vincristine 1.4mg/m2 D1
Prednisolone 100mg D1-5
Repeat every 21 days', 'pmjay_med_oncology', 9680, 9680, 8800, 8800),
  ('PMJAY-MO039A', 'COPP
Cyclophosphamide 650mg/m2 D1, 8
Vincristine 1.4mg/m2 D1, 8
Procarbazine 100 mg/m2 D1-14
Prednisolone 40mg/m2 D1-14
Every 28days. Total 6 - 8 cycles', 'pmjay_med_oncology', 4730, 4730, 4300, 4300),
  ('PMJAY-MO039B', 'ABVD
Adriamycin 25mg/m2
Bleomycin 10unit/m2
Vinblastine 6mg/m2
Dacarbazine 375 mg/m2 Day 1,15
Every 28 days for 6 cycles', 'pmjay_med_oncology', 12430, 12430, 11300, 11300),
  ('PMJAY-MO039C', 'AEVD
Adriamycin 25mg/m2
Vinblastine 6mg/m2
Dacarbazine 375 mg/m2 Day 1,15
Etoposide 65mg/m2 Day 1-3, 15-17
Every 28 days for 6 cycles', 'pmjay_med_oncology', 12430, 12430, 11300, 11300),
  ('PMJAY-MO040A', 'ICE
Ifosfamide 1.5 mg/m2 D1-3
Carboplatin AUC5 D2
Etoposide 100mg/m2 D1-3
Every 3 weeks', 'pmjay_med_oncology', 12760, 12760, 11600, 11600),
  ('PMJAY-MO040B', 'MINE
Ifosfamide 4 gm/m2 over 3days (D1-3)
Mitoxantrone 8mg/m2
Etoposide 65mg/m2 D1-3
Every 3 weeks', 'pmjay_med_oncology', 12760, 12760, 11600, 11600),
  ('PMJAY-MO040C', 'PTCL - GDP
Gemcitabine 1000mg/m2 D1 and D8
Dexamethasone 40mg D1-4
Cisplatin 75mg/m2 D1 or
Cacrboplatin AUC-5
Every 3 weeks', 'pmjay_med_oncology', 17930, 17930, 16300, 16300),
  ('PMJAY-MO041A', 'DHAP
Dexamethasone 40mg D1-4
Cisplatin 100mg/m2 or 
Carboplatin AUC-5D1
Cytarabine 2 gm/m2 BD D2
Repeat every 21 days', 'pmjay_med_oncology', 15180, 15180, 13800, 13800),
  ('PMJAY-MO042A', 'Lenalidomide + Dexamethasone
Lenalidomide 25 mg daily Day1-21
Dexamethasone 40mg Day 1, 8, 15, 22
Every 28days', 'pmjay_med_oncology', 6380, 6380, 5800, 5800),
  ('PMJAY-MO042B', 'Pomalidomide + Dexamethasone
Pomalidomide 4 mg daily Day 1-21
Dexamethasone 40mg Day 1, 8, 15, 22
Every 28 days', 'pmjay_med_oncology', 8690, 8690, 7900, 7900),
  ('PMJAY-MO043A', 'Cyclophosphamide + Thalidomide + Dexamethasone
Cyclophosphamide 100mg D1-D14
Thalidomide 100-200 mg daily Day 1-28
Dexamethasone 40mg Day 1, 8, 15, 22
Every 28 days', 'pmjay_med_oncology', 4950, 4950, 4500, 4500),
  ('PMJAY-MO043B', 'Melphalan + Thalidomide + Prednisolone
Melphalan 9mg/m2 D1-D4
Thalidomide 100mg D1-28
Prednisolone 100mg Day1-4
Every 28days', 'pmjay_med_oncology', 5060, 5060, 4600, 4600),
  ('PMJAY-MO043C', 'Bortezomib + Cyclophosphamide + Dexamethasone
Cyclophosphamide - 300 mg/m2 day 1, 8, 15, 22
Dexamethasone 40mg Day 1, 8, 15, 22
Bortezomib 1.3 mg/m2 Day1, 8, 15, 22
Every 28 days', 'pmjay_med_oncology', 17710, 17710, 16100, 16100),
  ('PMJAY-MO043D', 'Bortezomib + Dexamethasone
Bortezomib 1.3 mg/m2 Day1, 8, 15, 22
Dexamethasone 40mg Day1, 8, 15, 22
Every 28 day', 'pmjay_med_oncology', 16170, 16170, 14700, 14700),
  ('PMJAY-MO043E', 'Bortezomib + Melphalan + Prednsiolone
Melphalan 9mg/m2 D1-D4
Prednisolone 100mg Day 1-4
Bortezomib 1.3 mg/m2 Day 1, 8, 15, 22
Every 28 days', 'pmjay_med_oncology', 15290, 15290, 13900, 13900),
  ('PMJAY-MO043F', 'Bortezomib + Lenalidomide + Dexamethasone
Lenalidomide 25 mg daily Day 1 - 21
Dexamethasone 40mg Day 1, 8, 15, 22
Bortezomib 1.3 mg/m2 Day 1, 8, 15, 22
Every 28 days', 'pmjay_med_oncology', 21560, 21560, 19600, 19600),
  ('PMJAY-MO043G', 'Bortezomib + Thalidomide + Dexamethasone
Thalidomide 100 mg daily Day 1 - 28 Dexamethasone 40 mg Day 1, 8, 15, 22
Bortezomib 1.3 mg/m2 Day 1, 8, 15, 22
Every 28 days', 'pmjay_med_oncology', 18150, 18150, 16500, 16500),
  ('PMJAY-MO044A', 'Imatinib
Imatinib 400 mg, 600 mg, 800 mg
(per month X 5 years)', 'pmjay_med_oncology', 18150, 18150, 16500, 16500),
  ('PMJAY-MO044B', 'Dasatinib 100 mg once a day', 'pmjay_med_oncology', 6050, 6050, 5500, 5500),
  ('PMJAY-MO045A', 'Hydroxurea
Hydroxurea daily
(Dose will be based on blood counts)', 'pmjay_med_oncology', 2750, 2750, 2500, 2500),
  ('PMJAY-MO046A', 'Cytarabine 2 gm / M2 BD for 3 days
Every 21 days for 3 cycles', 'pmjay_med_oncology', 86240, 86240, 78400, 78400),
  ('PMJAY-MO046B', 'Cytarabine 100 mg / M2 7 days
Daunomycin 60 mg / M2 3 days ( this does not include antibiotics, antifungals, blood and platelets transfusion)', 'pmjay_med_oncology', 127820, 127820, 116200, 116200),
  ('PMJAY-MO047A', 'Berlin- Frankfurt -Munster-90, Berlin- Frankfurt -Munster-95,  Berlin- Frankfurt -Munster-2000
Hyper (cyclophosphamide, Vincristine, Adriamycin,Dexamethasone 
UKALL (United kingdom', 'pmjay_med_oncology', 193600, 193600, 176000, 176000),
  ('PMJAY-MO047B', 'Berlin- Frankfurt -Munster-90
Berlin- Frankfurt -Munster-95
Berlin- Frankfurt -Munster-2000
Hyper (cyclophosphamide, Vincristine, Adriamycin,Dexamethasone
UKALL (United kingdom acu', 'pmjay_med_oncology', 149820, 149820, 136200, 136200),
  ('PMJAY-MO047C', '6 Mercaptopurine 50 mg / M2 daily
Methotrexate 25 mg / M2 Weekly for 2 years', 'pmjay_med_oncology', 4840, 4840, 4400, 4400),
  ('PMJAY-MO048A', 'Berlin- Frankfurt -Munster-90
Berlin- Frankfurt -Munster- 95
Berlin- Frankfurt -Munster- 2000
Hyper CVAD (cyclophosphamide, Vincristine, Adriamycin,Dexamethasone
UKALL (United king', 'pmjay_med_oncology', 193600, 193600, 176000, 176000),
  ('PMJAY-MO048B', 'Berlin- Frankfurt -Munster-90
Berlin- Frankfurt -Munster-95 
Berlin- Frankfurt -Munster-2000
Hyper CVAD (cyclophosphamide, Vincristine, Adriamycin,Dexamethasone
UKALL (United kingd', 'pmjay_med_oncology', 149820, 149820, 136200, 136200),
  ('PMJAY-MO048C', '6 Mercaptopurine 50 mg/M2 daily and 
Methotrexate 25 mg/M2 Weekly for 2 Years', 'pmjay_med_oncology', 4840, 4840, 4400, 4400),
  ('PMJAY-MO049A', 'Arsenic trioxide
ATRA
Daunomycin or Idarubcin
Cytarabine - multiagent - vary in each protocol', 'pmjay_med_oncology', 87120, 87120, 79200, 79200),
  ('PMJAY-MO049B', 'Arsenic trioxide
ATRA
Daunomycin or Idarubcin
Cytarabine - multiagent - vary on protocol', 'pmjay_med_oncology', 117150, 117150, 106500, 106500),
  ('PMJAY-MO049C', '6 MP 50 mg / day daily
Methotrexate 15 mg Weekly
ATRA 45 mg / M2 for 14 days 
Every three months for 18 Months', 'pmjay_med_oncology', 9680, 9680, 8800, 8800),
  ('PMJAY-MO050A', 'ATO: Arsenic trioxide 0.15 mg / kg day 1-Day 5, day 8-12, day 15-19, day 22-26 every 56 days for 4 cycles
ATRA : All trans retinoic acid  45 mg / M2 day 1-Day 14 and Day 29-43 ever', 'pmjay_med_oncology', 66550, 66550, 60500, 60500),
  ('PMJAY-MO050B', 'ATO: Arsenic trioxide 0.15 mg / kg day 1-45 or 60
ATRA: All trans retinoic acid 45 mg / M2 - day 1-45 or 60', 'pmjay_med_oncology', 98010, 98010, 89100, 89100),
  ('PMJAY-MO051A', 'Cefoperazone + Sulbactum
Piperalicillin + Tazobactum
Cefoperazone
Piperacillin
Amikacin
Gentamicin
Cefipime
Levofloxacin
Amoxycillin and clavulanate
Teicoplanin
Vancomycin', 'pmjay_med_oncology', 40260, 40260, 36600, 36600),
  ('PMJAY-MO051B', 'Meropenem
Imipenem
Colistin
Tigecyclin
Linezolid
Voriconazole
Caspfungin
Amphotericin - B', 'pmjay_med_oncology', 95370, 95370, 86700, 86700),
  ('PMJAY-MO052A', 'Rasburicase
Febuxostat
Allopurinol
Sevelamer', 'pmjay_med_oncology', 29040, 29040, 26400, 26400),
  ('PMJAY-MO053A', '5 microgram / kg / day
(max 300 microgram per day) for 7 days or
PEG - GCSF 6mg one single dose per chemotherapy cycle', 'pmjay_med_oncology', 5500, 5500, 5000, 5000),
  ('PMJAY-MO054A', 'Langerhans Cell Histiocytosis
(Histiocytosis Protocol - Induction)', 'pmjay_med_oncology', 30690, 30690, 27900, 27900),
  ('PMJAY-MO054B', 'Langerhans Cell Histiocytosis
(Histiocytosis Protocol - Maintenance)', 'pmjay_med_oncology', 34980, 34980, 31800, 31800),
  ('PMJAY-MO055A', 'Vincristine + Carboplatin
Vincristine 1.5mg/m2 (day 1, 8 and 15 for first 4 cycles and then only day 1 from cycle 5 to 17)
Carboplatin 550mg/m2 every 3 weeks (all cycles)', 'pmjay_med_oncology', 7150, 7150, 6500, 6500),
  ('PMJAY-MO055B', 'Vinblastin
Vinblastine 6 mg/m2 every week', 'pmjay_med_oncology', 4070, 4070, 3700, 3700),
  ('PMJAY-MO056A', 'PACKER', 'pmjay_med_oncology', 7700, 7700, 7000, 7000),
  ('PMJAY-MO056B', 'Cisplatin + Cyclophosphamide + Vincristine
Cyclophosphamide 1000mg/m2 (2 days every cycles)
Vincristine 1.5mg/m2 (days 1 and 8)
Cisplatin 100mg/m2 (1 day per cycle)
Cycles given ev', 'pmjay_med_oncology', 10120, 10120, 9200, 9200),
  ('PMJAY-MO057A', 'Cabroplatin + Etoposide + Cyclophosphamide + Doxorubicin
Carboplatin 600mg/m2
Etoposide 100mg/m2 (days 1-5)
Cyclophosphamide
Doxorubicin', 'pmjay_med_oncology', 10450, 10450, 9500, 9500),
  ('PMJAY-MO057B', 'Carboplatin + Cisplatin + Cyclophosphamide + Vincristine + Etoposide', 'pmjay_med_oncology', 9240, 9240, 8400, 8400),
  ('PMJAY-MO057C', '13-cis retinoic acid 160mg/m2 per day for 2 weeks
Each cycle given 4 weekly', 'pmjay_med_oncology', 2530, 2530, 2300, 2300),
  ('PMJAY-MO058A', 'Vincristine + Carboplatin + Etoposide
Carboplatin 600mg/m2 day 1
Etoposide 150mg/m2 days 1-3 Vincristine1.5mg/m2 day 1', 'pmjay_med_oncology', 9020, 9020, 8200, 8200),
  ('PMJAY-MO059A', 'Vincristine + Cyclophosphamide + Dactinomycin
Vincristine 1.5mg/m2 (day 1, 8 and 15)
Cyclophosphamie 1200 - 2200 mg/m2 (day 1)
Dactinomycin 1.5mg / m2 (day 1)
3 weekly cycle', 'pmjay_med_oncology', 6930, 6930, 6300, 6300),
  ('PMJAY-MO059B', 'Vincristine + Ifosfamide + Etoposide
Vincristine 1.5mg/m2 (days 1, 8 and 15)
Ifosfamide 1.8gm/m2 (days 1-5)
Etoposide 100mg/m2 (days 1-5)
Each cycle every 3 weeks', 'pmjay_med_oncology', 19690, 19690, 17900, 17900),
  ('PMJAY-MO060A', 'Vincristine + Topotecan + Cyclophosphamide and
Vincristine + Adriamycin + Cyclophosphamide
Vincristine 1.5mg/m2 (day 1)
Topotecan 1.5mg/m2 (day 1-5)
Cyclophosphamide 250mg/m2 (days', 'pmjay_med_oncology', 15070, 15070, 13700, 13700),
  ('PMJAY-MO061A', 'Vincristine + Actinomycin D
Vincristine 1.5 mg/m2 weekly for 12 weeks and then 3 weekly
Actinomycin D 45 microgram / kg 3 weekly for 24 weeks', 'pmjay_med_oncology', 4620, 4620, 4200, 4200),
  ('PMJAY-MO061B', 'Vincristine + Actinomycin D + Doxorubicin
Vincristine 1.5 mg/m2 weekly for 12 weeks and then 3 weekly
Actinomycin D 45 microgram/kg 3 weekly
Doxorubicin 60mg/m2 for 24 weeks', 'pmjay_med_oncology', 6050, 6050, 5500, 5500),
  ('PMJAY-MO061C', 'Cyclophosphamide + Doxorubicin + Etoposide + Vincristine + Dactinomycin
Vincristine 1.5 mg/m2
Dactinomycin 45 microgram/kg
Adriamyicn 60mg/m2
Cyclophosphamide
Etoposide
Weekly chem', 'pmjay_med_oncology', 18480, 18480, 16800, 16800),
  ('PMJAY-MO062A', 'Consolidation 
(Phase II, CNS Therapy Reinduction)', 'pmjay_med_oncology', 290070, 290070, 263700, 263700),
  ('PMJAY-MO062B', 'India collaborative childhood leukaemia group 
Berlin- Frankfurt -Munster 
Kill acute lymphocytic leukemia cells 
Mitroxantrone,Chlorambucil,Prednisolone: 841', 'pmjay_med_oncology', 105270, 105270, 95700, 95700),
  ('PMJAY-MO062C', '6 - Mercaptopurine 75mg/m2 daily
Methotrexate 20mg/m2 weekly
Vincristine 1.5mg/m2 monthly
Intrathecal methotrexate 12 mg 3 monthly', 'pmjay_med_oncology', 3300, 3300, 3000, 3000),
  ('PMJAY-MO062D', 'Dasatinib + chemo (to be used only with ALL therapy)- Permonth', 'pmjay_med_oncology', 6050, 6050, 5500, 5500),
  ('PMJAY-MO062E', 'Imatinib + chemo ((to be used only with ALL therapy) -permonth', 'pmjay_med_oncology', 6050, 6050, 5500, 5500),
  ('PMJAY-MO063A', 'Consolidation 
(Phase II, CNS Therapy Reinduction)', 'pmjay_med_oncology', 290070, 290070, 263700, 263700),
  ('PMJAY-MO063B', 'India collaborative childhood leukaemia group 
Berlin- Frankfurt -Munster 
Kill acute lymphocytic leukemia cells
Mitroxantrone,Chlorambucil,Prednisolone: 841', 'pmjay_med_oncology', 105270, 105270, 95700, 95700),
  ('PMJAY-MO063C', '6 - Mercaptopurine 75mg/m2 daily
Methotrexate 20mg/m2 weekly
Vincristine 1.5mg/m2 monthly
Intrathecal methotrexate 12 mg 3 monthly', 'pmjay_med_oncology', 3300, 3300, 3000, 3000),
  ('PMJAY-MO064A', 'Cytrabine 3 gram/m2 twice a day
Days 1, 3 and 5', 'pmjay_med_oncology', 69740, 69740, 63400, 63400),
  ('PMJAY-MO064B', 'Cytrabine 200mg/m2/day days 1-10 and 
Daunorubicin 50mg/m2 days 1, 3 and 5
Etposide 100mg/m2 days 1-5', 'pmjay_med_oncology', 127380, 127380, 115800, 115800),
  ('PMJAY-MO064C', 'Cytrabine 100-200mg/m2/day days 1-7 and Daunorubicin 50mg/m2 days 1, 3 and 5', 'pmjay_med_oncology', 126940, 126940, 115400, 115400),
  ('PMJAY-MO065A', 'Consolidation', 'pmjay_med_oncology', 71170, 71170, 64700, 64700),
  ('PMJAY-MO065B', 'Induction', 'pmjay_med_oncology', 156640, 156640, 142400, 142400),
  ('PMJAY-MO065C', 'Maintenance (18 months total cost)', 'pmjay_med_oncology', 47630, 47630, 43300, 43300),
  ('PMJAY-MO066A', 'COPDAC: Cyclophosphamide, Vincristine sulfate,Prednisone,Dacarbazine', 'pmjay_med_oncology', 11440, 11440, 10400, 10400),
  ('PMJAY-MO066B', 'Oncovin,Etoposide,Prednisone,doxorubicin hydrochloride', 'pmjay_med_oncology', 15730, 15730, 14300, 14300),
  ('PMJAY-MO067A', 'ifosfamide, carboplatin, etoposide', 'pmjay_med_oncology', 16940, 16940, 15400, 15400),
  ('PMJAY-MO067B', 'DECA: Dexamethasone,Etoposide,Cytarabine,Cisplatin', 'pmjay_med_oncology', 16940, 16940, 15400, 15400),
  ('PMJAY-MO067C', 'IGVD: Need to check', 'pmjay_med_oncology', 41140, 41140, 37400, 37400),
  ('PMJAY-MO068A', 'Lymphoma malign B 89-96 Consolidation (second month)', 'pmjay_med_oncology', 51590, 51590, 46900, 46900),
  ('PMJAY-MO068B', 'Lymphoma malign B 89-96 Consolidation (First month)', 'pmjay_med_oncology', 51370, 51370, 46700, 46700),
  ('PMJAY-MO068C', 'Lymphoma malign B 89-96 - Maintenance', 'pmjay_med_oncology', 79640, 79640, 72400, 72400),
  ('PMJAY-MO068D', 'Mitroxantrone,Chlorambucil,Prednisolone: 842', 'pmjay_med_oncology', 119460, 119460, 108600, 108600),
  ('PMJAY-MO069A', 'PEDIATRIC-GCT/JEB', 'pmjay_med_oncology', 12980, 12980, 11800, 11800),
  ('PMJAY-MO070A', 'Carboplatin + Cisplatin + Doxorubicin', 'pmjay_med_oncology', 6820, 6820, 6200, 6200),
  ('PMJAY-MO070B', 'Cisplatin', 'pmjay_med_oncology', 6820, 6820, 6200, 6200),
  ('PMJAY-MO071A', 'Docetaxel
Docetaxel 75 mg/m2 D1 every 21 days', 'pmjay_med_oncology', 10340, 10340, 9400, 9400),
  ('PMJAY-MO071B', 'Erlotinib
Erlotinib 150 mg once daily', 'pmjay_med_oncology', 5500, 5500, 5000, 5000),
  ('PMJAY-MO071C', 'Gefitnib
Gefitinib 250 mg once daily', 'pmjay_med_oncology', 3080, 3080, 2800, 2800),
  ('PMJAY-MO071D', 'Paclitaxel + Carboplatin
Paclitaxel 175mg/m2 D1
Carboplatin AUC 5-6 D1 every 21 days', 'pmjay_med_oncology', 17600, 17600, 16000, 16000),
  ('PMJAY-MO071E', 'Pemetrexed + Carboplatin
Pemetrexed 500mg/m2 D1
Carboplatin AUC 5-6 D1 every 21 days', 'pmjay_med_oncology', 12320, 12320, 11200, 11200),
  ('PMJAY-MO071F', 'Topotecan
Topotecan 1.5 mg/m2 D1-D5 every 21 days', 'pmjay_med_oncology', 29810, 29810, 27100, 27100),
  ('PMJAY-MO071G', 'Docetaxel
Docetaxel 20 mg/m2 D1 every week', 'pmjay_med_oncology', 3850, 3850, 3500, 3500),
  ('PMJAY-MO071H', 'Etoposide + Carboplatin
Etoposide 100mg/m2 D1 - D3
Carboplatin AUC 5-6 D1 every 21 days', 'pmjay_med_oncology', 9350, 9350, 8500, 8500),
  ('PMJAY-MO071I', 'Etoposide + Cisplatin
Etoposide 100mg/m2 D1 - D3
Cisplatin 75-100 mg/m2 D1 every 21 days', 'pmjay_med_oncology', 8250, 8250, 7500, 7500),
  ('PMJAY-MO071J', 'Gemcitabine
Gemcitabine 1000mg /m2 D1 D8 every 21 days', 'pmjay_med_oncology', 10890, 10890, 9900, 9900),
  ('PMJAY-MO071K', 'Gemcitabine + Carboplatin
Gemcitabine 1000 mg/m2 D1 D8
Carboplatin AUC 5-6 D1 every 21 days', 'pmjay_med_oncology', 16830, 16830, 15300, 15300),
  ('PMJAY-MO071L', 'Gemcitabine + Cisplatin
Gemcitabine 1000 mg/m2 D1 D8
Cisplatin 75 mg/m2 D1 D8 every 21 days', 'pmjay_med_oncology', 14740, 14740, 13400, 13400),
  ('PMJAY-MO071M', 'Paclitaxel
Paclitaxel 80mg/m2 every week', 'pmjay_med_oncology', 7260, 7260, 6600, 6600),
  ('PMJAY-MO071N', 'Paclitaxel
Paclitaxel 175mg/m2 every 21 days', 'pmjay_med_oncology', 14300, 14300, 13000, 13000),
  ('PMJAY-MO071O', 'Paclitaxel + Carboplatin
Paclitaxel 50mg/m2 D1
Carboplatin AUC 2 D1 every week', 'pmjay_med_oncology', 9350, 9350, 8500, 8500),
  ('PMJAY-MO071P', 'Paclitaxel + Cisplatin
Paclitaxel 175 mg/m2 D1
Cisplatin 75mg/m2 D1 every 21 days', 'pmjay_med_oncology', 16170, 16170, 14700, 14700),
  ('PMJAY-MO071Q', 'Pemetrexed + Cisplatin
Pemetrexed 500mg/m2 D1
Cisplatin 75 mg/m2 D1 every 21 days', 'pmjay_med_oncology', 11440, 11440, 10400, 10400),
  ('PMJAY-MO071R', 'Pemetrexed
Pemetrexed 500mg/m2 D1 every 21 days', 'pmjay_med_oncology', 9240, 9240, 8400, 8400),
  ('PMJAY-MO071S', 'Vinorelbine + Carboplatin
Vinorelbine 25mg/m2 D1 D8
CarboplatinAUC 5-6 D1 every 21 days', 'pmjay_med_oncology', 20570, 20570, 18700, 18700),
  ('PMJAY-MO071T', 'Vinorelbine + Cisplatin
Vinorelbine 25mg/m2 D1 D8
Cisplatin 75mg/m2 D1 every 21 days', 'pmjay_med_oncology', 20570, 20570, 18700, 18700),
  ('PMJAY-MO072A', 'Carboplatin Carboplatin AUC 2 every week', 'pmjay_med_oncology', 3300, 3300, 3000, 3000),
  ('PMJAY-MO073A', 'De-Angelis/Methotrexate', 'pmjay_med_oncology', 43560, 43560, 39600, 39600),
  ('PMJAY-MO074A', 'SA Carboplatin AUC 7 once every 3 weeks - Max 4 cycles (price per cycle)', 'pmjay_med_oncology', 7260, 7260, 6600, 6600),
  ('PMJAY-MO075A', 'Denosumab 
Denosumab 120 mg s/c D1, 8, 15 then every 28 days- 19800 per dose. Max 6 dose', 'pmjay_med_oncology', 21780, 21780, 19800, 19800),
  ('PMJAY-MO076A', 'Temozolamide 150mg/m2 D9-14 + Capecitabine 1gm/me D1-14 every 28 days', 'pmjay_med_oncology', 9680, 9680, 8800, 8800),
  ('PMJAY-MO076B', 'Carboplatin AUC 5 + Etoposide 100mg/m2 D1-D3 every 21 days', 'pmjay_med_oncology', 16280, 16280, 14800, 14800),
  ('PMJAY-SU060A', 'Induction cycles (PC)
Rate per dose -Rs 5000 max no- 06 (including drug)', 'pmjay_med_oncology', 3520, 3520, 3200, 3200),
  ('PMJAY-SE042A', 'Optic neuritis', 'pmjay_ophthalmology', 2310, 2310, 2100, 2100),
  ('PMJAY-MR010A', 'SRT / SBRT- Curative (complete treatment to be approved based on Performance Status). No extra charges for gatting and imaging', 'pmjay_rad_oncology', 121000, 121000, 110000, 110000),
  ('PMJAY-MR011A', 'SRS - Curative (complete treatment to be approved based on Performance Status) - Includes imaging charges', 'pmjay_rad_oncology', 121000, 121000, 110000, 110000),
  ('PMJAY-MR012A', 'Respiratory Gating as an addon (complete treatment)', 'pmjay_rad_oncology', 33000, 33000, 30000, 30000),
  ('PMJAY-MR014A', 'Surface Mould (as a Boost after external RT min 4 # )    - CT/MR planning  (complete treatment)', 'pmjay_rad_oncology', 33000, 33000, 30000, 30000),
  ('PMJAY-MR014B', 'Surface Mould ( Radical Treatment minimum 10 #)   - CT/MR planning (complete treatment)', 'pmjay_rad_oncology', 66000, 66000, 60000, 60000),
  ('PMJAY-MR015A', 'large Dose scan/ Pre Ablation - calculation of treatment', 'pmjay_rad_oncology', 12540, 12540, 11400, 11400),
  ('PMJAY-MR015B', 'Ablation of residual disease any risk', 'pmjay_rad_oncology', 18590, 18590, 16900, 16900),
  ('PMJAY-MR016A', 'Ablation of residual neck disease low/intermediate', 'pmjay_rad_oncology', 19800, 19800, 18000, 18000),
  ('PMJAY-MR017A', 'Ablation for metastatic disease, High risk', 'pmjay_rad_oncology', 24640, 24640, 22400, 22400),
  ('PMJAY-MR018A', 'Ablation for metastatic disease, High risk', 'pmjay_rad_oncology', 33110, 33110, 30100, 30100),
  ('PMJAY-MR019A', 'Ablation for metastatic disease, High risk', 'pmjay_rad_oncology', 37950, 37950, 34500, 34500),
  ('PMJAY-MR020A', 'Ablation for metastatic disease, High risk', 'pmjay_rad_oncology', 44000, 44000, 40000, 40000),
  ('PMJAY-SE040A', 'GA / EUA separate add on package', 'pmjay_ophthalmology', 3300, 3300, 3000, 3000),
  ('PMJAY-OT002A', 'Pre Transplant Evaluation and Stem Cell Collection and Cryopreservation', 'pmjay_transplant', 137500, 137500, 125000, 125000),
  ('PMJAY-OT002B', 'Transplant 
(includes conditioning)', 'pmjay_transplant', 343750, 343750, 312500, 312500),
  ('PMJAY-OT002C', 'Post Transplant Care for 3 months
(includes supportive care and investigations)', 'pmjay_transplant', 68750, 68750, 62500, 62500),
  ('PMJAY-PM001A', 'Hematuria Palliative Interventions', 'pmjay_urology', 48400, 48400, 44000, 44000),
  ('PMJAY-PM005A', 'Pressure sore-Interventions', 'pmjay_surg_oncology', 48400, 48400, 44000, 44000),
  ('PMJAY-PM016A', 'Ascitis tapping with long term indwelling catheter', 'pmjay_med_oncology', 48400, 48400, 44000, 44000),
  ('PMJAY-PM018A', 'Long term indwelling venous catheter', 'pmjay_med_oncology', 12100, 12100, 11000, 11000),
  ('PMJAY-PM040A', 'Cancer pain interventions', 'pmjay_other', 9130, 9130, 8300, 8300),
  ('PMJAY-PM041A', 'Cancer pain plexus interventions', 'pmjay_other', 12100, 12100, 11000, 11000),
  ('PMJAY-SB002A', 'Skeletal Tractions with pin', 'pmjay_ortho', 4150, 4150, 3500, 3500),
  ('PMJAY-SB002B', 'Application of Traction-Skin Traction', 'pmjay_ortho', 990, 990, 900, 900),
  ('PMJAY-SB003A', 'Application of POP cast- Upper limb', 'pmjay_ortho', 3300, 3300, 3000, 3000),
  ('PMJAY-SB003B', 'Application of P.O.P. casts-Lower Limbs', 'pmjay_ortho', 3300, 3300, 3000, 3000),
  ('PMJAY-SB004A', 'Application of P.O.P. Spikas & Jackets-Spikas', 'pmjay_ortho', 3850, 3850, 3500, 3500),
  ('PMJAY-SB004B', 'Application of P.O.P. Spikas & Jackets-Jackets', 'pmjay_ortho', 3850, 3850, 3500, 3500),
  ('PMJAY-SB005A', 'External fixation of Fracture-Long bone', 'pmjay_ortho', 27400, 27400, 14000, 14000),
  ('PMJAY-SB005B', 'External fixation of Fracture-Small bone', 'pmjay_ortho', 17450, 17450, 9500, 9500),
  ('PMJAY-SB005C', 'External fixation of Fracture-Pelvis', 'pmjay_ortho', 28120, 28120, 19200, 19200),
  ('PMJAY-SB005D', 'Both bones - forearms + JESS Ligamentotaxis', 'pmjay_ortho', 22400, 22400, 14000, 14000),
  ('PMJAY-SB006A', 'Percutaneous - Fixation of Fracture', 'pmjay_ortho', 4300, 4300, 3000, 3000),
  ('PMJAY-SB007A', 'Elastic nailing for fracture fixation-Femur + shaft tibia', 'pmjay_ortho', 17100, 17100, 11000, 11000),
  ('PMJAY-SB007B', 'Elastic nailing for fracture fixation-Humerus', 'pmjay_ortho', 26010, 26010, 19100, 19100),
  ('PMJAY-SB007C', 'Elastic nailing for fracture fixation-Forearm', 'pmjay_ortho', 24030, 24030, 17300, 17300),
  ('PMJAY-SB008A', 'ORIF Small Bones', 'pmjay_ortho', 15930, 15930, 11300, 11300),
  ('PMJAY-SB009A', 'Fracture - Long Bones - Metaphyseal - ORIF', 'pmjay_ortho', 25040, 25040, 16400, 16400),
  ('PMJAY-SB010A', 'ORIF Long Bones', 'pmjay_ortho', 29880, 29880, 20800, 20800),
  ('PMJAY-SB010B', 'Closed Reduction & Internal Fixation of long bones Fixation', 'pmjay_ortho', 29880, 29880, 20800, 20800),
  ('PMJAY-SB011A', 'Plating olecrenon fracture, ulna', 'pmjay_ortho', 20980, 20980, 11800, 11800),
  ('PMJAY-SB012A', 'Fracture Head radius-Fixation', 'pmjay_ortho', 19000, 19000, 10000, 10000),
  ('PMJAY-SB012B', 'Fracture Head radius-Excision', 'pmjay_ortho', 10120, 10120, 9200, 9200),
  ('PMJAY-SB013A', 'Fracture - Single Bone - Forearm - ORIF - Plating / Nailing/DCP/LCP', 'pmjay_ortho', 14790, 14790, 8900, 8900),
  ('PMJAY-SB014A', 'Fracture - Both Bones - Forearm - ORIF - Plating / Nailing /DCP/LCP', 'pmjay_ortho', 22710, 22710, 16100, 16100),
  ('PMJAY-SB015A', 'Fracture Condyle - Humerus - ORIF-Lateral Condyle', 'pmjay_ortho', 10850, 10850, 8500, 8500),
  ('PMJAY-SB015B', 'ORIF with screw/wire of Medial Condyle', 'pmjay_ortho', 10850, 10850, 8500, 8500),
  ('PMJAY-SB016A', 'ORIF Fracture intercondylar Humerus + olecranon osteotomy + TBW', 'pmjay_ortho', 27610, 27610, 15100, 15100),
  ('PMJAY-SB017A', 'Open Reduction Internal Fixation', 'pmjay_ortho', 21700, 21700, 17000, 17000),
  ('PMJAY-SB018A', 'ORIF THROUGH Single Approach PLATING', 'pmjay_ortho', 40800, 40800, 28000, 28000),
  ('PMJAY-SB018B', 'ORIF THROUGH combined Approach PLATING', 'pmjay_ortho', 51850, 51850, 33500, 33500),
  ('PMJAY-SB019A', 'Closed Reduction and Percutaneous Screw Fixation', 'pmjay_ortho', 22050, 22050, 15500, 15500),
  ('PMJAY-SB019B', 'ORIF Intertrochanteric Fracture with Dynamic Hip Screw', 'pmjay_ortho', 25240, 25240, 18400, 18400),
  ('PMJAY-SB019C', 'ORIF Intertrochanteric Fracture with Proximal Femoral Nail', 'pmjay_ortho', 25710, 25710, 16100, 16100),
  ('PMJAY-SB020A', 'ORIF of medial malleolus or bimalleolar fracture or Trimalleolar fracture', 'pmjay_ortho', 22160, 22160, 15600, 15600),
  ('PMJAY-SB021A', 'Cervical spine fixation including odontoid', 'pmjay_ortho', 49370, 49370, 26700, 26700),
  ('PMJAY-SB022A', 'Dorsal and lumber spine fixation THROUGH Anterior approach', 'pmjay_ortho', 65000, 65000, 50000, 50000),
  ('PMJAY-SB022B', 'Dorsal and lumber spine fixation THROUGH Posterior approach', 'pmjay_ortho', 66250, 66250, 37500, 37500),
  ('PMJAY-SB023A', 'Bone grafting for Fracture Non union', 'pmjay_ortho', 20460, 20460, 18600, 18600),
  ('PMJAY-SB024A', 'Arthorotomy of any joint', 'pmjay_ortho', 15400, 15400, 14000, 14000),
  ('PMJAY-SB025A', 'Arthrolysis of joint-Elbow', 'pmjay_ortho', 16500, 16500, 15000, 15000),
  ('PMJAY-SB025B', 'Arthrolysis of joint-Knee', 'pmjay_ortho', 16500, 16500, 15000, 15000),
  ('PMJAY-SB025C', 'Arthrolysis of joint-Ankle', 'pmjay_ortho', 16500, 16500, 15000, 15000),
  ('PMJAY-SB026A', 'Arthrodesis-Ankle / Triple with implant', 'pmjay_ortho', 26810, 26810, 17100, 17100),
  ('PMJAY-SB026B', 'Arthrodesis-Shoulder', 'pmjay_ortho', 23810, 23810, 17100, 17100),
  ('PMJAY-SB026C', 'Wrist, Wrist with plating', 'pmjay_ortho', 23810, 23810, 17100, 17100),
  ('PMJAY-SB026D', 'Knee, Knee with plating/Nailing', 'pmjay_ortho', 28810, 28810, 17100, 17100),
  ('PMJAY-SB026E', 'Arthrodesis-Hand', 'pmjay_surg_oncology', 29700, 29700, 27000, 27000),
  ('PMJAY-SB026F', 'Arthrodesis-Foot', 'pmjay_surg_oncology', 29700, 29700, 27000, 27000),
  ('PMJAY-SB026G', 'Arthrodesis-Ankle / Triple without implant', 'pmjay_ortho', 19140, 19140, 17400, 17400),
  ('PMJAY-SB027A', 'Disarticulation-Hind quarter', 'pmjay_ortho', 34430, 34430, 31300, 31300),
  ('PMJAY-SB027B', 'Disarticulation-Fore quarter', 'pmjay_ortho', 27500, 27500, 25000, 25000),
  ('PMJAY-SB028A', 'Closed reduction of joint dislocation-Hip', 'pmjay_ortho', 12540, 12540, 11400, 11400),
  ('PMJAY-SB028B', 'Closed reduction of joint dislocation-Shoulder', 'pmjay_ortho', 6050, 6050, 5500, 5500),
  ('PMJAY-SB028C', 'Closed reduction of joint dislocation-Elbow', 'pmjay_ortho', 14520, 14520, 13200, 13200),
  ('PMJAY-SB028D', 'Closed reduction of joint dislocation-Knee', 'pmjay_ortho', 12540, 12540, 11400, 11400),
  ('PMJAY-SB029A', 'Open Reduction of Small Joint without fixation/Open Reduction of Small Joint with fixation', 'pmjay_ortho', 9650, 9650, 8500, 8500),
  ('PMJAY-SB030A', 'Tension Band Wiring', 'pmjay_ortho', 16300, 16300, 13000, 13000),
  ('PMJAY-SB031A', 'Hemiarthroplasty-Unipolar', 'pmjay_ortho', 23140, 23140, 17400, 17400),
  ('PMJAY-SB031B', 'Hemiarthroplasty - Bipolar (Non - Modular) cemented /non cemented', 'pmjay_ortho', 31140, 31140, 17400, 17400),
  ('PMJAY-SB031C', 'Hemiarthroplasty - Bipolar (Modular) cemented/non cemented', 'pmjay_ortho', 44140, 44140, 17400, 17400),
  ('PMJAY-SB032A', 'Rockwood Type - I', 'pmjay_ortho', 32550, 32550, 20500, 20500),
  ('PMJAY-SB032B', 'Rockwood Type - II', 'pmjay_ortho', 32550, 32550, 20500, 20500),
  ('PMJAY-SB032C', 'Rockwood Type - III', 'pmjay_ortho', 32550, 32550, 20500, 20500),
  ('PMJAY-SB032D', 'Rockwood Type - IV', 'pmjay_ortho', 32550, 32550, 20500, 20500),
  ('PMJAY-SB032E', 'Rockwood Type - V', 'pmjay_ortho', 32550, 32550, 20500, 20500),
  ('PMJAY-SB032F', 'Rockwood Type - VI', 'pmjay_ortho', 32550, 32550, 20500, 20500),
  ('PMJAY-SB033A', 'Excision Arthoplasty of Femur head', 'pmjay_ortho', 19250, 19250, 17500, 17500),
  ('PMJAY-SB034A', 'Open Reduction of CDH', 'pmjay_ortho', 22000, 22000, 20000, 20000),
  ('PMJAY-SB035A', 'Patellectomy', 'pmjay_ortho', 12100, 12100, 11000, 11000),
  ('PMJAY-SB036A', 'Arthroscopic Meniscus Repair / Meniscectomy', 'pmjay_ortho', 16200, 16200, 12000, 12000),
  ('PMJAY-SB037A', 'Elbow replacement', 'pmjay_ortho', 61030, 61030, 27300, 27300),
  ('PMJAY-SB038A', 'Total Hip Replacement-Cemented', 'pmjay_ortho', 108010, 108010, 61600, 61600),
  ('PMJAY-SB038B', 'Total Hip Replacement-Cementless', 'pmjay_ortho', 115930, 115930, 46300, 46300),
  ('PMJAY-SB038C', 'Total Hip Replacement-Hybrid', 'pmjay_ortho', 121820, 121820, 63700, 63700),
  ('PMJAY-SB038D', 'Revision - Total Hip Replacement', 'pmjay_ortho', 226460, 226460, 78600, 78600),
  ('PMJAY-SB039A', 'Primary - Total Knee Replacement', 'pmjay_ortho', 95040, 95040, 36400, 36400),
  ('PMJAY-SB039B', 'Revision - Total Knee Replacement', 'pmjay_ortho', 149060, 149060, 44600, 44600),
  ('PMJAY-SB040A', 'Bone Tumour Excision (malignant) including GCT / Osteoarthritis Condylar insufficiency with Sevear colateral Ligament Damage + Joint replacement 
(depending upon type of joint and', 'pmjay_ortho', 239430, 239430, 81300, 81300),
  ('PMJAY-SB041A', 'Bone Tumour Excision + reconstruction', 'pmjay_surg_oncology', 141250, 141250, 37500, 37500),
  ('PMJAY-SB042A', 'Bone Tumour (benign) curettage / Excision and bone grafting', 'pmjay_ortho', 30470, 30470, 27700, 27700),
  ('PMJAY-SB043A', 'Single Stage Amputation-Above Elbow', 'pmjay_ortho', 16940, 16940, 15400, 15400),
  ('PMJAY-SB043B', 'Single Stage Amputation-Below Elbow', 'pmjay_ortho', 17820, 17820, 16200, 16200),
  ('PMJAY-SB043C', 'Single Stage Amputation-Above Knee', 'pmjay_ortho', 19910, 19910, 18100, 18100),
  ('PMJAY-SB043D', 'Single Stage Amputation-Below Knee', 'pmjay_ortho', 20460, 20460, 18600, 18600),
  ('PMJAY-SB043E', 'Single Stage Amputation-Foot', 'pmjay_ortho', 20460, 20460, 18600, 18600),
  ('PMJAY-SB043F', 'Single Stage Amputation-Hand', 'pmjay_ortho', 20460, 20460, 18600, 18600),
  ('PMJAY-SB043G', 'Single Stage Amputation-Wrist', 'pmjay_ortho', 20460, 20460, 18600, 18600),
  ('PMJAY-SB044A', 'Two Stage Amputation-Above Elbow', 'pmjay_ortho', 25520, 25520, 23200, 23200),
  ('PMJAY-SB044B', 'Two Stage Amputation-Below Elbow', 'pmjay_ortho', 25520, 25520, 23200, 23200),
  ('PMJAY-SB044C', 'Two Stage Amputation-Above Knee', 'pmjay_ortho', 25520, 25520, 23200, 23200),
  ('PMJAY-SB044D', 'Two Stage Amputation-Below Knee', 'pmjay_ortho', 25520, 25520, 23200, 23200),
  ('PMJAY-SB044E', 'Two Stage Amputation-Foot', 'pmjay_ortho', 25520, 25520, 23200, 23200),
  ('PMJAY-SB044F', 'Two Stage Amputation-Hand', 'pmjay_ortho', 25520, 25520, 23200, 23200),
  ('PMJAY-SB044G', 'Two Stage Amputation-Wrist', 'pmjay_ortho', 25520, 25520, 23200, 23200),
  ('PMJAY-SB045A', 'Amputation - Fingers / Toes-Finger(s)', 'pmjay_ortho', 14850, 14850, 13500, 13500),
  ('PMJAY-SB045B', 'Amputation - Fingers / Toes-Toe(s)', 'pmjay_ortho', 14850, 14850, 13500, 13500),
  ('PMJAY-SB046A', 'Tendon Grafting', 'pmjay_ortho', 17160, 17160, 15600, 15600),
  ('PMJAY-SB046B', 'Tendon Repair', 'pmjay_ortho', 17160, 17160, 15600, 15600),
  ('PMJAY-SB047A', 'Tendon Release / Tenotomy', 'pmjay_ortho', 5500, 5500, 5000, 5000),
  ('PMJAY-SB048A', 'Tenolysis', 'pmjay_ortho', 5500, 5500, 5000, 5000),
  ('PMJAY-SB049A', 'Reconstruction of Cruciate Ligament with implant and brace-Anterior', 'pmjay_ortho', 52420, 52420, 32200, 32200),
  ('PMJAY-SB049B', 'Reconstruction of Cruciate Ligament with implant and brace-Posterior', 'pmjay_ortho', 53420, 53420, 32200, 32200),
  ('PMJAY-SB050A', 'Fasciotomy', 'pmjay_ortho', 11550, 11550, 10500, 10500),
  ('PMJAY-SB051A', 'Duputryen’s Contracture release + rehabilitation', 'pmjay_ortho', 15180, 15180, 13800, 13800),
  ('PMJAY-SB052A', 'Anti-biotic + dressing - minimum of 5 sessions', 'pmjay_ortho', 16500, 16500, 15000, 15000),
  ('PMJAY-SB052B', 'Anti-biotic + dressing - minimum of 2 sessions', 'pmjay_ortho', 5390, 5390, 4900, 4900),
  ('PMJAY-SB053A', 'Sequestectomy / Curettage', 'pmjay_ortho', 11000, 11000, 10000, 10000),
  ('PMJAY-SB055A', 'Osteotomy-Long Bone', 'pmjay_ortho', 26800, 26800, 18000, 18000),
  ('PMJAY-SB055B', 'Osteotomy-Small Bone', 'pmjay_ortho', 11300, 11300, 10000, 10000),
  ('PMJAY-SB056A', 'Pelvic Osteotomy and fixation', 'pmjay_ortho', 26000, 26000, 20000, 20000),
  ('PMJAY-SB057A', 'High Tibial Osteotomy', 'pmjay_ortho', 32600, 32600, 16000, 16000),
  ('PMJAY-SB058A', 'Ilizarov Fixation', 'pmjay_ortho', 26500, 26500, 15000, 15000),
  ('PMJAY-SB059A', 'Limb Lengthening / Bone Transport by Ilizarov', 'pmjay_ortho', 38070, 38070, 23700, 23700),
  ('PMJAY-SB060A', 'Growth Modulation and fixation', 'pmjay_ortho', 11270, 11270, 5700, 5700),
  ('PMJAY-SB061A', 'Vertical Talus', 'pmjay_ortho', 16500, 16500, 15000, 15000),
  ('PMJAY-SB061B', 'Other foot deformities', 'pmjay_ortho', 16500, 16500, 15000, 15000),
  ('PMJAY-SB062A', 'Correction of club foot per cast', 'pmjay_ortho', 6270, 6270, 5700, 5700),
  ('PMJAY-SB063A', 'Corrective Surgery in Club Foot / JESS Fixator', 'pmjay_ortho', 20200, 20200, 12000, 12000),
  ('PMJAY-SB064A', 'Osteochondroma', 'pmjay_ortho', 11000, 11000, 10000, 10000),
  ('PMJAY-SB064B', 'Excision of Osteochondroma / Exostosis-Exostosis', 'pmjay_ortho', 11000, 11000, 10000, 10000),
  ('PMJAY-SB065A', 'Excision of Bursa', 'pmjay_ortho', 3300, 3300, 3000, 3000),
  ('PMJAY-SB066A', 'Nerve Transposition', 'pmjay_ortho', 14300, 14300, 13000, 13000),
  ('PMJAY-SB066B', 'Nerve Release', 'pmjay_ortho', 14300, 14300, 13000, 13000),
  ('PMJAY-SB066C', 'Nerve Neurolysis', 'pmjay_ortho', 14300, 14300, 13000, 13000),
  ('PMJAY-SB067A', 'Nerve Repair Surgery', 'pmjay_ortho', 15180, 15180, 13800, 13800),
  ('PMJAY-SB068A', 'Nerve root block', 'pmjay_ortho', 3300, 3300, 3000, 3000),
  ('PMJAY-SB069A', 'Exploration and Ulnar nerve Repair', 'pmjay_ortho', 10780, 10780, 9800, 9800),
  ('PMJAY-SB070A', 'Implant Removal under LA-K - Wire', 'pmjay_ortho', 5500, 5500, 5000, 5000),
  ('PMJAY-SB070B', 'Implant Removal under LA-Screw', 'pmjay_ortho', 5500, 5500, 5000, 5000),
  ('PMJAY-SB071A', 'Implant Removal under RA / GA-Nail', 'pmjay_ortho', 16500, 16500, 15000, 15000),
  ('PMJAY-SB071B', 'Implant Removal under RA / GA-Plate', 'pmjay_ortho', 16500, 16500, 15000, 15000),
  ('PMJAY-SB072A', 'Core Decompression', 'pmjay_ortho', 15510, 15510, 14100, 14100),
  ('PMJAY-SB074A', 'Arthroscopy / open - synovectomy', 'pmjay_ortho', 29000, 29000, 10000, 10000),
  ('PMJAY-SB002C', 'crutchfiled tong cervical spine traction', 'pmjay_ortho', 5500, 5500, 5000, 5000),
  ('PMJAY-SB002D', 'Application of Traction-POP slab', 'pmjay_ortho', 2200, 2200, 2000, 2000),
  ('PMJAY-SB003C', 'Application of P.O.P. casts-POP slab', 'pmjay_ortho', 2420, 2420, 2200, 2200),
  ('PMJAY-SB012C', 'Replacement with Head Radius Prosthesis', 'pmjay_ortho', 21000, 21000, 10000, 10000),
  ('PMJAY-SB015C', 'ORIF with screw of proximal humerus', 'pmjay_ortho', 21350, 21350, 8500, 8500),
  ('PMJAY-SB038E', 'Revision of failed hemi Arthroplasty in to THR', 'pmjay_ortho', 98000, 98000, 52500, 52500),
  ('PMJAY-SC070A', 'Bone tumors / soft tissue sarcomas: surgery', 'pmjay_surg_oncology', 58080, 58080, 52800, 52800),
  ('PMJAY-SG092A', 'Tendon Transfer', 'pmjay_ortho', 27500, 27500, 25000, 25000),
  ('PMJAY-SN032A', 'Cervical/Thoracic/ Lumbar corpectomy with fusion for Tumor/Infection/Trauma', 'pmjay_ortho', 133180, 133180, 93800, 93800),
  ('PMJAY-SN034A', 'Laminectomy without fusion for lumbar or cervical canal stenosis', 'pmjay_ortho', 68750, 68750, 62500, 62500),
  ('PMJAY-SN034B', 'Laminectomy with fusion and fixation for lumbar/cervical/thoracic canal stenosis or for tumor / trauma/Bleed(Cost of implants to be extra)', 'pmjay_ortho', 84800, 84800, 68000, 68000),
  ('PMJAY-SN046A', 'Carpal tunnel release', 'pmjay_ortho', 20680, 20680, 18800, 18800),
  ('PMJAY-ST002A', 'Head injury with repair of Facio-Maxillary Injury & fixations (including implants)', 'pmjay_ortho', 46680, 46680, 38800, 38800),
  ('PMJAY-ST003A', 'Subdural hematoma along with fixation of fracture of single long bone', 'pmjay_ortho', 82500, 82500, 75000, 75000),
  ('PMJAY-ST003B', 'Extradural hematoma along with fixation of fracture of single long bone', 'pmjay_ortho', 82500, 82500, 75000, 75000),
  ('PMJAY-ST003C', 'Subdural hematoma along with fixation of fracture of 2 or more long bone.', 'pmjay_ortho', 103180, 103180, 93800, 93800),
  ('PMJAY-ST003D', 'Extradural hematoma along with fixation of fracture of 2 or more long bone.', 'pmjay_ortho', 103180, 103180, 93800, 93800),
  ('PMJAY-ST004A', 'Management of Chest injury with fixation of Single Long bone', 'pmjay_ortho', 38000, 38000, 30000, 30000),
  ('PMJAY-ST004B', 'Management of Chest injury with fixation of 2 or more Long bones', 'pmjay_ortho', 49500, 49500, 45000, 45000),
  ('PMJAY-ST005A', 'Surgical intervention for Visceral injury and fixation of fracture of single long bone', 'pmjay_ortho', 41250, 41250, 37500, 37500),
  ('PMJAY-ST005B', 'Surgical intervention for Visceral injury and fixation of fracture of 2 or more long bones', 'pmjay_ortho', 61930, 61930, 56300, 56300),
  ('PMJAY-ST006A', 'Internal fixation of Pelviacetabular fracture', 'pmjay_ortho', 44000, 44000, 40000, 40000),
  ('PMJAY-ST007A', 'Internal fixation with Flap cover Surgery for wound in compound fracture', 'pmjay_ortho', 47500, 47500, 40000, 40000),
  ('PMJAY-ST008A', 'Emergency tendons repair ± Peripheral Nerve repair', 'pmjay_ortho', 41250, 41250, 37500, 37500),
  ('PMJAY-ST009C', 'Tendon injury repair', 'pmjay_ortho', 55000, 55000, 50000, 50000),
  ('PMJAY-ST009D', 'Tendon graft repair', 'pmjay_ortho', 55000, 55000, 50000, 50000),
  ('PMJAY-ST009E', 'Tendon Transfer', 'pmjay_ortho', 22000, 22000, 20000, 20000),
  ('PMJAY-ST010B', 'Plexus injury along with Vascular injury graft', 'pmjay_ortho', 82500, 82500, 75000, 75000),
  ('PMJAY-SC001A', 'Hemiglossectomy', 'pmjay_surg_oncology', 97130, 97130, 88300, 88300),
  ('PMJAY-SC001B', 'Total Glossectomy', 'pmjay_surg_oncology', 113960, 113960, 103600, 103600),
  ('PMJAY-SC002A', 'Soft palate', 'pmjay_surg_oncology', 62040, 62040, 56400, 56400),
  ('PMJAY-SC002B', 'Hard palate', 'pmjay_surg_oncology', 70840, 70840, 64400, 64400),
  ('PMJAY-SC003A', 'Partial', 'pmjay_surg_oncology', 83600, 83600, 76000, 76000),
  ('PMJAY-SC003B', 'Radical', 'pmjay_surg_oncology', 73920, 73920, 67200, 67200),
  ('PMJAY-SC003C', 'Total', 'pmjay_surg_oncology', 92290, 92290, 83900, 83900),
  ('PMJAY-SC004A', 'Composite resection (Oral Cavity)', 'pmjay_surg_oncology', 60060, 60060, 54600, 54600),
  ('PMJAY-SC005A', 'Oesophageal stenting', 'pmjay_surg_oncology', 90970, 90970, 82700, 82700),
  ('PMJAY-SC005B', 'Tracheal stenting', 'pmjay_surg_oncology', 90970, 90970, 82700, 82700),
  ('PMJAY-SC006A', 'Open-Transthoracic esophagectomy: 2F / 3F', 'pmjay_surg_oncology', 141790, 141790, 128900, 128900),
  ('PMJAY-SC006B', 'MIS', 'pmjay_surg_oncology', 141790, 141790, 128900, 128900),
  ('PMJAY-SC007A', 'Gastric pull-up / Jejunal Graft', 'pmjay_surg_oncology', 112200, 112200, 102000, 102000),
  ('PMJAY-SC008A', 'Open-Radical Small Bowel Resection', 'pmjay_surg_oncology', 106810, 106810, 97100, 97100),
  ('PMJAY-SC008B', 'Radical Small Bowel Resection- Lap.', 'pmjay_surg_oncology', 142450, 142450, 129500, 129500),
  ('PMJAY-SC009A', 'Open- Intersphincteric resection', 'pmjay_surg_oncology', 96580, 96580, 87800, 87800),
  ('PMJAY-SC009B', 'Intersphincteric resection-Lap.', 'pmjay_surg_oncology', 96580, 96580, 87800, 87800),
  ('PMJAY-SC010A', 'Abdominal wall tumour resection', 'pmjay_surg_oncology', 63470, 63470, 57700, 57700),
  ('PMJAY-SC010B', 'Abdominal wall tumour resection with reconstruction', 'pmjay_surg_oncology', 93500, 93500, 85000, 85000),
  ('PMJAY-SC011A', 'Exploratory laparotomy f / b diversion stoma', 'pmjay_surg_oncology', 83710, 83710, 76100, 76100),
  ('PMJAY-SC011B', 'Exploratory laparotomy f / b diversion bypass', 'pmjay_surg_oncology', 83710, 83710, 76100, 76100),
  ('PMJAY-SC012A', 'Open- Intersphincteric resection', 'pmjay_surg_oncology', 95590, 95590, 86900, 86900),
  ('PMJAY-SC012B', 'Abdominoperineal resection -Lap.', 'pmjay_surg_oncology', 95590, 95590, 86900, 86900),
  ('PMJAY-SC013A', 'Omentectomy', 'pmjay_surg_oncology', 39160, 39160, 35600, 35600),
  ('PMJAY-SC014A', 'Procedures Requiring Bypass Techniques', 'pmjay_surg_oncology', 67540, 67540, 61400, 61400),
  ('PMJAY-SC015A', 'Segmentectomy - hepatobiliary system', 'pmjay_surg_oncology', 76230, 76230, 69300, 69300),
  ('PMJAY-SC016A', 'Radical', 'pmjay_surg_oncology', 95590, 95590, 86900, 86900),
  ('PMJAY-SC016B', 'Revision', 'pmjay_surg_oncology', 95590, 95590, 86900, 86900),
  ('PMJAY-SC017A', 'Enucleation of pancreatic neoplasm', 'pmjay_surg_oncology', 65780, 65780, 59800, 59800),
  ('PMJAY-SC018A', 'Hepatoblastoma Excision', 'pmjay_surg_oncology', 93830, 93830, 85300, 85300),
  ('PMJAY-SC019A', 'Hemipelvectomy - Internal', 'pmjay_surg_oncology', 101860, 101860, 92600, 92600),
  ('PMJAY-SC020A', 'Pelvic Exenteration Anterior - Open', 'pmjay_surg_oncology', 142560, 142560, 129600, 129600),
  ('PMJAY-SC020B', 'Pelvic Exenteration Anterior - Lap.', 'pmjay_surg_oncology', 142560, 142560, 129600, 129600),
  ('PMJAY-SC020C', 'Pelvic Exenteration Total - Open', 'pmjay_surg_oncology', 142560, 142560, 129600, 129600),
  ('PMJAY-SC020D', 'Pelvic Exenteration Total - Lap.', 'pmjay_surg_oncology', 142560, 142560, 129600, 129600),
  ('PMJAY-SC021A', 'Wilms tumors: surgery', 'pmjay_surg_oncology', 62700, 62700, 57000, 57000),
  ('PMJAY-SC022A', 'Ureteric end to end anastomosis', 'pmjay_surg_oncology', 48400, 48400, 44000, 44000),
  ('PMJAY-SC023A', 'Distal ureterectomy with reimplantation', 'pmjay_surg_oncology', 48950, 48950, 44500, 44500),
  ('PMJAY-SC024A', 'Radical cystectomy With continent diversion - Open', 'pmjay_surg_oncology', 137610, 137610, 125100, 125100),
  ('PMJAY-SC024B', 'Radical cystectomy With Ileal Conduit - Open', 'pmjay_surg_oncology', 178420, 178420, 162200, 162200),
  ('PMJAY-SC024C', 'Radical cystectomy- With Ileal Conduit - Lap.', 'pmjay_surg_oncology', 178420, 178420, 162200, 162200),
  ('PMJAY-SC024D', 'Radical cystectomy- With neobladder - Open', 'pmjay_surg_oncology', 204270, 204270, 185700, 185700),
  ('PMJAY-SC024E', 'With neobladder - Lap', 'pmjay_surg_oncology', 204270, 204270, 185700, 185700),
  ('PMJAY-SC024F', 'Radical cystectomy - With ureterosigmoidostomy - Open', 'pmjay_surg_oncology', 159170, 159170, 144700, 144700),
  ('PMJAY-SC024G', 'With ureterosigmoidostomy - Lap', 'pmjay_surg_oncology', 106810, 106810, 97100, 97100),
  ('PMJAY-SC024H', 'Radical cystectomy - With ureterostomy -Open', 'pmjay_surg_oncology', 106480, 106480, 96800, 96800),
  ('PMJAY-SC024I', 'Radical cystectomy-With ureterostomy -Lap.', 'pmjay_surg_oncology', 106480, 106480, 96800, 96800),
  ('PMJAY-SC025A', 'Channel TURP', 'pmjay_surg_oncology', 42130, 42130, 38300, 38300),
  ('PMJAY-SC026A', 'Radical Urethrectomy', 'pmjay_surg_oncology', 53460, 53460, 48600, 48600),
  ('PMJAY-SC027A', 'Penile preserving surgery 
(WLE, Glansectomy, Laser)', 'pmjay_surg_oncology', 39710, 39710, 36100, 36100),
  ('PMJAY-SC028A', 'Excision of undescended testicular mass', 'pmjay_surg_oncology', 39270, 39270, 35700, 35700),
  ('PMJAY-SC029A', 'Germ Cell Tumour Excision', 'pmjay_surg_oncology', 48950, 48950, 44500, 44500),
  ('PMJAY-SG081A', 'Lobectomy-Thoracoscopic', 'pmjay_surg_oncology', 51190, 51190, 32900, 32900),
  ('PMJAY-SG081B', 'Lobectomy-Lobectomy-Open', 'pmjay_surg_oncology', 36190, 36190, 32900, 32900),
  ('PMJAY-SC031A', 'Leiomyoma excision- Open', 'pmjay_surg_oncology', 108130, 108130, 98300, 98300),
  ('PMJAY-SC031B', 'Leiomyoma excision-MIS', 'pmjay_surg_oncology', 108130, 108130, 98300, 98300),
  ('PMJAY-SC032A', 'Class I radical hysterectomy + bilateral salpingoophorectomy + BPLND - Lap.', 'pmjay_surg_oncology', 58960, 58960, 53600, 53600),
  ('PMJAY-SC032B', 'Class I radical hysterectomy + bilateral salpingoophorectomy + BPLND - Open', 'pmjay_surg_oncology', 58960, 58960, 53600, 53600),
  ('PMJAY-SC032C', 'Class I radical Hysterectomy +/- bilateral salpingoophorectomy - Lap.', 'pmjay_surg_oncology', 42350, 42350, 38500, 38500),
  ('PMJAY-SC032D', 'Class I radical Hysterectomy +/- bilateral salpingoophorectomy - Open', 'pmjay_surg_oncology', 42350, 42350, 38500, 38500),
  ('PMJAY-SC032E', 'Class II radical hysterctomy + BPLND', 'pmjay_surg_oncology', 58960, 58960, 53600, 53600),
  ('PMJAY-SC032F', 'Class III radical hysterctomy + BPLND', 'pmjay_surg_oncology', 58960, 58960, 53600, 53600),
  ('PMJAY-SC032G', 'Hysterectomy + bilateral salpingoophorectomy + omentectomy + peritonectomy and organ resections', 'pmjay_surg_oncology', 96910, 96910, 88100, 88100),
  ('PMJAY-SC033A', 'Radical vaginectomy', 'pmjay_surg_oncology', 52910, 52910, 48100, 48100),
  ('PMJAY-SC034A', 'Vulvectomy + reconstruction procedures', 'pmjay_surg_oncology', 79750, 79750, 72500, 72500),
  ('PMJAY-SC035A', 'Radical Trachelectomy', 'pmjay_surg_oncology', 65670, 65670, 59700, 59700),
  ('PMJAY-SC036A', 'Sacral Tumour Excision-Anterior + Posterior approach', 'pmjay_surg_oncology', 157300, 157300, 143000, 143000),
  ('PMJAY-SC036B', 'Sacral Tumour Excision-Posterior approach', 'pmjay_surg_oncology', 134640, 134640, 122400, 122400),
  ('PMJAY-SC037A', 'Resection of nasopharyngeal tumour', 'pmjay_surg_oncology', 77110, 77110, 70100, 70100),
  ('PMJAY-SC038A', 'Total Pharyngectomy', 'pmjay_surg_oncology', 74140, 74140, 67400, 67400),
  ('PMJAY-SC039A', 'Parapharyngeal Tumour Excision', 'pmjay_surg_oncology', 52580, 52580, 47800, 47800),
  ('PMJAY-SC040A', 'Laryngectomy-Partial laryngectomy (voice preserving)', 'pmjay_surg_oncology', 133950, 133950, 94500, 94500),
  ('PMJAY-SC040B', 'Total Laryngectomy', 'pmjay_surg_oncology', 103510, 103510, 94100, 94100),
  ('PMJAY-SC041A', 'Tracheal resection', 'pmjay_surg_oncology', 72490, 72490, 65900, 65900),
  ('PMJAY-SC042A', 'Tracheal / Carinal resection', 'pmjay_surg_oncology', 106480, 106480, 96800, 96800),
  ('PMJAY-SC043A', 'Tracheal Stenosis (End to end Anastamosis) (Throat)', 'pmjay_surg_oncology', 55000, 55000, 50000, 50000),
  ('PMJAY-SC044A', 'Central airway tumour debulking', 'pmjay_surg_oncology', 38610, 38610, 35100, 35100),
  ('PMJAY-SC045A', 'Diagnostic thoracoscopy', 'pmjay_surg_oncology', 28490, 28490, 25900, 25900),
  ('PMJAY-SC046A', 'Sleeve resection of lung cancer', 'pmjay_surg_oncology', 126280, 126280, 114800, 114800),
  ('PMJAY-SC047A', 'Mediastinoscopy-Diagnostic', 'pmjay_surg_oncology', 59400, 59400, 54000, 54000),
  ('PMJAY-SC047B', 'Mediastinoscopy-Staging', 'pmjay_surg_oncology', 59400, 59400, 54000, 54000),
  ('PMJAY-SC048A', 'Chest Wall Tumour Excision', 'pmjay_surg_oncology', 120780, 120780, 109800, 109800),
  ('PMJAY-SC048B', 'Removal of chest wall tumour with reconstruction', 'pmjay_surg_oncology', 136620, 136620, 124200, 124200),
  ('PMJAY-SC049A', 'Pleurectomy Decortication', 'pmjay_surg_oncology', 70620, 70620, 64200, 64200),
  ('PMJAY-SC050A', 'Chamberlain procedure', 'pmjay_surg_oncology', 33770, 33770, 30700, 30700),
  ('PMJAY-SC051A', 'Extrapleural pneumonectomy', 'pmjay_surg_oncology', 119020, 119020, 108200, 108200),
  ('PMJAY-SC052A', 'Pneumonectomy', 'pmjay_surg_oncology', 104610, 104610, 95100, 95100),
  ('PMJAY-SC053A', 'Lung metastectomy- Open', 'pmjay_surg_oncology', 81290, 81290, 73900, 73900),
  ('PMJAY-SC053B', 'Lung metastectomy-VATS', 'pmjay_surg_oncology', 81290, 81290, 73900, 73900),
  ('PMJAY-SC054A', 'Thoracostomy', 'pmjay_surg_oncology', 32560, 32560, 29600, 29600),
  ('PMJAY-SC055A', 'Mediastinal lymphadenectomy- Open', 'pmjay_surg_oncology', 108240, 108240, 98400, 98400),
  ('PMJAY-SC055B', 'Mediastinal lymphadenectomy-Video - assisted', 'pmjay_surg_oncology', 108240, 108240, 98400, 98400),
  ('PMJAY-SC056A', 'Mediastinal mass excision with lung resection', 'pmjay_surg_oncology', 111870, 111870, 101700, 101700),
  ('PMJAY-SC057A', 'Segmental resection of lung-Open', 'pmjay_surg_oncology', 95700, 95700, 87000, 87000),
  ('PMJAY-SC057B', 'Segmental resection of lung-Thoracoscopic', 'pmjay_surg_oncology', 95700, 95700, 87000, 87000),
  ('PMJAY-SC058A', 'Wedge resection lung- Open', 'pmjay_surg_oncology', 110000, 110000, 100000, 100000),
  ('PMJAY-SC058B', 'Wedge resection lung-Thoracoscopic', 'pmjay_surg_oncology', 110000, 110000, 100000, 100000),
  ('PMJAY-SC059A', 'Breast conserving surgery 
(lumpectomy + axillary surgery)', 'pmjay_surg_oncology', 67650, 67650, 61500, 61500),
  ('PMJAY-SC059B', 'Breast conserving surgery with Oncoplasty', 'pmjay_surg_oncology', 62260, 62260, 56600, 56600),
  ('PMJAY-SC060A', 'Axillary Sampling / Sentinel Node Biopsy', 'pmjay_surg_oncology', 28490, 28490, 25900, 25900),
  ('PMJAY-SC061A', 'Axillary dissection', 'pmjay_surg_oncology', 35420, 35420, 32200, 32200),
  ('PMJAY-SC062A', 'Scalp tumour excision with skull bone excision', 'pmjay_surg_oncology', 48950, 48950, 44500, 44500),
  ('PMJAY-SC063A', 'Neuroblastoma Excision', 'pmjay_surg_oncology', 116270, 116270, 105700, 105700),
  ('PMJAY-SC064A', 'Excision of Pinna for Growths / Injuries - Total Amputation & Excision of External Auditory Meatus-Growth - Squamous', 'pmjay_surg_oncology', 61930, 61930, 56300, 56300),
  ('PMJAY-SC064B', 'Excision of Pinna for Growths / Injuries - Total Amputation & Excision of External Auditory Meatus-Growth - Basal', 'pmjay_surg_oncology', 61930, 61930, 56300, 56300),
  ('PMJAY-SC064C', 'Excision of Pinna for Growths / Injuries - Total Amputation & Excision of External Auditory Meatus-Injury', 'pmjay_surg_oncology', 61930, 61930, 56300, 56300),
  ('PMJAY-SC065A', 'Neck dissection - comprehensive', 'pmjay_surg_oncology', 36630, 36630, 33300, 33300),
  ('PMJAY-SC066A', 'Benign Soft Tissue Tumour - Excision (Small)', 'pmjay_surg_oncology', 21230, 21230, 19300, 19300),
  ('PMJAY-SC067A', 'Malignant Soft Tissue Tumour (Small)- Excision (New procedure)', 'pmjay_surg_oncology', 56100, 56100, 51000, 51000),
  ('PMJAY-SC068A', 'Myocutaneous flap', 'pmjay_surg_oncology', 71830, 71830, 65300, 65300),
  ('PMJAY-SC068B', 'Fasciocutaneous flap', 'pmjay_surg_oncology', 71830, 71830, 65300, 65300),
  ('PMJAY-SC069A', 'Rotationplasty', 'pmjay_surg_oncology', 88110, 88110, 80100, 80100),
  ('PMJAY-SC071A', 'Endoprosthesis Revision-Complete', 'pmjay_surg_oncology', 106810, 106810, 97100, 97100),
  ('PMJAY-SC071B', 'Endoprosthesis Revision-Partial', 'pmjay_surg_oncology', 74360, 74360, 67600, 67600),
  ('PMJAY-SC072A', 'Vertebral Tumour Excision and Reconstruction', 'pmjay_surg_oncology', 110000, 110000, 100000, 100000),
  ('PMJAY-SC073A', 'Microvascular reconstruction (free flaps)', 'pmjay_surg_oncology', 94860, 94860, 72600, 72600),
  ('PMJAY-SC074A', 'Vascular reconstruction', 'pmjay_surg_oncology', 104830, 104830, 95300, 95300),
  ('PMJAY-SC075A', 'Curopsy / Sclerotherapy', 'pmjay_surg_oncology', 30690, 30690, 27900, 27900),
  ('PMJAY-SC076A', 'Chemo Port Insertion', 'pmjay_surg_oncology', 51400, 51400, 24000, 24000),
  ('PMJAY-SC077A', 'Posterior Exenteration (Gynaec)', 'pmjay_surg_oncology', 111210, 111210, 101100, 101100),
  ('PMJAY-SC078A', 'Bilateral pelvic lymph Node Dissection (BPLND)', 'pmjay_surg_oncology', 61710, 61710, 56100, 56100),
  ('PMJAY-SC079A', 'Head & Neck Flap Cutting any type', 'pmjay_surg_oncology', 26400, 26400, 24000, 24000),
  ('PMJAY-SC081A', 'Cytoreductive surgery for ovarian cancer', 'pmjay_surg_oncology', 99880, 99880, 90800, 90800),
  ('PMJAY-SC082A', 'Wide Excision- Oral Cavity Malignancy', 'pmjay_surg_oncology', 53900, 53900, 49000, 49000),
  ('PMJAY-SE037A', 'Exenteration', 'pmjay_surg_oncology', 26070, 26070, 23700, 23700),
  ('PMJAY-SG001A', 'Oesophagectomy', 'pmjay_surg_oncology', 137500, 137500, 125000, 125000),
  ('PMJAY-SG003C', 'Partial Gastrectomy for Carcinoma', 'pmjay_surg_oncology', 47850, 47850, 43500, 43500),
  ('PMJAY-SG003D', 'Subtotal Gastrectomy for Carcinoma', 'pmjay_surg_oncology', 47850, 47850, 43500, 43500),
  ('PMJAY-SG003E', 'Total Gastrectomy - Lap.', 'pmjay_surg_oncology', 89430, 89430, 81300, 81300),
  ('PMJAY-SG003F', 'Total Gastrectomy - Open', 'pmjay_surg_oncology', 89430, 89430, 81300, 81300),
  ('PMJAY-SG0106A', 'Subtotal Colectomy- Open', 'pmjay_surg_oncology', 38390, 38390, 34900, 34900),
  ('PMJAY-SG0106B', 'Subtotal Colectomy-Lap', 'pmjay_surg_oncology', 38390, 38390, 34900, 34900),
  ('PMJAY-SG010A', 'Gastrojejunostomy', 'pmjay_surg_oncology', 33000, 33000, 30000, 30000),
  ('PMJAY-SG012A', 'Feeding Jejunostomy', 'pmjay_surg_oncology', 16500, 16500, 15000, 15000),
  ('PMJAY-SG020A', 'Total Colectomy- Open', 'pmjay_surg_oncology', 53130, 53130, 48300, 48300),
  ('PMJAY-SG020B', 'Total Colectomy-Lap', 'pmjay_surg_oncology', 53130, 53130, 48300, 48300),
  ('PMJAY-SG021A', 'Hemi colectomy Right-Open', 'pmjay_surg_oncology', 38720, 38720, 35200, 35200),
  ('PMJAY-SG021B', 'Hemi colectomy-Right- Lap', 'pmjay_surg_oncology', 38720, 38720, 35200, 35200),
  ('PMJAY-SG021C', 'Hemi colectomy Left-Open', 'pmjay_surg_oncology', 38720, 38720, 35200, 35200),
  ('PMJAY-SG021D', 'Hemi colectomy-Left- Lap', 'pmjay_surg_oncology', 38720, 38720, 35200, 35200),
  ('PMJAY-SG023A', 'Colostomy', 'pmjay_surg_oncology', 22000, 22000, 20000, 20000),
  ('PMJAY-SG024A', 'Closure of stoma', 'pmjay_surg_oncology', 18370, 18370, 16700, 16700),
  ('PMJAY-SG028A', 'Rectal Polyp Excision', 'pmjay_surg_oncology', 11000, 11000, 10000, 10000),
  ('PMJAY-SG029A', 'Anterior Resection of rectum- Open', 'pmjay_surg_oncology', 55000, 55000, 50000, 50000),
  ('PMJAY-SG029B', 'Anterior Resection of rectum-Lap', 'pmjay_surg_oncology', 55000, 55000, 50000, 50000),
  ('PMJAY-SG037A', 'Hepatic Resection- Open', 'pmjay_surg_oncology', 41250, 41250, 37500, 37500),
  ('PMJAY-SG037B', 'Hepatic Resection-Lap', 'pmjay_surg_oncology', 41250, 41250, 37500, 37500),
  ('PMJAY-SG043A', 'Bypass - Inoperable Pancreas', 'pmjay_surg_oncology', 68750, 68750, 62500, 62500),
  ('PMJAY-SG044A', 'Distal Pancreatectomy/Pancreatico Jejunostomy with/without spleenlectomy', 'pmjay_surg_oncology', 49060, 49060, 44600, 44600),
  ('PMJAY-SG045A', 'PancreaticoDuodenectomy (Whipple''s)', 'pmjay_surg_oncology', 137500, 137500, 125000, 125000),
  ('PMJAY-SG049A', 'Retroperitoneal Tumor – Excision', 'pmjay_surg_oncology', 43120, 43120, 39200, 39200),
  ('PMJAY-SG059A', 'Orchidectomy', 'pmjay_surg_oncology', 13200, 13200, 12000, 12000),
  ('PMJAY-SG061A', 'Estlander Operation (lip)', 'pmjay_surg_oncology', 20350, 20350, 18500, 18500),
  ('PMJAY-SG062A', 'Wedge Excision', 'pmjay_surg_oncology', 27610, 27610, 25100, 25100),
  ('PMJAY-SG062B', 'Wedge Excision and Vermilionectomy', 'pmjay_surg_oncology', 41250, 41250, 37500, 37500),
  ('PMJAY-SG062C', 'Cheek advancement', 'pmjay_surg_oncology', 41250, 41250, 37500, 37500),
  ('PMJAY-SG063A', 'Complete Excision of Growth from Tongue only 
(inclusive of Histopathology)', 'pmjay_surg_oncology', 22990, 22990, 20900, 20900),
  ('PMJAY-SG064A', 'Excision of Growth from Tongue with neck node dissection', 'pmjay_surg_oncology', 43120, 43120, 39200, 39200),
  ('PMJAY-SG066A', 'Submandibular Mass Excision', 'pmjay_surg_oncology', 27500, 27500, 25000, 25000),
  ('PMJAY-SG067A', 'Radical Neck Dissection', 'pmjay_surg_oncology', 37070, 37070, 33700, 33700),
  ('PMJAY-SG069A', 'Carotid Body tumour - Excision', 'pmjay_surg_oncology', 41250, 41250, 37500, 37500),
  ('PMJAY-SG070A', 'Hemi thyroidectomy', 'pmjay_surg_oncology', 28930, 28930, 26300, 26300),
  ('PMJAY-SG070B', 'Total thyroidectomy', 'pmjay_surg_oncology', 28930, 28930, 26300, 26300),
  ('PMJAY-SG070C', 'Total Thyroidectomy with Block Dissection', 'pmjay_surg_oncology', 47960, 47960, 43600, 43600),
  ('PMJAY-SG071A', 'Excision of Parathyroid Adenoma/Carcinoma', 'pmjay_surg_oncology', 27500, 27500, 25000, 25000),
  ('PMJAY-SG074A', 'Breast Lump Excision (Benign) or  Accssory breast', 'pmjay_surg_oncology', 11000, 11000, 10000, 10000),
  ('PMJAY-SG075A', 'Simple Mastectomy', 'pmjay_surg_oncology', 27500, 27500, 25000, 25000),
  ('PMJAY-SG075B', 'Radical / Modified Radical Mastectomy', 'pmjay_surg_oncology', 36190, 36190, 32900, 32900),
  ('PMJAY-SG087A', 'Flap Reconstructive Surgery', 'pmjay_surg_oncology', 39710, 39710, 36100, 36100),
  ('PMJAY-SG091A', 'Skin Flaps - Rotation Flaps', 'pmjay_surg_oncology', 31680, 31680, 28800, 28800),
  ('PMJAY-SL004A', 'Mastoidectomy-Simple', 'pmjay_surg_oncology', 30800, 30800, 28000, 28000),
  ('PMJAY-SL004B', 'Mastoidectomy-Radical', 'pmjay_surg_oncology', 30800, 30800, 28000, 28000),
  ('PMJAY-SL005A', 'Myringotomy with or without Grommet-Unilateral', 'pmjay_surg_oncology', 8360, 8360, 7600, 7600),
  ('PMJAY-SL005B', 'Myringotomy with or without Grommet-Bilateral', 'pmjay_surg_oncology', 8360, 8360, 7600, 7600),
  ('PMJAY-SL021A', 'Total Parotidectomy', 'pmjay_surg_oncology', 31020, 31020, 28200, 28200),
  ('PMJAY-SL021B', 'Superficial Parotidectomy', 'pmjay_surg_oncology', 26180, 26180, 23800, 23800),
  ('PMJAY-SL027A', 'Neck dissection-Selective Benign neck tumour
excision', 'pmjay_surg_oncology', 25850, 25850, 23500, 23500),
  ('PMJAY-SL027B', 'Comprehensive Benign neck tumour
excision', 'pmjay_surg_oncology', 25850, 25850, 23500, 23500),
  ('PMJAY-SL027C', 'Selective Pharyngeal diverticulum
excision', 'pmjay_surg_oncology', 25850, 25850, 23500, 23500),
  ('PMJAY-SL027D', 'Comprehensive Pharyngeal
diverticulum excision', 'pmjay_surg_oncology', 25850, 25850, 23500, 23500),
  ('PMJAY-SL020A', 'Excision of tumour of oral cavity / paranasal sinus / laryngopharynx
without reconstruction', 'pmjay_surg_oncology', 33750, 33750, 12500, 12500),
  ('PMJAY-SL020B', 'Excision of tumour of oral cavity / paranasal sinus / laryngopharynx
with pedicled flap reconstruction', 'pmjay_surg_oncology', 50270, 50270, 45700, 45700),
  ('PMJAY-SL020C', 'Excision of tumour of oral cavity /
paranasal sinus / laryngopharynx with free flap reconstruction', 'pmjay_surg_oncology', 54430, 54430, 31300, 31300),
  ('PMJAY-SL025A', 'Open laryngeal framework surgery / Thyroplasty', 'pmjay_surg_oncology', 20500, 20500, 5000, 5000),
  ('PMJAY-SL029A', 'Endoscopic CSF Rhinorrhea Repair', 'pmjay_surg_oncology', 44750, 44750, 32500, 32500),
  ('PMJAY-SL029B', 'Optic nerve decompression', 'pmjay_surg_oncology', 44090, 44090, 31900, 31900),
  ('PMJAY-SL029C', 'Orbital decompression', 'pmjay_surg_oncology', 44090, 44090, 31900, 31900),
  ('PMJAY-SL029D', 'Craniofacial resection', 'pmjay_surg_oncology', 44090, 44090, 31900, 31900),
  ('PMJAY-SL029E', 'Maxillary swing', 'pmjay_surg_oncology', 44090, 44090, 31900, 31900),
  ('PMJAY-SL030A', 'Endoscopic Hypophysectomy', 'pmjay_surg_oncology', 63780, 63780, 49800, 49800),
  ('PMJAY-SL030B', 'Clival tumour excision', 'pmjay_surg_oncology', 63780, 63780, 49800, 49800),
  ('PMJAY-SL031A', 'Subtotal petrosectomy', 'pmjay_surg_oncology', 42990, 42990, 30900, 30900),
  ('PMJAY-SL031B', 'Post-traumatic facial nerve
decompression', 'pmjay_surg_oncology', 42990, 42990, 30900, 30900),
  ('PMJAY-SL031C', 'CSF Otorrhoea repair', 'pmjay_surg_oncology', 42990, 42990, 30900, 30900),
  ('PMJAY-SL032A', 'Fisch approach', 'pmjay_surg_oncology', 63890, 63890, 49900, 49900),
  ('PMJAY-SL032B', 'Translabyrinthine approach', 'pmjay_surg_oncology', 63890, 63890, 49900, 49900),
  ('PMJAY-SL032C', 'Transcochlear approach', 'pmjay_surg_oncology', 63890, 63890, 49900, 49900),
  ('PMJAY-SL032D', 'Temporal Bone resection', 'pmjay_surg_oncology', 63890, 63890, 49900, 49900),
  ('PMJAY-SO002A', 'Laparotomy and proceed for Ovarian Cancers. Omentomy with Bilateral
Salpingo-oophorectomy', 'pmjay_surg_oncology', 41800, 41800, 38000, 38000),
  ('PMJAY-SO003A', 'Laparoscopic tubal surgeries
(for any indication including ectopic pregnancy)', 'pmjay_surg_oncology', 15290, 15290, 13900, 13900),
  ('PMJAY-SO004A', 'Procedure on Fallopian Tube for
establishing Tubal Patency', 'pmjay_surg_oncology', 12760, 12760, 11600, 11600),
  ('PMJAY-SU075A', 'Urethrovaginal fistula repair', 'pmjay_obgyn', 55000, 55000, 50000, 50000),
  ('PMJAY-SU090A', 'Radical Retroperitoneal lymph node dissection- Open', 'pmjay_surg_oncology', 54780, 54780, 49800, 49800),
  ('PMJAY-SU090B', 'Radical Retroperitoneal lymph node dissection - Lap.', 'pmjay_surg_oncology', 55770, 55770, 50700, 50700),
  ('PMJAY-SU003A', 'Nephrectomy For Benign pathology - Open', 'pmjay_surg_oncology', 45210, 45210, 41100, 41100),
  ('PMJAY-SU003B', 'Nephrectomy -For Benign pathology - Lap.', 'pmjay_surg_oncology', 50380, 50380, 45800, 45800),
  ('PMJAY-SU003C', 'Nephrectomy- Radical (Renal tumor) - Open', 'pmjay_surg_oncology', 45210, 45210, 41100, 41100),
  ('PMJAY-SU003D', 'Nephrectomy- Radical (Renal tumor) - Lap.', 'pmjay_surg_oncology', 50380, 50380, 45800, 45800),
  ('PMJAY-SU004A', 'Nephrectomy - Partial or Hemi-Open', 'pmjay_surg_oncology', 59950, 59950, 54500, 54500),
  ('PMJAY-SU004B', 'Nephrectomy - Partial or Hemi- Lap.', 'pmjay_surg_oncology', 63580, 63580, 57800, 57800),
  ('PMJAY-SU010A', 'Nephro ureterectomy (Benign)-Open', 'pmjay_surg_oncology', 45210, 45210, 41100, 41100),
  ('PMJAY-SU010B', 'Nephro ureterectomy (Benign) - Lap.', 'pmjay_surg_oncology', 50380, 50380, 45800, 45800),
  ('PMJAY-SU011A', 'Nephro ureterectomy with cuff of bladder-Open', 'pmjay_surg_oncology', 45210, 45210, 41100, 41100),
  ('PMJAY-SU011B', 'Nephro ureterectomy with cuff of bladder Lap.', 'pmjay_surg_oncology', 50380, 50380, 45800, 45800),
  ('PMJAY-SE001A', 'Ptosis Surgery', 'pmjay_ophthalmology', 8800, 8800, 8000, 8000),
  ('PMJAY-SE002A', 'Entropion correction', 'pmjay_ophthalmology', 7260, 7260, 6600, 6600),
  ('PMJAY-SE003A', 'Ectropion correction', 'pmjay_ophthalmology', 7150, 7150, 6500, 6500),
  ('PMJAY-SE004A', 'Lid Tear Repair', 'pmjay_ophthalmology', 8470, 8470, 7700, 7700),
  ('PMJAY-SE005A', 'Lid Abscess Drainage', 'pmjay_ophthalmology', 6270, 6270, 5700, 5700),
  ('PMJAY-SE006A', 'Lid Tumor excision + Lid Reconstruction', 'pmjay_ophthalmology', 15400, 15400, 14000, 14000),
  ('PMJAY-SE007A', 'Chalazion Removal', 'pmjay_ophthalmology', 2200, 2200, 2000, 2000),
  ('PMJAY-SE008A', 'Squint correction-Minor - upto 2 muscles', 'pmjay_ophthalmology', 4510, 4510, 4100, 4100),
  ('PMJAY-SE008B', 'Squint correction-Major - 3 or more muscles (complex surgery involving four muscles or oblique muscles)', 'pmjay_ophthalmology', 13200, 13200, 12000, 12000),
  ('PMJAY-SE009A', 'Conjunctival tumour excision including Amniotic Membrane Graft', 'pmjay_ophthalmology', 7700, 7700, 7000, 7000),
  ('PMJAY-SE010A', 'Canaliculo Dacryocystorhinostomy with Silicon Tube / Stent', 'pmjay_ophthalmology', 15750, 15750, 12500, 12500),
  ('PMJAY-SE010B', 'Canaliculo Dacryocystorhinostomy without Silicon Tube / Stent', 'pmjay_ophthalmology', 11000, 11000, 10000, 10000),
  ('PMJAY-SE010C', 'Dacryocystorhinostomy with Silicon Tube / Stent', 'pmjay_ophthalmology', 15750, 15750, 12500, 12500),
  ('PMJAY-SE010D', 'Dacryocystorhinostomy without Silicon Tube / Stent', 'pmjay_ophthalmology', 11000, 11000, 10000, 10000),
  ('PMJAY-SE011A', 'Corneal Ulcer Management', 'pmjay_ophthalmology', 5500, 5500, 5000, 5000),
  ('PMJAY-SE012A', 'Corneal Grafting', 'pmjay_ophthalmology', 15070, 15070, 13700, 13700),
  ('PMJAY-SE012C', 'Lamellar Keratoplasty', 'pmjay_ophthalmology', 18920, 18920, 17200, 17200),
  ('PMJAY-SE013A', 'Corneal Collagen Crosslinking', 'pmjay_ophthalmology', 19250, 19250, 17500, 17500),
  ('PMJAY-SE014A', 'Pterygium + Conjunctival Autograft', 'pmjay_ophthalmology', 12870, 12870, 11700, 11700),
  ('PMJAY-SE015A', 'Corneo / Scleral / Corneo scleral tear repair', 'pmjay_ophthalmology', 8250, 8250, 7500, 7500),
  ('PMJAY-SE016A', 'Corneal / Scleral Patch Graft', 'pmjay_ophthalmology', 8030, 8030, 7300, 7300),
  ('PMJAY-SE017A', 'Scleral buckling surgery', 'pmjay_ophthalmology', 27170, 27170, 24700, 24700),
  ('PMJAY-SE018A', 'Scleral Buckle Removal', 'pmjay_ophthalmology', 7590, 7590, 6900, 6900),
  ('PMJAY-SE019A', 'Limbal Dermoid Removal', 'pmjay_ophthalmology', 5750, 5750, 2500, 2500),
  ('PMJAY-SE021A', 'Paediatric lensectomy', 'pmjay_ophthalmology', 15650, 15650, 11500, 11500),
  ('PMJAY-SE021B', 'Pediatric lens aspiration with posterior capsulotomy & anterior vitrectomy', 'pmjay_ophthalmology', 15650, 15650, 11500, 11500),
  ('PMJAY-SE021C', 'Paediatric Membranectomy & anterior vitrectomy', 'pmjay_ophthalmology', 14000, 14000, 10000, 10000),
  ('PMJAY-SE022A', 'Capsulotomy (YAG)', 'pmjay_ophthalmology', 2090, 2090, 1900, 1900),
  ('PMJAY-SE023A', 'SFIOL (inclusive of Vitrectomy)', 'pmjay_ophthalmology', 23680, 23680, 18800, 18800),
  ('PMJAY-SE024A', 'Secondary IOL / IOL Exchange / Explant', 'pmjay_ophthalmology', 9820, 9820, 6200, 6200),
  ('PMJAY-SE025A', 'IRIS Prolapse – Repair', 'pmjay_ophthalmology', 4950, 4950, 4500, 4500),
  ('PMJAY-SE026A', 'Iridectomy', 'pmjay_ophthalmology', 2200, 2200, 2000, 2000),
  ('PMJAY-SE027A', 'Cyclocryotherapy / Cyclophotocoagulation', 'pmjay_ophthalmology', 5170, 5170, 4700, 4700),
  ('PMJAY-SE027B', 'Glaucoma Surgery (Trabeculectomy only) with or without Mitomycin C, including postoperative medications for 12 weeks 
(and wherever surgical or laser procedures required for bleb a', 'pmjay_ophthalmology', 15620, 15620, 14200, 14200),
  ('PMJAY-SE027C', 'Glaucoma Shunt Surgery', 'pmjay_ophthalmology', 24930, 24930, 16300, 16300),
  ('PMJAY-SE027D', 'Pediatric Glaucoma Surgery', 'pmjay_ophthalmology', 20680, 20680, 18800, 18800),
  ('PMJAY-SE028A', 'EUA for Confirmation of Pediatric Glaucoma', 'pmjay_ophthalmology', 3300, 3300, 3000, 3000),
  ('PMJAY-SE029A', 'Retinal Laser Photocoagulation -For retinal tear repair Per Eye Per Sitting', 'pmjay_ophthalmology', 1650, 1650, 1500, 1500),
  ('PMJAY-SE029B', 'Pan Retinal Photocoagulation (PRP) - Retinal Laser including 3 sittings / package of retino laser photocoagulation 
(3 sittings per eye for both eyes)', 'pmjay_ophthalmology', 9350, 9350, 8500, 8500),
  ('PMJAY-SE030A', 'ROP Laser - Per Eye', 'pmjay_ophthalmology', 5500, 5500, 5000, 5000),
  ('PMJAY-SE031A', 'Retinal Cryopexy', 'pmjay_ophthalmology', 4180, 4180, 3800, 3800),
  ('PMJAY-SE032A', 'Vitreoretinal Surgery (with Silicon Oil Insertion)', 'pmjay_ophthalmology', 33830, 33830, 25300, 25300),
  ('PMJAY-SE033A', 'SOR (Silicon Oil Removal)', 'pmjay_ophthalmology', 10230, 10230, 9300, 9300),
  ('PMJAY-SE034A', 'Endophthalmitis (excluding Vitrectomy)', 'pmjay_ophthalmology', 5500, 5500, 5000, 5000),
  ('PMJAY-SE035A', 'Enucleation Without implant', 'pmjay_ophthalmology', 13090, 13090, 11900, 11900),
  ('PMJAY-SE035B', 'Enucleation With implant', 'pmjay_ophthalmology', 15630, 15630, 13300, 13300),
  ('PMJAY-SE036A', 'Evisceration', 'pmjay_ophthalmology', 15630, 15630, 13300, 13300),
  ('PMJAY-SE038A', 'Socket Reconstruction including Amniotic Membrane Graft', 'pmjay_ophthalmology', 15400, 15400, 14000, 14000),
  ('PMJAY-SE039A', 'Orbitotomy', 'pmjay_ophthalmology', 19250, 19250, 17500, 17500),
  ('PMJAY-SE041A', 'Orbital fracture repair under GA', 'pmjay_ophthalmology', 11550, 11550, 10500, 10500),
  ('PMJAY-SG002A', 'Operations for Replacement of Oesophagus by Colon', 'pmjay_gen_surgery', 67320, 67320, 61200, 61200),
  ('PMJAY-SG003A', 'Bleeding Ulcer - Partial Gastrectomy without Vagotomy', 'pmjay_gen_surgery', 68750, 68750, 62500, 62500),
  ('PMJAY-SG003B', 'Bleeding Ulcer - Partial Gastrectomy with Vagotomy', 'pmjay_gen_surgery', 68750, 68750, 62500, 62500),
  ('PMJAY-SG004A', 'Operative Gastrostomy', 'pmjay_gen_surgery', 27500, 27500, 25000, 25000),
  ('PMJAY-SG005A', 'G J Vagotomy', 'pmjay_gen_surgery', 35420, 35420, 32200, 32200),
  ('PMJAY-SG005B', 'Vagotomy + Pyloroplasty', 'pmjay_gen_surgery', 35420, 35420, 32200, 32200),
  ('PMJAY-SG006A', 'Operation for Bleeding Peptic Ulcer', 'pmjay_gen_surgery', 29920, 29920, 27200, 27200),
  ('PMJAY-SG007A', 'Gastric Perforation', 'pmjay_gen_surgery', 24860, 24860, 22600, 22600),
  ('PMJAY-SG007B', 'Duodenal Perforation', 'pmjay_gen_surgery', 24860, 24860, 22600, 22600),
  ('PMJAY-SG008A', 'Pyloroplasty', 'pmjay_gen_surgery', 22770, 22770, 20700, 20700),
  ('PMJAY-SG009A', 'Pyloromyotomy', 'pmjay_gen_surgery', 41250, 41250, 37500, 37500),
  ('PMJAY-SG056B', 'Operation for Hydrocele (B/L)', 'pmjay_gen_surgery', 16500, 16500, 15000, 15000),
  ('PMJAY-SG073B', 'Sympathectomy-Bilateral (B/L)', 'pmjay_gen_surgery', 38500, 38500, 35000, 35000),
  ('PMJAY-SG0109A', 'ERCP', 'pmjay_gen_surgery', 16500, 16500, 15000, 15000),
  ('PMJAY-SG0110A', 'Brachial sinus excision', 'pmjay_gen_surgery', 22000, 22000, 20000, 20000),
  ('PMJAY-SG0111A', 'Epididymal Excision under GA', 'pmjay_gen_surgery', 2200, 2200, 2000, 2000),
  ('PMJAY-SG0112A', 'Mesentric cyst excision', 'pmjay_gen_surgery', 22000, 22000, 20000, 20000),
  ('PMJAY-SG0113A', 'Mole Excision', 'pmjay_gen_surgery', 2200, 2200, 2000, 2000),
  ('PMJAY-SG0114A', 'Neurofibroma Excision under LA', 'pmjay_gen_surgery', 2200, 2200, 2000, 2000),
  ('PMJAY-SG0115A', 'Ingrowing Toe Nail', 'pmjay_gen_surgery', 2200, 2200, 2000, 2000),
  ('PMJAY-SG0116A', 'Splenorenal Anastomosis', 'pmjay_gen_surgery', 77000, 77000, 70000, 70000),
  ('PMJAY-SG0117A', 'Replacement Surgery For Corrosive Injury Stomach', 'pmjay_gen_surgery', 55000, 55000, 50000, 50000),
  ('PMJAY-SG0118A', 'Choledochoduodenostomy Or Choledocho Jejunostomy', 'pmjay_gen_surgery', 38500, 38500, 35000, 35000),
  ('PMJAY-SG0119A', 'Hepatico Jejunostomy for biliary stricture', 'pmjay_gen_surgery', 49500, 49500, 45000, 45000),
  ('PMJAY-SG011A', 'CystoJejunostomy - Open', 'pmjay_gen_surgery', 24750, 24750, 22500, 22500),
  ('PMJAY-SG011B', 'CystoJejunostomy - Lap', 'pmjay_gen_surgery', 24750, 24750, 22500, 22500),
  ('PMJAY-SG011C', 'Cystogastrostomy - Open', 'pmjay_gen_surgery', 28930, 28930, 26300, 26300),
  ('PMJAY-SG011D', 'Cystogastrostomy - Lap', 'pmjay_gen_surgery', 28930, 28930, 26300, 26300),
  ('PMJAY-SG0120A', 'I Stage- Sub Total Colectomy + Ileostomy + J - Pouch', 'pmjay_gen_surgery', 88000, 88000, 80000, 80000),
  ('PMJAY-SG0121A', 'Pancreatic Necrosectomy', 'pmjay_gen_surgery', 66000, 66000, 60000, 60000),
  ('PMJAY-SG0122A', 'Distal Pancreatectomy + Splenectomy', 'pmjay_gen_surgery', 66000, 66000, 60000, 60000),
  ('PMJAY-SG0123A', 'Heller Myotomy (Lap./Open)', 'pmjay_gen_surgery', 33000, 33000, 30000, 30000),
  ('PMJAY-SG0124A', 'I Stage-Sub Total Colectomy + Ileostomy', 'pmjay_gen_surgery', 44000, 44000, 40000, 40000),
  ('PMJAY-SG013A', 'Ileostomy', 'pmjay_gen_surgery', 18150, 18150, 16500, 16500),
  ('PMJAY-SG014A', 'Congenital Atresia & Stenosis of Small Intestine', 'pmjay_gen_surgery', 41250, 41250, 37500, 37500),
  ('PMJAY-SG015A', 'Operation for Duplication of Intestine', 'pmjay_ent', 27940, 27940, 25400, 25400),
  ('PMJAY-SG016A', 'Excision Duodenal Diverticulum', 'pmjay_gen_surgery', 27500, 27500, 25000, 25000),
  ('PMJAY-SG016B', 'Excision Meckel''s Diverticulum', 'pmjay_gen_surgery', 18590, 18590, 16900, 16900),
  ('PMJAY-SG017A', 'Appendicectomy- Open', 'pmjay_gen_surgery', 22000, 22000, 20000, 20000),
  ('PMJAY-SG017B', 'Lap- Appendicectomy', 'pmjay_gen_surgery', 22000, 22000, 20000, 20000),
  ('PMJAY-SG018A', 'Appendicular Perforation', 'pmjay_gen_surgery', 22000, 22000, 20000, 20000),
  ('PMJAY-SG019A', 'Operative drainage of Appendicular Abscess', 'pmjay_gen_surgery', 16500, 16500, 15000, 15000),
  ('PMJAY-SG022A', 'Operative Management of Volvulus of Large Bowel', 'pmjay_gen_surgery', 36190, 36190, 32900, 32900),
  ('PMJAY-SG025A', 'Sigmoid Resection', 'pmjay_gen_surgery', 25410, 25410, 23100, 23100),
  ('PMJAY-SG026A', 'Perineal Procedure for Rectal Prolapse', 'pmjay_gen_surgery', 20680, 20680, 18800, 18800),
  ('PMJAY-SG027A', 'Abdominal Procedure for Rectal Prolapse - Open', 'pmjay_gen_surgery', 22330, 22330, 20300, 20300),
  ('PMJAY-SG027B', 'Retinal Laser Photocoagulation -For retinal tear repair Per Eye Per Sitting', 'pmjay_gen_surgery', 22330, 22330, 20300, 20300),
  ('PMJAY-SG030A', 'Resection Anastomosis - Open', 'pmjay_gen_surgery', 29370, 29370, 26700, 26700),
  ('PMJAY-SG030B', 'Resection Anastomosis-Lap', 'pmjay_gen_surgery', 29370, 29370, 26700, 26700),
  ('PMJAY-SG031A', 'Procedure for Fissure in Ano', 'pmjay_gen_surgery', 11000, 11000, 10000, 10000),
  ('PMJAY-SG032A', 'Haemorroidectomy-without Stapler', 'pmjay_gen_surgery', 13200, 13200, 12000, 12000),
  ('PMJAY-SG032B', 'Haemorroidectomy-with Stapler', 'pmjay_gen_surgery', 30200, 30200, 12000, 12000),
  ('PMJAY-SG033A', 'Management of Pilonidal Sinus', 'pmjay_gen_surgery', 6187, 6187, 5625, 5625),
  ('PMJAY-SG034A', 'Exicision of Sinus and Curettage', 'pmjay_gen_surgery', 5500, 5500, 5000, 5000),
  ('PMJAY-SG035A', 'Exploratory Laparotomy', 'pmjay_gen_surgery', 12980, 12980, 11800, 11800),
  ('PMJAY-SG036A', 'Closure of Burst Abdomen', 'pmjay_obgyn', 16500, 16500, 15000, 15000),
  ('PMJAY-SG038A', 'Operation forAbdominal Hydatid Cyst (Single Organ) - Change in Name', 'pmjay_gen_surgery', 23100, 23100, 21000, 21000),
  ('PMJAY-SG039A', 'Without Exploration of CBD - Open', 'pmjay_gen_surgery', 34210, 34210, 31100, 31100),
  ('PMJAY-SG039B', 'With Exploration of CBD - Open', 'pmjay_gen_surgery', 34210, 34210, 31100, 31100),
  ('PMJAY-SG039C', 'Without Exploration of CBD - Lap', 'pmjay_gen_surgery', 34210, 34210, 31100, 31100),
  ('PMJAY-SG039D', 'With Exploration of CBD - Lap', 'pmjay_gen_surgery', 34210, 34210, 31100, 31100),
  ('PMJAY-SG040A', 'Operative Cholecystostomy-Open', 'pmjay_gen_surgery', 12430, 12430, 11300, 11300),
  ('PMJAY-SG040B', 'Operative Cholecystostomy-Lap', 'pmjay_gen_surgery', 12430, 12430, 11300, 11300),
  ('PMJAY-SG041A', 'Operation of Choledochal Cyst', 'pmjay_gen_surgery', 34870, 34870, 31700, 31700),
  ('PMJAY-SG042A', 'Splenectomy- Open', 'pmjay_gen_surgery', 38720, 38720, 35200, 35200),
  ('PMJAY-SG042B', 'Splenectomy-Lap', 'pmjay_gen_surgery', 38720, 38720, 35200, 35200),
  ('PMJAY-SG046A', 'Porto Caval Anastomosis', 'pmjay_gen_surgery', 55000, 55000, 50000, 50000),
  ('PMJAY-SG047A', 'Mesenteric Caval Anastomosis', 'pmjay_gen_surgery', 53460, 53460, 48600, 48600),
  ('PMJAY-SG048A', 'Mesenteric Cyst – Excision', 'pmjay_gen_surgery', 22770, 22770, 20700, 20700),
  ('PMJAY-SG050A', 'Groin Hernia Repair-Inguinal - Open', 'pmjay_gen_surgery', 22800, 22800, 20000, 20000),
  ('PMJAY-SG050B', 'Groin Hernia Repair Inguinal - Lap.', 'pmjay_gen_surgery', 23500, 23500, 20000, 20000),
  ('PMJAY-SG050C', 'Groin Hernia Repair-Femoral - Open', 'pmjay_gen_surgery', 24000, 24000, 20000, 20000),
  ('PMJAY-SG050D', 'Groin Hernia Repair-Femoral - Lap', 'pmjay_gen_surgery', 23830, 23830, 20300, 20300),
  ('PMJAY-SG050E', 'Groin Hernia Repair Obturator - Lap.', 'pmjay_gen_surgery', 40190, 40190, 22900, 22900),
  ('PMJAY-SG051A', 'Hernia - Ventral-Epigastric', 'pmjay_gen_surgery', 24000, 24000, 20000, 20000),
  ('PMJAY-SG051B', 'Hernia - Ventral-Umbilical', 'pmjay_gen_surgery', 29500, 29500, 25000, 25000),
  ('PMJAY-SG051C', 'Hernia - Ventral-Paraumbilical', 'pmjay_gen_surgery', 29500, 29500, 25000, 25000),
  ('PMJAY-SG051D', 'Hernia - Ventral-Spigelian', 'pmjay_gen_surgery', 29500, 29500, 25000, 25000),
  ('PMJAY-SG052A', 'Repair of Incisional Hernia Lap/Open', 'pmjay_gen_surgery', 32330, 32330, 20300, 20300),
  ('PMJAY-SG053A', 'Hiatus Hernia Repair - Open', 'pmjay_gen_surgery', 28930, 28930, 26300, 26300),
  ('PMJAY-SG053B', 'Hiatus Hernia Repair - Lap', 'pmjay_gen_surgery', 28930, 28930, 26300, 26300),
  ('PMJAY-SG053C', 'Fundoplication - Open(+/- Hiatus Hernia repair)', 'pmjay_gen_surgery', 28930, 28930, 26300, 26300),
  ('PMJAY-SG054A', 'Single Cyst', 'pmjay_gen_surgery', 2970, 2970, 2700, 2700),
  ('PMJAY-SG054B', 'Multiple Cysts', 'pmjay_gen_surgery', 5500, 5500, 5000, 5000),
  ('PMJAY-SG055A', 'Excision Filarial Scrotum', 'pmjay_gen_surgery', 8800, 8800, 8000, 8000),
  ('PMJAY-SG056A', 'Operation for Hydrocele (U/L)', 'pmjay_gen_surgery', 11000, 11000, 10000, 10000),
  ('PMJAY-SG057A', 'Epididymal Cyst excision', 'pmjay_gen_surgery', 5830, 5830, 5300, 5300),
  ('PMJAY-SG057B', 'Epididymal Nodule excision', 'pmjay_gen_surgery', 5830, 5830, 5300, 5300),
  ('PMJAY-SG058A', 'Vasovasostomy', 'pmjay_urology', 13200, 13200, 12000, 12000),
  ('PMJAY-SG060A', 'Inguinal Node (dissection) - U/L', 'pmjay_gen_surgery', 21780, 21780, 19800, 19800),
  ('PMJAY-SG065A', 'Microlaryngoscopic Surgery', 'pmjay_gen_surgery', 20350, 20350, 18500, 18500),
  ('PMJAY-SG068A', 'Surgical removal of Branchial Cyst/Sinus', 'pmjay_ent', 22000, 22000, 20000, 20000),
  ('PMJAY-SG072A', 'Thymectomy', 'pmjay_ctvs', 66000, 66000, 60000, 60000),
  ('PMJAY-SG073A', 'Sympathectomy-Unilateral (U/L)', 'pmjay_gen_surgery', 22770, 22770, 20700, 20700),
  ('PMJAY-SG076A', 'Excision Mammary Fistula', 'pmjay_gen_surgery', 13200, 13200, 12000, 12000),
  ('PMJAY-SG077A', 'Intercostal drainage Only', 'pmjay_ctvs', 6160, 6160, 5600, 5600),
  ('PMJAY-SG078A', 'Rib Resection & Drainage', 'pmjay_gen_surgery', 22000, 22000, 20000, 20000),
  ('PMJAY-SG079A', 'Thoracoplasty', 'pmjay_ctvs', 26840, 26840, 24400, 24400),
  ('PMJAY-SG080A', 'Decortication (Pleurectomy)', 'pmjay_gen_surgery', 36300, 36300, 33000, 33000),
  ('PMJAY-SG082A', 'Thoracoscopic Segmental Resection', 'pmjay_gen_surgery', 58890, 58890, 39900, 39900),
  ('PMJAY-SG083A', 'Lung Hydatid Cyst removal', 'pmjay_gen_surgery', 28930, 28930, 26300, 26300),
  ('PMJAY-SG084A', 'Incision & Drainage of Abscess', 'pmjay_gen_surgery', 5500, 5500, 5000, 5000),
  ('PMJAY-SG085A', 'Lipoma Excision', 'pmjay_gen_surgery', 5500, 5500, 5000, 5000),
  ('PMJAY-SG085B', 'Cyst Excision', 'pmjay_gen_surgery', 5500, 5500, 5000, 5000),
  ('PMJAY-SG085C', 'Other cutaneous swellings Excision', 'pmjay_gen_surgery', 5500, 5500, 5000, 5000),
  ('PMJAY-SG086A', 'Debridement of Ulcer', 'pmjay_gen_surgery', 5500, 5500, 5000, 5000),
  ('PMJAY-SG088A', 'Free Grafts - Wolfe Grafts', 'pmjay_gen_surgery', 34430, 34430, 31300, 31300),
  ('PMJAY-SG089A', 'Tissue Reconstruction Flap', 'pmjay_gen_surgery', 38720, 38720, 35200, 35200),
  ('PMJAY-SG090A', 'Split thickness skin grafts-Small (< 4% TBSA)', 'pmjay_gen_surgery', 20680, 20680, 18800, 18800),
  ('PMJAY-SG090B', 'Split thickness skin grafts-Medium (4 - 8% TBSA)', 'pmjay_gen_surgery', 19910, 19910, 18100, 18100),
  ('PMJAY-SG090C', 'Split thickness skin grafts-Large (> 8% TBSA)', 'pmjay_gen_surgery', 22440, 22440, 20400, 20400),
  ('PMJAY-SG093A', 'Lymphatics Excision of Subcutaneous Tissues In Lymphoedema', 'pmjay_gen_surgery', 16500, 16500, 15000, 15000),
  ('PMJAY-SG094A', 'AV Fistula without prosthesis', 'pmjay_gen_surgery', 20240, 20240, 18400, 18400),
  ('PMJAY-SG095A', 'Management of Varicose Veins-Operative management', 'pmjay_gen_surgery', 18150, 18150, 16500, 16500),
  ('PMJAY-SG095B', 'Minor sclerotherapy', 'pmjay_gen_surgery', 5500, 5500, 5000, 5000),
  ('PMJAY-SG096A', 'Biopsy-Lymph Node', 'pmjay_obgyn', 5500, 5500, 5000, 5000),
  ('PMJAY-SG096B', 'Endometrial Aspiration', 'pmjay_obgyn', 2970, 2970, 2700, 2700),
  ('PMJAY-SG096C', 'Cervix Cancer screening (PAP + Colposcopy)', 'pmjay_obgyn', 2750, 2750, 2500, 2500),
  ('PMJAY-SG096E', 'Biopsy-Vulval', 'pmjay_obgyn', 2750, 2750, 2500, 2500),
  ('PMJAY-SG097A', 'Stoma Management follow up of Ileostomy', 'pmjay_gen_surgery', 6050, 6050, 5500, 5500),
  ('PMJAY-SG097B', 'Stoma Management follow up of Colostomy', 'pmjay_gen_surgery', 6050, 6050, 5500, 5500),
  ('PMJAY-SG098A', 'Foreign Body Removal', 'pmjay_ent', 7700, 7700, 7000, 7000),
  ('PMJAY-SG099A', 'Necrotising fasciitis / Fournier Gangrene', 'pmjay_gen_surgery', 15510, 15510, 14100, 14100),
  ('PMJAY-SG100A', 'Surgical management of Lower GI bleed (inclusive of sigmoidoscopy / colonoscopy) - Colonoscopic management only excluding local perineal conditions', 'pmjay_gen_surgery', 27500, 27500, 25000, 25000),
  ('PMJAY-SG101A', 'Caecopexy', 'pmjay_gen_surgery', 27500, 27500, 25000, 25000),
  ('PMJAY-SG102A', 'Repair of Renal Artery Stenosis', 'pmjay_gen_surgery', 133600, 133600, 76000, 76000),
  ('PMJAY-SG103A', 'ERCP + Stenting/Stone removal', 'pmjay_gen_surgery', 67500, 67500, 25000, 25000),
  ('PMJAY-SG104A', 'Circumcision - Phimosis / Paraphimosis or any other clinical condition', 'pmjay_gen_surgery', 11000, 11000, 10000, 10000),
  ('PMJAY-SG105A', 'Percutaneous transhepatic external biliary drainage (PTBD)', 'pmjay_ent', 57720, 57720, 25200, 25200),
  ('PMJAY-SL026A', 'Tracheostomy', 'pmjay_ent', 30800, 30800, 28000, 28000),
  ('PMJAY-SL026B', 'Tracheotomy', 'pmjay_ent', 30800, 30800, 28000, 28000),
  ('PMJAY-SL028A', 'Deep neck abscess drainage', 'pmjay_ent', 18480, 18480, 16800, 16800),
  ('PMJAY-SL028B', 'Post trauma neck exploration', 'pmjay_ent', 23100, 23100, 21000, 21000),
  ('PMJAY-SL002A', 'Tympanoplasty (can be stratified  (GA/LA) and price adjusted accordingly )', 'pmjay_ent', 23940, 23940, 15400, 15400),
  ('PMJAY-SL003A', 'Stapedectomy', 'pmjay_ent', 19030, 19030, 17300, 17300),
  ('PMJAY-SL007A', 'Epistaxis treatment - packing (inc. of pack cost)', 'pmjay_ent', 2750, 2750, 2500, 2500),
  ('PMJAY-SL008A', 'Functional septo rhinoplasty', 'pmjay_ent', 24970, 24970, 22700, 22700),
  ('PMJAY-SL009A', 'Septoplasty', 'pmjay_ent', 15263, 15263, 13875, 13875),
  ('PMJAY-SL010A', 'Fracture - setting nasal bone', 'pmjay_ent', 9487, 9487, 8625, 8625),
  ('PMJAY-SL011A', 'Inferior turbinate reduction under GA(HOW IS IT DIFFERENT FROM TURBINATE REDUCTION AT THE END?)', 'pmjay_ent', 6600, 6600, 6000, 6000),
  ('PMJAY-SL012A', 'Open sinus surgery(Open Sinus Surgery (Single/Multiple Sinuses)', 'pmjay_ent', 17820, 17820, 16200, 16200),
  ('PMJAY-SL013A', 'Functional Endoscopic Sinus (FESS)stratified as U/L or B/L and cost adjusted', 'pmjay_ent', 16170, 16170, 14700, 14700),
  ('PMJAY-SL014A', 'Ant. Ethmoidal artery ligation - Open', 'pmjay_ent', 17820, 17820, 16200, 16200),
  ('PMJAY-SL014B', 'Ant. Ethmoidal artery ligation - Endoscopic', 'pmjay_ent', 17820, 17820, 16200, 16200),
  ('PMJAY-SL014C', 'Sphenopalatine artery ligation - Open', 'pmjay_ent', 17820, 17820, 16200, 16200),
  ('PMJAY-SL014D', 'Sphenopalatine artery ligation - Endoscopic', 'pmjay_ent', 17820, 17820, 16200, 16200),
  ('PMJAY-SL015A', 'Adenoidectomy', 'pmjay_ent', 10340, 10340, 9400, 9400),
  ('PMJAY-SL016A', 'Tonsillectomy - U/L tonsillectomy (unilateral/bilateral)', 'pmjay_ent', 13420, 13420, 12200, 12200),
  ('PMJAY-SL016B', 'Tonsillectomy - B/L adenotonsillectomy', 'pmjay_ent', 13420, 13420, 12200, 12200),
  ('PMJAY-SL017A', 'Peritonsillar abscess drainage', 'pmjay_ent', 6380, 6380, 5800, 5800),
  ('PMJAY-SL017B', 'Intraoral calculus removal', 'pmjay_ent', 6380, 6380, 5800, 5800),
  ('PMJAY-SL018A', 'Thyroglossal cyst excision', 'pmjay_ent', 18700, 18700, 17000, 17000),
  ('PMJAY-SL018B', 'Thyroglossal sinus excision', 'pmjay_ent', 18700, 18700, 17000, 17000),
  ('PMJAY-SL018C', 'Thyroglossal fistula excision', 'pmjay_ent', 18700, 18700, 17000, 17000),
  ('PMJAY-SL018D', 'Branchial sinus excision', 'pmjay_ent', 18700, 18700, 17000, 17000),
  ('PMJAY-SL018E', 'Branchial fistula excision', 'pmjay_ent', 18700, 18700, 17000, 17000),
  ('PMJAY-SL019A', 'Uvulopalatopharyngoplasty (UPPP)', 'pmjay_ent', 22110, 22110, 20100, 20100),
  ('PMJAY-SL022A', 'Removal of Submandibular Salivary gland', 'pmjay_ent', 31900, 31900, 29000, 29000),
  ('PMJAY-SL022B', 'Removal of Ranula', 'pmjay_ent', 31900, 31900, 29000, 29000),
  ('PMJAY-SL023A', 'Rigid laryngoscopy - Diagnostic + / -
biopsy', 'pmjay_ent', 7700, 7700, 7000, 7000),
  ('PMJAY-SL023B', 'Rigid bronchoscopy -  Diagnostic + /
- biopsy', 'pmjay_ent', 7700, 7700, 7000, 7000),
  ('PMJAY-SL023C', 'Rigid oesophagoscopy - Diagnostic
+ / - biopsy', 'pmjay_ent', 7700, 7700, 7000, 7000),
  ('PMJAY-SL024A', 'Microlaryngeal surgery with or without laser', 'pmjay_ent', 18700, 18700, 17000, 17000),
  ('PMJAY-SL034A', 'Open reduction and internal fixation of maxilla', 'pmjay_ent', 19400, 19400, 14000, 14000),
  ('PMJAY-SL034B', 'Open reduction and internal fixation of mandible', 'pmjay_ent', 19400, 19400, 14000, 14000),
  ('PMJAY-SL034C', 'Open reduction and internal fixation of zygoma', 'pmjay_ent', 19400, 19400, 14000, 14000),
  ('PMJAY-SL035A', 'Turbinate reduction', 'pmjay_ent', 1320, 1320, 1200, 1200),
  ('PMJAY-SL035B', 'Biopsy', 'pmjay_ent', 1320, 1320, 1200, 1200),
  ('PMJAY-SL035C', 'Intratympanic injections', 'pmjay_ent', 1320, 1320, 1200, 1200),
  ('PMJAY-SL035D', 'Wide bore aspiration', 'pmjay_ent', 1320, 1320, 1200, 1200),
  ('PMJAY-SL036A', 'Cochlear Implant Surgery* Surgery(53000) *pre -op evaluation(including  vaccine for meningitis)- 10000/- *Initial mapping and swithch on - 5000/-Rehabilitation Therapy (part- 1 for', 'pmjay_ent', 178750, 178750, 162500, 162500),
  ('PMJAY-SN035B', 'Trigeminal Nerve Neurectomy', 'pmjay_neurosurgery', 34210, 34210, 31100, 31100),
  ('PMJAY-SM001A', 'Extraction of impacted tooth under LA', 'pmjay_oral', 880, 880, 800, 800),
  ('PMJAY-SM002A', 'Osteomyelitis -Acute', 'pmjay_oral', 2200, 2200, 2000, 2000),
  ('PMJAY-SM002B', 'Osteomyelitis-Chronic', 'pmjay_oral', 4180, 4180, 3800, 3800),
  ('PMJAY-SM003A', '1.TM joint ankylosis of both jaws - under GA 
(Unilateral)', 'pmjay_oral', 16500, 16500, 15000, 15000),
  ('PMJAY-SM003B', '2.TM joint ankylosis of both jaws - under GA (Bilateral)-
(Covering Reconstruction)', 'pmjay_oral', 34430, 34430, 31300, 31300),
  ('PMJAY-SM004A', 'Closed reduction (1 jaw) using wires -  under LA/GA', 'pmjay_oral', 5500, 5500, 5000, 5000),
  ('PMJAY-SM004B', 'Open reduction (1 jaw) and fixing of plates / wire – under LA/GA 
Cost of implant Titanium:- TBF at pre-auth', 'pmjay_oral', 21200, 21200, 12000, 12000),
  ('PMJAY-SM005A', 'Enucleation / excision  of cyst / tumour of jaws under LA +cost of implant', 'pmjay_oral', 2970, 2970, 2700, 2700),
  ('PMJAY-SM005B', 'Enucleation / excision  of cyst / tumour of jaws under GA', 'pmjay_oral', 6050, 6050, 5500, 5500),
  ('PMJAY-SM006A', 'Maxilla / Mandible neoplastic Tumour Resection and reconstruction  (Cancer surgery)', 'pmjay_oral', 14850, 14850, 13500, 13500),
  ('PMJAY-SM007A', '1.Release of fibrous bands & grafting - in (OSMF) treatment under LA: 5000', 'pmjay_oral', 3630, 3630, 3300, 3300),
  ('PMJAY-SM007B', '2. Release of fibrous release bands & coronoidectomy with grafting - in (OSMF) treatment under GA', 'pmjay_oral', 20680, 20680, 18800, 18800),
  ('PMJAY-SM008A', 'Apicoectomy (A) 
(1-3 teeth) LA/GA
3-6:4000', 'pmjay_oral', 1650, 1650, 1500, 1500),
  ('PMJAY-SM009A', 'Correction of oro-antral Fistula', 'pmjay_oral', 7700, 7700, 7000, 7000),
  ('PMJAY-SM010A', 'Intraoral submandibular sialolithotomy LA/ GA', 'pmjay_oral', 7700, 7700, 7000, 7000),
  ('PMJAY-SM010C', 'Submandibular sialolithotomy', 'pmjay_oral', 9900, 9900, 9000, 9000),
  ('PMJAY-SM011A', 'Dentoalveolar trauma - wiring (dental /trauma wiring- one jaw)', 'pmjay_oral', 3300, 3300, 3000, 3000),
  ('PMJAY-SM012A', 'Extraoral parotid sialolithotomy under GA', 'pmjay_oral', 13200, 13200, 12000, 12000),
  ('PMJAY-SM012B', 'Intraoral parotid sialolithotomy', 'pmjay_oral', 7700, 7700, 7000, 7000),
  ('PMJAY-SM013A', 'Re-implantation of Avulsed tooth with wiring (1-3 teeth)
3-6 :6000', 'pmjay_oral', 19870, 19870, 1700, 1700),
  ('PMJAY-SM014A', 'Osteoradionecrosis of jaws management by excision under LA', 'pmjay_oral', 5500, 5500, 5000, 5000),
  ('PMJAY-SM014B', '2.Osteoradionecrosis of Jaws management by excision  and / or reconstruction under GA inlcuidng  Implant', 'pmjay_oral', 16500, 16500, 15000, 15000),
  ('PMJAY-SS001A', 'Cleft Lip and Palate Surgery (per stage)', 'pmjay_pediatric', 23430, 23430, 21300, 21300),
  ('PMJAY-SN001A', 'Surgery for Depressed Skull  fracture', 'pmjay_neurosurgery', 55000, 55000, 50000, 50000),
  ('PMJAY-SN002A', 'Cranioplasty with autologus bone graft', 'pmjay_neurosurgery', 37840, 37840, 34400, 34400),
  ('PMJAY-SN002B', 'Cranioplasty with exogenous Graft', 'pmjay_neurosurgery', 57840, 57840, 34400, 34400),
  ('PMJAY-SN003A', 'Twist Drill Craniostomy', 'pmjay_neurosurgery', 20680, 20680, 18800, 18800),
  ('PMJAY-SN004A', 'Cranial vault remodeling/ surgery for "Craniosynostosis"', 'pmjay_neurosurgery', 76920, 76920, 47200, 47200),
  ('PMJAY-SN005A', 'Anterior cranial fossa encephalocele/meningocele repair', 'pmjay_neurosurgery', 68640, 68640, 62400, 62400),
  ('PMJAY-SN005B', 'Surgery for spina bifida cystica/occulta', 'pmjay_neurosurgery', 51590, 51590, 46900, 46900),
  ('PMJAY-SN005C', 'Posterior cranial fossa encephalocele/meningocele repair', 'pmjay_neurosurgery', 70950, 70950, 64500, 64500),
  ('PMJAY-SN006A', 'Surgery for supratentorial Extra-axial Tumours (Meningioma etc)', 'pmjay_neurosurgery', 70950, 70950, 64500, 64500),
  ('PMJAY-SN006B', 'Surgery for infratentorial ExtraaxialTumour(meningioma etc)', 'pmjay_neurosurgery', 70950, 70950, 64500, 64500),
  ('PMJAY-SN007A', 'Duroplasty with Endogenous graft- (May be perfomed as a add-on procedure)', 'pmjay_neurosurgery', 17270, 17270, 15700, 15700),
  ('PMJAY-SN007B', 'Duroplasty with Exogenous graft-  (May be perfomed as an add-on procedure) Cost of graft will be extra', 'pmjay_neurosurgery', 37270, 37270, 15700, 15700),
  ('PMJAY-SN008A', 'Burr hole surgery for evacuation of hematoma/ biopsy/ pus drainage/Placement of ICP monitoring device', 'pmjay_neurosurgery', 35180, 35180, 13800, 13800),
  ('PMJAY-SN008B', 'Burr hole surgery with chronic Sub Dural Haematoma', 'pmjay_neurosurgery', 34430, 34430, 31300, 31300),
  ('PMJAY-SN009A', 'Evacuation of Post-trauamtic  Intraparenchymal Hematoma', 'pmjay_neurosurgery', 77440, 77440, 70400, 70400),
  ('PMJAY-SN009B', 'Spontaneous Intraparenchymal hematoma evacuation', 'pmjay_neurosurgery', 70950, 70950, 64500, 64500),
  ('PMJAY-SN009C', 'Evacuation of Post-trauamtic  Intraparenchymal Hematoma in Pediatric Age group', 'pmjay_neurosurgery', 70950, 70950, 64500, 64500),
  ('PMJAY-SN010A', 'Excision of Brain abscess', 'pmjay_neurosurgery', 68640, 68640, 62400, 62400),
  ('PMJAY-SN011A', 'Craniotomy/Burr hole and Tapping of Brain Abscess', 'pmjay_neurosurgery', 27500, 27500, 25000, 25000),
  ('PMJAY-SN012A', 'Epilepsy Surgery', 'pmjay_neurosurgery', 94600, 94600, 86000, 86000),
  ('PMJAY-SN013A', 'Brain Biopsy- Open/Stereotactic guided', 'pmjay_neurosurgery', 23210, 23210, 21100, 21100),
  ('PMJAY-SN014A', 'Excision of Orbital Tumour', 'pmjay_neurosurgery', 68750, 68750, 62500, 62500),
  ('PMJAY-SN015A', 'Parasagital Tumours', 'pmjay_neurosurgery', 70950, 70950, 64500, 64500),
  ('PMJAY-SN015B', 'Skull Base Tumours', 'pmjay_neurosurgery', 70950, 70950, 64500, 64500),
  ('PMJAY-SN015C', 'Surgerey for infratentorial intra-axial tumours', 'pmjay_neurosurgery', 70950, 70950, 64500, 64500),
  ('PMJAY-SN015D', 'Cerebello-pontine angle Angle', 'pmjay_neurosurgery', 70950, 70950, 64500, 64500),
  ('PMJAY-SN015E', 'Supratentorial & other Tumours', 'pmjay_neurosurgery', 77440, 77440, 70400, 70400),
  ('PMJAY-SN016A', 'Stereotactic Lesioning for movement disoders', 'pmjay_neurosurgery', 103180, 103180, 93800, 93800),
  ('PMJAY-SN017A', 'Endoscpic/Microscopic Trans Sphenoidal Surgery', 'pmjay_neurosurgery', 70950, 70950, 64500, 64500),
  ('PMJAY-SN018A', 'Trans oral Surgery', 'pmjay_neurosurgery', 74800, 74800, 68000, 68000),
  ('PMJAY-SN019A', 'Trans oral anterior decompression and Posterior stabilisation or C V junction', 'pmjay_neurosurgery', 132300, 132300, 93000, 93000),
  ('PMJAY-SN020A', 'External Ventricular Drainage (EVD)', 'pmjay_neurosurgery', 46420, 46420, 42200, 42200),
  ('PMJAY-SN021A', 'Ventricular Tap', 'pmjay_neurosurgery', 20680, 20680, 18800, 18800),
  ('PMJAY-SN022A', 'Ventriculo-Peritoneal Shunt (Low/Medium/High Pressure or Flow regulated valve)', 'pmjay_neurosurgery', 46420, 46420, 42200, 42200),
  ('PMJAY-SN022B', 'Ventriculo - pleural Shunt (Low/Medium/High Pressure or Flow regulated valve)', 'pmjay_neurosurgery', 46420, 46420, 42200, 42200),
  ('PMJAY-SN022C', 'Ventriculo - atrial Shunt (Low/Medium/High Pressure or Flow regulated valve)', 'pmjay_neurosurgery', 46420, 46420, 42200, 42200),
  ('PMJAY-SN022D', 'Theco - peritoneal Shunt (Low/Medium/High Pressure or Flow regulated valve)', 'pmjay_neurosurgery', 46420, 46420, 42200, 42200),
  ('PMJAY-SN023A', 'Aneurysm Clipping including DSA or CTA', 'pmjay_neurosurgery', 109600, 109600, 86000, 86000),
  ('PMJAY-SN024A', 'Superficial Temporal Artery (STA): middle cerebral artery (MCA) or (other EC - IC) Bypass procedure', 'pmjay_neurosurgery', 92840, 92840, 84400, 84400),
  ('PMJAY-SN025A', 'Craniotmy and excision of arteriovenous malformation', 'pmjay_neurosurgery', 94600, 94600, 86000, 86000),
  ('PMJAY-SN025B', 'Laminectomy/Laminotomy and excision of Intraspinal arteriovenous malformation', 'pmjay_neurosurgery', 94600, 94600, 86000, 86000),
  ('PMJAY-SN025C', 'Excision of scalp arteriovenous malformation', 'pmjay_neurosurgery', 47300, 47300, 43000, 43000),
  ('PMJAY-SN026A', 'Foramen magnum decompression for Chiari malormation with or without duraplasty or tonsillar resection.', 'pmjay_neurosurgery', 103180, 103180, 93800, 93800),
  ('PMJAY-SN027A', 'Skull Traction', 'pmjay_neurosurgery', 13750, 13750, 12500, 12500),
  ('PMJAY-SN028A', 'Posterior cervical laminoforaminotomy and discectomy', 'pmjay_neurosurgery', 46420, 46420, 42200, 42200),
  ('PMJAY-SN029A', 'Posterior cervical fusion using lateral mass or pedicle screws and rods', 'pmjay_neurosurgery', 102270, 102270, 65700, 65700),
  ('PMJAY-SN030A', 'Anterior cervical discectomy without fusion', 'pmjay_neurosurgery', 68750, 68750, 62500, 62500),
  ('PMJAY-SN031A', 'Excision of Cervical Ribs', 'pmjay_neurosurgery', 31625, 31625, 28750, 28750),
  ('PMJAY-SN033A', 'Microscopic/Endoscopic Lumbar Discectomy (One level)', 'pmjay_neurosurgery', 46420, 46420, 42200, 42200),
  ('PMJAY-SN035A', 'Peripheral Neurectomy', 'pmjay_neurosurgery', 27500, 27500, 25000, 25000),
  ('PMJAY-SN036A', 'Anterior Cervical Discectomy with fusion (Cost of implants to be extra)', 'pmjay_neurosurgery', 98750, 98750, 62500, 62500),
  ('PMJAY-SN039A', 'Intraspinal Extradural hematoma evacuation', 'pmjay_neurosurgery', 46420, 46420, 42200, 42200),
  ('PMJAY-SN041A', 'Excision of extradural spinal tumor', 'pmjay_neurosurgery', 59400, 59400, 54000, 54000),
  ('PMJAY-SN041B', 'Excision of extradural spinal tumor with fusion and fixation (Cost of implants to be extra)', 'pmjay_neurosurgery', 89400, 89400, 54000, 54000),
  ('PMJAY-SN042A', 'Excision of Intradural extramedullary tumor', 'pmjay_neurosurgery', 68750, 68750, 62500, 62500),
  ('PMJAY-SN042B', 'Excision of Intradural extramedullary tumor with fusion and ficxation (Cost of implants to be extra)', 'pmjay_neurosurgery', 104800, 104800, 68000, 68000),
  ('PMJAY-SN043A', 'Excision of Intramedullary tumor of spine', 'pmjay_neurosurgery', 70950, 70950, 64500, 64500),
  ('PMJAY-SN043B', 'Excision of Intramedullary tumor with fusion and ficxation (Cost of implants to be extra)', 'pmjay_neurosurgery', 100950, 100950, 64500, 64500),
  ('PMJAY-SN044A', 'R. F. Lesioning for Trigeminal Neuralgia', 'pmjay_neurosurgery', 27500, 27500, 25000, 25000),
  ('PMJAY-SN045A', 'Brachial Plexus repair', 'pmjay_neurosurgery', 50380, 50380, 45800, 45800),
  ('PMJAY-SN047A', 'Peripheral nerve repair/Neurolysis', 'pmjay_neurosurgery', 23540, 23540, 21400, 21400),
  ('PMJAY-SN048A', 'Cranial nerve re-anastomosis/Repair (Facial/)', 'pmjay_neurosurgery', 34430, 34430, 31300, 31300),
  ('PMJAY-SN049B', 'Peripheral nerve tumor excision and repair', 'pmjay_neurosurgery', 46420, 46420, 42200, 42200),
  ('PMJAY-SN050A', 'Nerve Biopsy excluding Hansen''s', 'pmjay_neurosurgery', 10340, 10340, 9400, 9400),
  ('PMJAY-SN051A', 'Muscle Biopsy', 'pmjay_neurosurgery', 10340, 10340, 9400, 9400),
  ('PMJAY-SN054A', 'Gamma Knife Radiosurgery for tumors/AVMs/ Trigeminal Neuralgia', 'pmjay_rad_oncology', 103180, 103180, 93800, 93800),
  ('PMJAY-SN057A', 'Endoscopic Third ventriculostomy', 'pmjay_neurosurgery', 50380, 50380, 45800, 45800),
  ('PMJAY-SN059A', 'Radiofrequency lesioning for sacroilitis', 'pmjay_neurosurgery', 11220, 11220, 10200, 10200),
  ('PMJAY-SN059B', 'Radiofrequency lesioning for chronic back pain', 'pmjay_neurosurgery', 11220, 11220, 10200, 10200),
  ('PMJAY-SN060A', 'Discectomy - Dorsal', 'pmjay_neurosurgery', 46420, 46420, 42200, 42200),
  ('PMJAY-SN062A', 'Reexploration for Cranial / Spinal surgeries', 'pmjay_neurosurgery', 34430, 34430, 31300, 31300),
  ('PMJAY-SN064A', 'AVM EMBOLISATION/THROMBECTOMY', 'pmjay_neurosurgery', 240680, 240680, 218800, 218800),
  ('PMJAY-SN065A', 'Ventricular tapping with Omayya reservoir/external ventricular drain', 'pmjay_neurosurgery', 27500, 27500, 25000, 25000),
  ('PMJAY-SN066A', 'Craniectomy/ DECRA for head injury/acute stroke/cerebral venous thrombosis', 'pmjay_neurosurgery', 103180, 103180, 93800, 93800),
  ('PMJAY-SO006A', 'Abdominal Myomectomy', 'pmjay_obgyn', 27500, 27500, 25000, 25000),
  ('PMJAY-SO007A', 'Hysteroscopic Myomectomy', 'pmjay_obgyn', 13200, 13200, 12000, 12000),
  ('PMJAY-SO009A', 'Hysteroscopic polypectomy', 'pmjay_obgyn', 11550, 11550, 10500, 10500),
  ('PMJAY-SO010A', 'Abdominal Hysterectomy', 'pmjay_obgyn', 22000, 22000, 20000, 20000),
  ('PMJAY-SO010B', 'Abdominal Hysterectomy + Salpingo-oophorectomy', 'pmjay_obgyn', 22000, 22000, 20000, 20000),
  ('PMJAY-SO010C', 'Non descent vaginal hysterectomy', 'pmjay_obgyn', 22000, 22000, 20000, 20000),
  ('PMJAY-SO010D', 'Vaginal hysterectomy with anterior and posterior colpoperineorrhaphy', 'pmjay_obgyn', 22000, 22000, 20000, 20000),
  ('PMJAY-SO010E', 'Laparoscopic hysterectomy (TLH)', 'pmjay_obgyn', 22000, 22000, 20000, 20000),
  ('PMJAY-SO010F', 'Laparoscopically assisted vaginal hysterectomy (LAVH)', 'pmjay_obgyn', 22000, 22000, 20000, 20000),
  ('PMJAY-SO011A', 'Caesarean hysterectomy', 'pmjay_obgyn', 22000, 22000, 20000, 20000),
  ('PMJAY-SO012A', 'Manchester Repair', 'pmjay_obgyn', 22000, 22000, 20000, 20000),
  ('PMJAY-SO013A', 'Surgeries for Prolapse - Sling Surgeries', 'pmjay_obgyn', 39430, 39430, 31300, 31300),
  ('PMJAY-SO014A', 'Hysterotomy', 'pmjay_obgyn', 7040, 7040, 6400, 6400),
  ('PMJAY-SO015A', 'Lap. Surgery for Endometriosis 
(Other than Hysterectomy)', 'pmjay_obgyn', 19140, 19140, 17400, 17400),
  ('PMJAY-SO016A', 'With biopsy', 'pmjay_obgyn', 8800, 8800, 8000, 8000),
  ('PMJAY-SO016B', 'Without biopsy', 'pmjay_obgyn', 8800, 8800, 8000, 8000),
  ('PMJAY-SO017A', 'Hysteroscopic IUCD removal', 'pmjay_obgyn', 5500, 5500, 5000, 5000),
  ('PMJAY-SO018A', 'D&C (Dilatation&curretage)', 'pmjay_obgyn', 5500, 5500, 5000, 5000),
  ('PMJAY-SO019A', 'Dilation and Evacuation (D&E)', 'pmjay_obgyn', 5500, 5500, 5000, 5000),
  ('PMJAY-SO020A', 'Pyometra drainage', 'pmjay_obgyn', 5500, 5500, 5000, 5000),
  ('PMJAY-SO021A', 'Intrauterine transfusions', 'pmjay_obgyn', 11000, 11000, 10000, 10000),
  ('PMJAY-SO022A', 'Hysteroscopic adhesiolysis', 'pmjay_obgyn', 8800, 8800, 8000, 8000),
  ('PMJAY-SO023A', 'Laparoscopic adhesiolysis', 'pmjay_obgyn', 10780, 10780, 9800, 9800),
  ('PMJAY-SO024A', 'Trans-vaginal tape  (tape cost additional=30-35000)', 'pmjay_obgyn', 43800, 43800, 8000, 8000),
  ('PMJAY-SO024B', 'Trans-obturator tape (tape cost additional=30-35000)', 'pmjay_obgyn', 43800, 43800, 8000, 8000),
  ('PMJAY-SO025A', 'Open- Sacrocolpopexy (Abdominal)', 'pmjay_obgyn', 24000, 24000, 20000, 20000),
  ('PMJAY-SO025B', 'Sacrocolpopexy (Abdominal)- Lap.', 'pmjay_obgyn', 24000, 24000, 20000, 20000),
  ('PMJAY-SO026A', 'LLETZ (including PAP smear and colposcopy)', 'pmjay_obgyn', 7700, 7700, 7000, 7000),
  ('PMJAY-SO027A', 'Vaginal Sacrospinus fixation with repair', 'pmjay_obgyn', 18590, 18590, 16900, 16900),
  ('PMJAY-SO028A', 'Excision of Vaginal Septum (vaginal route)', 'pmjay_obgyn', 27170, 27170, 24700, 24700),
  ('PMJAY-SO029A', 'Hymenectomy for imperforate hymen', 'pmjay_obgyn', 3740, 3740, 3400, 3400),
  ('PMJAY-SO030A', 'Anterior & Posterior Colpoperineorrhapy', 'pmjay_obgyn', 12430, 12430, 11300, 11300),
  ('PMJAY-SO031A', 'Vaginoplasty (McIndoe procedure)', 'pmjay_obgyn', 22000, 22000, 20000, 20000),
  ('PMJAY-SO032A', 'Vaginal repair for vesico-vaginal fistula (Open)', 'pmjay_obgyn', 44000, 44000, 40000, 40000),
  ('PMJAY-SO033A', 'Rectovaginal fistula repair', 'pmjay_obgyn', 27500, 27500, 25000, 25000),
  ('PMJAY-SO034A', 'Vulval Hematoma drainage', 'pmjay_obgyn', 3740, 3740, 3400, 3400),
  ('PMJAY-SO035A', 'Vulvectomy simple', 'pmjay_obgyn', 22000, 22000, 20000, 20000),
  ('PMJAY-SO036A', 'Radical Vulvectomy with Inguinal and Pelvic lymph node disection', 'pmjay_obgyn', 55000, 55000, 50000, 50000),
  ('PMJAY-SO037A', 'Abdomino Perineal repair for Mullerian Anomaly', 'pmjay_obgyn', 38170, 38170, 34700, 34700),
  ('PMJAY-SO038A', 'Colpotomy', 'pmjay_obgyn', 5390, 5390, 4900, 4900),
  ('PMJAY-SO039A', 'Diagnostic  laparoscopy', 'pmjay_obgyn', 13200, 13200, 12000, 12000),
  ('PMJAY-SO040A', 'Open- Laparotomy for ectopic/ benign disorders', 'pmjay_obgyn', 22000, 22000, 20000, 20000),
  ('PMJAY-SO040B', 'PID', 'pmjay_obgyn', 22000, 22000, 20000, 20000),
  ('PMJAY-SO041A', 'Lap', 'pmjay_obgyn', 22000, 22000, 20000, 20000),
  ('PMJAY-SO042A', 'Cystocele - Anterior repair', 'pmjay_obgyn', 8800, 8800, 8000, 8000),
  ('PMJAY-SO043A', 'Abdominal', 'pmjay_obgyn', 27500, 27500, 25000, 25000),
  ('PMJAY-SO043B', 'Laparoscopic -Burch', 'pmjay_obgyn', 27500, 27500, 25000, 25000),
  ('PMJAY-SO044A', 'Electro Cauterisation / Cryo Surgery', 'pmjay_obgyn', 6270, 6270, 5700, 5700),
  ('PMJAY-SO045A', 'EUA for (minor girls / unmarried sexually inactive / victims of sexual abuse)', 'pmjay_obgyn', 2970, 2970, 2700, 2700),
  ('PMJAY-SO046A', 'Hospitalisation for Antenatal Complications', 'pmjay_obgyn', 2310, 2310, 2100, 2100),
  ('PMJAY-SO047A', 'Amniocentesis', 'pmjay_obgyn', 5500, 5500, 5000, 5000),
  ('PMJAY-SO048A', 'Chorionic villus sampling', 'pmjay_obgyn', 5500, 5500, 5000, 5000),
  ('PMJAY-SO049A', 'Cordocentesis', 'pmjay_obgyn', 11000, 11000, 10000, 10000),
  ('PMJAY-SO050A', 'McDonald''s stitch', 'pmjay_obgyn', 8800, 8800, 8000, 8000),
  ('PMJAY-SO051A', 'Shirodkar''s stitch', 'pmjay_obgyn', 4950, 4950, 4500, 4500),
  ('PMJAY-SO052A', 'Medical management of ectopic pregnancy', 'pmjay_obgyn', 2310, 2310, 2100, 2100),
  ('PMJAY-SO053A', 'MTP upto 8 weeks', 'pmjay_obgyn', 5500, 5500, 5000, 5000),
  ('PMJAY-SO053B', 'MTP 8 to 12 weeks', 'pmjay_obgyn', 7700, 7700, 7000, 7000),
  ('PMJAY-SO053C', 'MTP > 12 weeks', 'pmjay_obgyn', 7700, 7700, 7000, 7000),
  ('PMJAY-SO054B', 'Mothers with eclampsia / imminent eclampsia / severe pre-eclampsia', 'pmjay_obgyn', 16500, 16500, 15000, 15000),
  ('PMJAY-SO054C', 'Major Fetal malformation requiring intervention immediately after birth', 'pmjay_obgyn', 16500, 16500, 15000, 15000),
  ('PMJAY-SO054D', 'Mothers with severe anaemia (<7 g/dL)', 'pmjay_obgyn', 11000, 11000, 10000, 10000),
  ('PMJAY-SO054E', 'Other maternal and fetal conditions as per guidelines-eg previous caesarean section, diabetes, severe growth retardation, etc that qualify for high risk delivery.', 'pmjay_obgyn', 11000, 11000, 10000, 10000),
  ('PMJAY-SO055A', 'Manual removal of placenta', 'pmjay_obgyn', 9350, 9350, 8500, 8500),
  ('PMJAY-SO056A', 'Secondary suturing of episiotomy', 'pmjay_obgyn', 3300, 3300, 3000, 3000),
  ('PMJAY-SO057A', 'Caesarean Delivery', 'pmjay_obgyn', 15400, 15400, 14000, 14000),
  ('PMJAY-SO059A', 'Vulvo vaginal/ bartholin cyst/ abscess enucleation', 'pmjay_obgyn', 7700, 7700, 7000, 7000),
  ('PMJAY-SO059B', 'Vulvo vaginal/ bartholin cyst/ abscess drainage', 'pmjay_obgyn', 7700, 7700, 7000, 7000),
  ('PMJAY-SO060A', 'Hysterrectomy + salpingo opherectomy + omentectomy + BPLND- Open', 'pmjay_obgyn', 55000, 55000, 50000, 50000),
  ('PMJAY-SO061A', 'Vaginal Myomectomy', 'pmjay_obgyn', 16500, 16500, 15000, 15000),
  ('PMJAY-SO062A', 'Cystectomy - Open', 'pmjay_obgyn', 22000, 22000, 20000, 20000),
  ('PMJAY-SO063A', 'lap', 'pmjay_obgyn', 22000, 22000, 20000, 20000),
  ('PMJAY-SO064A', 'Sterilisation- Open', 'pmjay_obgyn', 7700, 7700, 7000, 7000),
  ('PMJAY-SO064B', 'Sterilisation- Lap', 'pmjay_obgyn', 11000, 11000, 10000, 10000),
  ('PMJAY-SO065A', 'Reversal of Sterilisation/ Tuboplasty (lap/ open)', 'pmjay_obgyn', 27500, 27500, 25000, 25000),
  ('PMJAY-SO066A', 'Diagnostic Hystero - Laparoscopy with/ without Chromopertubation', 'pmjay_obgyn', 16500, 16500, 15000, 15000),
  ('PMJAY-SO067A', 'Laparotomy for Broad Ligament Hematoma (including internal iliac ligation)', 'pmjay_obgyn', 38500, 38500, 35000, 35000),
  ('PMJAY-SO068A', 'Complete Perineal Tear', 'pmjay_obgyn', 27500, 27500, 25000, 25000),
  ('PMJAY-SO070A', 'Resuturing of wounds', 'pmjay_obgyn', 5500, 5500, 5000, 5000),
  ('PMJAY-SO071A', 'Post coital / Injury Repair', 'pmjay_obgyn', 7700, 7700, 7000, 7000),
  ('PMJAY-SO072A', 'Cone biopsy', 'pmjay_obgyn', 7700, 7700, 7000, 7000),
  ('PMJAY-SO073A', 'Biopsy- Cervical, Endometrial EA/ ECC; Vulvar; Polypectomy', 'pmjay_obgyn', 5500, 5500, 5000, 5000),
  ('PMJAY-SO075A', 'Operative vaginal delivery (Vacuum/ forceps)', 'pmjay_obgyn', 11000, 11000, 10000, 10000),
  ('PMJAY-SO076A', 'Surgical management of PPH after vaginal delivery', 'pmjay_obgyn', 16500, 16500, 15000, 15000),
  ('PMJAY-SC030A', 'Salpingoophorectomy- Open', 'pmjay_obgyn', 27500, 27500, 25000, 25000),
  ('PMJAY-SC030B', 'Salpingoophorectomy -Lap.', 'pmjay_obgyn', 27500, 27500, 25000, 25000),
  ('PMJAY-SU029A', 'Uretero - vaginal fistula repair - Open', 'pmjay_obgyn', 36190, 36190, 32900, 32900),
  ('PMJAY-SU029B', 'Uretero - Uterine fistula repair - Open', 'pmjay_obgyn', 36190, 36190, 32900, 32900),
  ('PMJAY-SU029C', 'Uretero - vaginal fistula repair - Laparoscopic', 'pmjay_obgyn', 36190, 36190, 32900, 32900),
  ('PMJAY-SU029D', 'Uretero - Uterine fistula repair - Laparoscopic', 'pmjay_obgyn', 36190, 36190, 32900, 32900),
  ('PMJAY-SP001A', 'Pressure Sore – Surgery', 'pmjay_plastic', 46420, 46420, 42200, 42200),
  ('PMJAY-SP002A', 'Diabetic Foot – Conservative management', 'pmjay_plastic', 28930, 28930, 26300, 26300),
  ('PMJAY-SP003A', 'Revascularization of limb / digit (single didgit)', 'pmjay_plastic', 43890, 43890, 39900, 39900),
  ('PMJAY-SP03B', 'Revascularization of limb / digit(morethan one digit)', 'pmjay_plastic', 213750, 213750, 112500, 112500),
  ('PMJAY-SP004A', 'Ear Pinna Reconstruction with costal cartilage / Prosthesis 
(including the cost of prosthesis / implants)', 'pmjay_plastic', 134230, 134230, 49300, 49300),
  ('PMJAY-SP004B', 'Ear Pinna Reconstruction with costal cartilage / Prosthesis 
(including the cost of prosthesis / implants)', 'pmjay_plastic', 110000, 110000, 100000, 100000),
  ('PMJAY-SP005A', 'Scalp avulsion reconstruction', 'pmjay_plastic', 82500, 82500, 75000, 75000),
  ('PMJAY-SP006A', 'Tissue Expander for disfigurement following burns', 'pmjay_plastic', 68750, 68750, 62500, 62500),
  ('PMJAY-SP006B', 'Tissue Expander for disfigurement following trauma', 'pmjay_plastic', 68750, 68750, 62500, 62500),
  ('PMJAY-SP006C', 'Tissue Expander for disfigurement following congenital deformity', 'pmjay_plastic', 68750, 68750, 62500, 62500),
  ('PMJAY-SP007A', 'Sclerotherapy under GA', 'pmjay_plastic', 34430, 34430, 31300, 31300),
  ('PMJAY-SP007B', 'Debulking', 'pmjay_plastic', 55000, 55000, 50000, 50000),
  ('PMJAY-SP007C', 'Excision', 'pmjay_plastic', 55440, 55440, 50400, 50400),
  ('PMJAY-SP008A', 'NPWT', 'pmjay_plastic', 5170, 5170, 4700, 4700),
  ('PMJAY-SP009A', 'Resuturing of Any Wound gap
Surgeries', 'pmjay_surg_oncology', 4180, 4180, 3800, 3800),
  ('PMJAY-SP009B', 'Resuturing of Any Wound gap
Surgeries', 'pmjay_plastic', 61930, 61930, 56300, 56300),
  ('PMJAY-SS002A', 'Ankyloglossia Minor', 'pmjay_ent', 9900, 9900, 9000, 9000),
  ('PMJAY-SS002B', 'Ankyloglossia Major', 'pmjay_pediatric', 20680, 20680, 18800, 18800),
  ('PMJAY-SS003A', 'Anti GERD Surgery', 'pmjay_pediatric', 29480, 29480, 26800, 26800),
  ('PMJAY-SS004A', 'Gastrostomy + Esophagoscopy + Threading', 'pmjay_pediatric', 30470, 30470, 27700, 27700),
  ('PMJAY-SS005A', 'Ladds Procedure', 'pmjay_pediatric', 53680, 53680, 48800, 48800),
  ('PMJAY-SS006A', 'Duplication Cyst Excision', 'pmjay_pediatric', 33880, 33880, 30800, 30800),
  ('PMJAY-SS007A', 'Non – Operative Reduction in infants', 'pmjay_pediatric', 31680, 31680, 28800, 28800),
  ('PMJAY-SS007B', 'Operative in infants', 'pmjay_pediatric', 37180, 37180, 33800, 33800),
  ('PMJAY-SS008A', 'Myectomy', 'pmjay_pediatric', 35200, 35200, 32000, 32000),
  ('PMJAY-SS008B', 'Pull Through', 'pmjay_pediatric', 34100, 34100, 31000, 31000),
  ('PMJAY-SS008C', 'Rectal Biopsy - Punch', 'pmjay_pediatric', 17600, 17600, 16000, 16000),
  ('PMJAY-SS008D', 'Rectal Biopsy – Open', 'pmjay_pediatric', 18150, 18150, 16500, 16500),
  ('PMJAY-SS008E', 'Sphinecterotomy', 'pmjay_pediatric', 22770, 22770, 20700, 20700),
  ('PMJAY-SS009A', 'Rectal Polypectomy - Sigmoiescopic Under GA', 'pmjay_pediatric', 16060, 16060, 14600, 14600),
  ('PMJAY-SS010A', 'Abd - Perineal PSARP', 'pmjay_pediatric', 35090, 35090, 31900, 31900),
  ('PMJAY-SS010B', 'Anoplasty', 'pmjay_pediatric', 31460, 31460, 28600, 28600),
  ('PMJAY-SS010C', 'Cutback', 'pmjay_pediatric', 27500, 27500, 25000, 25000),
  ('PMJAY-SS010D', 'PSARP', 'pmjay_pediatric', 34650, 34650, 31500, 31500),
  ('PMJAY-SS010E', 'Redo - Pullthrough', 'pmjay_pediatric', 33000, 33000, 30000, 30000),
  ('PMJAY-SS010F', 'Transposition', 'pmjay_pediatric', 29480, 29480, 26800, 26800),
  ('PMJAY-SS011A', 'Fecal Fistula Closure', 'pmjay_gen_surgery', 38940, 38940, 35400, 35400),
  ('PMJAY-SS012A', 'GI Tumor Excision', 'pmjay_pediatric', 45870, 45870, 41700, 41700),
  ('PMJAY-SS013A', 'Congenital Diaphragmatic Hernia', 'pmjay_pediatric', 55440, 55440, 50400, 50400),
  ('PMJAY-SS014A', 'Exomphalos', 'pmjay_pediatric', 42350, 42350, 38500, 38500),
  ('PMJAY-SS014B', 'Gastroschisis', 'pmjay_pediatric', 42350, 42350, 38500, 38500),
  ('PMJAY-SS015A', 'Hernia & Hydrocele', 'pmjay_pediatric', 27500, 27500, 25000, 25000),
  ('PMJAY-SS016A', 'Retro - Peritoneal Lymphangioma Excision', 'pmjay_pediatric', 36190, 36190, 32900, 32900),
  ('PMJAY-SS017A', 'Surgery for Sacrococcygeal Teratoma', 'pmjay_pediatric', 33550, 33550, 30500, 30500),
  ('PMJAY-SS018A', 'Surgery for Congenital Lobar Emphysema', 'pmjay_pediatric', 44550, 44550, 40500, 40500),
  ('PMJAY-SS019A', 'Undescended Testis-Bilateral - Palpable + Nonpalpable', 'pmjay_pediatric', 21670, 21670, 19700, 19700),
  ('PMJAY-SS019B', 'Undescended Testis-Bilateral Palpable', 'pmjay_pediatric', 21670, 21670, 19700, 19700),
  ('PMJAY-SS019C', 'Undescended Testis-Bilateral Non - Palpable', 'pmjay_pediatric', 26180, 26180, 23800, 23800),
  ('PMJAY-SS019D', 'Undescended Testis-Unilateral - Palpable', 'pmjay_pediatric', 21670, 21670, 19700, 19700),
  ('PMJAY-SS019E', 'Undescended Testis-Reexploration / Second Stage', 'pmjay_pediatric', 24750, 24750, 22500, 22500),
  ('PMJAY-SS020A', 'Excision of accessory auricle', 'pmjay_pediatric', 26180, 26180, 23800, 23800),
  ('PMJAY-SS021A', 'Repair of macrostomia', 'pmjay_pediatric', 53680, 53680, 48800, 48800),
  ('PMJAY-SS022A', 'Parathyroidectomy', 'pmjay_pediatric', 53680, 53680, 48800, 48800),
  ('PMJAY-SS023A', 'Dilatation of Stenson''s duct', 'pmjay_pediatric', 15180, 15180, 13800, 13800),
  ('PMJAY-SS024A', 'Excision of supernumerary digit', 'pmjay_pediatric', 19250, 19250, 17500, 17500),
  ('PMJAY-SS025A', 'Syndactyly repair', 'pmjay_pediatric', 48180, 48180, 43800, 43800),
  ('PMJAY-SS026A', 'Repair of tongue laceration', 'pmjay_pediatric', 19250, 19250, 17500, 17500),
  ('PMJAY-SS027A', 'Sternomastoid division', 'pmjay_pediatric', 20680, 20680, 18800, 18800),
  ('PMJAY-SS028A', 'Non-operative management of liver trauma', 'pmjay_pediatric', 55000, 55000, 50000, 50000),
  ('PMJAY-SS029A', 'NON-SHUNTS', 'pmjay_pediatric', 61930, 61930, 56300, 56300),
  ('PMJAY-SS030A', 'Separation of twins', 'pmjay_pediatric', 130680, 130680, 118800, 118800),
  ('PMJAY-SS031A', 'PRIMARY REPAIR', 'pmjay_pediatric', 89430, 89430, 81300, 81300),
  ('PMJAY-SS032A', 'Ladd''s procedure', 'pmjay_pediatric', 53680, 53680, 48800, 48800),
  ('PMJAY-SS033A', 'VESICOSTOMY', 'pmjay_pediatric', 56430, 56430, 51300, 51300),
  ('PMJAY-SS034A', 'Splenorapphy', 'pmjay_pediatric', 42680, 42680, 38800, 38800),
  ('PMJAY-SS035A', 'Esophageal dilatation', 'pmjay_pediatric', 41250, 41250, 37500, 37500),
  ('PMJAY-SS036A', 'Kiidney biopsy', 'pmjay_pediatric', 45430, 45430, 41300, 41300),
  ('PMJAY-SS037A', 'Appendicovesicostomy or Monti procedure', 'pmjay_pediatric', 59180, 59180, 53800, 53800),
  ('PMJAY-SS038A', 'Vesicostomy', 'pmjay_pediatric', 38500, 38500, 35000, 35000),
  ('PMJAY-SS039A', 'Supra-glotoplasty', 'pmjay_pediatric', 37180, 37180, 33800, 33800),
  ('PMJAY-SS040A', 'Airway reconstruction', 'pmjay_pediatric', 75680, 75680, 68800, 68800),
  ('PMJAY-SS041A', 'Staged airway reconstruction', 'pmjay_pediatric', 68750, 68750, 62500, 62500),
  ('PMJAY-SS042A', 'Slide tracheoplasty', 'pmjay_pediatric', 82500, 82500, 75000, 75000),
  ('PMJAY-SG56B', 'Operation for Hydrocele (B/L)', 'pmjay_gen_surgery', 16500, 16500, 15000, 15000),
  ('PMJAY-SU001A', 'Adrenalectomy- Open', 'pmjay_urology', 32780, 32780, 29800, 29800),
  ('PMJAY-SU001B', 'Adrenalectomy -Lap.', 'pmjay_urology', 31900, 31900, 29000, 29000),
  ('PMJAY-SU018A', 'Ureterolithotomy -Open', 'pmjay_urology', 31460, 31460, 28600, 28600),
  ('PMJAY-SU018B', 'Lap.-Ureterolithotomy', 'pmjay_urology', 31020, 31020, 28200, 28200),
  ('PMJAY-SU021A', 'Pyeloplasty - Open', 'pmjay_urology', 42570, 42570, 38700, 38700),
  ('PMJAY-SU021B', 'Pyeloplasty - Laparoscopic', 'pmjay_urology', 47740, 47740, 43400, 43400),
  ('PMJAY-SU021C', 'Pyeloureterostomy - Open', 'pmjay_urology', 42570, 42570, 38700, 38700),
  ('PMJAY-SU021D', 'Pyeloureterostomy - Laparoscopic', 'pmjay_urology', 47740, 47740, 43400, 43400),
  ('PMJAY-SU021E', 'Pyelopyelostomy - Open', 'pmjay_urology', 42570, 42570, 38700, 38700),
  ('PMJAY-SU021F', 'Pyelopyelostomy - Laparoscopic', 'pmjay_urology', 47740, 47740, 43400, 43400),
  ('PMJAY-SU023A', 'Ureterocalycostomy - Open', 'pmjay_urology', 43890, 43890, 39900, 39900),
  ('PMJAY-SU023B', 'Ureterocalycostomy - Laparoscopic', 'pmjay_urology', 49060, 49060, 44600, 44600),
  ('PMJAY-SU024A', 'Pyelolithotomy - Open', 'pmjay_urology', 41250, 41250, 37500, 37500),
  ('PMJAY-SU024B', 'Lap.', 'pmjay_urology', 41250, 41250, 37500, 37500),
  ('PMJAY-SU027A', 'Ureterostomy (Cutaneous)', 'pmjay_urology', 27940, 27940, 25400, 25400),
  ('PMJAY-SU028A', 'Uretero-ureterostomy- Open', 'pmjay_urology', 41250, 41250, 37500, 37500),
  ('PMJAY-SU028B', 'Uretero-ureterostomy Lap.', 'pmjay_urology', 46420, 46420, 42200, 42200),
  ('PMJAY-SU030A', 'Ureteric reimplantation - Open', 'pmjay_urology', 28050, 28050, 25500, 25500),
  ('PMJAY-SU030B', 'Lap.', 'pmjay_urology', 28050, 28050, 25500, 25500),
  ('PMJAY-SU033A', 'DJ stent Insertion (One side)', 'pmjay_urology', 6525, 6525, 5750, 5750),
  ('PMJAY-SU040A', 'Open - including cystoscopy', 'pmjay_urology', 27390, 27390, 24900, 24900),
  ('PMJAY-SU041A', 'Cystolithotripsy endoscopic, including cystoscopy', 'pmjay_urology', 27390, 27390, 24900, 24900),
  ('PMJAY-SU041B', 'Urethral Stone removal endoscopic, including cystoscopy', 'pmjay_urology', 27390, 27390, 24900, 24900),
  ('PMJAY-SU043A', 'Partial Cystectomy- Open', 'pmjay_surg_oncology', 36080, 36080, 32800, 32800),
  ('PMJAY-SU043B', 'Lap.', 'pmjay_surg_oncology', 35090, 35090, 31900, 31900),
  ('PMJAY-SU045A', 'Augmentation cystoplasty - Open', 'pmjay_urology', 43890, 43890, 39900, 39900),
  ('PMJAY-SU045B', 'Lap.', 'pmjay_urology', 49060, 49060, 44600, 44600),
  ('PMJAY-SU048A', 'Open bladder diverticulectomy with / without ureteric re-implantation', 'pmjay_urology', 36190, 36190, 32900, 32900),
  ('PMJAY-SU049A', 'Bladder injury repair 
(with or without urethral injury)', 'pmjay_urology', 35090, 35090, 31900, 31900),
  ('PMJAY-SU050A', 'Bladder injury repair with colostomy 
(with or without urethral injury)', 'pmjay_urology', 40040, 40040, 36400, 36400),
  ('PMJAY-SU051A', 'Extrophy Bladder repair including osteotomy if needed + epispadias repair + ureteric reimplant', 'pmjay_urology', 123750, 123750, 112500, 112500),
  ('PMJAY-SU052A', 'Neurogenic bladder - Package for evaluation / investigation (catheter + ultrasound + culture + RGU/ MCU) for 1 month (medicines - antibiotics)', 'pmjay_urology', 22550, 22550, 20500, 20500),
  ('PMJAY-SU061A', 'Suprapubic Drainage - Closed / Trocar', 'pmjay_urology', 7040, 7040, 6400, 6400),
  ('PMJAY-SU065A', 'Meatotomy', 'pmjay_urology', 5720, 5720, 5200, 5200),
  ('PMJAY-SU065B', 'Meatoplasty', 'pmjay_urology', 6490, 6490, 5900, 5900),
  ('PMJAY-SU066A', 'Urethroplasty - End to end', 'pmjay_urology', 41250, 41250, 37500, 37500),
  ('PMJAY-SU066B', 'Urethroplasty - Substitution - single stage', 'pmjay_urology', 41250, 41250, 37500, 37500),
  ('PMJAY-SU066C', 'Urethroplasty - Substitution - two stage', 'pmjay_urology', 82500, 82500, 75000, 75000),
  ('PMJAY-SU066D', 'Urethroplasty - Transpubic', 'pmjay_urology', 47520, 47520, 43200, 43200),
  ('PMJAY-SU068A', 'Non endocopic as an independent procedure', 'pmjay_urology', 3520, 3520, 3200, 3200),
  ('PMJAY-SU068B', 'Endocopic as an independent procedure', 'pmjay_urology', 7810, 7810, 7100, 7100),
  ('PMJAY-SU069A', 'Perineal Urethrostomy without closure', 'pmjay_urology', 27940, 27940, 25400, 25400),
  ('PMJAY-SU070A', 'Post. Urethral Valve fulguration(to be checked from pead surgery)', 'pmjay_urology', 27500, 27500, 25000, 25000),
  ('PMJAY-SU071A', 'Hypospadias repair-Single stage', 'pmjay_urology', 55000, 55000, 50000, 50000),
  ('PMJAY-SU071B', 'Hypospadias repair-Two or more stage (First Stage)', 'pmjay_urology', 22440, 22440, 20400, 20400),
  ('PMJAY-SU071D', 'Hypospadias repair-Two or more stage (Final Stage)/Fistula repair', 'pmjay_urology', 27500, 27500, 25000, 25000),
  ('PMJAY-SU076A', 'Urethrorectal fistula repair', 'pmjay_urology', 68750, 68750, 62500, 62500),
  ('PMJAY-SU086A', 'Orchiectomy-High inguinal', 'pmjay_surg_oncology', 27500, 27500, 25000, 25000),
  ('PMJAY-SU088A', 'Orchiopexy with laparoscopyto be cross checked with pead surgery', 'pmjay_urology', 33000, 33000, 30000, 30000),
  ('PMJAY-SU088B', 'Orchiopexy without laparoscopy - U/L', 'pmjay_urology', 22770, 22770, 20700, 20700),
  ('PMJAY-SU088C', 'Orchiopexy without laparoscopy - B/L', 'pmjay_urology', 22770, 22770, 20700, 20700),
  ('PMJAY-SU094A', 'Emergency management of Ureteric stone - Package for evaluation / investigation (ultrasound + culture) for 3 weeks (medicines).', 'pmjay_urology', 2970, 2970, 2700, 2700),
  ('PMJAY-SU005A', 'Nephrolithotomy- Open', 'pmjay_urology', 41800, 41800, 38000, 38000),
  ('PMJAY-SU005B', 'Anatrophic', 'pmjay_urology', 41800, 41800, 38000, 38000),
  ('PMJAY-SU007A', 'PCNL (Percutaneous Nephrolithotomy)', 'pmjay_urology', 49500, 49500, 45000, 45000),
  ('PMJAY-SU0100A', 'Torsion of testis', 'pmjay_urology', 20680, 20680, 18800, 18800),
  ('PMJAY-SU013A', 'Perinephric Abscess drainage -Open', 'pmjay_urology', 27500, 27500, 25000, 25000),
  ('PMJAY-SU013B', 'Perinephric Abscess drainage-Percutaneous', 'pmjay_urology', 20680, 20680, 18800, 18800),
  ('PMJAY-SU014A', 'Ureteroscopy + Stone removal with lithotripsy-Lower Ureter', 'pmjay_urology', 32917, 32917, 29925, 29925),
  ('PMJAY-SU014B', 'Ureteroscopy + Stone removal with lithotripsy-Upper Ureter', 'pmjay_urology', 32917, 32917, 29925, 29925),
  ('PMJAY-SU016A', 'Extracoporeal shock - wave Lithotripsy (ESWL) stone, with or without stent (one side)', 'pmjay_urology', 22200, 22200, 20000, 20000),
  ('PMJAY-SU025A', 'Internal Ureterotomy including cystoscopy as an independent procedure', 'pmjay_urology', 13970, 13970, 12700, 12700),
  ('PMJAY-SU026A', 'Open - Ureterolysis for retroperitoneal fibrosis
(with or without omental wrapping)', 'pmjay_urology', 41250, 41250, 37500, 37500),
  ('PMJAY-SU026B', 'Ureterolysis for retroperitoneal fibrosis
(with or without omental wrapping- Lap.', 'pmjay_urology', 40260, 40260, 36600, 36600),
  ('PMJAY-SU031A', 'Open - Boari flap for ureteric stricture', 'pmjay_urology', 43890, 43890, 39900, 39900),
  ('PMJAY-SU031B', 'Boari flap for ureteric stricture- Lap.', 'pmjay_urology', 46420, 46420, 42200, 42200),
  ('PMJAY-SU032A', 'Ileal replacement for ureteric stricture', 'pmjay_urology', 89430, 89430, 81300, 81300),
  ('PMJAY-SU034A', 'DJ Stent Removal (Bilateral)', 'pmjay_urology', 3300, 3300, 3000, 3000),
  ('PMJAY-SU035A', 'Ureterocele incision including cystoscopy, ureteric catheterization, retrograde pyelogram', 'pmjay_urology', 27500, 27500, 25000, 25000),
  ('PMJAY-SU036A', 'Ureteric sampling including cystoscopy, ureteric catheterization, retrograde pyelogram', 'pmjay_urology', 20680, 20680, 18800, 18800),
  ('PMJAY-SU038A', 'Retrograde with laser / bugbee', 'pmjay_urology', 41250, 41250, 37500, 37500),
  ('PMJAY-SU038B', 'Antegrade with laser / bugbee', 'pmjay_urology', 41250, 41250, 37500, 37500),
  ('PMJAY-SU046A', 'Deflux for VUR(only procedure charge)', 'pmjay_urology', 5830, 5830, 5300, 5300),
  ('PMJAY-SU054A', 'Bladder Neck incision - Endoscopic', 'pmjay_urology', 22770, 22770, 20700, 20700),
  ('PMJAY-SU055A', 'TURBT 
(Transurethral Resection of the Bladder Tumor)', 'pmjay_surg_oncology', 40040, 40040, 36400, 36400),
  ('PMJAY-SU056A', 'TURBT - Restage', 'pmjay_surg_oncology', 27280, 27280, 24800, 24800),
  ('PMJAY-SU057A', 'Post TURBT - Check Cystoscopy (Per sitting) with cold-cup biopsy', 'pmjay_urology', 13750, 13750, 12500, 12500),
  ('PMJAY-SU058A', 'Urachal Cyst excision - Open', 'pmjay_urology', 30250, 30250, 27500, 27500),
  ('PMJAY-SU058B', 'Urachal Cyst excision - Laparoscopic', 'pmjay_urology', 32780, 32780, 29800, 29800),
  ('PMJAY-SU062A', 'Stress incontinence surgery - Open', 'pmjay_surg_oncology', 37450, 37450, 29500, 29500),
  ('PMJAY-SU074A', 'Excision of Urethral Caruncle', 'pmjay_urology', 7810, 7810, 7100, 7100),
  ('PMJAY-SU077A', 'Open simple prostatetctomy for BPH', 'pmjay_urology', 41030, 41030, 37300, 37300),
  ('PMJAY-SU078A', 'Radical prostatectomy-Open', 'pmjay_surg_oncology', 74800, 74800, 68000, 68000),
  ('PMJAY-SU078B', 'Lap.', 'pmjay_surg_oncology', 77440, 77440, 70400, 70400),
  ('PMJAY-SU080A', 'TURP-Transurethral Resection of the Prostate, BPH-Monopolar', 'pmjay_urology', 42570, 42570, 38700, 38700),
  ('PMJAY-SU080B', 'TURP-Transurethral Resection of the Prostate, BPH-Bipolar', 'pmjay_urology', 42570, 42570, 38700, 38700),
  ('PMJAY-SU081A', 'Transrectal Ultrasound guided prostate biopsy (minimum 12 core)', 'pmjay_urology', 13970, 13970, 12700, 12700),
  ('PMJAY-SU082A', 'Partial/ Total Penectomy', 'pmjay_surg_oncology', 27500, 27500, 25000, 25000),
  ('PMJAY-SU082B', 'Total Penectomy + Perineal Urethrostomy', 'pmjay_surg_oncology', 41250, 41250, 37500, 37500),
  ('PMJAY-SU083A', 'Surgery for Priapism-Aspiration', 'pmjay_urology', 20680, 20680, 18800, 18800),
  ('PMJAY-SU083B', 'Surgery for Priapism-Shunt', 'pmjay_urology', 22770, 22770, 20700, 20700),
  ('PMJAY-SU085A', 'Penile prosthesis insertion', 'pmjay_urology', 76180, 76180, 43800, 43800),
  ('PMJAY-SU087A', 'Bilateral Orchidectomy for hormone ablation', 'pmjay_surg_oncology', 15510, 15510, 14100, 14100),
  ('PMJAY-SU089A', 'Surgical Correction of Varicocele-Non Microsurgical', 'pmjay_urology', 11137, 11137, 10125, 10125),
  ('PMJAY-SU089B', 'Surgical Correction of Varicocele-Microsurgical
Startification', 'pmjay_urology', 27500, 27500, 25000, 25000),
  ('PMJAY-SU091A', 'Ilio-Inguinal lymphadenectomy', 'pmjay_surg_oncology', 24090, 24090, 21900, 21900),
  ('PMJAY-SU095A', 'Retrograde Intrarenal Surgery with Laser Lithotripsy', 'pmjay_urology', 41800, 41800, 38000, 38000),
  ('PMJAY-SU096B', 'Repair for VVF -Laparoscopic/open', 'pmjay_urology', 41250, 41250, 37500, 37500),
  ('PMJAY-SU097A', 'Permanent tunnelled catheter placement as substitute for AV fistula in long term dialysis', 'pmjay_urology', 33000, 33000, 30000, 30000),
  ('PMJAY-SU098A', 'Pelvic lymphadenectomy, after prior cancer surgery- Open', 'pmjay_surg_oncology', 41250, 41250, 37500, 37500),
  ('PMJAY-SU098B', 'Pelvic lymphadenectomy, after prior cancer surgery-Laparoscopic', 'pmjay_urology', 41800, 41800, 38000, 38000),
  ('PMJAY-SU099A', 'Botulinum toxin injection for Neuropathic bladder', 'pmjay_urology', 13750, 13750, 12500, 12500),
  ('PMJAY-SV001A', 'Unifocalization of MAPCA', 'pmjay_ctvs', 181250, 181250, 137500, 137500),
  ('PMJAY-SV001B', 'Isolated Secundum Atrial Septal Defect (ASD) Repair', 'pmjay_ctvs', 181250, 181250, 137500, 137500),
  ('PMJAY-SV001C', 'Glenn procedure', 'pmjay_ctvs', 151250, 151250, 137500, 137500),
  ('PMJAY-SV001D', 'Pulmonary Artery Banding', 'pmjay_ctvs', 151250, 151250, 137500, 137500),
  ('PMJAY-SV001E', 'Systemic - Pulmonary Artery shunt', 'pmjay_ctvs', 181250, 181250, 137500, 137500),
  ('PMJAY-SV001F', 'Vascular Ring division', 'pmjay_ctvs', 151250, 151250, 137500, 137500),
  ('PMJAY-SV001G', 'Coarctation repair', 'pmjay_ctvs', 181250, 181250, 137500, 137500),
  ('PMJAY-SV002A', 'ASD closure + Partial Anomalous Venous Drainage Repair', 'pmjay_ctvs', 231500, 231500, 165000, 165000),
  ('PMJAY-SV002B', 'ASD Closure + Mitral procedure', 'pmjay_ctvs', 261500, 261500, 165000, 165000),
  ('PMJAY-SV002C', 'ASD Closure + Tricuspid procedure', 'pmjay_ctvs', 261500, 261500, 165000, 165000),
  ('PMJAY-SV002D', 'ASD Closure + Pulmonary procedure', 'pmjay_ctvs', 261500, 261500, 165000, 165000),
  ('PMJAY-SV002E', 'ASD Closure + Infundibular procedure', 'pmjay_ctvs', 261500, 261500, 165000, 165000),
  ('PMJAY-SV002F', 'VSD closure', 'pmjay_ctvs', 261500, 261500, 165000, 165000),
  ('PMJAY-SV002G', 'Infundibular PS repair', 'pmjay_ctvs', 261500, 261500, 165000, 165000),
  ('PMJAY-SV002H', 'Valvular PS / PR repair', 'pmjay_ctvs', 261500, 261500, 165000, 165000),
  ('PMJAY-SV002I', 'Partial AV canal repair', 'pmjay_ctvs', 261500, 261500, 165000, 165000),
  ('PMJAY-SV002J', 'Intermediate AV canal repair', 'pmjay_ctvs', 261500, 261500, 165000, 165000),
  ('PMJAY-SV002K', 'Atrial septectomy + Glenn', 'pmjay_ctvs', 261500, 261500, 165000, 165000),
  ('PMJAY-SV002L', 'Atrial septectomy + PA Band', 'pmjay_ctvs', 261500, 261500, 165000, 165000),
  ('PMJAY-SV002M', 'Sinus of Valsalva aneurysm repair with aortic valve procedure', 'pmjay_ctvs', 261500, 261500, 165000, 165000),
  ('PMJAY-SV002N', 'Sinus of Valsalva aneurysm repair without aortic valve procedure', 'pmjay_ctvs', 261500, 261500, 165000, 165000),
  ('PMJAY-SV002O', 'Sub-aortic membrane resection', 'pmjay_ctvs', 261500, 261500, 165000, 165000),
  ('PMJAY-SV003A', 'Ebstien anomoly repair', 'pmjay_ctvs', 346930, 346930, 206300, 206300),
  ('PMJAY-SV003B', 'Double switch operation', 'pmjay_ctvs', 346930, 346930, 206300, 206300),
  ('PMJAY-SV003C', 'Rastelli Procedure', 'pmjay_ctvs', 346930, 346930, 206300, 206300),
  ('PMJAY-SV003D', 'Fontan procedure', 'pmjay_ctvs', 346930, 346930, 206300, 206300),
  ('PMJAY-SV003E', 'AP window repair', 'pmjay_ctvs', 346930, 346930, 206300, 206300),
  ('PMJAY-SV003F', 'Arch interruption Repair without VSD closure', 'pmjay_ctvs', 346930, 346930, 206300, 206300),
  ('PMJAY-SV003G', 'Arch interruption Repair with VSD closure', 'pmjay_ctvs', 346930, 346930, 206300, 206300),
  ('PMJAY-SV003H', 'DORV Repair', 'pmjay_ctvs', 346930, 346930, 206300, 206300),
  ('PMJAY-SV003I', 'Supravalvular AS repair', 'pmjay_ctvs', 346930, 346930, 206300, 206300),
  ('PMJAY-SV003J', 'Konno procedure', 'pmjay_ctvs', 346930, 346930, 206300, 206300),
  ('PMJAY-SV003K', 'Norwood procedure', 'pmjay_ctvs', 346930, 346930, 206300, 206300),
  ('PMJAY-SV003L', 'VSD closure + RV - PA conduit', 'pmjay_ctvs', 346930, 346930, 206300, 206300),
  ('PMJAY-SV003M', 'VSD + Aortic procedure', 'pmjay_ctvs', 346930, 346930, 206300, 206300),
  ('PMJAY-SV003N', 'VSD + Mitral procedure', 'pmjay_ctvs', 346930, 346930, 206300, 206300),
  ('PMJAY-SV003O', 'VSD + Tricuspid procedure', 'pmjay_ctvs', 346930, 346930, 206300, 206300),
  ('PMJAY-SV003P', 'VSD + Pulmonary artery procedure', 'pmjay_ctvs', 346930, 346930, 206300, 206300),
  ('PMJAY-SV003Q', 'VSD + Infundibular procedure', 'pmjay_ctvs', 346930, 346930, 206300, 206300),
  ('PMJAY-SV003R', 'VSD + Coarctation repair', 'pmjay_ctvs', 346930, 346930, 206300, 206300),
  ('PMJAY-SV003S', 'TAPVC Repair', 'pmjay_ctvs', 346930, 346930, 206300, 206300),
  ('PMJAY-SV003T', 'Truncus arteriosus repair', 'pmjay_ctvs', 346930, 346930, 206300, 206300),
  ('PMJAY-SV003U', 'Tetralogy of Fallot Repair', 'pmjay_ctvs', 346930, 346930, 206300, 206300),
  ('PMJAY-SV003V', 'Complete AV canal repair', 'pmjay_ctvs', 346930, 346930, 206300, 206300),
  ('PMJAY-SV003W', 'Arterial switch operation', 'pmjay_ctvs', 346930, 346930, 206300, 206300),
  ('PMJAY-SV003X', 'Senning Operation', 'pmjay_ctvs', 346930, 346930, 206300, 206300),
  ('PMJAY-SV003Y', 'Mustard Operation', 'pmjay_ctvs', 346930, 346930, 206300, 206300),
  ('PMJAY-SV003Z', 'ALCAPA repair', 'pmjay_ctvs', 302500, 302500, 275000, 275000),
  ('PMJAY-SV004A', 'Coronary artery bypass grafting (CABG), with or without  intraoperative IABP)', 'pmjay_ctvs', 178640, 178640, 162400, 162400),
  ('PMJAY-SV005A', 'Aortic valve replacement', 'pmjay_ctvs', 260070, 260070, 163700, 163700),
  ('PMJAY-SV005B', 'Mitral valve replacement / Mitral valve repair', 'pmjay_ctvs', 260070, 260070, 163700, 163700),
  ('PMJAY-SV005C', 'Tricuspid valve replacement / Tricuspid valve repair', 'pmjay_ctvs', 260070, 260070, 163700, 163700),
  ('PMJAY-SV006A', 'Double valve replacement / repair', 'pmjay_ctvs', 294830, 294830, 195300, 195300),
  ('PMJAY-SV007A', 'Triple valve replacement / repair', 'pmjay_ctvs', 337180, 337180, 233800, 233800),
  ('PMJAY-SV008A', 'Closed mitral valvotomy', 'pmjay_ctvs', 86240, 86240, 78400, 78400),
  ('PMJAY-SV009A', 'Ross Procedure', 'pmjay_ctvs', 346930, 346930, 206300, 206300),
  ('PMJAY-SV010A', 'Surgery for Hypertrophic Obstructive Cardiomyopathy (HOCM)', 'pmjay_ctvs', 247970, 247970, 152700, 152700),
  ('PMJAY-SV011A', 'Pericardial window (via thoracotomy)', 'pmjay_ctvs', 45430, 45430, 41300, 41300),
  ('PMJAY-SV012A', 'Pericardiectomy', 'pmjay_ctvs', 101420, 101420, 92200, 92200),
  ('PMJAY-SV013A', 'Patent Ductus Arteriosus (PDA) Closure via thoracotomy', 'pmjay_ctvs', 86240, 86240, 78400, 78400),
  ('PMJAY-SV014A', 'Bental Procedure', 'pmjay_ctvs', 326930, 326930, 206300, 206300),
  ('PMJAY-SV014B', 'Aortic Dissection', 'pmjay_ctvs', 326930, 326930, 206300, 206300),
  ('PMJAY-SV014C', 'Aortic Aneurysm ( Root Ascending )', 'pmjay_ctvs', 326930, 326930, 206300, 206300),
  ('PMJAY-SV014D', 'Valve sparing root replacement', 'pmjay_ctvs', 326930, 326930, 206300, 206300),
  ('PMJAY-SV014E', 'AVR + Root enlargement', 'pmjay_ctvs', 346930, 346930, 206300, 206300),
  ('PMJAY-SV015A', 'Aortic Arch Replacement using cardiopulmonary bypass', 'pmjay_ctvs', 311930, 311930, 206300, 206300),
  ('PMJAY-SV015B', 'Thoracoabdominal aneurysm Repair using partial cardiopulmonary bypass', 'pmjay_ctvs', 311930, 311930, 206300, 206300),
  ('PMJAY-SV016A', 'Aortic Aneurysm Repair using Cardiopulmonary bypass (CPB)', 'pmjay_ctvs', 211500, 211500, 165000, 165000),
  ('PMJAY-SV016B', 'Aortic Aneurysm Repair using Left Heart Bypass', 'pmjay_ctvs', 211500, 211500, 165000, 165000),
  ('PMJAY-SV016C', 'Aortic Aneurysm Repair without using Cardiopulmonary bypass (CPB)', 'pmjay_ctvs', 129110, 129110, 90100, 90100),
  ('PMJAY-SV016D', 'Aortic Aneurysm Repair without using Left Heart Bypass', 'pmjay_ctvs', 129110, 129110, 90100, 90100),
  ('PMJAY-SV017A', 'Aorto Iliac bypass - U/L', 'pmjay_ctvs', 147570, 147570, 88700, 88700),
  ('PMJAY-SV017B', 'Aorto femoral bypass - U/L', 'pmjay_ctvs', 147570, 147570, 88700, 88700),
  ('PMJAY-SV017C', 'Aorto Iliac bypass - B/L', 'pmjay_ctvs', 147570, 147570, 88700, 88700),
  ('PMJAY-SV017D', 'Aorto femoral bypass - B/L', 'pmjay_ctvs', 147570, 147570, 88700, 88700),
  ('PMJAY-SV018A', 'Pulmonary Embolectomy', 'pmjay_ctvs', 213290, 213290, 193900, 193900),
  ('PMJAY-SV018B', 'Pulmanary Thromboendarterectomy', 'pmjay_ctvs', 213290, 213290, 193900, 193900),
  ('PMJAY-SV019A', 'Femoro - Femoral Bypass', 'pmjay_ctvs', 125680, 125680, 68800, 68800),
  ('PMJAY-SV019B', 'Carotid - endearterectomy', 'pmjay_ctvs', 125680, 125680, 68800, 68800),
  ('PMJAY-SV019C', 'Carotid Body Tumor Excision', 'pmjay_ctvs', 125680, 125680, 68800, 68800),
  ('PMJAY-SV019D', 'Thoracic Outlet syndrome Repair', 'pmjay_ctvs', 125680, 125680, 68800, 68800),
  ('PMJAY-SV019E', 'Carotid aneurysm repair', 'pmjay_ctvs', 125680, 125680, 68800, 68800),
  ('PMJAY-SV019F', 'Subclavian aneurysm repair', 'pmjay_ctvs', 125680, 125680, 68800, 68800),
  ('PMJAY-SV019G', 'Axillary aneurysm repair', 'pmjay_ctvs', 125680, 125680, 68800, 68800),
  ('PMJAY-SV019H', 'Brachial artery aneurysm repair', 'pmjay_ctvs', 125680, 125680, 68800, 68800),
  ('PMJAY-SV019I', 'Femoral artery aneurysm repair', 'pmjay_ctvs', 125680, 125680, 68800, 68800),
  ('PMJAY-SV019J', 'Popliteal artery aneurysm repair', 'pmjay_ctvs', 125680, 125680, 68800, 68800),
  ('PMJAY-SV019K', 'Femoral - popliteal Bypass', 'pmjay_ctvs', 125680, 125680, 68800, 68800),
  ('PMJAY-SV019L', 'Axillo - Brachial Bypass', 'pmjay_ctvs', 125680, 125680, 68800, 68800),
  ('PMJAY-SV019M', 'Carotio - carotid Bypass', 'pmjay_ctvs', 125680, 125680, 68800, 68800),
  ('PMJAY-SV019N', 'Carotido - subclavian artery  bypass', 'pmjay_ctvs', 125680, 125680, 68800, 68800),
  ('PMJAY-SV019O', 'Carotido - axillary bypass', 'pmjay_ctvs', 125680, 125680, 68800, 68800),
  ('PMJAY-SV019P', 'Axillo - femoral bypass - U/L', 'pmjay_ctvs', 125680, 125680, 68800, 68800),
  ('PMJAY-SV019Q', 'Axillo - femoral bypass - B/L', 'pmjay_ctvs', 125680, 125680, 68800, 68800),
  ('PMJAY-SV019R', 'Aorto - carotid bypass', 'pmjay_ctvs', 125680, 125680, 68800, 68800),
  ('PMJAY-SV019S', 'Aorto - subclavian bypass', 'pmjay_ctvs', 125680, 125680, 68800, 68800),
  ('PMJAY-SV019T', 'Patch Graft Angioplasty', 'pmjay_ctvs', 125680, 125680, 68800, 68800),
  ('PMJAY-SV019U', 'Small Arterial Aneurysms – Repair', 'pmjay_ctvs', 125680, 125680, 68800, 68800),
  ('PMJAY-SV019V', 'Medium size arterial aneurysms with synthetic graft', 'pmjay_ctvs', 125680, 125680, 68800, 68800),
  ('PMJAY-SV019W', 'Surgery for Arterial Aneursysm –Vertebral', 'pmjay_ctvs', 125680, 125680, 68800, 68800),
  ('PMJAY-SV019X', 'Surgery for Arterial Aneurysm Renal Artery', 'pmjay_ctvs', 125680, 125680, 68800, 68800),
  ('PMJAY-SV019Y', 'Operations for Acquired Arteriovenous Fistual', 'pmjay_ctvs', 125680, 125680, 68800, 68800),
  ('PMJAY-SV019Z', 'Congenital Arterio Venous Fistula', 'pmjay_ctvs', 75680, 75680, 68800, 68800),
  ('PMJAY-SV020A', 'Peripheral Thromboembolectomy', 'pmjay_ctvs', 42350, 42350, 38500, 38500),
  ('PMJAY-SV021A', 'Peripheral arterial injury repair (without bypass)', 'pmjay_ctvs', 45430, 45430, 41300, 41300),
  ('PMJAY-SV022A', 'Thoracotomy, Thoraco Abdominal Approach', 'pmjay_ctvs', 45430, 45430, 41300, 41300),
  ('PMJAY-SV023A', 'Lung cyst exision', 'pmjay_ctvs', 68090, 68090, 61900, 61900),
  ('PMJAY-SV023B', 'Decortication', 'pmjay_ctvs', 68090, 68090, 61900, 61900),
  ('PMJAY-SV023C', 'Hydatid cyst', 'pmjay_ctvs', 68090, 68090, 61900, 61900),
  ('PMJAY-SV023D', 'Other simple lung procedure excluding lung resection', 'pmjay_ctvs', 68090, 68090, 61900, 61900),
  ('PMJAY-SV023E', 'Bronchial Repair Surgery for Injuries due to FB', 'pmjay_ctvs', 68090, 68090, 61900, 61900),
  ('PMJAY-SV024A', 'Pulmonary Resection', 'pmjay_ctvs', 105930, 105930, 96300, 96300),
  ('PMJAY-SV025A', 'Foreign Body Removal with scope', 'pmjay_ctvs', 30250, 30250, 27500, 27500),
  ('PMJAY-SV026A', 'Surgical Correction of Bronchopleural Fistula', 'pmjay_ctvs', 98340, 98340, 89400, 89400),
  ('PMJAY-SV027A', 'Space - Occupying Lesion (SOL) mediastinum', 'pmjay_ctvs', 99110, 99110, 90100, 90100),
  ('PMJAY-SV028A', 'Isolated Intercostal Drainage and Management of ICD, Intercostal Block, Antibiotics & Physiotherapy', 'pmjay_ctvs', 15180, 15180, 13800, 13800),
  ('PMJAY-SV029A', 'Diaphragmatic Repair', 'pmjay_ctvs', 46930, 46930, 41300, 41300),
  ('PMJAY-SV030A', 'Surgery for Cardiac Tumour', 'pmjay_ctvs', 143770, 143770, 130700, 130700),
  ('PMJAY-SV031A', 'Tetralogy of Fallot Repair (immediate  re operation)', 'pmjay_ctvs', 233520, 233520, 103200, 103200),
  ('PMJAY-SV031B', 'Aortic valve replacement /repair', 'pmjay_ctvs', 295710, 295710, 196100, 196100),
  ('PMJAY-SV031C', 'Mitral valve replacement /repair', 'pmjay_ctvs', 295710, 295710, 196100, 196100),
  ('PMJAY-SV031D', 'Tricuspid valve replacement /repair', 'pmjay_ctvs', 295710, 295710, 196100, 196100),
  ('PMJAY-SV031E', 'Double valve replacement /repair', 'pmjay_ctvs', 187470, 187470, 97700, 97700),
  ('PMJAY-SV031F', 'Triple valve replacement /repair', 'pmjay_ctvs', 208590, 208590, 116900, 116900),
  ('PMJAY-SV032A', 'Low Cardiac Output syndrome requiring IABP insertion post - operatively', 'pmjay_ctvs', 125680, 125680, 68800, 68800),
  ('PMJAY-SV033A', 'Re-do sternotomy', 'pmjay_ctvs', 30250, 30250, 27500, 27500),
  ('PMJAY-SV034A', 'Excessive bleeding requiring re-exploration', 'pmjay_ctvs', 15180, 15180, 13800, 13800),
  ('PMJAY-SV035A', 'Mediastinotomy', 'pmjay_ctvs', 43560, 43560, 39600, 39600),
  ('PMJAY-SV036A', 'Pectus excavation (incluidng implants if any)', 'pmjay_ctvs', 68750, 68750, 62500, 62500),
  ('PMJAY-SV037A', 'Left ventricular aneurysm repair', 'pmjay_ctvs', 178640, 178640, 162400, 162400),
  ('PMJAY-SV038A', 'CABG + Left ventricular aneurysm repair', 'pmjay_ctvs', 247390, 247390, 224900, 224900),
  ('PMJAY-SV039A', 'Tracheal repair', 'pmjay_ctvs', 68750, 68750, 62500, 62500),
  ('PMJAY-SV040A', 'Aortic stenting +Cost of Stent)', 'pmjay_ctvs', 418750, 418750, 62500, 62500),
  ('PMJAY-HM001A', 'Recombinant tissue plasminogen activator- 0.9 mg/kg (not to exceed 90 mg total treatment dose) infused over 60 minutes.', 'pmjay_medicine', 46200, 46200, 42000, 42000),
  ('PMJAY-HM002A', 'Tenecteplase - 0.2 mg/kg given as a bolus dose over 1-2min volume of TNK to be administered at a dilution of 2mg/ml', 'pmjay_medicine', 27390, 27390, 24900, 24900),
  ('PMJAY-HM003A', 'Heparin - Based on weight and age of patient', 'pmjay_medicine', 16500, 16500, 15000, 15000),
  ('PMJAY-HM004A', 'Methylprednisolone - 0.117-1.66 mg/kg/day orally divided every 6-8 hours', 'pmjay_medicine', 27500, 27500, 25000, 25000),
  ('PMJAY-HM006A', 'Liposomal amphotericin - for 2.5 Gm  dosage. @ 2500 per 50mg', 'pmjay_medicine', 137500, 137500, 125000, 125000),
  ('PMJAY-HM007A', 'IVIG - 2000 per GM @ 2 GM/Per Kg body weight. Almost 20 GM in adult dose.( Mx. Of 200000 , paid on actual utilization)', 'pmjay_medicine', 222000, 222000, 200000, 200000),
  ('PMJAY-HM017A', 'Imipenem - . 3 gm per day dose', 'pmjay_medicine', 8400, 8400, 7000, 7000),
  ('PMJAY-HM018A', 'Meropenem -  3 gm Per day dose', 'pmjay_medicine', 8400, 8400, 7000, 7000),
  ('PMJAY-HM019A', 'Piperacillin-Tazobactem - 4.5gm TDS per day dose', 'pmjay_medicine', 6300, 6300, 3000, 3000),
  ('PMJAY-HM020A', 'Colistin - Variable', 'pmjay_medicine', 8400, 8400, 7000, 7000),
  ('PMJAY-HM021A', 'Vancomycin -  15 mg/kg IV BD per day', 'pmjay_medicine', 4410, 4410, 2100, 2100),
  ('PMJAY-HM022A', 'Amphotericin deoxycholate 0.3 mg/kg IV qDay', 'pmjay_medicine', 1100, 1100, 1000, 1000),
  ('PMJAY-IN011GJA', 'Additonal coil for Parent Vessel Occlusion', 'pmjay_ent', 26400, 26400, 24000, 24000),
  ('PMJAY-IN012GJA', 'Additonal balloon for Parent Vessel Occlusion', 'pmjay_ent', 12100, 12100, 11000, 11000),
  ('PMJAY-IN013GJA', 'Additional coil for coil embolization for aneurysms', 'pmjay_ent', 26400, 26400, 24000, 24000),
  ('PMJAY-MC023GJA', 'Coil clouser', 'pmjay_cardiology', 22000, 22000, 20000, 20000),
  ('PMJAY-MC023GJB', 'Pseudoaneurysms of Abdomen', 'pmjay_cardiology', 60500, 60500, 55000, 55000),
  ('PMJAY-MC025GJA', 'Percutaneous Transluminal Tricuspid Commissurotormy (PTTC)', 'pmjay_cardiology', 27500, 27500, 25000, 25000),
  ('PMJAY-MC026GJA', 'Pulmonary artery stenting', 'pmjay_cardiology', 44000, 44000, 40000, 40000),
  ('PMJAY-MC027GJA', 'Right ventricular outflow tract (RVOT) stenting', 'pmjay_cardiology', 44000, 44000, 40000, 40000),
  ('PMJAY-MC028GJA', '3D Maping + Ablation', 'pmjay_cardiology', 30044, 30044, 27313, 27313),
  ('PMJAY-MC030GJA', 'CAG (Coronary Angiography) / Peripheral Angiography/ Renal Angiography', 'pmjay_cardiology', 4427, 4427, 4025, 4025),
  ('PMJAY-MC030GJB', 'Check Angiography', 'pmjay_cardiology', 3669, 3669, 3335, 3335),
  ('PMJAY-MC030GJC', 'Coronary Angiography + Peripheral Angiography', 'pmjay_cardiology', 4427, 4427, 4025, 4025),
  ('PMJAY-MC030GJD', 'Coronary Angiography + Renal Angiography', 'pmjay_cardiology', 4427, 4427, 4025, 4025),
  ('PMJAY-MC033GJA', 'PDA Coil (one) insertion', 'pmjay_cardiology', 15180, 15180, 13800, 13800),
  ('PMJAY-MC034GJA', 'Post MI VSD closure', 'pmjay_cardiology', 101200, 101200, 92000, 92000),
  ('PMJAY-MC036GJA', 'Bi Ventricular Pacing - CRT', 'pmjay_cardiology', 319000, 319000, 290000, 290000),
  ('PMJAY-MC037GJA', 'AICD - Automatic Implantable Cardiac Defibrillator (with device SingleChamber)', 'pmjay_cardiology', 341000, 341000, 310000, 310000),
  ('PMJAY-MC038GJA', 'AICD - Automatic Implantable Cardiac Defibrillator (with device DoubleChamber)', 'pmjay_cardiology', 453200, 453200, 412000, 412000),
  ('PMJAY-MC039GJA', 'Combo: AICD+Bi ventricular pacemaker (with device)', 'pmjay_cardiology', 656700, 656700, 597000, 597000),
  ('PMJAY-MG084GJA', 'Intraparenchymal / Subarachnoid Hemmorrhage (Conservative management)', 'pmjay_ent', 44000, 44000, 40000, 40000),
  ('PMJAY-MG085GJA', 'Meninfoencephalitis, or / and EVD / VP shunt (Consevative management)', 'pmjay_neurosurgery', 121000, 121000, 110000, 110000),
  ('PMJAY-MG088GJA', 'Thrombolysis with Actilyse for Ischemic stroke', 'pmjay_ent', 132000, 132000, 120000, 120000),
  ('PMJAY-MG089GJA', 'Endovascular intervention for salvaging hemodialysis AV fistula', 'pmjay_urology', 44000, 44000, 40000, 40000),
  ('PMJAY-MG091GJA', 'Brachiocephalic AV fistula for Hemodialysis', 'pmjay_urology', 9108, 9108, 8280, 8280),
  ('PMJAY-MO073GJB', 'Aplastic Anaemia - ATG + Cyclosporine + Steroid', 'pmjay_med_oncology', 352000, 352000, 320000, 320000),
  ('PMJAY-MO073GJA', 'Allogeneic stem cell Transplant', 'pmjay_med_oncology', 858000, 858000, 780000, 780000),
  ('PMJAY-MO074GJA', 'ATRA, Arsenic trioxide, Daunorubicin, Cytarabine 6 MP, methotrexate', 'pmjay_med_oncology', 70840, 70840, 64400, 64400),
  ('PMJAY-MO075GJA', 'Methotrexate Vinblastine Adriamycin Cyclophosphamide (MVAC)', 'pmjay_med_oncology', 7843, 7843, 7130, 7130),
  ('PMJAY-MO075GJB', 'Weekly Cisplatin', 'pmjay_med_oncology', 4554, 4554, 4140, 4140),
  ('PMJAY-MO076GJA', 'Congenital condition amenable to BMT - Allogeneic stem cell Transplant', 'pmjay_med_oncology', 858000, 858000, 780000, 780000),
  ('PMJAY-MO077GJA', 'Palliative and Supportive Therapy', 'pmjay_med_oncology', 5313, 5313, 4830, 4830),
  ('PMJAY-MO078GJA', '5-FU -Leucovorin (McDonald Regimen), Epirubicin/Taxanes/Platin', 'pmjay_med_oncology', 18975, 18975, 17250, 17250),
  ('PMJAY-MO080GJA', 'Gemcitabine 1000 mg/sq m D1 and 8 , Oxaliplatin 85 mg per sq m', 'pmjay_med_oncology', 19228, 19228, 17480, 17480),
  ('PMJAY-MO081GJA', 'Bortezamib, Lenalinomide, Bisphosphonates, Autologus stem cell transplant', 'pmjay_med_oncology', 15180, 15180, 13800, 13800),
  ('PMJAY-MO081GJB', 'Melphalan -Prednisone (oral)', 'pmjay_med_oncology', 2783, 2783, 2530, 2530),
  ('PMJAY-MO081GJC', 'Thalidomide+Dexamethasone(Oral)', 'pmjay_med_oncology', 5313, 5313, 4830, 4830),
  ('PMJAY-MO081GJD', 'Vincristine, Adriamycin,Dexamethasone(VAD)', 'pmjay_med_oncology', 6325, 6325, 5750, 5750),
  ('PMJAY-MO082GJA', 'Allogeneic stem cell Transplant', 'pmjay_med_oncology', 858000, 858000, 780000, 780000),
  ('PMJAY-MO082GJB', 'Myelodysplastic syndrome - Lenalinomide Decitabine', 'pmjay_med_oncology', 220000, 220000, 200000, 200000),
  ('PMJAY-MO083GJA', 'Variable Regimen Variable regimens, Autologous Stem Cell', 'pmjay_med_oncology', 17710, 17710, 16100, 16100),
  ('PMJAY-MO084GJA', 'All Cancer for all oncology cluster diagnostic or staging in proven cancer patient', 'pmjay_med_oncology', 11000, 11000, 10000, 10000),
  ('PMJAY-MO085GJA', 'Cisplatin/Adriamycin + ifosmide (IAP)', 'pmjay_med_oncology', 15180, 15180, 13800, 13800),
  ('PMJAY-MO086GJA', 'Fixation of pathological fracture [Palliative package ^]', 'pmjay_med_oncology', 34914, 34914, 31740, 31740),
  ('PMJAY-MO086GJB', 'Pain killer /  G-CSF/  Drainage – Biliary and urinary /  Stenting – Biliary/  Stenting – urinary /  Nutritional supplement [Palliative package ^]', 'pmjay_med_oncology', 5819, 5819, 5290, 5290),
  ('PMJAY-MO087GJA', 'Relapsed Paediatric Solid Tumor - Autologus stem cell transplant -', 'pmjay_med_oncology', 858000, 858000, 780000, 780000),
  ('PMJAY-MO088GJB', 'Taxanes, Ifosphamides, Vinblastine, Gemcitabine, Docetaxol, Platin', 'pmjay_med_oncology', 12144, 12144, 11040, 11040),
  ('PMJAY-MO089GJA', 'Thalassemia/Haemoglobinopat hies Sickle cell anaemia - Allogeneic Bone Marrow Transplant', 'pmjay_med_oncology', 858000, 858000, 780000, 780000),
  ('PMJAY-MO090GJA', 'Palliative Chemotherapy', 'pmjay_med_oncology', 7843, 7843, 7130, 7130),
  ('PMJAY-MO091GJA', 'Cisplatin 100mg/m2 D1 and5FU 1000mg/sq m D1-3', 'pmjay_med_oncology', 10120, 10120, 9200, 9200),
  ('PMJAY-MO092GJA', 'SIOP/NWTS regimen(Stages I - IV)', 'pmjay_med_oncology', 15180, 15180, 13800, 13800),
  ('PMJAY-MR015GJA', 'Interstitial Brachy therapy (Radical Treatment min 10 #) - CT/MR planning  (complete treatment)', 'pmjay_rad_oncology', 88000, 88000, 80000, 80000),
  ('PMJAY-MR015GJB', 'Interstitial Brachy therapy (as a Boost after external RT min 4 # )  - CT/MR planning  (complete treatment)', 'pmjay_rad_oncology', 44000, 44000, 40000, 40000),
  ('PMJAY-MR015GJC', 'Intracavitary / Intraluminal  Brachytherapy - CT/MR planning (Image based Brachy therapy)', 'pmjay_rad_oncology', 11000, 11000, 10000, 10000),
  ('PMJAY-MR016GJA', 'Hypofractionated Breast Cancer (40Gy/15# or 42Gy/16#)', 'pmjay_rad_oncology', 44000, 44000, 40000, 40000),
  ('PMJAY-MR016GJB', 'Hypofractionated Prostate (70Gy/28# or 70Gy/26#)', 'pmjay_rad_oncology', 99000, 99000, 90000, 90000),
  ('PMJAY-MR018GJA', 'Radio Iodine Therapy(Package amount per Dose)', 'pmjay_rad_oncology', 16500, 16500, 15000, 15000),
  ('PMJAY-MR019GJA', 'SRS - Palliative (complete treatment to be approved based on Performance Status) -includes imaging charges', 'pmjay_rad_oncology', 60500, 60500, 55000, 55000),
  ('PMJAY-MR019GJB', 'SRT / SBRT - Palliative (complete treatment to be approved based on Performance Status). No extra charges for gatting and imaging', 'pmjay_rad_oncology', 60500, 60500, 55000, 55000),
  ('PMJAY-MR021GJA', 'Total Body Radiation (complete treatment)', 'pmjay_rad_oncology', 73370, 73370, 66700, 66700),
  ('PMJAY-OT002GJA', 'Liver transplantation from deceased donor Part - 3 Operative Part', 'pmjay_transplant', 948750, 948750, 862500, 862500),
  ('PMJAY-OT003GJA', 'for 1 to 3 day', 'pmjay_transplant', 82500, 82500, 75000, 75000),
  ('PMJAY-OT003GJB', 'for 10 day or above', 'pmjay_transplant', 165000, 165000, 150000, 150000),
  ('PMJAY-OT003GJC', 'for 3 to 7 day', 'pmjay_transplant', 123750, 123750, 112500, 112500),
  ('PMJAY-OT004GJC', '3-10 days', 'pmjay_transplant', 82500, 82500, 75000, 75000),
  ('PMJAY-OT004GJA', 'for 11-20 days', 'pmjay_transplant', 123750, 123750, 112500, 112500),
  ('PMJAY-OT004GJB', 'for 21 and above days', 'pmjay_transplant', 165000, 165000, 150000, 150000),
  ('PMJAY-OT005GJA', 'for 13 and above Days', 'pmjay_transplant', 66000, 66000, 60000, 60000),
  ('PMJAY-OT005GJB', 'for 3-7 days', 'pmjay_transplant', 19800, 19800, 18000, 18000),
  ('PMJAY-OT005GJC', 'for 8-12 days', 'pmjay_transplant', 39600, 39600, 36000, 36000),
  ('PMJAY-OT006GJA', 'for 13 and above Days', 'pmjay_transplant', 72600, 72600, 66000, 66000),
  ('PMJAY-OT006GJB', 'for 3-7 days', 'pmjay_transplant', 21780, 21780, 19800, 19800),
  ('PMJAY-OT006GJC', 'for 8-12 days', 'pmjay_transplant', 43560, 43560, 39600, 39600),
  ('PMJAY-OT007GJA', 'Dual lobe liver transplantation: One lobe from one living donor and other lobe from other living donor (Two donor hepatectomy and one liver recipient surgery)', 'pmjay_transplant', 33000, 33000, 30000, 30000),
  ('PMJAY-OT008GJA', 'Dual lobe liver transplantation: One lobe from one living donor and other lobe from other living donor (Two donor hepatectomy and one liver recipient surgery) Receipient Ix Part-5', 'pmjay_transplant', 1188000, 1188000, 1080000, 1080000),
  ('PMJAY-OT009GJA', 'for liver donor', 'pmjay_transplant', 22000, 22000, 20000, 20000),
  ('PMJAY-OT009GJB', 'for liver recipient', 'pmjay_transplant', 55000, 55000, 50000, 50000),
  ('PMJAY-OT010GJA', 'for abdominal wash', 'pmjay_transplant', 22000, 22000, 20000, 20000),
  ('PMJAY-OT010GJB', 'for pancreatectomy', 'pmjay_transplant', 55000, 55000, 50000, 50000),
  ('PMJAY-OT011GJA', 'HEPATITIS C VIRUS TREAMENTInclude Sofosbuvir400+ledispasvir90mg OD for 3 months and HCVRNA quantity ( 3 times) (Rate per Month)', 'pmjay_transplant', 11550, 11550, 10500, 10500),
  ('PMJAY-OT012GJA', 'Invasive fungal infection after liver transplant Include Liposomal Amphotericin 5-10  mg/kg/day for 30 days and Surgical debridement, ICU stay for 10 days Hospital stay for 21 days', 'pmjay_transplant', 412500, 412500, 375000, 375000),
  ('PMJAY-OT013GJA', 'Kidney transplantation Laparoscopic Donor nephrectomy', 'pmjay_transplant', 66000, 66000, 60000, 60000),
  ('PMJAY-OT014GJA', 'Liver resection for HCC in Child-A cirrhosis', 'pmjay_transplant', 137500, 137500, 125000, 125000),
  ('PMJAY-OT015GJA', 'Part - 1', 'pmjay_transplant', 13750, 13750, 12500, 12500),
  ('PMJAY-OT015GJB', 'Part - 2', 'pmjay_transplant', 27500, 27500, 25000, 25000),
  ('PMJAY-OT016GJA', 'Part - 1', 'pmjay_transplant', 9625, 9625, 8750, 8750),
  ('PMJAY-OT016GJB', 'Part - 2', 'pmjay_transplant', 19250, 19250, 17500, 17500),
  ('PMJAY-OT016GJC', 'Part -3 Operative Part', 'pmjay_transplant', 686125, 686125, 623750, 623750),
  ('PMJAY-OT017GJA', 'Part - 1', 'pmjay_transplant', 12375, 12375, 11250, 11250),
  ('PMJAY-OT017GJB', 'Part-2 Investigations CT triphasic angiography for celiac axis, CT Volumetry, MR cholengiography', 'pmjay_transplant', 8250, 8250, 7500, 7500),
  ('PMJAY-OT017GJC', 'Part-3 Operative Part', 'pmjay_transplant', 254375, 254375, 231250, 231250),
  ('PMJAY-OT018GJB', '(Calcineurin  and mTOR based ) Include Prednisolone Tacrolimus 2 mg/day  Everolimus 1 mg/day, Mycophenolate upto 2 g/day (Rate per month)', 'pmjay_transplant', 8800, 8800, 8000, 8000),
  ('PMJAY-OT018GJA', '(Calcineurin based ) Include Prednisolone, Tacrolimus  2mg/day Mycophenolate upto 2 g /day(Rate per month)', 'pmjay_transplant', 3850, 3850, 3500, 3500),
  ('PMJAY-OT019GJA', 'Monthly everolimus Immunosuppression  after kidney transplant(Rate per Month)', 'pmjay_transplant', 9900, 9900, 9000, 9000),
  ('PMJAY-OT020GJA', 'Monthly investigations and  immunosuppression  after kidney transplant  Include Prednisolone,Tacrolimus  4mg/day,Mycophenolate 360 or 500 mg (4 tables)  /day, Sepmax OD (Package Ra', 'pmjay_transplant', 5500, 5500, 5000, 5000),
  ('PMJAY-OT021GJB', 'Include Prednisolone ,Tacrolimus  4mg/day, Mycophenolate upto 2 g / day , Fluconazole 100mg/day, Septran 1 tablet once a day,', 'pmjay_transplant', 4620, 4620, 4200, 4200),
  ('PMJAY-OT021GJA', 'Include Prednisolone Tacrolimus 2 mg/day +Everolimus 1 mg/day, Mycophenolate upto 2 g /day Fluconazole 100mg/day, Septran 1 tablet once a day', 'pmjay_transplant', 8580, 8580, 7800, 7800),
  ('PMJAY-OT022GJA', 'Monthly investigations and  immunosuppression from discharge after kidney transplant Include Prednisolone ,Tacrolimus  4mg/day, Mycophenolate 360 or 500 mg (4 tables)  /day, Valgan', 'pmjay_transplant', 11000, 11000, 10000, 10000),
  ('PMJAY-OT023GJA', 'Include Prednisolone, Tacrolimus  4mg/day, Mycophenolate   upto  2 g /day, Valgancyclovir 450 mg ,Fluconazole 100mg/day, Septran 1 tablet once a day  For First Month', 'pmjay_transplant', 45738, 45738, 41580, 41580),
  ('PMJAY-OT023GJB', 'Include Prednisolone, Tacrolimus  4mg/day, Mycophenolate   upto  2 g /day, Valgancyclovir 450 mg ,Fluconazole 100mg/day, Septran 1 tablet once a day  For Second Month', 'pmjay_transplant', 15246, 15246, 13860, 13860),
  ('PMJAY-OT023GJC', 'Include Prednisolone, Tacrolimus  4mg/day, Mycophenolate   upto  2 g /day, Valgancyclovir 450 mg ,Fluconazole 100mg/day, Septran 1 tablet once a day  For Third Month', 'pmjay_transplant', 15246, 15246, 13860, 13860),
  ('PMJAY-OT024GJA', 'Monthly once a day tacrolimus immunosuppression  after kidney transplant (Rate per Month)', 'pmjay_transplant', 7480, 7480, 6800, 6800),
  ('PMJAY-OT025GJA', 'Monthly sirolimus immunosuppression  after kidney transplant (Rate per Month)', 'pmjay_transplant', 4048, 4048, 3680, 3680),
  ('PMJAY-OT026GJA', 'Part - 1', 'pmjay_transplant', 22000, 22000, 20000, 20000),
  ('PMJAY-OT026GJB', 'Part - 4 Operative Part', 'pmjay_transplant', 352000, 352000, 320000, 320000),
  ('PMJAY-OT026GJC', 'Part=3 Investigation Single Antigen Quantitative', 'pmjay_transplant', 33000, 33000, 30000, 30000),
  ('PMJAY-OT026GJD', 'Part-2 Investigations HLA Typing LCM, FCM Single Antigen Qualitative', 'pmjay_transplant', 33000, 33000, 30000, 30000),
  ('PMJAY-OT027GJA', 'Part - 1', 'pmjay_transplant', 19800, 19800, 18000, 18000),
  ('PMJAY-OT027GJB', 'Part=3 InvestigationSingle Antigen Quantitative', 'pmjay_transplant', 29700, 29700, 27000, 27000),
  ('PMJAY-OT027GJC', 'Part-2 Investigations HLA Typing LCM, FCM Single Antigen Qualitative', 'pmjay_transplant', 29700, 29700, 27000, 27000),
  ('PMJAY-OT027GJD', 'Part-4 Operative Part', 'pmjay_transplant', 316800, 316800, 288000, 288000),
  ('PMJAY-OT028GJB', 'Part - 1', 'pmjay_transplant', 16500, 16500, 15000, 15000),
  ('PMJAY-OT028GJC', 'Part - 3', 'pmjay_transplant', 24750, 24750, 22500, 22500),
  ('PMJAY-OT028GJA', 'Part-2 Investigations HLA Typing LCM, FCM Single Antigen Qualitative', 'pmjay_transplant', 24750, 24750, 22500, 22500),
  ('PMJAY-OT028GJD', 'Part-4 Operative Part', 'pmjay_transplant', 264000, 264000, 240000, 240000),
  ('PMJAY-OT029GJA', 'Part - 1', 'pmjay_transplant', 11000, 11000, 10000, 10000),
  ('PMJAY-OT029GJB', 'Part - 4 Operative Part', 'pmjay_transplant', 462000, 462000, 420000, 420000),
  ('PMJAY-OT029GJC', 'Part-2 Investigations HLA Typing LCM, FCM Single Antigen Qualitative', 'pmjay_transplant', 44000, 44000, 40000, 40000),
  ('PMJAY-OT029GJD', 'Part-3 Investigation Single Antigen Quantitative,  S. Amylase, S. lipase, C-Peptide, GAD Antibody, Plain CT of Abdomen', 'pmjay_transplant', 33000, 33000, 30000, 30000),
  ('PMJAY-OT030GJA', 'Percutaneous liver allograft biopsy', 'pmjay_transplant', 5500, 5500, 5000, 5000),
  ('PMJAY-OT031GJA', 'for acute B cell rejection Albumin and Rituximab based protocol ( Rate is per sittings with limit of 4 sittings)', 'pmjay_transplant', 53900, 53900, 49000, 49000),
  ('PMJAY-OT031GJB', 'for highly sensitized recipient Albumin and Rituximab based protocol (rate is  per sittings with limit of 4 sittings)', 'pmjay_transplant', 41250, 41250, 37500, 37500),
  ('PMJAY-OT032GJA', 'ERCP', 'pmjay_transplant', 11000, 11000, 10000, 10000),
  ('PMJAY-OT032GJB', 'ERCP with stenting', 'pmjay_transplant', 19800, 19800, 18000, 18000),
  ('PMJAY-OT032GJF', 'Hepatitis B infection (entecavir resistant)Includes tenofovir 300 mg /day (Rate Per Month)', 'pmjay_transplant', 5170, 5170, 4700, 4700),
  ('PMJAY-OT032GJG', 'Hepatitis B infection Includes entecavir 0.5 mg /day (Rate Per Month)', 'pmjay_transplant', 4400, 4400, 4000, 4000),
  ('PMJAY-OT032GJH', 'Hepatitis C infectionIncludes sofosbuvir 400 mg/ day  + daclatasavir 60 mg/day  + ribavirin 1000 mg/day (Rate Per Month)', 'pmjay_transplant', 33000, 33000, 30000, 30000),
  ('PMJAY-OT032GJC', 'Incisional hernia repair (Prosthetic mesh)', 'pmjay_transplant', 44000, 44000, 40000, 40000),
  ('PMJAY-OT032GJI', 'Percutaneous Endoscopy guided gastrostomy (PEG)', 'pmjay_transplant', 8800, 8800, 8000, 8000),
  ('PMJAY-OT032GJD', 'Percutaneous transhepatic biliary drainage (PTBD)', 'pmjay_transplant', 16500, 16500, 15000, 15000),
  ('PMJAY-OT032GJE', 'Roux en Y jejunojejunostomy and choledochojejunostomy', 'pmjay_transplant', 55000, 55000, 50000, 50000),
  ('PMJAY-OT033GJA', 'Radiofrequency ablation (RFA) for HCC for Child-A, B and C cirrhosis(Rate per session)', 'pmjay_transplant', 27500, 27500, 25000, 25000),
  ('PMJAY-OT034GJA', 'Part - 1', 'pmjay_transplant', 26400, 26400, 24000, 24000),
  ('PMJAY-OT034GJB', 'Part-2 Investigations HLA Typing LCM, FCM Single Antigen Qualitative', 'pmjay_transplant', 39600, 39600, 36000, 36000),
  ('PMJAY-OT034GJC', 'Part-3 Investigation Single Antigen Quantitative', 'pmjay_transplant', 39600, 39600, 36000, 36000),
  ('PMJAY-OT034GJD', 'Part-4 Operative Part', 'pmjay_transplant', 422400, 422400, 384000, 384000),
  ('PMJAY-OT035GJB', 'Part - 4 Operative Part', 'pmjay_transplant', 404800, 404800, 368000, 368000),
  ('PMJAY-OT035GJC', 'Part-2 Investigations HLA Typing LCM, FCM Single Antigen Qualitative', 'pmjay_transplant', 37950, 37950, 34500, 34500),
  ('PMJAY-OT035GJD', 'Part-3 Investigation Single Antigen Quantitative', 'pmjay_transplant', 37950, 37950, 34500, 34500),
  ('PMJAY-OT035GJA', 'Robotic kidney transplantation from deceased donor Part - 1', 'pmjay_transplant', 25300, 25300, 23000, 23000),
  ('PMJAY-OT036GJA', 'Part - 1', 'pmjay_transplant', 24200, 24200, 22000, 22000),
  ('PMJAY-OT036GJB', 'Part - 4 Operative Part', 'pmjay_transplant', 387200, 387200, 352000, 352000),
  ('PMJAY-OT036GJC', 'Part-2 Investigations HLA Typing LCM, FCM Single Antigen Qualitative', 'pmjay_transplant', 36300, 36300, 33000, 33000),
  ('PMJAY-OT036GJD', 'Part-3 Investigation Single Antigen Quantitative', 'pmjay_transplant', 36300, 36300, 33000, 33000),
  ('PMJAY-OT037GJA', 'Part - 1', 'pmjay_transplant', 13750, 13750, 12500, 12500),
  ('PMJAY-OT037GJB', 'Part - 2', 'pmjay_transplant', 27500, 27500, 25000, 25000),
  ('PMJAY-OT037GJC', 'Part - 3 Operative Part', 'pmjay_transplant', 948750, 948750, 862500, 862500),
  ('PMJAY-OT038GJA', 'Trans-jugular Intrahepatic Porto-Systemic Shunt procedure (TIPS)', 'pmjay_transplant', 165000, 165000, 150000, 150000),
  ('PMJAY-OT039GJA', 'Trans-jugular liver allograft biopsy', 'pmjay_transplant', 8800, 8800, 8000, 8000),
  ('PMJAY-OT040GJA', 'for 13 Days abd above', 'pmjay_transplant', 247500, 247500, 225000, 225000),
  ('PMJAY-OT040GJB', 'for 8-13 Days', 'pmjay_transplant', 148500, 148500, 135000, 135000),
  ('PMJAY-OT040GJC', 'for3-7 days', 'pmjay_transplant', 74250, 74250, 67500, 67500),
  ('PMJAY-OT041GJA', 'for 3rd  month', 'pmjay_transplant', 66000, 66000, 60000, 60000),
  ('PMJAY-OT041GJB', 'for First month', 'pmjay_transplant', 88000, 88000, 80000, 80000),
  ('PMJAY-OT041GJC', 'for second month', 'pmjay_transplant', 66000, 66000, 60000, 60000),
  ('PMJAY-OT042GJA', 'for  3-7 days', 'pmjay_transplant', 9900, 9900, 9000, 9000),
  ('PMJAY-OT042GJB', 'for 13 and above days', 'pmjay_transplant', 33000, 33000, 30000, 30000),
  ('PMJAY-OT042GJC', 'for 8-12 days', 'pmjay_transplant', 19800, 19800, 18000, 18000),
  ('PMJAY-OT043GJA', 'for 13 and above Days', 'pmjay_transplant', 143000, 143000, 130000, 130000),
  ('PMJAY-OT043GJB', 'for 3-7 days', 'pmjay_transplant', 42900, 42900, 39000, 39000),
  ('PMJAY-OT043GJC', 'for 8-12 days', 'pmjay_transplant', 85800, 85800, 78000, 78000),
  ('PMJAY-OT044GJA', 'Treatment of Invasive fungal infection after kidney transplant  Include Liposomal Amphotericin 300MG /day(5mg/kg for 60 kg person) for 30 days and Surgical debridement Hospital sta', 'pmjay_transplant', 13200, 13200, 12000, 12000),
  ('PMJAY-OT045GJB', 'Wound exploration for kidney graft nephrectomy', 'pmjay_transplant', 44000, 44000, 40000, 40000),
  ('PMJAY-OT046GJC', 'Yearly HEPATITIS B VIRUS TREATMENT Include ENTECAVIR 0.5 MG OD for 12 months, HBVDNA quantity( 3 time) (Rate per Month)', 'pmjay_transplant', 2420, 2420, 2200, 2200),
  ('PMJAY-SB075GJA', 'Congenital, Accessory digits sometime can be removed', 'pmjay_ortho', 6600, 6600, 6000, 6000),
  ('PMJAY-SB076GJA', 'Clavicle fracture management - conservative', 'pmjay_ortho', 3300, 3300, 3000, 3000),
  ('PMJAY-SB077GJA', 'Close Reduction - Small Joints', 'pmjay_ortho', 4400, 4400, 4000, 4000),
  ('PMJAY-SB078GJA', 'Closed Interlock Nailing + Bone Grafting – femur', 'pmjay_ortho', 20900, 20900, 19000, 19000),
  ('PMJAY-SB080GJA', 'Closed Reduction and Internal Fixation with K wire', 'pmjay_ortho', 6600, 6600, 6000, 6000),
  ('PMJAY-SB084GJA', 'Internal Fixation Lateral Epicondyle', 'pmjay_ortho', 11000, 11000, 10000, 10000),
  ('PMJAY-SB085GJA', 'Sequestrectomy of Long Bones + anti-biotics + dressing', 'pmjay_ortho', 27500, 27500, 25000, 25000),
  ('PMJAY-SB086GJA', 'Tendo Achilles Tenotomy', 'pmjay_ortho', 5500, 5500, 5000, 5000),
  ('PMJAY-SC081GJA', 'Urinary diversion', 'pmjay_surg_oncology', 44000, 44000, 40000, 40000),
  ('PMJAY-SC090GJA', 'Drain Insertion any type', 'pmjay_surg_oncology', 1650, 1650, 1500, 1500),
  ('PMJAY-SC093GJA', 'Inguinal Block Dissection-one side', 'pmjay_surg_oncology', 9614, 9614, 8740, 8740),
  ('PMJAY-SC095GJA', 'Surgery for Ca Ovary - early stage', 'pmjay_surg_oncology', 25300, 25300, 23000, 23000),
  ('PMJAY-SC096GJA', 'Surgery for Ca Ovary - advance stage', 'pmjay_surg_oncology', 44000, 44000, 40000, 40000),
  ('PMJAY-SC097GJA', 'Wide excision for CA Breast', 'pmjay_surg_oncology', 12650, 12650, 11500, 11500),
  ('PMJAY-SC098GJA', 'Decortication', 'pmjay_surg_oncology', 44000, 44000, 40000, 40000),
  ('PMJAY-SC099GJA', 'Laryngopharyngo Oesophagectomy', 'pmjay_surg_oncology', 77000, 77000, 70000, 70000),
  ('PMJAY-SC100GJA', 'Hemimandibulectomy', 'pmjay_surg_oncology', 27500, 27500, 25000, 25000),
  ('PMJAY-SC101GJA', 'Resection with reconstruction for GI System', 'pmjay_surg_oncology', 22770, 22770, 20700, 20700),
  ('PMJAY-SC102GJA', 'Triple Bypass', 'pmjay_surg_oncology', 25300, 25300, 23000, 23000),
  ('PMJAY-SC105GJA', 'Forequarter amputation', 'pmjay_surg_oncology', 33000, 33000, 30000, 30000),
  ('PMJAY-SC106GJA', 'Bone resection', 'pmjay_surg_oncology', 33000, 33000, 30000, 30000),
  ('PMJAY-SC107GJA', 'Nephroureterectomy for Transitional Cell Carcinoma of renal pelvis (one side)', 'pmjay_surg_oncology', 50600, 50600, 46000, 46000),
  ('PMJAY-SC108GJA', 'Retro Peritoneal Lymph Node Dissection(RPLND) (for Residual Disease)', 'pmjay_surg_oncology', 66000, 66000, 60000, 60000),
  ('PMJAY-SC109GJA', 'Retro Peritoneal Lymph Node Dissection RPLND as part of staging', 'pmjay_surg_oncology', 25300, 25300, 23000, 23000),
  ('PMJAY-SC112GJA', 'Suprapubic Cystostomy', 'pmjay_surg_oncology', 11000, 11000, 10000, 10000),
  ('PMJAY-SC114GJA', 'Substernal bypass', 'pmjay_surg_oncology', 38500, 38500, 35000, 35000),
  ('PMJAY-SC115GJA', 'Amputation for bone / soft tissue tumours (Major / Minor)', 'pmjay_surg_oncology', 27500, 27500, 25000, 25000),
  ('PMJAY-SC116GJA', 'Inguinal Block Dissection-both side', 'pmjay_surg_oncology', 17710, 17710, 16100, 16100),
  ('PMJAY-SC119GJA', 'ICD Tube Insertion', 'pmjay_surg_oncology', 1650, 1650, 1500, 1500),
  ('PMJAY-SC120GJA', 'Skin Tumours Wide Excision + Reconstruction', 'pmjay_surg_oncology', 27500, 27500, 25000, 25000),
  ('PMJAY-SC121GJA', 'Skin Tumours Amputation', 'pmjay_surg_oncology', 27500, 27500, 25000, 25000),
  ('PMJAY-SC122GJA', 'Voice prosthesis', 'pmjay_surg_oncology', 33000, 33000, 30000, 30000),
  ('PMJAY-SN064GJA', 'Anterio Lateral Decompression', 'pmjay_neurosurgery', 18975, 18975, 17250, 17250),
  ('PMJAY-SN065GJA', 'Bone flap removal', 'pmjay_neurosurgery', 38500, 38500, 35000, 35000),
  ('PMJAY-SN066GJA', 'Bony tumor of skull', 'pmjay_neurosurgery', 55000, 55000, 50000, 50000),
  ('PMJAY-SN067GJA', 'Posterior (Arnold-Chiary Malformation and others)', 'pmjay_neurosurgery', 77000, 77000, 70000, 70000),
  ('PMJAY-SN068GJA', 'C.S.F. Rhinorrhoea (Transcranial / Transnasal)', 'pmjay_neurosurgery', 82500, 82500, 75000, 75000),
  ('PMJAY-SN070GJA', 'For CCF', 'pmjay_neurosurgery', 33000, 33000, 30000, 30000),
  ('PMJAY-SN070GJB', 'For Giant Aneurysm', 'pmjay_neurosurgery', 33000, 33000, 30000, 30000),
  ('PMJAY-SN073GJA', 'Extradural', 'pmjay_neurosurgery', 56672, 56672, 51520, 51520),
  ('PMJAY-SN075GJA', 'Global (Anterior  and Posterior combine)', 'pmjay_neurosurgery', 99000, 99000, 90000, 90000),
  ('PMJAY-SN075GJB', 'Posterior  Level four', 'pmjay_neurosurgery', 88000, 88000, 80000, 80000),
  ('PMJAY-SN075GJC', 'Posterior  Level three', 'pmjay_neurosurgery', 77000, 77000, 70000, 70000),
  ('PMJAY-SN075GJD', 'Posterior  Level two', 'pmjay_neurosurgery', 66000, 66000, 60000, 60000),
  ('PMJAY-SN076GJA', 'Aqueductoplasty with implant', 'pmjay_neurosurgery', 66000, 66000, 60000, 60000),
  ('PMJAY-SN076GJB', 'Aqueductoplasty without implant', 'pmjay_neurosurgery', 55000, 55000, 50000, 50000),
  ('PMJAY-SN076GJC', 'Cyst Excision', 'pmjay_neurosurgery', 66000, 66000, 60000, 60000),
  ('PMJAY-SN076GJD', 'Diagnostic', 'pmjay_neurosurgery', 33000, 33000, 30000, 30000),
  ('PMJAY-SN076GJE', 'Endoscopic Spine Surgery', 'pmjay_neurosurgery', 44000, 44000, 40000, 40000),
  ('PMJAY-SN076GJF', 'Tumor Excision', 'pmjay_neurosurgery', 66000, 66000, 60000, 60000),
  ('PMJAY-SN078GJA', 'Excision of Brain Tumors – Infratentorial', 'pmjay_neurosurgery', 121000, 121000, 110000, 110000),
  ('PMJAY-SN079GJA', 'Infratentorial tumor with spinal extension', 'pmjay_neurosurgery', 110000, 110000, 100000, 100000),
  ('PMJAY-SN082GJA', 'Cervical', 'pmjay_neurosurgery', 55000, 55000, 50000, 50000),
  ('PMJAY-SN082GJB', 'Dorsal', 'pmjay_neurosurgery', 55000, 55000, 50000, 50000),
  ('PMJAY-SN082GJC', 'Lumber', 'pmjay_neurosurgery', 55000, 55000, 50000, 50000),
  ('PMJAY-SN084GJA', 'MVD', 'pmjay_neurosurgery', 49500, 49500, 45000, 45000),
  ('PMJAY-SN085GJA', 'Posterior Fixation Alone', 'pmjay_neurosurgery', 71500, 71500, 65000, 65000),
  ('PMJAY-SN086GJA', 'Reexploration for debridement / CSF Leak / Hematoma', 'pmjay_neurosurgery', 27500, 27500, 25000, 25000),
  ('PMJAY-SN087GJA', 'Skull base surgery', 'pmjay_neurosurgery', 75900, 75900, 69000, 69000),
  ('PMJAY-SN091GJA', 'Subdural Tapping', 'pmjay_neurosurgery', 18722, 18722, 17020, 17020),
  ('PMJAY-SN092GJA', 'Supratentorial tumor with infratentorial tumour extension', 'pmjay_neurosurgery', 110000, 110000, 100000, 100000),
  ('PMJAY-SN093GJA', 'Transpedicular Biopsy', 'pmjay_neurosurgery', 27500, 27500, 25000, 25000),
  ('PMJAY-SN096GJA', 'Vertebral artery Stenting', 'pmjay_neurosurgery', 66000, 66000, 60000, 60000),
  ('PMJAY-SO097GJA', 'Rupture uterus, closer and repair with tubal ligation', 'pmjay_obgyn', 44275, 44275, 40250, 40250),
  ('PMJAY-SO098GJA', 'Normal delivery', 'pmjay_obgyn', 7700, 7700, 7000, 7000),
  ('PMJAY-SP009GJA', 'Ear Reconstruction for Microtia (stage-I)', 'pmjay_plastic', 31625, 31625, 28750, 28750),
  ('PMJAY-SP009GJB', 'Reconstructive lower limb surgery following infection, Trauma, Tumors / Malignancy, Developmental including diabetic foot – SEVERE', 'pmjay_plastic', 53130, 53130, 48300, 48300),
  ('PMJAY-SS020GJA', 'H- type fistula', 'pmjay_pediatric', 44000, 44000, 40000, 40000),
  ('PMJAY-SS021GJA', '2nd Stage procedure', 'pmjay_pediatric', 27830, 27830, 25300, 25300),
  ('PMJAY-SS022GJA', 'Colostomy, iliostomy / pouchostomy (first stage of male / female ARM, cloaca, pouch colon or hirschsprung diease]', 'pmjay_pediatric', 33000, 33000, 30000, 30000),
  ('PMJAY-SS022GJB', 'Low ARM (male  and female)', 'pmjay_pediatric', 20240, 20240, 18400, 18400),
  ('PMJAY-SS023GJA', 'Biliary Atresia', 'pmjay_pediatric', 50600, 50600, 46000, 46000),
  ('PMJAY-SS025GJA', 'Duodenal atresia- Kimuras duodenoduodenostomy', 'pmjay_pediatric', 52800, 52800, 48000, 48000),
  ('PMJAY-SS026GJA', 'Empyema Thoracis', 'pmjay_pediatric', 44000, 44000, 40000, 40000),
  ('PMJAY-SS027GJA', 'Continent', 'pmjay_pediatric', 44000, 44000, 40000, 40000),
  ('PMJAY-SS027GJB', 'Incontinent (Epispadias repair + BNR)', 'pmjay_pediatric', 56925, 56925, 51750, 51750),
  ('PMJAY-SS028GJA', 'Exomphalos/gastroschisis', 'pmjay_pediatric', 27500, 27500, 25000, 25000),
  ('PMJAY-SS029GJA', 'First stage bladder closure', 'pmjay_pediatric', 110687, 110687, 100625, 100625),
  ('PMJAY-SS029GJB', 'Primary or secondary ureterosigmoidostomy', 'pmjay_pediatric', 94875, 94875, 86250, 86250),
  ('PMJAY-SS029GJC', 'Second stage bladder neck reconstruction', 'pmjay_pediatric', 66000, 66000, 60000, 60000),
  ('PMJAY-SS029GJD', 'Total correction - single stage', 'pmjay_pediatric', 139150, 139150, 126500, 126500),
  ('PMJAY-SS030GJA', 'Hirschsprungs Disease- Single Stage', 'pmjay_pediatric', 66000, 66000, 60000, 60000),
  ('PMJAY-SS031GJA', 'Hydrocephalus in children- Ventriculoperitoneal shunt', 'pmjay_pediatric', 27500, 27500, 25000, 25000),
  ('PMJAY-SS032GJA', '1st Stage procedure', 'pmjay_pediatric', 37950, 37950, 34500, 34500),
  ('PMJAY-SS032GJB', 'Single stage surgery', 'pmjay_pediatric', 37950, 37950, 34500, 34500),
  ('PMJAY-SS033GJA', 'Intermediate  and High variety Stage 1 colostomy', 'pmjay_pediatric', 33000, 33000, 30000, 30000),
  ('PMJAY-SS034GJA', 'Intestinal Atresias  and Obstructions', 'pmjay_pediatric', 50600, 50600, 46000, 46000),
  ('PMJAY-SS035GJA', 'NEC - operative - Exploratory laparotomy + repair of perforation', 'pmjay_pediatric', 52800, 52800, 48000, 48000),
  ('PMJAY-SS036GJA', 'Pure atresia - first stage(‘o’stomy  and ‘G’stomy)', 'pmjay_pediatric', 25300, 25300, 23000, 23000),
  ('PMJAY-SS036GJB', 'Pure atresia - second stage (oesaphageal replacement)', 'pmjay_pediatric', 77000, 77000, 70000, 70000),
  ('PMJAY-SS037GJA', 'Posterior urethral valve - stabilization + cystoscopy + puv fulguration  and or vesicostomy', 'pmjay_pediatric', 33000, 33000, 30000, 30000),
  ('PMJAY-SS040GJA', 'Second stage- PSARVUP/Abdominoperineal Pull through Definitive surgery', 'pmjay_pediatric', 66000, 66000, 60000, 60000),
  ('PMJAY-SS041GJA', 'Second stage-Definitive surgery', 'pmjay_pediatric', 63250, 63250, 57500, 57500),
  ('PMJAY-SS042GJA', 'Single stage PSARP  female ( Rectovestibular fistula/ anovestibular fistula/ vestibular anus etc)', 'pmjay_pediatric', 55000, 55000, 50000, 50000),
  ('PMJAY-SS044GJA', 'Stage three colostomy closure/ Ileostomy closure', 'pmjay_pediatric', 38500, 38500, 35000, 35000),
  ('PMJAY-SS045GJA', 'Stage two PSARP/Abdominoperineal Pull through', 'pmjay_pediatric', 37950, 37950, 34500, 34500),
  ('PMJAY-SS046GJA', 'Third stage- Colostomy / ileostomy closure', 'pmjay_pediatric', 37950, 37950, 34500, 34500),
  ('PMJAY-SS047GJA', 'Tracheo-oesphageal fistula (type c)', 'pmjay_pediatric', 44275, 44275, 40250, 40250),
  ('PMJAY-SS048GJA', 'Vesicoureteric reflux, megaureter- ureteric reimplantation unilateral/bilateral', 'pmjay_pediatric', 44000, 44000, 40000, 40000),
  ('PMJAY-ST011GJA', 'External fixator with soft tissue injury - Large bones', 'pmjay_polytrauma', 55000, 55000, 50000, 50000),
  ('PMJAY-ST012GJA', 'External fixator with soft tissue injury - Small bones', 'pmjay_polytrauma', 55000, 55000, 50000, 50000),
  ('PMJAY-ST013GJA', 'Flap cover Surgery for wound in compound fracture', 'pmjay_polytrauma', 25300, 25300, 23000, 23000),
  ('PMJAY-ST017GJA', 'Prepatellar bursa and repair of MCL of knee', 'pmjay_polytrauma', 63250, 63250, 57500, 57500),
  ('PMJAY-ST019GJA', 'Shoulder Jacket', 'pmjay_polytrauma', 55000, 55000, 50000, 50000),
  ('PMJAY-ST020GJA', 'Surgical Correction of Pelvic bone fractures.', 'pmjay_polytrauma', 44000, 44000, 40000, 40000),
  ('PMJAY-ST024GJA', 'Wound management for compound fracture  (Any grade)', 'pmjay_polytrauma', 33000, 33000, 30000, 30000),
  ('PMJAY-SU100GJA', 'Colostomy  and Suprapubic urinary diversion for pelvix fracture injury', 'pmjay_urology', 25300, 25300, 23000, 23000),
  ('PMJAY-SU101GJA', 'Open', 'pmjay_urology', 37950, 37950, 34500, 34500),
  ('PMJAY-SU103GJA', 'Endoureterotomy (laser/bugbee)', 'pmjay_urology', 22000, 22000, 20000, 20000),
  ('PMJAY-SU105GJA', 'Laparoscopic', 'pmjay_urology', 44275, 44275, 40250, 40250),
  ('PMJAY-SU105GJB', 'Open', 'pmjay_urology', 37950, 37950, 34500, 34500),
  ('PMJAY-SU106GJA', 'Open surgery for Colovesical fistula', 'pmjay_urology', 37950, 37950, 34500, 34500),
  ('PMJAY-SU109GJA', 'With laparoscopy, unilateral', 'pmjay_urology', 33000, 33000, 30000, 30000),
  ('PMJAY-SU111GJA', 'SPC for atony bladder', 'pmjay_urology', 22000, 22000, 20000, 20000),
  ('PMJAY-SU112GJA', 'Laparoscopic', 'pmjay_urology', 33000, 33000, 30000, 30000),
  ('PMJAY-SU112GJB', 'With slings', 'pmjay_urology', 38500, 38500, 35000, 35000),
  ('PMJAY-SU113GJA', 'Open, as an independent procedure', 'pmjay_urology', 11000, 11000, 10000, 10000),
  ('PMJAY-SU121GJA', 'Laparoscopy surgery', 'pmjay_urology', 33000, 33000, 30000, 30000),
  ('PMJAY-SU121GJB', 'Open surgery (exploratory)', 'pmjay_urology', 22000, 22000, 20000, 20000),
  ('PMJAY-SV036GJA', 'Brachio - Radial Bypass with Synthetic Graft', 'pmjay_ctvs', 63250, 63250, 57500, 57500),
  ('PMJAY-SV037GJA', 'Pulmonary Atresia with or without VSD', 'pmjay_ctvs', 107525, 107525, 97750, 97750),
  ('PMJAY-SV038GJA', 'Pulmonary AV Fistula surgery', 'pmjay_ctvs', 25300, 25300, 23000, 23000),
  ('PMJAY-SV039GJA', 'Oesophageal Diverticula /Achalasia Cardia', 'pmjay_ctvs', 25300, 25300, 23000, 23000),
  ('PMJAY-SV040GJA', 'Pulmonary artero venous malformation', 'pmjay_ctvs', 44000, 44000, 40000, 40000),
  ('PMJAY-SV041GJA', 'Operations for Stenosis of Renal Arteries', 'pmjay_ctvs', 25300, 25300, 23000, 23000),
  ('PMJAY-SV043GJA', 'Re DO', 'pmjay_ctvs', 178640, 178640, 162400, 162400),
  ('PMJAY-SV043GJB', 'with post MI VSD repair', 'pmjay_ctvs', 109423, 109423, 99475, 99475),
  ('PMJAY-SV044GJA', 'Coarctation Repair with graft', 'pmjay_ctvs', 40480, 40480, 36800, 36800),
  ('PMJAY-SV045GJA', 'Congenital Cystic Lesions/ Cystic Hygroma', 'pmjay_ctvs', 33000, 33000, 30000, 30000),
  ('PMJAY-SV046GJA', 'Diaphragmatic Eventeration', 'pmjay_ctvs', 50600, 50600, 46000, 46000),
  ('PMJAY-SV046GJB', 'Diaphragmatic Hernia', 'pmjay_ctvs', 44000, 44000, 40000, 40000),
  ('PMJAY-SV047GJA', 'with CPB (inclu. Graft)', 'pmjay_ctvs', 103730, 103730, 94300, 94300),
  ('PMJAY-SV047GJB', 'without CPB (incl. graft)', 'pmjay_ctvs', 94875, 94875, 86250, 86250),
  ('PMJAY-SV048GJA', 'Encysted Empyema/Pleural Effusion - Tubercular', 'pmjay_ctvs', 11000, 11000, 10000, 10000),
  ('PMJAY-SV049GJA', 'Large', 'pmjay_ctvs', 63250, 63250, 57500, 57500),
  ('PMJAY-SV049GJB', 'Small', 'pmjay_ctvs', 33000, 33000, 30000, 30000),
  ('PMJAY-SV050GJA', 'First rib Excision by transaxillary approach, Excision of cervical rib / fibrous band / muscle by cervical approach', 'pmjay_ctvs', 33000, 33000, 30000, 30000),
  ('PMJAY-SV051GJA', 'Lobectomy', 'pmjay_ctvs', 37950, 37950, 34500, 34500),
  ('PMJAY-SV052GJA', 'Lung Injury repair', 'pmjay_ctvs', 25300, 25300, 23000, 23000),
  ('PMJAY-SV054GJA', 'Peripheral Embolectomy without graft', 'pmjay_ctvs', 18975, 18975, 17250, 17250),
  ('PMJAY-SV055GJA', 'Pleurectomy', 'pmjay_ctvs', 50600, 50600, 46000, 46000),
  ('PMJAY-SV056GJA', 'Pneumonectomy', 'pmjay_ctvs', 50600, 50600, 46000, 46000),
  ('PMJAY-SV057GJA', 'Pulmonary Conduit', 'pmjay_ctvs', 115500, 115500, 105000, 105000),
  ('PMJAY-SV058GJA', 'Pulmonary Valve Replacement', 'pmjay_ctvs', 132000, 132000, 120000, 120000),
  ('PMJAY-SV059GJA', 'Pulmonary Valvotomy + RVOT Resection', 'pmjay_ctvs', 99935, 99935, 90850, 90850),
  ('PMJAY-SV061GJA', 'Surgery with CPB', 'pmjay_ctvs', 63250, 63250, 57500, 57500),
  ('PMJAY-SV061GJB', 'Surgery without CPB', 'pmjay_ctvs', 63250, 63250, 57500, 57500),
  ('PMJAY-SV064GJA', 'Thyomectomy', 'pmjay_ctvs', 31625, 31625, 28750, 28750),
  ('PMJAY-SV065GJA', 'Major Vessels', 'pmjay_ctvs', 25300, 25300, 23000, 23000),
  ('PMJAY-SV065GJB', 'Minor Vessels', 'pmjay_ctvs', 22000, 22000, 20000, 20000),
  ('PMJAY-SV066GJA', 'Vascular Tumors', 'pmjay_ctvs', 50600, 50600, 46000, 46000),
  ('PMJAY-New Added (removed by NHA in 1991)', 'Pre-mature delivery', 'pmjay_obgyn', 12650, 12650, 11500, 11500),
  ('PMJAY-New Added', 'FISTULECTOMY for Low anal Fistula (Inculding dressing and post operative Infection t/t)', 'pmjay_gen_surgery', 16500, 16500, 15000, 15000),
  ('PMJAY-OT048GJA', 'Heart  transplant', 'pmjay_ctvs', 990000, 990000, 900000, 900000),
  ('PMJAY-OT049GJA', 'UTERINE TRANSPLANT', 'pmjay_transplant', 396000, 396000, 360000, 360000),
  ('PMJAY-IN002', 'Spinal AVM embolization - Using Histoacryl 
(per sitting)', 'pmjay_ent', 110000, 110000, 100000, 100000),
  ('PMJAY-MO003', 'Liposomal Doxorubicin  and Gemcitabine', 'pmjay_med_oncology', 15180, 15180, 13800, 13800),
  ('PMJAY-MO014', 'Monthly 5-FU', 'pmjay_med_oncology', 6325, 6325, 5750, 5750),
  ('PMJAY-MO021', 'Tenozolamide, Procarbazine, CCNU, Vincristine', 'pmjay_med_oncology', 19228, 19228, 17480, 17480),
  ('PMJAY-MO024', 'CISPLATIN + MTX', 'pmjay_med_oncology', 5060, 5060, 4600, 4600),
  ('PMJAY-MO028', 'Docetaxol + steriods with G-CSF', 'pmjay_med_oncology', 20240, 20240, 18400, 18400),
  ('PMJAY-MO044', 'Imatinib, Nilotinib, Dasatinib Allogeneic stem cell Transplant', 'pmjay_med_oncology', 5060, 5060, 4600, 4600),
  ('PMJAY-SB027', 'Hip  and Knee Disarticulation', 'pmjay_surg_oncology', 49500, 49500, 45000, 45000),
  ('PMJAY-SC024', 'Open with mainz 2 pouch - Radical', 'pmjay_urology', 63250, 63250, 57500, 57500),
  ('PMJAY-SN037', 'Surgery for Spinal Canal Stenosis', 'pmjay_neurosurgery', 44000, 44000, 40000, 40000),
  ('PMJAY-SN038', 'Spine - Decompression & Fusion with fixation', 'pmjay_neurosurgery', 44000, 44000, 40000, 40000),
  ('PMJAY-SN040', 'Spine - Intradural  Haematoma with fixation', 'pmjay_neurosurgery', 44000, 44000, 40000, 40000),
  ('PMJAY-SO001', 'Lap. Salpingo-oophrectomy', 'pmjay_obgyn', 15400, 15400, 14000, 14000),
  ('PMJAY-SO058', 'Re exploration after laparotomy', 'pmjay_obgyn', 15400, 15400, 14000, 14000),
  ('PMJAY-SU002', 'Lap.', 'pmjay_pediatric', 27500, 27500, 25000, 25000),
  ('PMJAY-SU042', 'Diagnostic Cystoscopy', 'pmjay_pediatric', 7150, 7150, 6500, 6500),
  ('PMJAY-SU053', 'Y V Plasty of Bladder Neck / Bladder Neck Reconstruction', 'pmjay_pediatric', 25300, 25300, 23000, 23000),
  ('PMJAY-SU079', 'Holmium Laser Prostatectomy', 'pmjay_urology', 44000, 44000, 40000, 40000),
  ('PMJAY-SU122GJA', 'Surgical intervention with Robot', 'pmjay_surg_oncology', 101200, 101200, 2000, 2000)
) AS v(service_code, service_name, category, rate_self, rate_insurance, rate_pmjay, rate_cghs)
WHERE c.code = 'SHJ' OR c.name ILIKE '%shilaj%'
ON CONFLICT (centre_id, service_code) DO UPDATE SET
  service_name = EXCLUDED.service_name, category = EXCLUDED.category,
  rate_self = EXCLUDED.rate_self, rate_insurance = EXCLUDED.rate_insurance,
  rate_pmjay = EXCLUDED.rate_pmjay, rate_cghs = EXCLUDED.rate_cghs, is_active = EXCLUDED.is_active;
