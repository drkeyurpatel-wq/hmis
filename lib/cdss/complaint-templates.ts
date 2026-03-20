// lib/cdss/complaint-templates.ts
// 100+ clinical complaint templates with structured follow-up questions
// Covers: Cardio, Neuro, Resp, GI, Renal, Ortho, ENT, Ophth, Derm, Psych, OB-GYN, Peds, Endo, General

export interface AttributeDef {
  label: string;
  type: 'chips' | 'scale' | 'duration' | 'text';
  options?: string[];
  multi?: boolean;
}

export interface ComplaintTemplate {
  name: string;
  category: string;
  aliases: string[];
  attributes: Record<string, AttributeDef>;
}

export const COMPLAINT_TEMPLATES: ComplaintTemplate[] = [
  // ============================================================
  // CARDIOVASCULAR (8)
  // ============================================================
  { name: 'Chest Pain', category: 'Cardiovascular', aliases: ['chest discomfort', 'angina', 'chest heaviness'],
    attributes: {
      type: { label: 'Type', type: 'chips', options: ['Burning', 'Squeezing', 'Stabbing', 'Pressure-like', 'Heaviness', 'Dull ache', 'Pricking', 'Tearing'] },
      location: { label: 'Location', type: 'chips', options: ['Retrosternal', 'Left-sided', 'Right-sided', 'Precordial', 'Diffuse', 'Epigastric', 'Lateral chest wall'] },
      radiation: { label: 'Radiation', type: 'chips', options: ['Left arm', 'Right arm', 'Both arms', 'Jaw', 'Back', 'Neck', 'Shoulder', 'Interscapular', 'No radiation'], multi: true },
      severity: { label: 'Severity (1-10)', type: 'scale' },
      onset: { label: 'Onset', type: 'chips', options: ['Sudden', 'Gradual', 'At rest', 'On exertion', 'Post-prandial', 'Nocturnal', 'Positional'] },
      duration: { label: 'Duration', type: 'duration' },
      aggravating: { label: 'Aggravating', type: 'chips', options: ['Exertion', 'Deep breathing', 'Lying flat', 'Eating', 'Stress', 'Cold weather', 'Arm movement'], multi: true },
      relieving: { label: 'Relieving', type: 'chips', options: ['Rest', 'Sorbitrate SL', 'Sitting up', 'Antacids', 'Leaning forward', 'Nothing'], multi: true },
      associated: { label: 'Associated symptoms', type: 'chips', options: ['Sweating', 'Breathlessness', 'Nausea', 'Vomiting', 'Palpitations', 'Giddiness', 'Syncope', 'Cough', 'Hemoptysis'], multi: true },
    }},
  { name: 'Palpitations', category: 'Cardiovascular', aliases: ['heart racing', 'heart pounding', 'skipping beats'],
    attributes: {
      pattern: { label: 'Pattern', type: 'chips', options: ['Regular fast', 'Irregular', 'Skipping beats', 'Fluttering', 'Pounding', 'Racing then stopping'] },
      onset: { label: 'Onset', type: 'chips', options: ['Sudden', 'Gradual', 'At rest', 'On exertion', 'After caffeine', 'After meals', 'During sleep'] },
      duration: { label: 'Duration', type: 'duration' },
      frequency: { label: 'Frequency', type: 'chips', options: ['First time', 'Daily', 'Weekly', 'Monthly', 'Episodic'] },
      severity: { label: 'Severity', type: 'scale' },
      associated: { label: 'Associated', type: 'chips', options: ['Chest pain', 'Breathlessness', 'Giddiness', 'Syncope', 'Sweating', 'Anxiety', 'Neck pulsations'], multi: true },
      triggers: { label: 'Triggers', type: 'chips', options: ['Exercise', 'Caffeine', 'Alcohol', 'Stress', 'Sleep deprivation', 'Medications', 'None identifiable'], multi: true },
    }},
  { name: 'Syncope', category: 'Cardiovascular', aliases: ['fainting', 'blackout', 'loss of consciousness'],
    attributes: {
      type: { label: 'Type', type: 'chips', options: ['Complete LOC', 'Near-syncope', 'Pre-syncopal', 'Drop attack'] },
      prodrome: { label: 'Warning signs', type: 'chips', options: ['Lightheadedness', 'Visual dimming', 'Sweating', 'Nausea', 'Tunnel vision', 'No warning'], multi: true },
      position: { label: 'Position when occurred', type: 'chips', options: ['Standing', 'Sitting', 'Lying', 'On exertion', 'After standing up', 'During micturition'] },
      duration_loc: { label: 'Duration of LOC', type: 'chips', options: ['Seconds', '< 1 minute', '1-5 minutes', '> 5 minutes'] },
      recovery: { label: 'Recovery', type: 'chips', options: ['Immediate', 'Gradual', 'Confused after', 'Sleepy after', 'Headache after'] },
      associated: { label: 'Associated', type: 'chips', options: ['Chest pain', 'Palpitations', 'Seizure activity', 'Tongue bite', 'Incontinence', 'Injury from fall'], multi: true },
      frequency: { label: 'Episodes', type: 'chips', options: ['First episode', 'Recurrent', 'Multiple today'] },
    }},
  { name: 'Pedal Oedema', category: 'Cardiovascular', aliases: ['leg swelling', 'ankle swelling', 'foot swelling'],
    attributes: {
      laterality: { label: 'Side', type: 'chips', options: ['Bilateral', 'Left only', 'Right only', 'Alternating'] },
      onset: { label: 'Onset', type: 'chips', options: ['Gradual', 'Sudden', 'Progressive over days', 'Progressive over weeks'] },
      timing: { label: 'Timing', type: 'chips', options: ['Evening worse', 'Morning worse', 'Constant', 'After prolonged standing'] },
      pitting: { label: 'Nature', type: 'chips', options: ['Pitting', 'Non-pitting', 'Tender', 'Non-tender', 'Warm', 'Cold'] },
      extent: { label: 'Extent', type: 'chips', options: ['Ankle only', 'Up to knee', 'Up to thigh', 'Sacral also', 'Facial also', 'Generalized'] },
      associated: { label: 'Associated', type: 'chips', options: ['Breathlessness', 'Orthopnea', 'PND', 'Reduced urine', 'Abdominal distension', 'Weight gain', 'Calf pain'], multi: true },
    }},
  { name: 'Claudication', category: 'Cardiovascular', aliases: ['leg pain on walking', 'calf pain walking'],
    attributes: {
      location: { label: 'Location', type: 'chips', options: ['Calf', 'Thigh', 'Buttock', 'Foot', 'Bilateral'] },
      distance: { label: 'Walking distance', type: 'chips', options: ['< 50m', '50-100m', '100-200m', '200-500m', '> 500m'] },
      relieving: { label: 'Relief', type: 'chips', options: ['Rest (within 5 min)', 'Leaning forward', 'Sitting down', 'Does not relieve'] },
      associated: { label: 'Associated', type: 'chips', options: ['Rest pain', 'Night pain', 'Skin changes', 'Non-healing ulcer', 'Cold extremity', 'Numbness'], multi: true },
    }},
  { name: 'Varicose Veins', category: 'Cardiovascular', aliases: ['prominent leg veins', 'bulging veins'],
    attributes: {
      location: { label: 'Location', type: 'chips', options: ['Left leg', 'Right leg', 'Bilateral', 'Long saphenous', 'Short saphenous'] },
      symptoms: { label: 'Symptoms', type: 'chips', options: ['Pain', 'Heaviness', 'Itching', 'Cramps', 'Swelling', 'Cosmetic concern only'], multi: true },
      complications: { label: 'Complications', type: 'chips', options: ['Skin pigmentation', 'Eczema', 'Ulcer', 'Bleeding', 'Thrombophlebitis', 'None'], multi: true },
      duration: { label: 'Duration', type: 'duration' },
    }},
  { name: 'Hypertension Symptoms', category: 'Cardiovascular', aliases: ['high BP symptoms', 'BP headache'],
    attributes: {
      symptoms: { label: 'Symptoms', type: 'chips', options: ['Headache', 'Giddiness', 'Blurred vision', 'Nosebleed', 'Chest pain', 'Breathlessness', 'Asymptomatic'], multi: true },
      known_htn: { label: 'Known HTN', type: 'chips', options: ['New diagnosis', 'Known - on treatment', 'Known - not on treatment', 'Gestational'] },
      compliance: { label: 'Medication compliance', type: 'chips', options: ['Regular', 'Irregular', 'Stopped', 'Never started', 'Not applicable'] },
      last_bp: { label: 'Last known BP', type: 'text' },
    }},
  { name: 'DVT Symptoms', category: 'Cardiovascular', aliases: ['deep vein thrombosis', 'leg clot'],
    attributes: {
      side: { label: 'Side', type: 'chips', options: ['Left', 'Right', 'Bilateral'] },
      symptoms: { label: 'Symptoms', type: 'chips', options: ['Calf pain', 'Swelling', 'Warmth', 'Redness', 'Tenderness', 'Calf hardness'], multi: true },
      risk_factors: { label: 'Risk factors', type: 'chips', options: ['Recent surgery', 'Immobilization', 'Long travel', 'Pregnancy', 'OCP use', 'Cancer', 'Previous DVT', 'None'], multi: true },
      onset: { label: 'Onset', type: 'chips', options: ['Sudden', 'Gradual over hours', 'Gradual over days'] },
    }},

  // ============================================================
  // NEUROLOGY (12)
  // ============================================================
  { name: 'Headache', category: 'Neurology', aliases: ['head pain', 'cephalalgia', 'migraine'],
    attributes: {
      type: { label: 'Type', type: 'chips', options: ['Throbbing', 'Pressure', 'Sharp', 'Dull', 'Band-like', 'Pulsating', 'Thunderclap', 'Boring'] },
      location: { label: 'Location', type: 'chips', options: ['Frontal', 'Temporal', 'Occipital', 'Vertex', 'Hemi-cranial (L)', 'Hemi-cranial (R)', 'Diffuse', 'Retro-orbital', 'Suboccipital'] },
      severity: { label: 'Severity (1-10)', type: 'scale' },
      onset: { label: 'Onset', type: 'chips', options: ['Sudden', 'Gradual', 'Morning', 'Evening', 'With activity', 'Post-trauma', 'Worst-ever'] },
      duration: { label: 'Duration', type: 'duration' },
      frequency: { label: 'Frequency', type: 'chips', options: ['First episode', 'Episodic', 'Daily', 'Chronic (>15 days/month)', 'Cluster pattern'] },
      aggravating: { label: 'Aggravating', type: 'chips', options: ['Light', 'Noise', 'Coughing', 'Straining', 'Bending forward', 'Screen time', 'Stress', 'Menstruation'], multi: true },
      relieving: { label: 'Relieving', type: 'chips', options: ['Rest', 'Sleep', 'Dark room', 'Paracetamol', 'Triptans', 'Pressure on temple', 'Nothing'], multi: true },
      associated: { label: 'Associated', type: 'chips', options: ['Nausea', 'Vomiting', 'Photophobia', 'Phonophobia', 'Aura', 'Visual disturbance', 'Neck stiffness', 'Fever', 'Seizure', 'Focal deficit', 'Papilloedema'], multi: true },
      red_flags: { label: 'Red flags', type: 'chips', options: ['Worst-ever headache', 'New onset >50yrs', 'Progressive worsening', 'Focal signs', 'Papilloedema', 'Post-trauma', 'Immunosuppressed', 'None'], multi: true },
    }},
  { name: 'Seizure', category: 'Neurology', aliases: ['convulsion', 'fit', 'epilepsy attack'],
    attributes: {
      type: { label: 'Type', type: 'chips', options: ['Generalized tonic-clonic', 'Focal aware', 'Focal impaired awareness', 'Absence', 'Myoclonic', 'Atonic', 'Unknown'] },
      aura: { label: 'Aura/Warning', type: 'chips', options: ['Deja vu', 'Epigastric rising', 'Visual', 'Olfactory', 'Tingling', 'Fear', 'No aura'] },
      duration: { label: 'Duration of episode', type: 'chips', options: ['< 1 min', '1-5 min', '5-15 min', '> 15 min (status)', 'Unknown'] },
      post_ictal: { label: 'Post-ictal', type: 'chips', options: ['Confusion', 'Drowsiness', 'Todd paralysis', 'Headache', 'Rapid recovery'], multi: true },
      tongue_bite: { label: 'Tongue bite', type: 'chips', options: ['Yes - lateral', 'Yes - tip', 'No', 'Unknown'] },
      incontinence: { label: 'Incontinence', type: 'chips', options: ['Urinary', 'Fecal', 'None', 'Unknown'] },
      triggers: { label: 'Triggers', type: 'chips', options: ['Sleep deprivation', 'Alcohol', 'Flashing lights', 'Stress', 'Fever', 'Medication non-compliance', 'None'], multi: true },
      known_epilepsy: { label: 'Known epilepsy', type: 'chips', options: ['New onset', 'Known - on AEDs', 'Known - stopped AEDs', 'Febrile seizure'] },
      frequency: { label: 'Frequency', type: 'chips', options: ['First episode', 'Rare (<1/year)', 'Monthly', 'Weekly', 'Daily'] },
    }},
  { name: 'Weakness / Paralysis', category: 'Neurology', aliases: ['hemiparesis', 'paraplegia', 'quadriplegia', 'motor deficit'],
    attributes: {
      distribution: { label: 'Distribution', type: 'chips', options: ['Right hemiplegia', 'Left hemiplegia', 'Paraplegia', 'Quadriplegia', 'Monoplegia (arm)', 'Monoplegia (leg)', 'Facial only'] },
      onset: { label: 'Onset', type: 'chips', options: ['Sudden (stroke-like)', 'Gradual over hours', 'Gradual over days', 'Progressive over weeks', 'Fluctuating'] },
      severity: { label: 'Severity', type: 'chips', options: ['Complete paralysis', 'Severe weakness', 'Moderate weakness', 'Mild weakness'] },
      associated: { label: 'Associated', type: 'chips', options: ['Speech difficulty', 'Facial droop', 'Vision loss', 'Numbness', 'Headache', 'Seizure', 'Bowel/bladder involvement', 'Neck pain', 'Back pain'], multi: true },
      progression: { label: 'Progression', type: 'chips', options: ['Static', 'Improving', 'Worsening', 'Fluctuating'] },
    }},
  { name: 'Numbness / Tingling', category: 'Neurology', aliases: ['paraesthesia', 'pins and needles', 'loss of sensation'],
    attributes: {
      distribution: { label: 'Distribution', type: 'chips', options: ['Hands (glove)', 'Feet (stocking)', 'Glove & stocking', 'Dermatomal', 'Half body', 'Facial', 'Perioral'] },
      type: { label: 'Type', type: 'chips', options: ['Tingling', 'Numbness', 'Burning', 'Electric shock', 'Crawling sensation', 'Loss of sensation'] },
      onset: { label: 'Onset', type: 'chips', options: ['Sudden', 'Gradual', 'Progressive', 'Intermittent'] },
      duration: { label: 'Duration', type: 'duration' },
      associated: { label: 'Associated', type: 'chips', options: ['Weakness', 'Pain', 'Balance problems', 'Bladder issues', 'Neck/back pain'], multi: true },
    }},
  { name: 'Giddiness / Vertigo', category: 'Neurology', aliases: ['dizziness', 'room spinning', 'unsteadiness', 'lightheadedness'],
    attributes: {
      type: { label: 'Type', type: 'chips', options: ['True vertigo (room spinning)', 'Lightheadedness', 'Unsteadiness', 'Presyncope', 'Imbalance'] },
      onset: { label: 'Onset', type: 'chips', options: ['Sudden', 'Gradual', 'Positional', 'On standing', 'Constant'] },
      duration: { label: 'Duration per episode', type: 'chips', options: ['Seconds', 'Minutes', 'Hours', 'Days', 'Constant'] },
      triggers: { label: 'Triggers', type: 'chips', options: ['Head turning', 'Lying down', 'Getting up', 'Looking up', 'Walking', 'No trigger'], multi: true },
      associated: { label: 'Associated', type: 'chips', options: ['Nausea', 'Vomiting', 'Hearing loss', 'Tinnitus', 'Ear fullness', 'Headache', 'Nystagmus', 'Falls'], multi: true },
      severity: { label: 'Severity', type: 'scale' },
    }},
  { name: 'Tremor', category: 'Neurology', aliases: ['shaking', 'hand tremor', 'trembling'],
    attributes: {
      type: { label: 'Type', type: 'chips', options: ['Resting', 'Action/postural', 'Intention', 'Task-specific (writing)'] },
      location: { label: 'Location', type: 'chips', options: ['Hands', 'Head', 'Voice', 'Jaw/chin', 'Legs', 'Generalized'], multi: true },
      laterality: { label: 'Side', type: 'chips', options: ['Right dominant', 'Left dominant', 'Bilateral symmetric', 'Bilateral asymmetric'] },
      onset: { label: 'Onset', type: 'chips', options: ['Gradual over months', 'Gradual over years', 'Sudden', 'After medication'] },
      associated: { label: 'Associated', type: 'chips', options: ['Rigidity', 'Slow movement', 'Balance problems', 'Small handwriting', 'Soft voice', 'Family history'], multi: true },
    }},
  { name: 'Memory Loss', category: 'Neurology', aliases: ['forgetfulness', 'cognitive decline', 'dementia symptoms'],
    attributes: {
      onset: { label: 'Onset', type: 'chips', options: ['Gradual over months', 'Gradual over years', 'Sudden', 'Step-wise decline', 'After event/illness'] },
      type: { label: 'Type', type: 'chips', options: ['Recent memory', 'Remote memory', 'Word-finding difficulty', 'Getting lost', 'Repeating questions', 'Forgetting appointments'] },
      impact: { label: 'Impact on daily life', type: 'chips', options: ['No impact', 'Mild - needs reminders', 'Moderate - needs help with tasks', 'Severe - cannot be left alone'] },
      associated: { label: 'Associated', type: 'chips', options: ['Personality change', 'Depression', 'Sleep disturbance', 'Wandering', 'Hallucinations', 'Incontinence', 'Gait problems'], multi: true },
      progression: { label: 'Progression', type: 'chips', options: ['Stable', 'Slowly worsening', 'Rapidly worsening', 'Fluctuating'] },
    }},
  { name: 'Speech Difficulty', category: 'Neurology', aliases: ['slurred speech', 'aphasia', 'dysarthria', 'difficulty speaking'],
    attributes: {
      type: { label: 'Type', type: 'chips', options: ['Slurred (dysarthria)', 'Cannot find words (expressive)', 'Cannot understand (receptive)', 'Cannot read/write', 'Hoarse voice'] },
      onset: { label: 'Onset', type: 'chips', options: ['Sudden', 'Gradual', 'Episodic', 'Progressive'] },
      duration: { label: 'Duration', type: 'duration' },
      associated: { label: 'Associated', type: 'chips', options: ['Weakness', 'Facial droop', 'Swallowing difficulty', 'Drooling', 'Vision changes', 'Headache'], multi: true },
    }},
  { name: 'Back Pain', category: 'Neurology', aliases: ['backache', 'lumbar pain', 'sciatica', 'lumbago'],
    attributes: {
      location: { label: 'Location', type: 'chips', options: ['Cervical', 'Thoracic', 'Lumbar', 'Sacral', 'Entire spine'] },
      type: { label: 'Type', type: 'chips', options: ['Dull aching', 'Sharp', 'Burning', 'Shooting', 'Stiffness', 'Spasm'] },
      radiation: { label: 'Radiation', type: 'chips', options: ['Down left leg', 'Down right leg', 'Both legs', 'Buttock', 'Groin', 'No radiation'] },
      severity: { label: 'Severity', type: 'scale' },
      onset: { label: 'Onset', type: 'chips', options: ['Sudden after lifting', 'Gradual', 'After trauma', 'Progressive', 'Recurrent'] },
      aggravating: { label: 'Aggravating', type: 'chips', options: ['Bending forward', 'Standing long', 'Sitting long', 'Coughing/sneezing', 'Walking', 'Night pain'], multi: true },
      relieving: { label: 'Relieving', type: 'chips', options: ['Rest', 'Lying down', 'Walking', 'Medications', 'Nothing'], multi: true },
      red_flags: { label: 'Red flags', type: 'chips', options: ['Bladder/bowel involvement', 'Saddle anaesthesia', 'Progressive weakness', 'Night pain', 'Weight loss', 'Fever', 'None'], multi: true },
    }},
  { name: 'Neck Pain', category: 'Neurology', aliases: ['cervical pain', 'stiff neck', 'cervicalgia'],
    attributes: {
      type: { label: 'Type', type: 'chips', options: ['Dull aching', 'Sharp', 'Stiffness', 'Burning', 'Electric shock'] },
      radiation: { label: 'Radiation', type: 'chips', options: ['Right arm', 'Left arm', 'Both arms', 'Occiput', 'Shoulder', 'No radiation'] },
      onset: { label: 'Onset', type: 'chips', options: ['After trauma', 'Gradual', 'On waking', 'With specific posture'] },
      severity: { label: 'Severity', type: 'scale' },
      associated: { label: 'Associated', type: 'chips', options: ['Headache', 'Numbness in arms', 'Weakness', 'Giddiness', 'Grip weakness', 'Gait problems'], multi: true },
    }},
  { name: 'Sleep Disturbance', category: 'Neurology', aliases: ['insomnia', 'cannot sleep', 'sleep problems', 'excessive sleep'],
    attributes: {
      type: { label: 'Type', type: 'chips', options: ['Difficulty falling asleep', 'Difficulty staying asleep', 'Early morning awakening', 'Excessive daytime sleepiness', 'Snoring with apnea'] },
      duration: { label: 'Duration', type: 'duration' },
      impact: { label: 'Daytime impact', type: 'chips', options: ['Fatigue', 'Poor concentration', 'Irritability', 'Drowsy driving', 'Work impairment', 'No impact'] },
      associated: { label: 'Associated', type: 'chips', options: ['Anxiety', 'Depression', 'Pain', 'Restless legs', 'Snoring', 'Witnessed apnea', 'Nocturia'], multi: true },
      hygiene: { label: 'Sleep habits', type: 'chips', options: ['Screen before bed', 'Irregular schedule', 'Caffeine evening', 'Alcohol use', 'Shift work', 'Good hygiene'], multi: true },
    }},
  { name: 'Facial Weakness', category: 'Neurology', aliases: ['facial palsy', 'bell palsy', 'facial droop'],
    attributes: {
      side: { label: 'Side', type: 'chips', options: ['Right', 'Left', 'Bilateral'] },
      onset: { label: 'Onset', type: 'chips', options: ['Sudden (hours)', 'Gradual (days)', 'On waking'] },
      forehead: { label: 'Forehead involved', type: 'chips', options: ['Yes (LMN pattern)', 'No (UMN pattern)', 'Unsure'] },
      associated: { label: 'Associated', type: 'chips', options: ['Ear pain', 'Taste loss', 'Hyperacusis', 'Dry eye', 'Vesicles in ear', 'Limb weakness', 'Speech difficulty'], multi: true },
    }},

  // ============================================================
  // RESPIRATORY (10)
  // ============================================================
  { name: 'Breathlessness', category: 'Respiratory', aliases: ['dyspnea', 'shortness of breath', 'SOB', 'difficulty breathing'],
    attributes: {
      grade: { label: 'NYHA Grade', type: 'chips', options: ['Grade I (strenuous)', 'Grade II (moderate)', 'Grade III (mild activity)', 'Grade IV (at rest)'] },
      mMRC: { label: 'mMRC Scale', type: 'chips', options: ['0 - Strenuous exercise only', '1 - Hurrying on level', '2 - Walks slower than peers', '3 - Stops after 100m', '4 - Cannot leave house'] },
      onset: { label: 'Onset', type: 'chips', options: ['Sudden', 'Gradual', 'Progressive', 'Episodic', 'Seasonal'] },
      duration: { label: 'Duration', type: 'duration' },
      trigger: { label: 'Trigger', type: 'chips', options: ['Exertion', 'At rest', 'Lying flat (Orthopnea)', 'Night (PND)', 'Dust/smoke', 'Cold air', 'Emotional', 'Allergens'], multi: true },
      severity: { label: 'Severity', type: 'scale' },
      associated: { label: 'Associated', type: 'chips', options: ['Cough', 'Wheeze', 'Chest pain', 'Palpitations', 'Pedal oedema', 'Hemoptysis', 'Fever', 'Stridor', 'Chest tightness'], multi: true },
      diurnal: { label: 'Diurnal variation', type: 'chips', options: ['Morning worse', 'Night worse', 'No variation', 'Exercise-induced'] },
    }},
  { name: 'Cough', category: 'Respiratory', aliases: ['chronic cough', 'dry cough', 'productive cough'],
    attributes: {
      type: { label: 'Type', type: 'chips', options: ['Dry', 'Productive', 'Barking', 'Whooping', 'Bovine (hoarse)'] },
      sputum: { label: 'Sputum', type: 'chips', options: ['None (dry)', 'White mucoid', 'Yellow-green', 'Rusty', 'Blood-streaked', 'Frankly bloody', 'Foul-smelling', 'Frothy pink'] },
      duration: { label: 'Duration', type: 'duration' },
      timing: { label: 'Timing', type: 'chips', options: ['Morning', 'Night', 'Post-nasal drip', 'After eating', 'On lying down', 'Continuous', 'Exercise-induced'] },
      severity: { label: 'Severity', type: 'scale' },
      aggravating: { label: 'Aggravating', type: 'chips', options: ['Cold air', 'Dust/smoke', 'Talking', 'Eating', 'Lying flat', 'Exercise', 'Perfumes'], multi: true },
      associated: { label: 'Associated', type: 'chips', options: ['Breathlessness', 'Wheeze', 'Fever', 'Weight loss', 'Night sweats', 'Chest pain', 'Hemoptysis', 'Hoarseness', 'Acid reflux'], multi: true },
    }},
  { name: 'Hemoptysis', category: 'Respiratory', aliases: ['coughing blood', 'blood in sputum'],
    attributes: {
      amount: { label: 'Amount', type: 'chips', options: ['Blood-streaked sputum', 'Teaspoons', 'Tablespoons', 'Cupfuls (massive)'] },
      frequency: { label: 'Frequency', type: 'chips', options: ['Single episode', 'Recurring', 'Daily', 'With every cough'] },
      color: { label: 'Color', type: 'chips', options: ['Bright red', 'Dark red', 'Rusty', 'Pink frothy'] },
      associated: { label: 'Associated', type: 'chips', options: ['Cough', 'Fever', 'Weight loss', 'Night sweats', 'Chest pain', 'Breathlessness', 'TB contact', 'Smoking'], multi: true },
    }},
  { name: 'Wheeze', category: 'Respiratory', aliases: ['wheezing', 'asthma attack', 'chest tightness'],
    attributes: {
      timing: { label: 'Timing', type: 'chips', options: ['Episodic', 'Nocturnal', 'Exercise-induced', 'Seasonal', 'Continuous', 'Cold-induced'] },
      severity: { label: 'Severity', type: 'chips', options: ['Mild (can talk in sentences)', 'Moderate (phrases only)', 'Severe (words only)', 'Life-threatening (silent chest)'] },
      known_asthma: { label: 'Known asthma/COPD', type: 'chips', options: ['Known asthma', 'Known COPD', 'New onset', 'Unknown'] },
      triggers: { label: 'Triggers', type: 'chips', options: ['Dust', 'Pollen', 'Cold air', 'Exercise', 'Smoke', 'Perfumes', 'Pets', 'Infections'], multi: true },
      current_treatment: { label: 'Current treatment', type: 'chips', options: ['Inhaler - regular', 'Inhaler - SOS only', 'Nebulization', 'Oral steroids', 'No treatment'] },
      frequency: { label: 'Attack frequency', type: 'chips', options: ['< 2/week (intermittent)', '> 2/week (mild persistent)', 'Daily (moderate)', 'Continuous (severe)'] },
    }},
  { name: 'Snoring', category: 'Respiratory', aliases: ['sleep apnea', 'OSA', 'obstructive sleep apnea'],
    attributes: {
      severity: { label: 'Severity', type: 'chips', options: ['Mild', 'Loud (heard next room)', 'Very loud', 'Variable'] },
      witnessed_apnea: { label: 'Witnessed apnea', type: 'chips', options: ['Yes - frequent', 'Yes - occasional', 'No', 'Lives alone'] },
      daytime: { label: 'Daytime symptoms', type: 'chips', options: ['Excessive sleepiness', 'Morning headache', 'Poor concentration', 'Irritability', 'None'], multi: true },
      risk_factors: { label: 'Risk factors', type: 'chips', options: ['Obesity', 'Thick neck', 'Retrognathia', 'Nasal obstruction', 'Alcohol before bed', 'Supine position'], multi: true },
      epworth: { label: 'Epworth score', type: 'scale' },
    }},
  { name: 'Chest Tightness', category: 'Respiratory', aliases: ['tight chest', 'constriction in chest'],
    attributes: {
      onset: { label: 'Onset', type: 'chips', options: ['Sudden', 'Gradual', 'On exertion', 'At rest', 'Nocturnal'] },
      duration: { label: 'Duration', type: 'duration' },
      triggers: { label: 'Triggers', type: 'chips', options: ['Exercise', 'Cold air', 'Allergens', 'Stress', 'Smoke', 'None'], multi: true },
      associated: { label: 'Associated', type: 'chips', options: ['Wheeze', 'Cough', 'Breathlessness', 'Chest pain', 'Anxiety'], multi: true },
    }},
  { name: 'Sore Throat', category: 'Respiratory', aliases: ['throat pain', 'pharyngitis', 'tonsillitis'],
    attributes: {
      severity: { label: 'Severity', type: 'scale' },
      duration: { label: 'Duration', type: 'duration' },
      swallowing: { label: 'Swallowing', type: 'chips', options: ['Painful (odynophagia)', 'Difficult (dysphagia)', 'Normal swallowing'] },
      associated: { label: 'Associated', type: 'chips', options: ['Fever', 'Cough', 'Runny nose', 'Hoarseness', 'Ear pain', 'Neck swelling', 'Rash', 'Body ache'], multi: true },
      recurrence: { label: 'Recurrence', type: 'chips', options: ['First episode', 'Recurrent (>3/year)', 'Chronic', 'Post-nasal drip'] },
    }},
  { name: 'Nasal Congestion', category: 'Respiratory', aliases: ['blocked nose', 'stuffy nose', 'rhinitis'],
    attributes: {
      laterality: { label: 'Side', type: 'chips', options: ['Bilateral', 'Left', 'Right', 'Alternating'] },
      duration: { label: 'Duration', type: 'duration' },
      discharge: { label: 'Discharge', type: 'chips', options: ['None', 'Clear watery', 'Thick yellow', 'Green', 'Blood-stained', 'Foul-smelling'] },
      associated: { label: 'Associated', type: 'chips', options: ['Sneezing', 'Itching', 'Post-nasal drip', 'Headache', 'Facial pain', 'Loss of smell', 'Ear fullness', 'Snoring'], multi: true },
      triggers: { label: 'Triggers', type: 'chips', options: ['Dust', 'Pollen', 'Cold air', 'Perfumes', 'Smoke', 'Seasonal', 'No specific trigger'], multi: true },
    }},
  { name: 'Hoarseness', category: 'Respiratory', aliases: ['voice change', 'dysphonia', 'husky voice'],
    attributes: {
      onset: { label: 'Onset', type: 'chips', options: ['Sudden', 'Gradual', 'After voice overuse', 'After surgery/intubation', 'After URTI'] },
      duration: { label: 'Duration', type: 'duration' },
      associated: { label: 'Associated', type: 'chips', options: ['Sore throat', 'Cough', 'Breathing difficulty', 'Swallowing difficulty', 'Weight loss', 'Neck lump', 'Acid reflux'], multi: true },
      voice_use: { label: 'Voice use', type: 'chips', options: ['Professional voice user (teacher/singer)', 'Heavy phone use', 'Shouting/screaming', 'Normal use'] },
    }},
  { name: 'Nosebleed', category: 'Respiratory', aliases: ['epistaxis', 'bleeding from nose'],
    attributes: {
      side: { label: 'Side', type: 'chips', options: ['Left', 'Right', 'Both', 'Alternating'] },
      amount: { label: 'Amount', type: 'chips', options: ['Few drops', 'Moderate', 'Heavy', 'Requiring ER visit'] },
      frequency: { label: 'Frequency', type: 'chips', options: ['First time', 'Occasional', 'Frequent (weekly)', 'Daily'] },
      triggers: { label: 'Triggers', type: 'chips', options: ['Nose picking', 'Dry air', 'Nose blowing', 'Trauma', 'Spontaneous', 'After blood thinner'], multi: true },
      associated: { label: 'Associated', type: 'chips', options: ['Easy bruising', 'Gum bleeding', 'Heavy periods', 'On blood thinners', 'Hypertension', 'Liver disease'], multi: true },
    }},

  // ============================================================
  // GI (12)
  // ============================================================
  { name: 'Abdominal Pain', category: 'GI', aliases: ['stomach pain', 'belly pain', 'tummy ache'],
    attributes: {
      location: { label: 'Location', type: 'chips', options: ['Epigastric', 'RUQ', 'LUQ', 'Umbilical', 'RIF', 'LIF', 'Suprapubic', 'Diffuse', 'Loin (R)', 'Loin (L)', 'RHC', 'LHC'] },
      type: { label: 'Type', type: 'chips', options: ['Colicky', 'Burning', 'Dull aching', 'Sharp', 'Cramping', 'Dragging', 'Gnawing'] },
      severity: { label: 'Severity (1-10)', type: 'scale' },
      onset: { label: 'Onset', type: 'chips', options: ['Sudden', 'Gradual', 'After eating', 'Before eating', 'Nocturnal', 'Post-prandial', 'Recurrent'] },
      duration: { label: 'Duration', type: 'duration' },
      radiation: { label: 'Radiation', type: 'chips', options: ['Back', 'Right shoulder', 'Groin', 'Chest', 'No radiation'] },
      aggravating: { label: 'Aggravating', type: 'chips', options: ['Eating', 'Spicy food', 'Fatty food', 'Fasting', 'Movement', 'Deep breathing', 'Straining'], multi: true },
      relieving: { label: 'Relieving', type: 'chips', options: ['Antacids', 'Vomiting', 'Passing gas', 'Defecation', 'Fasting', 'Nothing'], multi: true },
      associated: { label: 'Associated', type: 'chips', options: ['Nausea', 'Vomiting', 'Diarrhea', 'Constipation', 'Bloating', 'Blood in stool', 'Jaundice', 'Fever', 'Weight loss', 'Loss of appetite'], multi: true },
    }},
  { name: 'Nausea / Vomiting', category: 'GI', aliases: ['feeling sick', 'throwing up', 'emesis'],
    attributes: {
      type: { label: 'Vomiting type', type: 'chips', options: ['Nausea only (no vomiting)', 'Non-projectile', 'Projectile', 'Bilious (green)', 'Feculent', 'Blood (hematemesis)', 'Coffee ground'] },
      frequency: { label: 'Frequency', type: 'chips', options: ['1-2 episodes', '3-5 episodes', 'Multiple (>5)', 'Continuous retching'] },
      timing: { label: 'Timing', type: 'chips', options: ['Morning', 'After meals', 'Before meals', 'Night', 'No relation to meals'] },
      onset: { label: 'Onset', type: 'chips', options: ['Sudden', 'Gradual', 'After specific food', 'After medication', 'With headache', 'With pain'] },
      associated: { label: 'Associated', type: 'chips', options: ['Abdominal pain', 'Diarrhea', 'Fever', 'Headache', 'Giddiness', 'Dehydration signs', 'Weight loss'], multi: true },
    }},
  { name: 'Diarrhea', category: 'GI', aliases: ['loose motions', 'watery stools', 'loose stools'],
    attributes: {
      frequency: { label: 'Frequency', type: 'chips', options: ['2-3/day', '4-6/day', '7-10/day', '>10/day'] },
      consistency: { label: 'Consistency', type: 'chips', options: ['Semi-formed', 'Loose', 'Watery', 'Rice-water', 'Mucoid', 'Bloody'] },
      duration: { label: 'Duration', type: 'duration' },
      blood: { label: 'Blood/Mucus', type: 'chips', options: ['None', 'Blood streaked', 'Bloody (dysentery)', 'Mucoid', 'Blood + mucus'] },
      associated: { label: 'Associated', type: 'chips', options: ['Fever', 'Vomiting', 'Crampy pain', 'Tenesmus', 'Dehydration', 'Weight loss', 'Night diarrhea'], multi: true },
      history: { label: 'Exposure', type: 'chips', options: ['Outside food', 'Travel', 'Contaminated water', 'Antibiotic use', 'Contact with sick person', 'Unknown'], multi: true },
    }},
  { name: 'Constipation', category: 'GI', aliases: ['hard stools', 'difficulty passing stools', 'not passing motion'],
    attributes: {
      frequency: { label: 'Stool frequency', type: 'chips', options: ['Every 2 days', 'Every 3 days', 'Once a week', 'Less than once a week'] },
      nature: { label: 'Nature', type: 'chips', options: ['Hard pellets', 'Hard large stool', 'Incomplete evacuation', 'Need to strain', 'Digital evacuation needed'] },
      duration: { label: 'Duration', type: 'duration' },
      onset: { label: 'Onset', type: 'chips', options: ['Lifelong', 'Recent onset', 'After medication', 'After surgery', 'Progressive'] },
      associated: { label: 'Associated', type: 'chips', options: ['Bloating', 'Pain', 'Blood on wiping', 'Mucus', 'Weight loss', 'Loss of appetite', 'Abdominal distension'], multi: true },
      red_flags: { label: 'Red flags', type: 'chips', options: ['New onset >50yrs', 'Weight loss', 'Blood in stool', 'Family history colon cancer', 'None'], multi: true },
    }},
  { name: 'Heartburn / Acid Reflux', category: 'GI', aliases: ['GERD', 'acidity', 'gastritis'],
    attributes: {
      type: { label: 'Type', type: 'chips', options: ['Burning sensation', 'Sour taste', 'Regurgitation', 'Water brash', 'Lump in throat'] },
      timing: { label: 'Timing', type: 'chips', options: ['After meals', 'On lying down', 'Nocturnal', 'On bending', 'Fasting', 'Random'] },
      duration: { label: 'Duration', type: 'duration' },
      triggers: { label: 'Triggers', type: 'chips', options: ['Spicy food', 'Fatty food', 'Coffee', 'Alcohol', 'Citrus', 'Chocolate', 'Late meals', 'Stress', 'NSAIDs'], multi: true },
      severity: { label: 'Severity', type: 'scale' },
      associated: { label: 'Associated', type: 'chips', options: ['Chest pain', 'Cough', 'Hoarseness', 'Throat clearing', 'Difficulty swallowing', 'Weight loss'], multi: true },
    }},
  { name: 'Difficulty Swallowing', category: 'GI', aliases: ['dysphagia', 'food sticking', 'cannot swallow'],
    attributes: {
      type: { label: 'Type', type: 'chips', options: ['Solids only', 'Liquids only', 'Both solids and liquids', 'Progressive (solids → liquids)'] },
      level: { label: 'Level', type: 'chips', options: ['Throat (oropharyngeal)', 'Behind sternum (esophageal)', 'Uncertain'] },
      onset: { label: 'Onset', type: 'chips', options: ['Sudden', 'Gradual progressive', 'Intermittent'] },
      associated: { label: 'Associated', type: 'chips', options: ['Weight loss', 'Regurgitation', 'Cough after swallowing', 'Nasal regurgitation', 'Hoarseness', 'Pain on swallowing', 'Heartburn'], multi: true },
      red_flags: { label: 'Red flags', type: 'chips', options: ['Progressive', 'Weight loss', 'Anemia', '>50 years new onset', 'None'], multi: true },
    }},
  { name: 'Jaundice', category: 'GI', aliases: ['yellowish discoloration', 'yellow eyes', 'icterus'],
    attributes: {
      onset: { label: 'Onset', type: 'chips', options: ['Sudden', 'Gradual', 'Fluctuating', 'Progressive'] },
      urine: { label: 'Urine color', type: 'chips', options: ['Dark yellow', 'Cola colored', 'Normal'] },
      stool: { label: 'Stool color', type: 'chips', options: ['Normal', 'Pale/clay colored', 'Dark'] },
      itching: { label: 'Itching', type: 'chips', options: ['Severe', 'Mild', 'None'] },
      associated: { label: 'Associated', type: 'chips', options: ['Pain (RUQ)', 'Fever', 'Loss of appetite', 'Weight loss', 'Nausea', 'Abdominal distension', 'Alcohol history'], multi: true },
      duration: { label: 'Duration', type: 'duration' },
    }},
  { name: 'Blood in Stool', category: 'GI', aliases: ['rectal bleeding', 'melena', 'hematochezia'],
    attributes: {
      color: { label: 'Color', type: 'chips', options: ['Bright red', 'Dark red', 'Black tarry (melena)', 'Maroon', 'On tissue only'] },
      amount: { label: 'Amount', type: 'chips', options: ['Streaks on stool', 'Mixed with stool', 'Dripping after stool', 'Large volume', 'Clots'] },
      frequency: { label: 'Frequency', type: 'chips', options: ['Single episode', 'Intermittent', 'Every stool', 'Daily'] },
      associated: { label: 'Associated', type: 'chips', options: ['Pain during defecation', 'Tenesmus', 'Weight loss', 'Change in bowel habits', 'Abdominal pain', 'Mass per rectum', 'Dizziness'], multi: true },
    }},
  { name: 'Abdominal Distension', category: 'GI', aliases: ['bloating', 'swollen belly', 'abdominal swelling'],
    attributes: {
      onset: { label: 'Onset', type: 'chips', options: ['Gradual over days', 'Gradual over weeks', 'Sudden', 'Fluctuating'] },
      pattern: { label: 'Pattern', type: 'chips', options: ['Constant', 'Worse after meals', 'Worse by evening', 'Intermittent'] },
      associated: { label: 'Associated', type: 'chips', options: ['Constipation', 'Diarrhea', 'Vomiting', 'Loss of appetite', 'Weight loss', 'Jaundice', 'Pedal oedema', 'Reduced urine'], multi: true },
    }},
  { name: 'Loss of Appetite', category: 'GI', aliases: ['anorexia', 'not hungry', 'poor appetite'],
    attributes: {
      onset: { label: 'Onset', type: 'chips', options: ['Sudden', 'Gradual', 'After illness', 'After medication'] },
      duration: { label: 'Duration', type: 'duration' },
      weight_loss: { label: 'Weight loss', type: 'chips', options: ['Yes - significant (>5%)', 'Yes - mild', 'No', 'Weight gain'] },
      associated: { label: 'Associated', type: 'chips', options: ['Nausea', 'Abdominal pain', 'Early satiety', 'Depression', 'Fatigue', 'Fever', 'Night sweats'], multi: true },
    }},
  { name: 'Hiccups', category: 'GI', aliases: ['singultus', 'persistent hiccups'],
    attributes: {
      duration: { label: 'Duration', type: 'chips', options: ['Minutes', 'Hours', 'Days', 'Weeks (intractable)'] },
      triggers: { label: 'Triggers', type: 'chips', options: ['After eating', 'Carbonated drinks', 'Spicy food', 'Spontaneous', 'After surgery'], multi: true },
      associated: { label: 'Associated', type: 'chips', options: ['GERD', 'Abdominal distension', 'CNS symptoms', 'Metabolic disease', 'None'], multi: true },
    }},
  { name: 'Rectal Pain', category: 'GI', aliases: ['anal pain', 'pain in bottom', 'perianal pain'],
    attributes: {
      timing: { label: 'Timing', type: 'chips', options: ['During defecation', 'After defecation', 'Constant', 'Throbbing at night'] },
      severity: { label: 'Severity', type: 'scale' },
      associated: { label: 'Associated', type: 'chips', options: ['Bleeding', 'Discharge', 'Lump', 'Constipation', 'Itching', 'Fever'], multi: true },
      likely: { label: 'Clinical suspicion', type: 'chips', options: ['Fissure', 'Hemorrhoids', 'Abscess', 'Fistula', 'Proctalgia fugax', 'Unknown'] },
    }},

  // ============================================================
  // RENAL / UROLOGICAL (6)
  // ============================================================
  { name: 'Burning Micturition', category: 'Renal', aliases: ['dysuria', 'painful urination', 'UTI symptoms'],
    attributes: {
      severity: { label: 'Severity', type: 'scale' },
      duration: { label: 'Duration', type: 'duration' },
      frequency: { label: 'Urinary frequency', type: 'chips', options: ['Normal', 'Increased', 'Very frequent', 'Urgency', 'Nocturia'] },
      associated: { label: 'Associated', type: 'chips', options: ['Fever', 'Hematuria', 'Cloudy urine', 'Foul-smelling urine', 'Suprapubic pain', 'Loin pain', 'Urethral discharge', 'Incomplete voiding'], multi: true },
      recurrence: { label: 'Recurrence', type: 'chips', options: ['First episode', 'Recurrent (<3/year)', 'Frequent (>3/year)', 'Chronic'] },
    }},
  { name: 'Hematuria', category: 'Renal', aliases: ['blood in urine', 'red urine'],
    attributes: {
      type: { label: 'Type', type: 'chips', options: ['Gross (visible)', 'Microscopic (lab found)', 'Initial stream', 'Terminal', 'Throughout'] },
      color: { label: 'Color', type: 'chips', options: ['Pink', 'Red', 'Brown/cola', 'Clots present'] },
      associated: { label: 'Associated', type: 'chips', options: ['Pain', 'Burning', 'Frequency', 'Fever', 'Weight loss', 'Loin pain', 'Clot retention'], multi: true },
      onset: { label: 'Onset', type: 'chips', options: ['First time', 'Recurrent', 'After trauma', 'After exercise', 'During menstruation'] },
    }},
  { name: 'Urinary Retention', category: 'Renal', aliases: ['cannot pass urine', 'urine retention', 'difficulty urinating'],
    attributes: {
      type: { label: 'Type', type: 'chips', options: ['Acute (sudden)', 'Chronic (gradual)', 'Overflow incontinence'] },
      symptoms: { label: 'Symptoms', type: 'chips', options: ['Cannot void at all', 'Poor stream', 'Straining', 'Hesitancy', 'Dribbling', 'Incomplete emptying', 'Double voiding'], multi: true },
      prostate: { label: 'Prostate history (males)', type: 'chips', options: ['Known BPH', 'On tamsulosin', 'Previous TURP', 'Not applicable (female)'] },
      associated: { label: 'Associated', type: 'chips', options: ['Suprapubic pain', 'Distended bladder', 'Fever', 'Back pain', 'Constipation', 'Recent surgery', 'Medications (anticholinergic)'], multi: true },
    }},
  { name: 'Renal Colic', category: 'Renal', aliases: ['kidney stone pain', 'ureteric colic', 'flank pain'],
    attributes: {
      side: { label: 'Side', type: 'chips', options: ['Left', 'Right', 'Bilateral'] },
      radiation: { label: 'Radiation', type: 'chips', options: ['Loin to groin', 'Loin to testis/labia', 'Loin to suprapubic', 'No radiation'] },
      severity: { label: 'Severity (1-10)', type: 'scale' },
      pattern: { label: 'Pattern', type: 'chips', options: ['Colicky (waves)', 'Constant', 'Intermittent'] },
      associated: { label: 'Associated', type: 'chips', options: ['Nausea', 'Vomiting', 'Hematuria', 'Dysuria', 'Fever', 'Restlessness', 'Previous stones'], multi: true },
      stone_history: { label: 'Stone history', type: 'chips', options: ['First episode', 'Recurrent', 'Known stone on imaging', 'Family history'] },
    }},
  { name: 'Urinary Incontinence', category: 'Renal', aliases: ['leaking urine', 'urine leak', 'bladder control'],
    attributes: {
      type: { label: 'Type', type: 'chips', options: ['Stress (cough/sneeze/laugh)', 'Urge (sudden need)', 'Mixed', 'Overflow', 'Continuous', 'Functional'] },
      severity: { label: 'Severity', type: 'chips', options: ['Occasional drops', 'Pad needed sometimes', 'Pad needed always', 'Complete loss of control'] },
      triggers: { label: 'Triggers', type: 'chips', options: ['Coughing', 'Sneezing', 'Laughing', 'Lifting', 'Running', 'Urgency', 'Sound of water'], multi: true },
      impact: { label: 'Impact', type: 'chips', options: ['Social embarrassment', 'Limits activities', 'Skin irritation', 'Sleep disruption', 'Depression'], multi: true },
    }},
  { name: 'Scrotal Swelling', category: 'Renal', aliases: ['testicular swelling', 'scrotal pain', 'hydrocele'],
    attributes: {
      side: { label: 'Side', type: 'chips', options: ['Left', 'Right', 'Bilateral'] },
      onset: { label: 'Onset', type: 'chips', options: ['Sudden (hours)', 'Gradual (days)', 'Gradual (weeks/months)', 'After trauma'] },
      pain: { label: 'Pain', type: 'chips', options: ['Severe', 'Moderate', 'Mild', 'Painless'] },
      associated: { label: 'Associated', type: 'chips', options: ['Fever', 'Redness', 'Nausea', 'Inguinal swelling', 'Urinary symptoms', 'Transillumination positive'], multi: true },
      reducible: { label: 'Reducible', type: 'chips', options: ['Yes (reducible swelling)', 'No (irreducible)', 'Not sure'] },
    }},

  // ============================================================
  // MUSCULOSKELETAL / ORTHO (8)
  // ============================================================
  { name: 'Joint Pain', category: 'Orthopaedic', aliases: ['arthralgia', 'arthritis', 'joint ache'],
    attributes: {
      joints: { label: 'Joints affected', type: 'chips', options: ['Knee (R)', 'Knee (L)', 'Hip', 'Shoulder', 'Elbow', 'Wrist', 'Small joints (hands)', 'Small joints (feet)', 'Spine', 'SI joint', 'TMJ'], multi: true },
      pattern: { label: 'Pattern', type: 'chips', options: ['Monoarticular', 'Oligoarticular (2-4)', 'Polyarticular (>4)', 'Migratory', 'Additive', 'Symmetric'] },
      type: { label: 'Type', type: 'chips', options: ['Aching', 'Sharp', 'Stiffness', 'Locking', 'Giving way', 'Grinding'] },
      morning_stiffness: { label: 'Morning stiffness', type: 'chips', options: ['None', '<30 min', '30-60 min', '>1 hour (inflammatory)'] },
      severity: { label: 'Severity', type: 'scale' },
      swelling: { label: 'Swelling', type: 'chips', options: ['Yes - warm', 'Yes - not warm', 'No swelling', 'Deformity present'] },
      aggravating: { label: 'Aggravating', type: 'chips', options: ['Movement', 'Weight bearing', 'Climbing stairs', 'Squatting', 'Cold weather', 'Rest (inflammatory)'], multi: true },
      associated: { label: 'Associated', type: 'chips', options: ['Fever', 'Rash', 'Eye redness', 'Mouth ulcers', 'Back pain', 'Psoriasis', 'Diarrhea', 'Weight loss'], multi: true },
    }},
  { name: 'Knee Pain', category: 'Orthopaedic', aliases: ['knee ache', 'knee injury', 'knee swelling'],
    attributes: {
      side: { label: 'Side', type: 'chips', options: ['Right', 'Left', 'Bilateral'] },
      location: { label: 'Location', type: 'chips', options: ['Anterior', 'Medial', 'Lateral', 'Posterior', 'Patellofemoral', 'Diffuse'] },
      type: { label: 'Type', type: 'chips', options: ['Aching', 'Sharp', 'Grinding', 'Catching/locking', 'Giving way', 'Stiffness'] },
      severity: { label: 'Severity', type: 'scale' },
      onset: { label: 'Onset', type: 'chips', options: ['After injury', 'Gradual', 'After sports', 'After walking', 'On squatting'] },
      aggravating: { label: 'Aggravating', type: 'chips', options: ['Stairs', 'Squatting', 'Walking', 'Running', 'Sitting long', 'Kneeling'], multi: true },
      swelling: { label: 'Swelling', type: 'chips', options: ['Yes (immediate after injury)', 'Yes (gradual)', 'Intermittent', 'None'] },
      mechanical: { label: 'Mechanical symptoms', type: 'chips', options: ['Locking', 'Clicking', 'Giving way', 'Catching', 'None'], multi: true },
    }},
  { name: 'Shoulder Pain', category: 'Orthopaedic', aliases: ['shoulder ache', 'frozen shoulder', 'rotator cuff'],
    attributes: {
      side: { label: 'Side', type: 'chips', options: ['Right', 'Left', 'Bilateral'] },
      type: { label: 'Type', type: 'chips', options: ['Deep aching', 'Sharp', 'Stiffness', 'Catching', 'Night pain'] },
      onset: { label: 'Onset', type: 'chips', options: ['After injury', 'Gradual', 'After overhead activity', 'Spontaneous'] },
      movements: { label: 'Limited movements', type: 'chips', options: ['Overhead reach', 'Behind back', 'Across body', 'All directions (frozen)', 'No restriction'], multi: true },
      severity: { label: 'Severity', type: 'scale' },
      associated: { label: 'Associated', type: 'chips', options: ['Night pain', 'Weakness', 'Numbness down arm', 'Neck pain', 'Clicking', 'Instability'], multi: true },
    }},
  { name: 'Hip Pain', category: 'Orthopaedic', aliases: ['groin pain', 'hip ache'],
    attributes: {
      side: { label: 'Side', type: 'chips', options: ['Right', 'Left', 'Bilateral'] },
      location: { label: 'Location', type: 'chips', options: ['Groin', 'Lateral (trochanteric)', 'Buttock', 'Anterior thigh'] },
      onset: { label: 'Onset', type: 'chips', options: ['After fall', 'Gradual', 'After long walk', 'Post AVN diagnosis'] },
      severity: { label: 'Severity', type: 'scale' },
      limp: { label: 'Limp', type: 'chips', options: ['Yes', 'No', 'Uses walking aid'] },
      associated: { label: 'Associated', type: 'chips', options: ['Stiffness', 'Limb shortening', 'Difficulty with shoes/socks', 'Night pain', 'Rest pain'], multi: true },
    }},
  { name: 'Fracture / Trauma', category: 'Orthopaedic', aliases: ['broken bone', 'injury', 'fall'],
    attributes: {
      mechanism: { label: 'Mechanism', type: 'chips', options: ['Fall from height', 'Fall on ground', 'RTA', 'Sports injury', 'Assault', 'Trivial fall (fragility)', 'Crush injury'] },
      site: { label: 'Site', type: 'text' },
      deformity: { label: 'Deformity', type: 'chips', options: ['Visible deformity', 'Swelling only', 'Bruising', 'Open wound', 'No visible deformity'] },
      neurovascular: { label: 'Distal NV status', type: 'chips', options: ['Sensation intact', 'Numbness', 'Pulse present', 'Pulse absent', 'Cold limb', 'Motor intact'] },
      severity: { label: 'Pain severity', type: 'scale' },
    }},
  { name: 'Muscle Pain', category: 'Orthopaedic', aliases: ['myalgia', 'body ache', 'muscle soreness'],
    attributes: {
      location: { label: 'Location', type: 'chips', options: ['Generalized', 'Neck/shoulders', 'Lower back', 'Thighs', 'Calves', 'Upper arms'], multi: true },
      onset: { label: 'Onset', type: 'chips', options: ['After exercise', 'After viral illness', 'Gradual', 'Sudden', 'After new medication (statin)'] },
      associated: { label: 'Associated', type: 'chips', options: ['Fever', 'Fatigue', 'Weakness', 'Dark urine (rhabdomyolysis)', 'Joint pain', 'Rash'], multi: true },
      duration: { label: 'Duration', type: 'duration' },
    }},
  { name: 'Foot Pain', category: 'Orthopaedic', aliases: ['heel pain', 'plantar fasciitis', 'metatarsalgia'],
    attributes: {
      location: { label: 'Location', type: 'chips', options: ['Heel (plantar)', 'Heel (posterior)', 'Arch', 'Ball of foot', 'Toes', 'Ankle', 'Diffuse'] },
      timing: { label: 'Timing', type: 'chips', options: ['First steps in morning', 'After walking', 'After standing long', 'During walking', 'At rest', 'Night'] },
      severity: { label: 'Severity', type: 'scale' },
      associated: { label: 'Associated', type: 'chips', options: ['Swelling', 'Numbness', 'Burning', 'Deformity', 'Difficulty wearing shoes', 'Diabetes'], multi: true },
    }},
  { name: 'Limb Swelling', category: 'Orthopaedic', aliases: ['arm swelling', 'leg swelling post injury'],
    attributes: {
      limb: { label: 'Limb', type: 'chips', options: ['Right arm', 'Left arm', 'Right leg', 'Left leg'] },
      onset: { label: 'Onset', type: 'chips', options: ['After injury', 'After surgery', 'Gradual', 'Sudden'] },
      associated: { label: 'Associated', type: 'chips', options: ['Pain', 'Warmth', 'Redness', 'Numbness', 'Deformity', 'Bruising'], multi: true },
    }},

  // ============================================================
  // GENERAL / SYSTEMIC (10)
  // ============================================================
  { name: 'Fever', category: 'General', aliases: ['pyrexia', 'high temperature', 'raised temperature'],
    attributes: {
      grade: { label: 'Grade', type: 'chips', options: ['Low (99-100°F)', 'Moderate (100-102°F)', 'High (102-104°F)', 'Very high (>104°F)'] },
      pattern: { label: 'Pattern', type: 'chips', options: ['Continuous', 'Intermittent', 'Remittent', 'Step-ladder', 'Pel-Ebstein', 'Quotidian', 'Tertian'] },
      onset: { label: 'Onset', type: 'chips', options: ['Sudden', 'Gradual', 'With chills', 'Without chills'] },
      duration: { label: 'Duration', type: 'duration' },
      timing: { label: 'Timing', type: 'chips', options: ['Evening rise', 'Night rise', 'Morning', 'Throughout day', 'No fixed pattern'] },
      associated: { label: 'Associated', type: 'chips', options: ['Chills', 'Rigors', 'Sweating', 'Body ache', 'Headache', 'Rash', 'Joint pain', 'Sore throat', 'Cough', 'Loose stools', 'Burning micturition', 'Altered sensorium', 'Night sweats', 'Weight loss'], multi: true },
      treatment_taken: { label: 'Treatment taken', type: 'chips', options: ['Paracetamol', 'Antibiotics (self)', 'Home remedies', 'No treatment', 'Visited local doctor'], multi: true },
    }},
  { name: 'Weakness / Fatigue', category: 'General', aliases: ['tiredness', 'exhaustion', 'lethargy', 'malaise'],
    attributes: {
      onset: { label: 'Onset', type: 'chips', options: ['Sudden', 'Gradual over weeks', 'Gradual over months', 'After illness', 'After surgery'] },
      severity: { label: 'Impact', type: 'chips', options: ['Can work normally', 'Reduced work capacity', 'Difficulty with daily tasks', 'Bedbound'] },
      timing: { label: 'Timing', type: 'chips', options: ['Morning worse', 'Evening worse', 'Constant', 'After activity', 'Variable'] },
      associated: { label: 'Associated', type: 'chips', options: ['Weight loss', 'Fever', 'Loss of appetite', 'Breathlessness', 'Pallor', 'Depression', 'Sleep disturbance', 'Muscle pain'], multi: true },
      duration: { label: 'Duration', type: 'duration' },
    }},
  { name: 'Weight Loss', category: 'General', aliases: ['losing weight', 'unintentional weight loss'],
    attributes: {
      amount: { label: 'Amount', type: 'chips', options: ['1-2 kg', '3-5 kg', '5-10 kg', '>10 kg', 'Clothes loosening (unsure)'] },
      duration: { label: 'Over what period', type: 'chips', options: ['1 month', '3 months', '6 months', '>6 months'] },
      appetite: { label: 'Appetite', type: 'chips', options: ['Preserved (eating well)', 'Reduced', 'Severely reduced', 'Increased (but still losing)'] },
      intentional: { label: 'Intentional', type: 'chips', options: ['Yes - dieting/exercise', 'No - unintentional'] },
      associated: { label: 'Associated', type: 'chips', options: ['Fever', 'Night sweats', 'Cough', 'Diarrhea', 'Difficulty swallowing', 'Abdominal pain', 'Diabetes', 'Thyroid symptoms'], multi: true },
    }},
  { name: 'Weight Gain', category: 'General', aliases: ['gaining weight', 'obesity'],
    attributes: {
      amount: { label: 'Amount', type: 'chips', options: ['1-3 kg', '3-5 kg', '5-10 kg', '>10 kg'] },
      duration: { label: 'Over what period', type: 'chips', options: ['1 month', '3 months', '6 months', 'Gradual over years'] },
      pattern: { label: 'Pattern', type: 'chips', options: ['Generalized', 'Central (belly)', 'Face (moon face)', 'Fluid retention'] },
      associated: { label: 'Associated', type: 'chips', options: ['Swelling', 'Breathlessness', 'Fatigue', 'Menstrual irregularity', 'Depression', 'Medication related', 'Hypothyroid symptoms'], multi: true },
    }},
  { name: 'Swelling (General)', category: 'General', aliases: ['body swelling', 'generalized edema', 'puffiness'],
    attributes: {
      location: { label: 'Location', type: 'chips', options: ['Face (periorbital)', 'Feet/ankles', 'Generalized', 'Abdomen (ascites)', 'Hands', 'Sacral'] },
      timing: { label: 'Timing', type: 'chips', options: ['Morning (face)', 'Evening (feet)', 'Constant', 'Progressive'] },
      onset: { label: 'Onset', type: 'chips', options: ['Sudden', 'Gradual over days', 'Gradual over weeks'] },
      associated: { label: 'Associated', type: 'chips', options: ['Reduced urine', 'Foamy urine', 'Breathlessness', 'Weight gain', 'Abdominal distension', 'Periorbital puffiness'], multi: true },
    }},
  { name: 'Rash', category: 'Dermatology', aliases: ['skin rash', 'skin lesion', 'eruption', 'itchy skin'],
    attributes: {
      type: { label: 'Type', type: 'chips', options: ['Macular (flat)', 'Papular (raised)', 'Vesicular (blisters)', 'Pustular', 'Urticarial (hives)', 'Petechial', 'Scaly/plaque', 'Nodular'] },
      distribution: { label: 'Distribution', type: 'chips', options: ['Face', 'Trunk', 'Limbs', 'Palms/soles', 'Flexures', 'Extensors', 'Generalized', 'Sun-exposed', 'Dermatomal'] },
      itching: { label: 'Itching', type: 'chips', options: ['Severe', 'Moderate', 'Mild', 'None'] },
      onset: { label: 'Onset', type: 'chips', options: ['Sudden', 'Gradual', 'After drug', 'After food', 'After sun exposure', 'Recurrent'] },
      duration: { label: 'Duration', type: 'duration' },
      associated: { label: 'Associated', type: 'chips', options: ['Fever', 'Joint pain', 'Swelling', 'Mucosal involvement', 'Hair loss', 'Nail changes', 'Drug history'], multi: true },
    }},
  { name: 'Itching', category: 'Dermatology', aliases: ['pruritus', 'skin itching', 'scratching'],
    attributes: {
      distribution: { label: 'Distribution', type: 'chips', options: ['Generalized', 'Localized', 'Scalp', 'Groin', 'Interdigital', 'Perianal', 'Legs'] },
      timing: { label: 'Timing', type: 'chips', options: ['Nocturnal worse', 'Constant', 'After bathing', 'Seasonal'] },
      severity: { label: 'Severity', type: 'scale' },
      associated: { label: 'Associated', type: 'chips', options: ['Rash', 'Dry skin', 'Jaundice', 'Excoriations', 'Secondary infection', 'Anxiety/depression', 'Family members affected'], multi: true },
    }},
  { name: 'Hair Loss', category: 'Dermatology', aliases: ['alopecia', 'balding', 'thinning hair'],
    attributes: {
      pattern: { label: 'Pattern', type: 'chips', options: ['Diffuse thinning', 'Patchy (alopecia areata)', 'Frontal recession', 'Vertex thinning', 'Band-like'] },
      onset: { label: 'Onset', type: 'chips', options: ['Gradual', 'Sudden', 'After illness/stress', 'After pregnancy', 'After medication'] },
      associated: { label: 'Associated', type: 'chips', options: ['Thyroid disease', 'Iron deficiency', 'Stress', 'Weight loss', 'PCOS', 'Nail changes', 'Autoimmune disease'], multi: true },
    }},
  { name: 'Pallor', category: 'General', aliases: ['anemia symptoms', 'looking pale', 'weakness with pallor'],
    attributes: {
      onset: { label: 'Onset', type: 'chips', options: ['Gradual', 'Sudden', 'Recurrent', 'After blood loss'] },
      associated: { label: 'Associated', type: 'chips', options: ['Fatigue', 'Breathlessness', 'Palpitations', 'Giddiness', 'Heavy periods', 'Blood in stool', 'Worm infestation', 'Poor diet', 'Pica (ice/clay craving)'], multi: true },
    }},
  { name: 'Lymph Node Swelling', category: 'General', aliases: ['swollen glands', 'lymphadenopathy', 'neck lump'],
    attributes: {
      location: { label: 'Location', type: 'chips', options: ['Cervical', 'Axillary', 'Inguinal', 'Supraclavicular', 'Generalized', 'Multiple sites'], multi: true },
      character: { label: 'Character', type: 'chips', options: ['Single', 'Multiple', 'Matted', 'Tender', 'Non-tender', 'Firm', 'Hard', 'Rubbery'] },
      onset: { label: 'Onset', type: 'chips', options: ['Recent (days)', 'Weeks', 'Months', 'Progressive'] },
      associated: { label: 'Associated', type: 'chips', options: ['Fever', 'Weight loss', 'Night sweats', 'Sore throat', 'Skin infection', 'TB contact', 'Rash'], multi: true },
    }},

  // ============================================================
  // ENDOCRINE (6)
  // ============================================================
  { name: 'Increased Thirst', category: 'Endocrine', aliases: ['polydipsia', 'excessive thirst', 'DM symptoms'],
    attributes: {
      duration: { label: 'Duration', type: 'duration' },
      water_intake: { label: 'Daily water intake', type: 'chips', options: ['3-4 L', '5-6 L', '>6 L'] },
      associated: { label: 'Associated', type: 'chips', options: ['Frequent urination', 'Weight loss', 'Fatigue', 'Blurred vision', 'Slow wound healing', 'Tingling in feet', 'Recurrent infections'], multi: true },
      known_dm: { label: 'Known diabetes', type: 'chips', options: ['New symptoms', 'Known DM - on treatment', 'Known DM - not controlled', 'Gestational DM'] },
    }},
  { name: 'Thyroid Symptoms', category: 'Endocrine', aliases: ['thyroid problem', 'hyper/hypothyroid', 'goiter'],
    attributes: {
      type: { label: 'Suspected type', type: 'chips', options: ['Hypothyroid features', 'Hyperthyroid features', 'Goiter/neck swelling', 'Unknown'] },
      hypo_symptoms: { label: 'Hypothyroid symptoms', type: 'chips', options: ['Weight gain', 'Fatigue', 'Cold intolerance', 'Constipation', 'Dry skin', 'Hair loss', 'Heavy periods', 'Depression', 'Hoarseness'], multi: true },
      hyper_symptoms: { label: 'Hyperthyroid symptoms', type: 'chips', options: ['Weight loss', 'Palpitations', 'Heat intolerance', 'Sweating', 'Tremor', 'Anxiety', 'Diarrhea', 'Eye prominence', 'Irregular periods'], multi: true },
      neck: { label: 'Neck', type: 'chips', options: ['Visible swelling', 'Nodule', 'Difficulty swallowing', 'No neck changes'] },
    }},
  { name: 'Diabetic Foot', category: 'Endocrine', aliases: ['foot ulcer', 'diabetic ulcer', 'neuropathic foot'],
    attributes: {
      location: { label: 'Ulcer location', type: 'chips', options: ['Sole', 'Toe', 'Heel', 'Dorsum', 'Between toes', 'No ulcer'] },
      duration: { label: 'Duration', type: 'duration' },
      discharge: { label: 'Discharge', type: 'chips', options: ['None', 'Serous', 'Purulent', 'Foul-smelling', 'Blood-stained'] },
      sensation: { label: 'Sensation', type: 'chips', options: ['Normal', 'Reduced', 'Absent', 'Burning/tingling'] },
      dm_control: { label: 'DM control', type: 'chips', options: ['Well controlled', 'Poorly controlled', 'Not on treatment', 'On insulin'] },
    }},
  { name: 'Excessive Sweating', category: 'Endocrine', aliases: ['hyperhidrosis', 'night sweats', 'diaphoresis'],
    attributes: {
      type: { label: 'Type', type: 'chips', options: ['Generalized', 'Palms/soles', 'Axillary', 'Night sweats only', 'Facial'] },
      timing: { label: 'Timing', type: 'chips', options: ['Constant', 'Nocturnal', 'With activity', 'Episodic', 'With anxiety'] },
      associated: { label: 'Associated', type: 'chips', options: ['Fever', 'Weight loss', 'Palpitations', 'Flushing', 'Anxiety', 'Hot flashes', 'TB symptoms'], multi: true },
    }},
  { name: 'Menstrual Irregularity', category: 'Endocrine', aliases: ['irregular periods', 'heavy periods', 'missed period', 'amenorrhea'],
    attributes: {
      type: { label: 'Type', type: 'chips', options: ['Heavy periods (menorrhagia)', 'Irregular cycles', 'Absent periods (amenorrhea)', 'Painful periods (dysmenorrhea)', 'Intermenstrual bleeding', 'Postmenopausal bleeding'] },
      cycle: { label: 'Cycle length', type: 'chips', options: ['<21 days', '21-35 days (normal)', '>35 days', 'Variable', 'Absent'] },
      duration_flow: { label: 'Flow duration', type: 'chips', options: ['1-3 days', '4-5 days', '6-7 days', '>7 days'] },
      associated: { label: 'Associated', type: 'chips', options: ['Clots', 'Cramping', 'Weight changes', 'Acne', 'Hirsutism', 'Hot flashes', 'Mood changes', 'Infertility'], multi: true },
      contraception: { label: 'Contraception', type: 'chips', options: ['None', 'OCP', 'IUD/Copper-T', 'Hormonal IUD', 'Other'] },
    }},
  { name: 'Hot Flashes', category: 'Endocrine', aliases: ['menopausal symptoms', 'flushing', 'hot flushes'],
    attributes: {
      frequency: { label: 'Frequency', type: 'chips', options: ['Occasional', 'Several per day', 'Hourly', 'Nocturnal only'] },
      severity: { label: 'Severity', type: 'chips', options: ['Mild warmth', 'Moderate with sweating', 'Severe with drenching sweat'] },
      duration_each: { label: 'Duration each', type: 'chips', options: ['Seconds', 'Minutes', 'Prolonged'] },
      associated: { label: 'Associated', type: 'chips', options: ['Sleep disturbance', 'Mood changes', 'Vaginal dryness', 'Night sweats', 'Anxiety', 'Palpitations'], multi: true },
    }},

  // ============================================================
  // EYE (5)
  // ============================================================
  { name: 'Eye Pain', category: 'Ophthalmology', aliases: ['painful eye', 'eye ache'],
    attributes: {
      type: { label: 'Type', type: 'chips', options: ['Sharp', 'Dull aching', 'Burning', 'Foreign body sensation', 'Deep boring'] },
      laterality: { label: 'Side', type: 'chips', options: ['Right', 'Left', 'Both'] },
      associated: { label: 'Associated', type: 'chips', options: ['Redness', 'Watering', 'Discharge', 'Blurred vision', 'Photophobia', 'Headache', 'Halos around lights', 'Nausea'], multi: true },
      onset: { label: 'Onset', type: 'chips', options: ['Sudden', 'Gradual', 'After trauma', 'After surgery', 'With headache'] },
    }},
  { name: 'Vision Loss', category: 'Ophthalmology', aliases: ['blurred vision', 'cannot see', 'visual disturbance'],
    attributes: {
      type: { label: 'Type', type: 'chips', options: ['Blurred (gradual)', 'Sudden complete', 'Central scotoma', 'Peripheral field loss', 'Curtain coming down', 'Floaters/flashes', 'Double vision'] },
      laterality: { label: 'Side', type: 'chips', options: ['Right eye', 'Left eye', 'Both eyes'] },
      onset: { label: 'Onset', type: 'chips', options: ['Sudden (seconds/minutes)', 'Over hours', 'Over days', 'Gradual (weeks/months)'] },
      associated: { label: 'Associated', type: 'chips', options: ['Eye pain', 'Headache', 'Redness', 'Flashes', 'Floaters', 'Diabetes', 'Hypertension'], multi: true },
    }},
  { name: 'Red Eye', category: 'Ophthalmology', aliases: ['conjunctivitis', 'eye redness', 'bloodshot eye'],
    attributes: {
      laterality: { label: 'Side', type: 'chips', options: ['Right', 'Left', 'Both'] },
      discharge: { label: 'Discharge', type: 'chips', options: ['None', 'Watery', 'Mucoid', 'Purulent (yellow-green)', 'Blood-stained'] },
      associated: { label: 'Associated', type: 'chips', options: ['Pain', 'Itching', 'Photophobia', 'Blurred vision', 'Foreign body sensation', 'Contact lens use', 'Recent URTI'], multi: true },
      onset: { label: 'Onset', type: 'chips', options: ['Sudden', 'Gradual', 'After trauma', 'After swimming', 'Recurrent'] },
    }},
  { name: 'Itchy Eyes', category: 'Ophthalmology', aliases: ['eye allergy', 'allergic conjunctivitis'],
    attributes: {
      laterality: { label: 'Side', type: 'chips', options: ['Right', 'Left', 'Both'] },
      triggers: { label: 'Triggers', type: 'chips', options: ['Dust', 'Pollen', 'Smoke', 'Pet dander', 'Seasonal', 'No trigger'], multi: true },
      associated: { label: 'Associated', type: 'chips', options: ['Watering', 'Redness', 'Swelling of lids', 'Sneezing', 'Nasal congestion', 'Skin eczema'], multi: true },
      duration: { label: 'Duration', type: 'duration' },
    }},
  { name: 'Dry Eyes', category: 'Ophthalmology', aliases: ['gritty eyes', 'eye dryness'],
    attributes: {
      symptoms: { label: 'Symptoms', type: 'chips', options: ['Burning', 'Gritty/sandy feeling', 'Stinging', 'Tired eyes', 'Blurred vision', 'Excessive tearing (reflex)'], multi: true },
      aggravating: { label: 'Aggravating', type: 'chips', options: ['Screen use', 'Air conditioning', 'Reading', 'Driving', 'Wind', 'Contact lenses'], multi: true },
      associated: { label: 'Associated', type: 'chips', options: ['Dry mouth', 'Joint pain', 'Autoimmune disease', 'Medications (antihistamines)', 'Post-LASIK'], multi: true },
    }},

  // ============================================================
  // ENT (4)
  // ============================================================
  { name: 'Ear Pain', category: 'ENT', aliases: ['otalgia', 'earache'],
    attributes: {
      side: { label: 'Side', type: 'chips', options: ['Right', 'Left', 'Both'] },
      type: { label: 'Type', type: 'chips', options: ['Deep boring', 'Sharp', 'Throbbing', 'Dull'] },
      duration: { label: 'Duration', type: 'duration' },
      associated: { label: 'Associated', type: 'chips', options: ['Discharge', 'Hearing loss', 'Tinnitus', 'Fever', 'Sore throat', 'Jaw pain', 'Vertigo'], multi: true },
    }},
  { name: 'Hearing Loss', category: 'ENT', aliases: ['deafness', 'cannot hear', 'hard of hearing'],
    attributes: {
      side: { label: 'Side', type: 'chips', options: ['Right', 'Left', 'Both'] },
      onset: { label: 'Onset', type: 'chips', options: ['Sudden', 'Gradual', 'Progressive', 'After noise exposure', 'After infection'] },
      type: { label: 'Suspected type', type: 'chips', options: ['Conductive (ear blocked feeling)', 'Sensorineural (nerve type)', 'Mixed', 'Unsure'] },
      associated: { label: 'Associated', type: 'chips', options: ['Tinnitus', 'Vertigo', 'Ear discharge', 'Ear pain', 'Fullness', 'Family history'], multi: true },
    }},
  { name: 'Tinnitus', category: 'ENT', aliases: ['ringing in ears', 'ear noise', 'buzzing in ears'],
    attributes: {
      side: { label: 'Side', type: 'chips', options: ['Right', 'Left', 'Both', 'Head (central)'] },
      type: { label: 'Type', type: 'chips', options: ['Ringing', 'Buzzing', 'Hissing', 'Pulsatile', 'Clicking', 'Roaring'] },
      timing: { label: 'Timing', type: 'chips', options: ['Constant', 'Intermittent', 'Night only', 'In silence'] },
      severity: { label: 'Severity', type: 'scale' },
      associated: { label: 'Associated', type: 'chips', options: ['Hearing loss', 'Vertigo', 'Headache', 'Stress', 'Noise exposure', 'Medication (aspirin)'], multi: true },
    }},
  { name: 'Difficulty Swallowing (ENT)', category: 'ENT', aliases: ['throat dysphagia', 'globus sensation', 'lump in throat'],
    attributes: {
      type: { label: 'Type', type: 'chips', options: ['Solids', 'Liquids', 'Both', 'Globus (lump sensation)', 'Pain on swallowing'] },
      level: { label: 'Level', type: 'chips', options: ['Throat', 'Neck', 'Behind sternum'] },
      onset: { label: 'Onset', type: 'chips', options: ['Sudden', 'Gradual', 'Intermittent', 'Progressive'] },
      associated: { label: 'Associated', type: 'chips', options: ['Weight loss', 'Hoarseness', 'Cough after swallowing', 'Neck lump', 'GERD', 'Anxiety'], multi: true },
    }},

  // ============================================================
  // PSYCHIATRY (5)
  // ============================================================
  { name: 'Anxiety', category: 'Psychiatry', aliases: ['nervousness', 'worry', 'panic attacks', 'anxious'],
    attributes: {
      type: { label: 'Type', type: 'chips', options: ['Generalized (constant worry)', 'Panic attacks', 'Social anxiety', 'Phobia-specific', 'Health anxiety', 'OCD features'] },
      severity: { label: 'Severity', type: 'scale' },
      physical: { label: 'Physical symptoms', type: 'chips', options: ['Palpitations', 'Sweating', 'Trembling', 'Breathlessness', 'Chest tightness', 'Nausea', 'Dizziness', 'Numbness/tingling'], multi: true },
      triggers: { label: 'Triggers', type: 'chips', options: ['Work stress', 'Financial', 'Health concerns', 'Social situations', 'Specific phobia', 'No trigger'], multi: true },
      duration: { label: 'Duration', type: 'duration' },
      impact: { label: 'Impact', type: 'chips', options: ['Mild - manageable', 'Moderate - affects work/social', 'Severe - avoidance behavior', 'Cannot leave home'] },
    }},
  { name: 'Depression', category: 'Psychiatry', aliases: ['low mood', 'sadness', 'feeling depressed', 'loss of interest'],
    attributes: {
      symptoms: { label: 'Core symptoms', type: 'chips', options: ['Low mood', 'Loss of interest', 'Fatigue', 'Sleep disturbance', 'Appetite change', 'Concentration problems', 'Guilt/worthlessness', 'Psychomotor retardation', 'Suicidal thoughts'], multi: true },
      duration: { label: 'Duration', type: 'duration' },
      severity: { label: 'Severity', type: 'chips', options: ['Mild', 'Moderate', 'Severe', 'With psychotic features'] },
      sleep: { label: 'Sleep', type: 'chips', options: ['Insomnia', 'Early morning waking', 'Hypersomnia', 'Normal'] },
      previous: { label: 'Previous episodes', type: 'chips', options: ['First episode', 'Recurrent', 'Chronic', 'Bipolar history'] },
      treatment: { label: 'Current treatment', type: 'chips', options: ['None', 'Antidepressant', 'Counseling', 'Both', 'Stopped treatment'] },
    }},
  { name: 'Insomnia', category: 'Psychiatry', aliases: ['cannot sleep', 'sleeplessness', 'poor sleep'],
    attributes: {
      type: { label: 'Type', type: 'chips', options: ['Cannot fall asleep', 'Cannot stay asleep', 'Early morning waking', 'Non-restorative sleep'] },
      duration: { label: 'Duration', type: 'duration' },
      sleep_time: { label: 'Hours of sleep', type: 'chips', options: ['< 3 hours', '3-5 hours', '5-6 hours', '> 6 hours'] },
      daytime: { label: 'Daytime impact', type: 'chips', options: ['Fatigue', 'Irritability', 'Poor concentration', 'Drowsiness', 'Accidents', 'No impact'], multi: true },
      causes: { label: 'Contributing factors', type: 'chips', options: ['Anxiety/worry', 'Pain', 'Caffeine', 'Screen time', 'Shift work', 'Medications', 'Environment'], multi: true },
    }},
  { name: 'Substance Use', category: 'Psychiatry', aliases: ['alcohol problem', 'drug abuse', 'addiction'],
    attributes: {
      substance: { label: 'Substance', type: 'chips', options: ['Alcohol', 'Tobacco', 'Cannabis', 'Opioids', 'Benzodiazepines', 'Stimulants', 'Inhalants', 'Multiple'], multi: true },
      pattern: { label: 'Pattern', type: 'chips', options: ['Daily', 'Binge', 'Weekend only', 'Increasing quantity', 'Withdrawal symptoms'] },
      reason_visit: { label: 'Reason for visit', type: 'chips', options: ['Wants to quit', 'Withdrawal symptoms', 'Medical complication', 'Family pressure', 'Legal issues'] },
      withdrawal: { label: 'Withdrawal symptoms', type: 'chips', options: ['Tremors', 'Sweating', 'Anxiety', 'Seizures', 'Hallucinations', 'Insomnia', 'Nausea', 'None'], multi: true },
    }},
  { name: 'Psychosis', category: 'Psychiatry', aliases: ['hallucinations', 'delusions', 'hearing voices', 'paranoia'],
    attributes: {
      symptoms: { label: 'Symptoms', type: 'chips', options: ['Auditory hallucinations', 'Visual hallucinations', 'Persecutory delusions', 'Grandiose delusions', 'Thought insertion', 'Disorganized speech', 'Disorganized behavior', 'Catatonia'], multi: true },
      onset: { label: 'Onset', type: 'chips', options: ['Acute (days)', 'Subacute (weeks)', 'Chronic', 'Relapse'] },
      insight: { label: 'Insight', type: 'chips', options: ['Good (knows something is wrong)', 'Partial', 'Absent'] },
      triggers: { label: 'Triggers', type: 'chips', options: ['Medication non-compliance', 'Substance use', 'Stress', 'Medical illness', 'None'], multi: true },
      functioning: { label: 'Functioning', type: 'chips', options: ['Self-care intact', 'Needs supervision', 'Cannot care for self', 'Aggressive/dangerous'] },
    }},

  // ============================================================
  // PEDIATRIC-SPECIFIC (4)
  // ============================================================
  { name: 'Fever (Pediatric)', category: 'Pediatric', aliases: ['child fever', 'baby fever'],
    attributes: {
      grade: { label: 'Grade', type: 'chips', options: ['Low (99-100°F)', 'Moderate (100-102°F)', 'High (>102°F)'] },
      duration: { label: 'Duration', type: 'duration' },
      feeding: { label: 'Feeding', type: 'chips', options: ['Normal feeding', 'Reduced', 'Refusing feeds', 'Vomiting feeds'] },
      activity: { label: 'Activity', type: 'chips', options: ['Playful', 'Irritable', 'Lethargic', 'Inconsolable crying', 'Limp/floppy'] },
      associated: { label: 'Associated', type: 'chips', options: ['Cough', 'Cold', 'Rash', 'Diarrhea', 'Vomiting', 'Ear pulling', 'Seizure', 'Dehydration signs'], multi: true },
      red_flags: { label: 'Red flags', type: 'chips', options: ['< 3 months old', 'Bulging fontanelle', 'Non-blanching rash', 'Seizure', 'Stiff neck', 'Reduced consciousness', 'None'], multi: true },
    }},
  { name: 'Not Feeding Well', category: 'Pediatric', aliases: ['poor feeding', 'refusing feeds', 'baby not eating'],
    attributes: {
      type: { label: 'Feeding type', type: 'chips', options: ['Breastfed', 'Formula fed', 'Mixed', 'Weaning foods', 'Regular diet'] },
      change: { label: 'Change', type: 'chips', options: ['Complete refusal', 'Reduced quantity', 'Vomiting after feeds', 'Fussy/irritable with feeds'] },
      duration: { label: 'Duration', type: 'duration' },
      urine: { label: 'Urine output', type: 'chips', options: ['Normal wet nappies', 'Reduced', 'Very few/dry'] },
      associated: { label: 'Associated', type: 'chips', options: ['Fever', 'Vomiting', 'Diarrhea', 'Cough/cold', 'Rash', 'Lethargy', 'Weight loss'], multi: true },
    }},
  { name: 'Crying Excessively', category: 'Pediatric', aliases: ['colic', 'baby crying', 'inconsolable'],
    attributes: {
      pattern: { label: 'Pattern', type: 'chips', options: ['Evening colic', 'After feeds', 'Constant', 'With drawing up legs', 'Sudden onset (pain)'] },
      duration: { label: 'Duration', type: 'duration' },
      feeding: { label: 'Feeding', type: 'chips', options: ['Normal', 'Reduced', 'Refusing', 'Excessive'] },
      associated: { label: 'Associated', type: 'chips', options: ['Abdominal distension', 'Vomiting', 'Blood in stool', 'Fever', 'Rash', 'Pulling ear', 'Red/swollen area'], multi: true },
    }},
  { name: 'Developmental Delay', category: 'Pediatric', aliases: ['milestone delay', 'not walking', 'not talking'],
    attributes: {
      areas: { label: 'Areas affected', type: 'chips', options: ['Gross motor', 'Fine motor', 'Speech/language', 'Social', 'Cognitive', 'Global (all areas)'], multi: true },
      severity: { label: 'Severity', type: 'chips', options: ['Mild delay', 'Moderate delay', 'Severe delay', 'Regression (lost skills)'] },
      associated: { label: 'Associated', type: 'chips', options: ['Seizures', 'Hearing concern', 'Vision concern', 'Behavioral issues', 'Feeding difficulties', 'Abnormal movements'], multi: true },
      birth_history: { label: 'Birth history', type: 'chips', options: ['Normal delivery', 'Preterm', 'Birth asphyxia', 'NICU stay', 'Low birth weight', 'Normal'] },
    }},

  // ============================================================
  // OB-GYN (5)
  // ============================================================
  { name: 'Vaginal Bleeding', category: 'OB-GYN', aliases: ['PV bleeding', 'abnormal uterine bleeding'],
    attributes: {
      type: { label: 'Type', type: 'chips', options: ['Heavy menstrual', 'Intermenstrual', 'Post-coital', 'Postmenopausal', 'First trimester', 'Second/third trimester'] },
      amount: { label: 'Amount', type: 'chips', options: ['Spotting', 'Moderate', 'Heavy (soaking pad/hour)', 'With clots'] },
      duration: { label: 'Duration', type: 'duration' },
      pregnancy: { label: 'Pregnancy status', type: 'chips', options: ['Not pregnant', 'Early pregnancy', 'Late pregnancy', 'Postpartum', 'Unsure'] },
      associated: { label: 'Associated', type: 'chips', options: ['Pain', 'Fever', 'Discharge', 'Dizziness', 'Products passed', 'Fetal movements reduced'], multi: true },
    }},
  { name: 'Vaginal Discharge', category: 'OB-GYN', aliases: ['white discharge', 'leucorrhoea', 'PV discharge'],
    attributes: {
      color: { label: 'Color', type: 'chips', options: ['White', 'Yellow', 'Green', 'Grey', 'Blood-tinged', 'Brown'] },
      consistency: { label: 'Consistency', type: 'chips', options: ['Thin watery', 'Thick curd-like', 'Frothy', 'Mucoid'] },
      odor: { label: 'Odor', type: 'chips', options: ['None', 'Fishy', 'Foul-smelling', 'Mild'] },
      associated: { label: 'Associated', type: 'chips', options: ['Itching', 'Burning', 'Dysuria', 'Dyspareunia', 'Lower abdominal pain', 'Fever'], multi: true },
      duration: { label: 'Duration', type: 'duration' },
    }},
  { name: 'Lower Abdominal Pain (Gynae)', category: 'OB-GYN', aliases: ['pelvic pain', 'period pain', 'dysmenorrhea'],
    attributes: {
      type: { label: 'Type', type: 'chips', options: ['Crampy (menstrual)', 'Sharp', 'Dull aching', 'Colicky', 'Constant'] },
      relation_to_cycle: { label: 'Relation to cycle', type: 'chips', options: ['During periods', 'Mid-cycle (ovulation)', 'Premenstrual', 'No relation', 'Postmenopausal'] },
      severity: { label: 'Severity', type: 'scale' },
      laterality: { label: 'Side', type: 'chips', options: ['Central', 'Right iliac fossa', 'Left iliac fossa', 'Bilateral'] },
      associated: { label: 'Associated', type: 'chips', options: ['Vaginal bleeding', 'Discharge', 'Fever', 'Nausea', 'Urinary symptoms', 'Missed period', 'Dyspareunia'], multi: true },
    }},
  { name: 'Pregnancy Symptoms', category: 'OB-GYN', aliases: ['morning sickness', 'pregnancy nausea', 'antenatal complaint'],
    attributes: {
      trimester: { label: 'Trimester', type: 'chips', options: ['First (1-12 wks)', 'Second (13-27 wks)', 'Third (28-40 wks)'] },
      symptoms: { label: 'Symptoms', type: 'chips', options: ['Nausea/vomiting', 'Heartburn', 'Back pain', 'Swollen feet', 'Headache', 'Blurred vision', 'Reduced fetal movements', 'Leaking fluid', 'Contractions'], multi: true },
      severity: { label: 'Impact', type: 'chips', options: ['Mild - manageable', 'Moderate - affects daily life', 'Severe - cannot eat/drink', 'Hospitalization needed'] },
      red_flags: { label: 'Red flags', type: 'chips', options: ['Severe headache', 'Visual changes', 'Epigastric pain', 'Reduced fetal movements', 'PV bleeding', 'Leaking fluid', 'BP >140/90', 'None'], multi: true },
    }},
  { name: 'Breast Lump', category: 'OB-GYN', aliases: ['breast swelling', 'breast pain', 'mastalgia'],
    attributes: {
      side: { label: 'Side', type: 'chips', options: ['Right', 'Left', 'Bilateral'] },
      onset: { label: 'Onset', type: 'chips', options: ['Recent (weeks)', 'Months', 'Years', 'Cyclical'] },
      character: { label: 'Character', type: 'chips', options: ['Firm', 'Hard', 'Soft', 'Tender', 'Mobile', 'Fixed', 'Painful', 'Painless'] },
      associated: { label: 'Associated', type: 'chips', options: ['Nipple discharge', 'Skin changes', 'Nipple retraction', 'Axillary lump', 'Weight loss', 'Family history breast cancer'], multi: true },
      cyclical: { label: 'Cyclical', type: 'chips', options: ['Yes - worse premenstrual', 'No - constant', 'Postmenopausal'] },
    }},

  // ============================================================
  // SURGICAL (5)
  // ============================================================
  { name: 'Hernia', category: 'Surgical', aliases: ['inguinal swelling', 'groin swelling', 'umbilical hernia'],
    attributes: {
      location: { label: 'Location', type: 'chips', options: ['Inguinal (R)', 'Inguinal (L)', 'Inguinal (bilateral)', 'Umbilical', 'Incisional', 'Epigastric', 'Femoral'] },
      reducibility: { label: 'Reducibility', type: 'chips', options: ['Reducible', 'Irreducible', 'Partially reducible'] },
      onset: { label: 'Onset', type: 'chips', options: ['Gradual', 'After straining/lifting', 'Since childhood', 'Post-surgery'] },
      symptoms: { label: 'Symptoms', type: 'chips', options: ['Pain', 'Dragging sensation', 'Increases on standing', 'Increases on coughing', 'Vomiting', 'Constipation', 'Asymptomatic'], multi: true },
      emergency: { label: 'Emergency signs', type: 'chips', options: ['Tender irreducible', 'Vomiting', 'Abdominal distension', 'Skin changes over swelling', 'None'], multi: true },
    }},
  { name: 'Abscess', category: 'Surgical', aliases: ['boil', 'pus collection', 'swelling with pus'],
    attributes: {
      location: { label: 'Location', type: 'text' },
      size: { label: 'Size', type: 'chips', options: ['< 2 cm', '2-5 cm', '5-10 cm', '> 10 cm'] },
      duration: { label: 'Duration', type: 'duration' },
      symptoms: { label: 'Symptoms', type: 'chips', options: ['Pain', 'Swelling', 'Redness', 'Warmth', 'Discharge', 'Fever'], multi: true },
      recurrence: { label: 'Recurrence', type: 'chips', options: ['First time', 'Recurrent same site', 'Recurrent different sites', 'Diabetes present'] },
    }},
  { name: 'Wound / Laceration', category: 'Surgical', aliases: ['cut', 'injury', 'wound'],
    attributes: {
      mechanism: { label: 'Mechanism', type: 'chips', options: ['Sharp (knife/glass)', 'Blunt trauma', 'Fall', 'Road accident', 'Animal bite', 'Human bite', 'Machinery'] },
      location: { label: 'Location', type: 'text' },
      bleeding: { label: 'Bleeding', type: 'chips', options: ['Stopped', 'Ongoing (slow)', 'Ongoing (heavy)', 'Arterial spurting'] },
      depth: { label: 'Depth', type: 'chips', options: ['Superficial', 'Deep (subcutaneous)', 'Bone/tendon visible', 'Unsure'] },
      tetanus: { label: 'Tetanus status', type: 'chips', options: ['Up to date', 'Unsure', 'Never vaccinated', 'Needs booster'] },
      contamination: { label: 'Contamination', type: 'chips', options: ['Clean', 'Dirty/contaminated', 'Animal saliva', 'Rusty object'] },
    }},
  { name: 'Burns', category: 'Surgical', aliases: ['burn injury', 'scald', 'thermal injury'],
    attributes: {
      cause: { label: 'Cause', type: 'chips', options: ['Flame', 'Scald (hot water)', 'Electrical', 'Chemical', 'Contact (hot surface)', 'Radiation', 'Steam'] },
      extent: { label: 'Extent', type: 'chips', options: ['< 10% TBSA', '10-20% TBSA', '20-40% TBSA', '> 40% TBSA', 'Localized (hand/face)'] },
      depth: { label: 'Depth', type: 'chips', options: ['Superficial (red, painful)', 'Partial thickness (blisters)', 'Deep partial', 'Full thickness (white/charred)'] },
      areas: { label: 'Areas involved', type: 'chips', options: ['Face', 'Hands', 'Feet', 'Perineum', 'Trunk', 'Limbs', 'Circumferential'], multi: true },
      airway: { label: 'Airway involvement', type: 'chips', options: ['Singed nasal hair', 'Soot in mouth', 'Hoarse voice', 'Stridor', 'None'] },
    }},
  { name: 'Post-operative Pain', category: 'Surgical', aliases: ['surgical site pain', 'post-surgery pain'],
    attributes: {
      surgery: { label: 'Surgery type', type: 'text' },
      day: { label: 'Post-op day', type: 'chips', options: ['Day 0-1', 'Day 2-3', 'Day 4-7', 'Week 2-4', '> 4 weeks'] },
      severity: { label: 'Severity', type: 'scale' },
      character: { label: 'Character', type: 'chips', options: ['Expected surgical pain', 'Increasing (not improving)', 'New onset', 'Different from before'] },
      wound: { label: 'Wound', type: 'chips', options: ['Clean and dry', 'Redness', 'Discharge', 'Dehiscence', 'Swelling', 'Warmth'], multi: true },
      associated: { label: 'Associated', type: 'chips', options: ['Fever', 'Nausea', 'Constipation', 'Urinary retention', 'Leg swelling', 'Breathlessness'], multi: true },
    }},

  // ============================================================
  // INFECTIOUS DISEASE (5)
  // ============================================================
  { name: 'Dengue Symptoms', category: 'Infectious', aliases: ['dengue fever', 'break-bone fever'],
    attributes: {
      phase: { label: 'Phase', type: 'chips', options: ['Febrile (day 1-3)', 'Critical (day 4-6)', 'Recovery (day 7+)'] },
      symptoms: { label: 'Symptoms', type: 'chips', options: ['High fever', 'Severe headache', 'Retro-orbital pain', 'Body ache', 'Joint pain', 'Rash', 'Nausea', 'Vomiting'], multi: true },
      warning_signs: { label: 'Warning signs', type: 'chips', options: ['Abdominal pain', 'Persistent vomiting', 'Mucosal bleed', 'Lethargy', 'Hepatomegaly', 'Rising HCT with falling platelets', 'None'], multi: true },
      platelet: { label: 'Last platelet count', type: 'text' },
    }},
  { name: 'Malaria Symptoms', category: 'Infectious', aliases: ['malaria', 'chills and rigors'],
    attributes: {
      pattern: { label: 'Fever pattern', type: 'chips', options: ['Alternate day (tertian)', 'Every 3rd day (quartan)', 'Daily', 'Irregular'] },
      symptoms: { label: 'Symptoms', type: 'chips', options: ['Chills → rigors → sweating', 'Headache', 'Body ache', 'Nausea/vomiting', 'Jaundice', 'Dark urine'], multi: true },
      severity: { label: 'Severity', type: 'chips', options: ['Uncomplicated', 'Severe (cerebral)', 'Severe (renal)', 'Severe (hepatic)'] },
      travel: { label: 'Travel/exposure', type: 'chips', options: ['Endemic area resident', 'Recent travel to endemic area', 'No travel history'] },
    }},
  { name: 'Typhoid Symptoms', category: 'Infectious', aliases: ['typhoid fever', 'enteric fever'],
    attributes: {
      week: { label: 'Week of illness', type: 'chips', options: ['Week 1 (step-ladder fever)', 'Week 2 (plateau fever)', 'Week 3 (complications)', 'Treated/recovering'] },
      symptoms: { label: 'Symptoms', type: 'chips', options: ['Step-ladder fever', 'Headache', 'Abdominal pain', 'Constipation then diarrhea', 'Rose spots', 'Coated tongue', 'Hepatosplenomegaly', 'Bradycardia'], multi: true },
      complications: { label: 'Complications', type: 'chips', options: ['GI bleeding', 'Perforation', 'Encephalopathy', 'Myocarditis', 'None'], multi: true },
    }},
  { name: 'COVID Symptoms', category: 'Infectious', aliases: ['corona symptoms', 'COVID-19', 'SARS-CoV-2'],
    attributes: {
      symptoms: { label: 'Symptoms', type: 'chips', options: ['Fever', 'Cough', 'Sore throat', 'Body ache', 'Loss of smell/taste', 'Breathlessness', 'Fatigue', 'Headache', 'Diarrhea', 'Chest pain'], multi: true },
      severity: { label: 'Severity', type: 'chips', options: ['Mild (home manageable)', 'Moderate (needs O2)', 'Severe (ICU)', 'Asymptomatic positive'] },
      spo2: { label: 'SpO2', type: 'chips', options: ['> 95%', '93-95%', '90-93%', '< 90%'] },
      vaccination: { label: 'Vaccination', type: 'chips', options: ['Fully vaccinated + booster', 'Fully vaccinated', 'Partially vaccinated', 'Unvaccinated'] },
      risk_factors: { label: 'Risk factors', type: 'chips', options: ['Age >60', 'Diabetes', 'Hypertension', 'Obesity', 'Immunosuppressed', 'Lung disease', 'None'], multi: true },
    }},
  { name: 'Tuberculosis Symptoms', category: 'Infectious', aliases: ['TB symptoms', 'suspected TB'],
    attributes: {
      symptoms: { label: 'Symptoms', type: 'chips', options: ['Cough > 2 weeks', 'Hemoptysis', 'Evening fever', 'Night sweats', 'Weight loss', 'Loss of appetite', 'Lymph node swelling', 'Back pain (spinal TB)'], multi: true },
      duration: { label: 'Duration', type: 'duration' },
      contact: { label: 'Contact history', type: 'chips', options: ['Known TB contact', 'Household member on ATT', 'Healthcare worker', 'No known contact'] },
      previous: { label: 'Previous TB', type: 'chips', options: ['Never treated', 'Previously treated (completed)', 'Defaulted treatment', 'MDR-TB history'] },
      site: { label: 'Suspected site', type: 'chips', options: ['Pulmonary', 'Lymph node', 'Pleural', 'Abdominal', 'Spinal', 'CNS', 'Disseminated'], multi: true },
    }},
];

// ============================================================
// SEARCH / MATCH
// ============================================================
export function searchTemplates(query: string): ComplaintTemplate[] {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  return COMPLAINT_TEMPLATES.filter(t =>
    t.name.toLowerCase().includes(q) ||
    t.category.toLowerCase().includes(q) ||
    t.aliases.some(a => a.toLowerCase().includes(q))
  ).slice(0, 12);
}

export function getTemplateByName(name: string): ComplaintTemplate | undefined {
  const n = name.toLowerCase();
  return COMPLAINT_TEMPLATES.find(t =>
    t.name.toLowerCase() === n ||
    t.aliases.some(a => a.toLowerCase() === n)
  );
}

export function getTemplatesByCategory(category: string): ComplaintTemplate[] {
  return COMPLAINT_TEMPLATES.filter(t => t.category === category);
}

export const CATEGORIES = [...new Set(COMPLAINT_TEMPLATES.map(t => t.category))];
