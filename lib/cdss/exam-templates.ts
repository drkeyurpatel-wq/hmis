// lib/cdss/exam-templates.ts
// Examination findings templates organized by system

export interface ExamFinding {
  label: string;
  normal: string;
  abnormalOptions: string[];
}

export interface ExamSystem {
  key: string;
  label: string;
  icon: string;
  findings: ExamFinding[];
}

export const EXAM_SYSTEMS: ExamSystem[] = [
  {
    key: 'general',
    label: 'General',
    icon: '🏥',
    findings: [
      { label: 'Appearance', normal: 'Well-oriented, comfortable', abnormalOptions: ['Ill-looking', 'Toxic', 'Drowsy', 'Restless', 'Pale', 'Icteric', 'Cyanosed', 'Dehydrated', 'Cachetic'] },
      { label: 'Built', normal: 'Average built, well-nourished', abnormalOptions: ['Thin built', 'Obese', 'Malnourished', 'Muscular wasting'] },
      { label: 'Pallor', normal: 'No pallor', abnormalOptions: ['Mild pallor', 'Moderate pallor', 'Severe pallor'] },
      { label: 'Icterus', normal: 'No icterus', abnormalOptions: ['Mild icterus', 'Moderate icterus', 'Deep icterus'] },
      { label: 'Cyanosis', normal: 'No cyanosis', abnormalOptions: ['Peripheral cyanosis', 'Central cyanosis'] },
      { label: 'Clubbing', normal: 'No clubbing', abnormalOptions: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4'] },
      { label: 'Edema', normal: 'No edema', abnormalOptions: ['Pedal edema +', 'Pedal edema ++', 'Pedal edema +++', 'Pitting edema', 'Anasarca', 'Facial puffiness'] },
      { label: 'Lymphadenopathy', normal: 'No lymphadenopathy', abnormalOptions: ['Cervical', 'Axillary', 'Inguinal', 'Generalized', 'Supraclavicular'] },
      { label: 'JVP', normal: 'JVP not raised', abnormalOptions: ['JVP raised', 'JVP elevated 4cm above sternal angle'] },
    ]
  },
  {
    key: 'cvs',
    label: 'Cardiovascular',
    icon: '❤️',
    findings: [
      { label: 'Pulse', normal: 'Regular, normal volume, no radio-radial/radio-femoral delay', abnormalOptions: ['Irregularly irregular', 'Regularly irregular', 'Tachycardia', 'Bradycardia', 'Low volume', 'Bounding', 'Pulsus paradoxus', 'Radio-femoral delay'] },
      { label: 'Heart Sounds', normal: 'S1S2 normal, no murmurs', abnormalOptions: ['Loud S1', 'Soft S1', 'Loud S2', 'S3 gallop', 'S4 gallop', 'Opening snap'] },
      { label: 'Murmur', normal: 'No murmur', abnormalOptions: ['Systolic murmur — apex', 'Systolic murmur — aortic area', 'Diastolic murmur — mitral area', 'Pan-systolic murmur', 'Ejection systolic murmur', 'Continuous murmur'] },
      { label: 'Apex Beat', normal: 'Apex beat in 5th ICS, MCL', abnormalOptions: ['Displaced laterally', 'Displaced inferiorly', 'Heaving', 'Tapping', 'Not palpable'] },
      { label: 'Peripheral Pulses', normal: 'All peripheral pulses palpable', abnormalOptions: ['Dorsalis pedis absent', 'Posterior tibial absent', 'Radial weak', 'Femoral absent'] },
      { label: 'Carotid Bruit', normal: 'No carotid bruit', abnormalOptions: ['Left carotid bruit', 'Right carotid bruit', 'Bilateral carotid bruit'] },
    ]
  },
  {
    key: 'rs',
    label: 'Respiratory',
    icon: '🫁',
    findings: [
      { label: 'Respiratory Rate', normal: 'RR 16-20/min, regular', abnormalOptions: ['Tachypnea', 'Bradypnea', 'Cheyne-Stokes', 'Kussmaul', 'Accessory muscles in use'] },
      { label: 'Trachea', normal: 'Central, no tug', abnormalOptions: ['Deviated to right', 'Deviated to left', 'Tracheal tug present'] },
      { label: 'Chest Expansion', normal: 'Bilateral equal expansion', abnormalOptions: ['Reduced on right', 'Reduced on left', 'Bilaterally reduced'] },
      { label: 'Percussion', normal: 'Resonant bilaterally', abnormalOptions: ['Dull right base', 'Dull left base', 'Stony dull right', 'Stony dull left', 'Hyper-resonant right', 'Hyper-resonant left'] },
      { label: 'Breath Sounds', normal: 'Bilateral equal vesicular breath sounds', abnormalOptions: ['Reduced right base', 'Reduced left base', 'Bronchial breathing right', 'Bronchial breathing left', 'Absent right', 'Absent left'] },
      { label: 'Added Sounds', normal: 'No added sounds', abnormalOptions: ['Wheeze bilateral', 'Wheeze right', 'Wheeze left', 'Crepitations right base', 'Crepitations left base', 'Crepitations bilateral', 'Rhonchi', 'Pleural rub right', 'Pleural rub left', 'Stridor'] },
      { label: 'Vocal Resonance', normal: 'Normal vocal resonance', abnormalOptions: ['Increased right', 'Increased left', 'Decreased right', 'Decreased left'] },
    ]
  },
  {
    key: 'pa',
    label: 'Per Abdomen',
    icon: '🫃',
    findings: [
      { label: 'Shape', normal: 'Soft, flat, non-tender', abnormalOptions: ['Distended', 'Scaphoid', 'Tense', 'Visible peristalsis', 'Visible veins (caput medusae)'] },
      { label: 'Tenderness', normal: 'No tenderness', abnormalOptions: ['RUQ tenderness', 'LUQ tenderness', 'RLQ tenderness', 'LLQ tenderness', 'Epigastric tenderness', 'Suprapubic tenderness', 'Diffuse tenderness', 'Rebound tenderness', 'Guarding', 'Rigidity'] },
      { label: 'Liver', normal: 'Liver not palpable', abnormalOptions: ['Hepatomegaly 2cm BCM', 'Hepatomegaly 4cm BCM', 'Tender hepatomegaly', 'Firm liver', 'Hard nodular liver'] },
      { label: 'Spleen', normal: 'Spleen not palpable', abnormalOptions: ['Splenomegaly — just palpable', 'Splenomegaly — moderate', 'Massive splenomegaly'] },
      { label: 'Bowel Sounds', normal: 'Bowel sounds present and normal', abnormalOptions: ['Hyperactive', 'Hypoactive', 'Absent', 'Metallic tinkling'] },
      { label: 'Free Fluid', normal: 'No free fluid clinically', abnormalOptions: ['Shifting dullness positive', 'Fluid thrill positive', 'Mild ascites'] },
      { label: 'Hernial Orifices', normal: 'Hernial orifices intact', abnormalOptions: ['Right inguinal hernia', 'Left inguinal hernia', 'Umbilical hernia', 'Incisional hernia'] },
    ]
  },
  {
    key: 'cns',
    label: 'Neurological',
    icon: '🧠',
    findings: [
      { label: 'Consciousness', normal: 'Conscious, alert, oriented ×3', abnormalOptions: ['Drowsy', 'Confused', 'Stuporous', 'Comatose', 'GCS 15/15', 'GCS 14/15', 'GCS 13/15', 'GCS <8 — intubation needed'] },
      { label: 'Speech', normal: 'Speech fluent, coherent', abnormalOptions: ['Dysarthria', 'Aphasia — expressive', 'Aphasia — receptive', 'Aphasia — global', 'Slurred speech'] },
      { label: 'Cranial Nerves', normal: 'Cranial nerves grossly intact', abnormalOptions: ['Facial palsy — UMN type right', 'Facial palsy — UMN type left', 'Facial palsy — LMN type right', 'Facial palsy — LMN type left', 'Pupil — RAPD right', 'Pupil — RAPD left', 'Diplopia', 'Nystagmus', 'Tongue deviation', 'Palatal palsy'] },
      { label: 'Motor — Upper Limb', normal: 'Power 5/5 bilateral upper limbs', abnormalOptions: ['Right UL weakness 4/5', 'Right UL weakness 3/5', 'Right UL weakness 0/5', 'Left UL weakness 4/5', 'Left UL weakness 3/5', 'Left UL weakness 0/5', 'Bilateral UL weakness'] },
      { label: 'Motor — Lower Limb', normal: 'Power 5/5 bilateral lower limbs', abnormalOptions: ['Right LL weakness 4/5', 'Right LL weakness 3/5', 'Right LL weakness 0/5', 'Left LL weakness 4/5', 'Left LL weakness 3/5', 'Left LL weakness 0/5', 'Bilateral LL weakness'] },
      { label: 'Tone', normal: 'Tone normal all limbs', abnormalOptions: ['Spasticity — right side', 'Spasticity — left side', 'Rigidity — cogwheel', 'Rigidity — lead pipe', 'Hypotonia', 'Bilateral spasticity'] },
      { label: 'Reflexes', normal: 'Deep tendon reflexes 2+ symmetric', abnormalOptions: ['Hyperreflexia right', 'Hyperreflexia left', 'Hyporeflexia', 'Areflexia', 'Babinski positive right', 'Babinski positive left', 'Ankle clonus'] },
      { label: 'Sensory', normal: 'Sensory exam grossly intact', abnormalOptions: ['Reduced sensation right side', 'Reduced sensation left side', 'Glove-stocking pattern loss', 'Dermatomal sensory loss', 'Loss of proprioception'] },
      { label: 'Cerebellar', normal: 'No cerebellar signs', abnormalOptions: ['Finger-nose ataxia', 'Heel-shin ataxia', 'Dysdiadochokinesia', 'Intention tremor', 'Gait ataxia', 'Romberg positive'] },
      { label: 'Gait', normal: 'Gait normal', abnormalOptions: ['Hemiplegic gait', 'Spastic gait', 'Ataxic gait', 'Parkinsonian gait', 'Steppage gait', 'Waddling gait', 'Unable to walk'] },
    ]
  },
  {
    key: 'msk',
    label: 'Musculoskeletal',
    icon: '🦴',
    findings: [
      { label: 'Posture', normal: 'Normal posture, no deformity', abnormalOptions: ['Kyphosis', 'Scoliosis', 'Lordosis', 'Antalgic posture'] },
      { label: 'Spine', normal: 'Spine — non-tender, full ROM', abnormalOptions: ['Cervical tenderness', 'Thoracic tenderness', 'Lumbar tenderness', 'Restricted flexion', 'Restricted extension', 'SLR positive right', 'SLR positive left', 'SLR positive bilateral', 'Paraspinal spasm'] },
      { label: 'Joints', normal: 'No joint swelling or deformity', abnormalOptions: ['Knee effusion right', 'Knee effusion left', 'Knee crepitus', 'Hip — restricted ROM', 'Shoulder — restricted ROM', 'Small joint swelling hands', 'Heberden nodes', 'Bouchard nodes'] },
      { label: 'Muscle', normal: 'No muscle tenderness or wasting', abnormalOptions: ['Quadriceps wasting', 'Calf tenderness', 'Thenar wasting', 'Hypothenar wasting', 'Proximal muscle weakness'] },
    ]
  },
];

export function getExamSystem(key: string): ExamSystem | undefined {
  return EXAM_SYSTEMS.find(s => s.key === key);
}
