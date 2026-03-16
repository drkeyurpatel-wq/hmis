// lib/lab/instrument/instrument-config.ts
// Instrument → LIMS parameter mapping and result processing

import { parseASTMStream, type ASTMResult } from './astm-parser';
import { parseHL7Message, type HL7Result } from './hl7-parser';

// ============================================================
// INSTRUMENT CONFIGURATION
// ============================================================
export interface InstrumentConfig {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  department: string;
  protocol: 'astm' | 'hl7' | 'proprietary';
  connectionType: 'serial' | 'tcp' | 'file';
  // Serial settings
  comPort?: string;
  baudRate?: number;
  dataBits?: number;
  parity?: 'none' | 'even' | 'odd';
  stopBits?: number;
  // TCP settings
  host?: string;
  port?: number;
  // Parameter mapping: instrument code → LIMS parameter code
  parameterMap: Record<string, string>;
  // Test mapping: instrument test ID → LIMS test code
  testMap: Record<string, string>;
  // Unit conversion if needed
  unitConversions?: Record<string, { factor: number; targetUnit: string }>;
  isActive: boolean;
}

// ============================================================
// DEFAULT INSTRUMENT CONFIGS (templates)
// ============================================================
export const INSTRUMENT_TEMPLATES: Record<string, Partial<InstrumentConfig>> = {
  // Sysmex XN-series (Hematology)
  sysmex_xn: {
    manufacturer: 'Sysmex', model: 'XN-550/1000', department: 'Hematology',
    protocol: 'hl7', connectionType: 'tcp', port: 4000,
    parameterMap: {
      'WBC': 'WBC', 'RBC': 'RBC', 'HGB': 'HB', 'HCT': 'PCV',
      'MCV': 'MCV', 'MCH': 'MCH', 'MCHC': 'MCHC', 'PLT': 'PLT',
      'NEUT%': 'NEUT', 'LYMPH%': 'LYMPH', 'MONO%': 'MONO',
      'EO%': 'EOS', 'BASO%': 'BASO', 'RDW-CV': 'RDW', 'MPV': 'MPV',
      'NEUT#': 'NEUT_ABS', 'LYMPH#': 'LYMPH_ABS',
    },
    testMap: { 'CBC': 'CBC', '00400': 'CBC', 'CBC+DIFF': 'CBC' },
  },

  // Mindray BC-5000 (Hematology — 5-part differential)
  // Interface: HL7 v2.3.1 over TCP/IP
  // Default port: 6000 (configurable in Service > Communication on analyzer)
  // Connection: RJ45 Ethernet on back panel
  mindray_bc5000: {
    manufacturer: 'Mindray', model: 'BC-5000', department: 'Hematology',
    protocol: 'hl7', connectionType: 'tcp', port: 6000,
    parameterMap: {
      // CBC parameters — BC-5000 OBX observation IDs
      'WBC': 'WBC',           // x10^9/L → x10^3/uL (same numeric, diff unit label)
      'RBC': 'RBC',           // x10^12/L → million/cumm
      'HGB': 'HB',            // g/L → g/dL (divide by 10)
      'HCT': 'PCV',           // L/L → % (multiply by 100) or already in %
      'MCV': 'MCV',           // fL
      'MCH': 'MCH',           // pg
      'MCHC': 'MCHC',         // g/L → g/dL
      'PLT': 'PLT',           // x10^9/L → x10^3/uL
      'RDW-CV': 'RDW',        // %
      'RDW-SD': 'RDW',        // fL (alternate)
      'MPV': 'MPV',           // fL
      'PDW': 'PDW',           // fL (not in LIMS but captured)
      'PCT': 'PCT',           // % plateletcrit
      'P-LCR': 'PLCR',       // % large platelets
      // 5-part differential (%)
      'Neu%': 'NEUT',         // Neutrophil %
      'Lym%': 'LYMPH',        // Lymphocyte %
      'Mon%': 'MONO',         // Monocyte %
      'Eos%': 'EOS',          // Eosinophil %
      'Bas%': 'BASO',         // Basophil %
      // 5-part differential (absolute) — BC-5000 also sends these
      'Neu#': 'NEUT_ABS',
      'Lym#': 'LYMPH_ABS',
      'Mon#': 'MONO_ABS',
      'Eos#': 'EOS_ABS',
      'Bas#': 'BASO_ABS',
    },
    unitConversions: {
      // BC-5000 reports HGB in g/L, LIMS expects g/dL
      'HGB': { factor: 0.1, targetUnit: 'g/dL' },
      // BC-5000 may report HCT as ratio (0.45), LIMS expects % (45)
      // Only apply if analyzer sends ratio format:
      // 'HCT': { factor: 100, targetUnit: '%' },
    },
    testMap: { 'CBC': 'CBC', 'CBC+DIFF': 'CBC', '00001': 'CBC', 'Automated Count': 'CBC' },
  },

  // Mindray BC-6800/5390 (kept for reference)
  mindray_bc: {
    manufacturer: 'Mindray', model: 'BC-6800/5390', department: 'Hematology',
    protocol: 'hl7', connectionType: 'tcp', port: 6000,
    parameterMap: {
      'WBC': 'WBC', 'RBC': 'RBC', 'HGB': 'HB', 'HCT': 'PCV',
      'MCV': 'MCV', 'MCH': 'MCH', 'MCHC': 'MCHC', 'PLT': 'PLT',
      'Neu%': 'NEUT', 'Lym%': 'LYMPH', 'Mon%': 'MONO',
      'Eos%': 'EOS', 'Bas%': 'BASO', 'RDW-CV': 'RDW', 'MPV': 'MPV',
    },
    testMap: { 'CBC': 'CBC', 'CBC5': 'CBC' },
  },

  // Beckman AU-series (Biochemistry)
  beckman_au: {
    manufacturer: 'Beckman Coulter', model: 'AU680/AU5800', department: 'Biochemistry',
    protocol: 'astm', connectionType: 'serial', baudRate: 9600,
    parameterMap: {
      'GLU': 'FBS', 'BUN': 'BUN', 'CREA': 'CREAT', 'UA': 'URIC',
      'CHOL': 'TCHOL', 'TG': 'TG', 'HDL': 'HDL', 'LDL': 'LDL',
      'TP': 'TP', 'ALB': 'ALB', 'TBIL': 'TBIL', 'DBIL': 'DBIL',
      'AST': 'SGOT', 'ALT': 'SGPT', 'ALP': 'ALP', 'GGT': 'GGT',
      'AMY': 'AMYLASE', 'LIP': 'LIPASE', 'CK': 'CK_MB', 'LDH': 'LDH',
      'Na': 'NA', 'K': 'K', 'Cl': 'CL', 'Ca': 'CA', 'Mg': 'MAGNESIUM',
      'PHOS': 'PHOS', 'Fe': 'IRON',
    },
    testMap: { 'RFT': 'RFT', 'LFT': 'LFT', 'LIPID': 'LIPID', 'ELECTRO': 'ELECTRO' },
  },

  // Roche Cobas c-series (Biochemistry)
  roche_cobas_c: {
    manufacturer: 'Roche', model: 'Cobas c311/c501', department: 'Biochemistry',
    protocol: 'astm', connectionType: 'tcp', port: 5000,
    parameterMap: {
      'GLUC': 'FBS', 'UREA': 'UREA', 'CREJ': 'CREAT', 'UA': 'URIC',
      'CHOL': 'TCHOL', 'TRIG': 'TG', 'HDLC': 'HDL', 'LDLC': 'LDL',
      'TP': 'TP', 'ALB': 'ALB', 'TBIL': 'TBIL', 'DBIL': 'DBIL',
      'ASTL': 'SGOT', 'ALTL': 'SGPT', 'ALP': 'ALP', 'GGTL': 'GGT',
      'AMYL': 'AMYLASE', 'LIPL': 'LIPASE', 'CK': 'CK_MB', 'LDH': 'LDH',
      'NA': 'NA', 'K': 'K', 'CL': 'CL', 'CA': 'CA',
    },
    testMap: {},
  },

  // Siemens Atellica (Immunoassay)
  siemens_atellica: {
    manufacturer: 'Siemens', model: 'Atellica IM', department: 'Immunoassay',
    protocol: 'hl7', connectionType: 'tcp', port: 7000,
    parameterMap: {
      'TSH': 'TSH', 'FT3': 'FT3', 'FT4': 'FT4',
      'FERR': 'FERRITIN', 'VB12': 'VIT_B12', 'FOL': 'FOLATE',
      'CTNI': 'TROP_I', 'CKMB': 'CK_MB', 'BNPT': 'BNP',
      'COR': 'CORTISOL', 'INS': 'INSULIN',
      'PSA': 'PSA_T', 'CEA': 'CEA', 'AFP': 'AFP',
      'CA125': 'CA125', 'CA199': 'CA199',
      'HBSA': 'HBsAg', 'AHCV': 'HCV', 'HIV': 'HIV',
    },
    testMap: {},
  },

  // Radiometer ABL (ABG)
  radiometer_abl: {
    manufacturer: 'Radiometer', model: 'ABL90/ABL800', department: 'ABG',
    protocol: 'hl7', connectionType: 'tcp', port: 8000,
    parameterMap: {
      'pH': 'PH_ABG', 'pCO2': 'PCO2', 'pO2': 'PO2',
      'cHCO3': 'HCO3', 'cBase': 'BE', 'sO2': 'SAO2',
      'FIO2': 'FIO2_ABG', 'ctHb': 'HB', 'cK+': 'K',
      'cNa+': 'NA', 'cCa++': 'CA', 'cCl-': 'CL',
      'cGlu': 'FBS', 'cLac': 'LACTATE',
    },
    testMap: { 'ABG': 'ABG' },
  },

  // Sysmex CS-series (Coagulation)
  sysmex_cs: {
    manufacturer: 'Sysmex', model: 'CS-1600/2500', department: 'Coagulation',
    protocol: 'astm', connectionType: 'serial', baudRate: 9600,
    parameterMap: {
      'PT': 'PT', 'INR': 'INR', 'APTT': 'APTT',
      'FBG': 'FIBRINOGEN', 'DD': 'DDIMER',
    },
    testMap: { 'COAG': 'PT_INR' },
  },
};

