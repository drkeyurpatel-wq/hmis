// lib/lab/instrument/hl7-parser.ts
// HL7 v2.x Parser for lab instrument interfacing
// Supports: ORM (orders), ORU (results), ACK

export interface HL7Message {
  type: string; // ORM, ORU, ACK
  header: HL7MSH;
  patient?: HL7PID;
  visit?: HL7PV1;
  orders: HL7Order[];
  rawSegments: string[];
}

export interface HL7MSH {
  fieldSeparator: string;
  encodingChars: string;
  sendingApp: string;
  sendingFacility: string;
  receivingApp: string;
  receivingFacility: string;
  dateTime: string;
  messageType: string;
  messageControlId: string;
  processingId: string;
  version: string;
}

export interface HL7PID {
  patientId: string;
  externalId: string;
  patientName: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  phone: string;
}

export interface HL7PV1 {
  patientClass: string;
  attendingDoctor: string;
  visitNumber: string;
}

export interface HL7Order {
  placerOrderId: string;
  fillerOrderId: string;
  universalServiceId: string;
  testName: string;
  priority: string;
  orderedDateTime: string;
  specimenSource: string;
  results: HL7Result[];
}

export interface HL7Result {
  setId: string;
  observationId: string;
  observationName: string;
  value: string;
  unit: string;
  referenceRange: string;
  abnormalFlag: string;
  observationStatus: string; // F=final, P=preliminary, C=corrected
  observationDateTime: string;
  producerId: string;
  valueType: string; // NM=numeric, ST=string, TX=text
}

// HL7 segment delimiter
const SEGMENT_DELIMITER = '\r';
const FIELD_SEPARATOR = '|';
const COMPONENT_SEPARATOR = '^';
const REPEAT_SEPARATOR = '~';
const ESCAPE_CHAR = '\\';
const SUB_COMPONENT_SEPARATOR = '&';

/**
 * Parse raw HL7 message string into structured data
 */
export function parseHL7Message(raw: string): HL7Message {
  // Normalize line endings
  const normalized = raw.replace(/\r\n/g, '\r').replace(/\n/g, '\r');
  const segments = normalized.split('\r').filter(s => s.trim().length > 0);

  const message: HL7Message = {
    type: '',
    header: parseMSH(['MSH']),
    orders: [],
    rawSegments: segments,
  };

  let currentOrder: HL7Order | null = null;

  for (const segment of segments) {
    const fields = segment.split(FIELD_SEPARATOR);
    const segType = fields[0];

    switch (segType) {
      case 'MSH':
        message.header = parseMSH(fields);
        message.type = getComponent(fields[8], 0); // ORM, ORU, ACK
        break;

      case 'PID':
        message.patient = parsePID(fields);
        break;

      case 'PV1':
        message.visit = parsePV1(fields);
        break;

      case 'ORC': // Order Common
        // ORC usually precedes OBR
        break;

      case 'OBR': // Observation Request
        currentOrder = parseOBR(fields);
        message.orders.push(currentOrder);
        break;

      case 'OBX': // Observation Result
        const result = parseOBX(fields);
        // Skip metadata OBX (Mindray BC-5000 sends Take Mode, Blood Mode, Test Mode as IS type)
        // Only process NM (numeric), ST (string), TX (text) — skip IS (coded), CE (coded element)
        if (result.valueType === 'IS' || result.valueType === 'CE') break;
        // Skip OBX where observation ID starts with 08 (Mindray metadata range)
        if (result.observationId.startsWith('08')) break;
        if (currentOrder) {
          currentOrder.results.push(result);
        } else {
          // Create default order if OBX comes without OBR
          currentOrder = { placerOrderId: '', fillerOrderId: '', universalServiceId: '',
            testName: '', priority: 'R', orderedDateTime: '', specimenSource: '', results: [result] };
          message.orders.push(currentOrder);
        }
        break;

      case 'NTE': // Notes
        break;
    }
  }

  return message;
}

