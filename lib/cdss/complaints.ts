// lib/cdss/complaints.ts
// Chief complaint templates with HPI builders

export interface ComplaintTemplate {
  label: string;
  keywords: string[];
  hpiChips: string[];          // quick-select HPI descriptors
  durationOptions: string[];   // common duration selections
  relatedComplaints: string[]; // commonly associated complaints
}

export const COMPLAINT_TEMPLATES: ComplaintTemplate[] = [
  {
    label: 'Fever',
    keywords: ['fever', 'temperature', 'bukhar', 'tapaman'],
    hpiChips: ['High grade', 'Low grade', 'Intermittent', 'Continuous', 'With chills', 'With rigors', 'Night sweats', 'Evening rise', 'Step-ladder pattern', 'Responds to paracetamol', 'Not responding to paracetamol'],
    durationOptions: ['1 day', '2 days', '3 days', '5 days', '1 week', '2 weeks', '>2 weeks'],
    relatedComplaints: ['Body ache', 'Headache', 'Cold', 'Cough', 'Sore throat', 'Vomiting', 'Loose motions']
  },
  {
    label: 'Chest Pain',
    keywords: ['chest pain', 'chhati ma dard'],
    hpiChips: ['Central/retrosternal', 'Left-sided', 'Right-sided', 'Crushing/pressure', 'Sharp/stabbing', 'Burning', 'Radiating to left arm', 'Radiating to jaw', 'On exertion', 'At rest', 'Relieved by rest', 'Relieved by sorbitrate', 'With sweating', 'With breathlessness', 'Pleuritic (worse on breathing)', 'Positional'],
    durationOptions: ['Minutes', '30 min', '1 hour', 'Few hours', '1 day', 'Recurrent episodes'],
    relatedComplaints: ['Breathlessness', 'Sweating', 'Palpitations', 'Nausea', 'Giddiness', 'Jaw pain']
  },
  {
    label: 'Breathlessness',
    keywords: ['breathlessness', 'dyspnea', 'sob', 'shvas', 'difficulty breathing'],
    hpiChips: ['On exertion', 'At rest', 'Orthopnea', 'PND', 'Progressive', 'Sudden onset', 'Wheezing', 'With chest tightness', 'NYHA Class I', 'NYHA Class II', 'NYHA Class III', 'NYHA Class IV', 'Nocturnal', 'Episodic'],
    durationOptions: ['Acute (hours)', '1 day', '3 days', '1 week', 'Progressive over weeks', 'Chronic (months)'],
    relatedComplaints: ['Cough', 'Chest pain', 'Pedal edema', 'Palpitations', 'Wheeze', 'Fever']
  },
  {
    label: 'Headache',
    keywords: ['headache', 'head pain', 'mathanu dard', 'cephalgia'],
    hpiChips: ['Unilateral', 'Bilateral', 'Frontal', 'Occipital', 'Temporal', 'Throbbing', 'Band-like', 'Thunderclap onset', 'With aura', 'With nausea', 'With photophobia', 'With phonophobia', 'Worse in morning', 'Worse on bending', 'With visual disturbance', 'With neck stiffness'],
    durationOptions: ['Hours', '1 day', '3 days', '1 week', 'Recurrent episodes', 'Chronic daily'],
    relatedComplaints: ['Nausea', 'Vomiting', 'Visual disturbance', 'Neck pain', 'Giddiness', 'Fever']
  },
  {
    label: 'Abdominal Pain',
    keywords: ['abdominal pain', 'stomach pain', 'pet ma dard', 'belly ache'],
    hpiChips: ['Epigastric', 'Right upper quadrant', 'Left upper quadrant', 'Right lower quadrant', 'Left lower quadrant', 'Periumbilical', 'Diffuse', 'Colicky', 'Constant', 'Burning', 'After food', 'Before food', 'Radiating to back', 'With bloating', 'Relieved by antacids', 'Worse after fatty food'],
    durationOptions: ['Hours', '1 day', '3 days', '1 week', '2 weeks', 'Recurrent episodes', 'Chronic'],
    relatedComplaints: ['Nausea', 'Vomiting', 'Loose motions', 'Constipation', 'Bloating', 'Loss of appetite', 'Fever', 'Jaundice']
  },
  {
    label: 'Cough',
    keywords: ['cough', 'khansi', 'khasvu'],
    hpiChips: ['Dry', 'Productive', 'White sputum', 'Yellow/green sputum', 'Blood-tinged', 'Hemoptysis', 'Nocturnal', 'Morning predominance', 'Barking', 'Paroxysmal', 'Worse on lying down', 'With wheezing'],
    durationOptions: ['3 days', '1 week', '2 weeks', '3 weeks', '>3 weeks (chronic)', '>8 weeks'],
    relatedComplaints: ['Fever', 'Breathlessness', 'Chest pain', 'Cold', 'Sore throat', 'Weight loss', 'Night sweats']
  },
  {
    label: 'Vomiting',
    keywords: ['vomiting', 'emesis', 'ulti'],
    hpiChips: ['Non-bilious', 'Bilious', 'Projectile', 'Blood-tinged', 'Coffee-ground', 'After food', 'Early morning', 'With nausea', 'Relieved after vomiting', 'Associated with vertigo', 'Feculent'],
    durationOptions: ['Few hours', '1 day', '2 days', '3 days', '1 week'],
    relatedComplaints: ['Nausea', 'Abdominal pain', 'Loose motions', 'Fever', 'Headache', 'Giddiness']
  },
  {
    label: 'Loose Motions',
    keywords: ['loose motions', 'diarrhea', 'jullab', 'loose stools'],
    hpiChips: ['Watery', 'Mucoid', 'Bloody', 'Rice-water', 'Frequent (>6/day)', 'With cramps', 'Nocturnal', 'Post-prandial', 'Explosive', 'Steatorrhea (oily)', 'With tenesmus'],
    durationOptions: ['1 day', '2 days', '3 days', '1 week', '2 weeks', '>4 weeks (chronic)'],
    relatedComplaints: ['Vomiting', 'Abdominal pain', 'Fever', 'Dehydration', 'Loss of appetite']
  },
  {
    label: 'Weakness / Fatigue',
    keywords: ['weakness', 'fatigue', 'tiredness', 'kamzori', 'thak'],
    hpiChips: ['Generalized', 'Proximal', 'Distal', 'Progressive', 'Episodic', 'Morning stiffness', 'Afternoon fatigue', 'Chronic', 'With weight loss', 'With loss of appetite', 'Unable to do daily activities'],
    durationOptions: ['1 week', '2 weeks', '1 month', '3 months', '>6 months'],
    relatedComplaints: ['Loss of appetite', 'Weight loss', 'Fever', 'Breathlessness', 'Pallor', 'Body ache']
  },
  {
    label: 'Joint Pain',
    keywords: ['joint pain', 'arthralgia', 'sandhino dard'],
    hpiChips: ['Single joint (mono)', 'Few joints (oligo)', 'Multiple joints (poly)', 'Small joints', 'Large joints', 'Symmetric', 'Asymmetric', 'Morning stiffness >30 min', 'Worse with activity', 'Worse with rest', 'With swelling', 'Migratory', 'With redness/warmth'],
    durationOptions: ['Days', '1 week', '2 weeks', '1 month', '3 months', '>6 months'],
    relatedComplaints: ['Swelling', 'Stiffness', 'Fever', 'Skin rash', 'Weakness', 'Back pain']
  },
  {
    label: 'Back Pain',
    keywords: ['back pain', 'backache', 'kamardard', 'lbp'],
    hpiChips: ['Lower back', 'Upper back', 'Central', 'Unilateral', 'Radiating to leg', 'Radiating to buttock', 'Worse on bending', 'Worse on sitting', 'Morning stiffness', 'Relieved by rest', 'Night pain', 'With numbness/tingling', 'After lifting heavy weight', 'With bladder/bowel disturbance'],
    durationOptions: ['Acute (days)', '1 week', '2 weeks', '1 month', '3 months', '>3 months (chronic)'],
    relatedComplaints: ['Leg pain', 'Numbness', 'Weakness in legs', 'Difficulty walking']
  },
  {
    label: 'Giddiness / Vertigo',
    keywords: ['giddiness', 'vertigo', 'dizziness', 'chakkar'],
    hpiChips: ['Rotatory', 'Lightheadedness', 'Positional', 'On standing', 'Constant', 'Episodic', 'With nausea', 'With tinnitus', 'With hearing loss', 'With ear fullness', 'With unsteadiness', 'Worse on head turning'],
    durationOptions: ['Seconds', 'Minutes', 'Hours', '1 day', 'Recurrent episodes', 'Chronic'],
    relatedComplaints: ['Nausea', 'Vomiting', 'Hearing loss', 'Tinnitus', 'Headache', 'Falls']
  },
];

export function searchComplaints(query: string): ComplaintTemplate[] {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];
  return COMPLAINT_TEMPLATES.filter(c =>
    c.label.toLowerCase().includes(q) ||
    c.keywords.some(k => k.includes(q))
  );
}