// ============================================================
// RESULT PROCESSOR — maps instrument results to LIMS
// ============================================================
export interface MappedResult {
  sampleId: string;
  patientId: string;
  limsParameterCode: string;
  instrumentParameterCode: string;
  value: string;
  unit: string;
  abnormalFlag: string;
  resultStatus: string;
  instrumentId: string;
  instrumentName: string;
  rawData: any;
}

/**
 * Process ASTM data from an instrument
 */
export function processASTMData(rawData: string, config: InstrumentConfig): MappedResult[] {
  const messages = parseASTMStream(rawData);
  const results: MappedResult[] = [];

  for (const msg of messages) {
    for (const patient of msg.patients) {
      for (const order of patient.orders) {
        for (const result of order.results) {
          const limsCode = config.parameterMap[result.parameterCode] || config.parameterMap[result.testCode];
          if (!limsCode) continue; // Unmapped parameter — skip

          let value = result.value;
          // Apply unit conversion if configured
          if (config.unitConversions?.[result.parameterCode]) {
            const conv = config.unitConversions[result.parameterCode];
            const numVal = parseFloat(value);
            if (!isNaN(numVal)) value = (numVal * conv.factor).toFixed(2);
          }

          results.push({
            sampleId: order.sampleId,
            patientId: patient.patientId || patient.labPatientId,
            limsParameterCode: limsCode,
            instrumentParameterCode: result.parameterCode,
            value,
            unit: result.unit,
            abnormalFlag: result.abnormalFlag,
            resultStatus: result.resultStatus,
            instrumentId: config.id,
            instrumentName: `${config.manufacturer} ${config.model}`,
            rawData: result,
          });
        }
      }
    }
  }

  return results;
}

/**
 * Process HL7 data from an instrument
 */
export function processHL7Data(rawData: string, config: InstrumentConfig): MappedResult[] {
  const message = parseHL7Message(rawData);
  const results: MappedResult[] = [];

  for (const order of message.orders) {
    for (const result of order.results) {
      const limsCode = config.parameterMap[result.observationId] || config.parameterMap[result.observationName];
      if (!limsCode) continue;

      let value = result.value;
      if (config.unitConversions?.[result.observationId]) {
        const conv = config.unitConversions[result.observationId];
        const numVal = parseFloat(value);
        if (!isNaN(numVal)) value = (numVal * conv.factor).toFixed(2);
      }

      results.push({
        sampleId: order.placerOrderId || order.fillerOrderId,
        patientId: message.patient?.patientId || '',
        limsParameterCode: limsCode,
        instrumentParameterCode: result.observationId,
        value,
        unit: result.unit,
        abnormalFlag: result.abnormalFlag,
        resultStatus: result.observationStatus,
        instrumentId: config.id,
        instrumentName: `${config.manufacturer} ${config.model}`,
        rawData: result,
      });
    }
  }

  return results;
}