function parseMSH(fields: string[]): HL7MSH {
  return {
    fieldSeparator: FIELD_SEPARATOR,
    encodingChars: fields[1] || '^~\\&',
    sendingApp: getComponent(fields[2], 0),
    sendingFacility: getComponent(fields[3], 0),
    receivingApp: getComponent(fields[4], 0),
    receivingFacility: getComponent(fields[5], 0),
    dateTime: fields[6] || '',
    messageType: fields[8] || '',
    messageControlId: fields[9] || '',
    processingId: fields[10] || 'P',
    version: fields[11] || '2.3.1',
  };
}

function parsePID(fields: string[]): HL7PID {
  const name = fields[5] || '';
  const nameParts = name.split(COMPONENT_SEPARATOR);
  return {
    patientId: getComponent(fields[3], 0),
    externalId: getComponent(fields[2], 0),
    patientName: `${nameParts[1] || ''} ${nameParts[0] || ''}`.trim(),
    dateOfBirth: fields[7] || '',
    gender: fields[8] || '',
    address: fields[11] || '',
    phone: fields[13] || '',
  };
}

function parsePV1(fields: string[]): HL7PV1 {
  return {
    patientClass: fields[2] || '',
    attendingDoctor: getComponent(fields[7], 1) || getComponent(fields[7], 0) || '',
    visitNumber: getComponent(fields[19], 0) || '',
  };
}

function parseOBR(fields: string[]): HL7Order {
  return {
    placerOrderId: getComponent(fields[2], 0),
    fillerOrderId: getComponent(fields[3], 0),
    universalServiceId: getComponent(fields[4], 0),
    testName: getComponent(fields[4], 1) || getComponent(fields[4], 0),
    priority: fields[5] || 'R',
    orderedDateTime: fields[7] || '',
    specimenSource: getComponent(fields[15], 0) || '',
    results: [],
  };
}

function parseOBX(fields: string[]): HL7Result {
  return {
    setId: fields[1] || '',
    observationId: getComponent(fields[3], 0),
    observationName: getComponent(fields[3], 1) || getComponent(fields[3], 0),
    value: fields[5] || '',
    unit: getComponent(fields[6], 0) || '',
    referenceRange: fields[7] || '',
    abnormalFlag: fields[8] || '',
    observationStatus: fields[11] || 'F',
    observationDateTime: fields[14] || '',
    producerId: getComponent(fields[15], 0) || '',
    valueType: fields[2] || 'NM',
  };
}

function getComponent(field: string | undefined, index: number): string {
  if (!field) return '';
  return field.split(COMPONENT_SEPARATOR)[index] || '';
}

/**
 * Generate HL7 ACK message
 */
export function generateHL7ACK(originalMSH: HL7MSH, ackCode: 'AA' | 'AE' | 'AR' = 'AA'): string {
  const now = new Date();
  const ts = now.getFullYear().toString() + (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0') + now.getHours().toString().padStart(2, '0') +
    now.getMinutes().toString().padStart(2, '0') + now.getSeconds().toString().padStart(2, '0');
  
  return [
    `MSH|^~\\&|H1LIMS|HEALTH1|${originalMSH.sendingApp}|${originalMSH.sendingFacility}|${ts}||ACK|${ts}|P|2.3.1`,
    `MSA|${ackCode}|${originalMSH.messageControlId}`,
  ].join('\r') + '\r';
}

/**
 * Build HL7 ORM (Order Message) to send to analyzer
 * For bidirectional interfaces that support host query
 */
export function buildHL7OrderMessage(data: {
  sampleId: string;
  patientId: string;
  patientName: string;
  testCodes: string[];
  priority?: string;
}): string {
  const now = new Date();
  const ts = now.getFullYear().toString() + (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0') + now.getHours().toString().padStart(2, '0') +
    now.getMinutes().toString().padStart(2, '0') + now.getSeconds().toString().padStart(2, '0');
  const msgId = 'H1-' + Date.now();

  const segments = [
    `MSH|^~\\&|H1LIMS|HEALTH1|ANALYZER|LAB|${ts}||ORM^O01|${msgId}|P|2.3.1`,
    `PID|1||${data.patientId}||${data.patientName}`,
    `ORC|NW|${data.sampleId}|||${data.priority || 'R'}`,
  ];

  data.testCodes.forEach((code, i) => {
    segments.push(`OBR|${i + 1}|${data.sampleId}||${code}|||${ts}`);
  });

  return segments.join('\r') + '\r';
}
