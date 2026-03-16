// lib/lab/instrument/astm-parser.ts
// ASTM E1394 Protocol Parser for clinical lab analyzers
// Parses: Header (H), Patient (P), Order (O), Result (R), Comment (C), Terminator (L)

export interface ASTMMessage {
  header: ASTMHeader;
  patients: ASTMPatient[];
  rawFrames: string[];
}

export interface ASTMHeader {
  senderId: string;
  senderName: string;
  receiverId: string;
  processingId: string;
  messageDateTime: string;
  version: string;
}

export interface ASTMPatient {
  patientId: string;
  labPatientId: string;
  patientName: string;
  dateOfBirth: string;
  gender: string;
  orders: ASTMOrder[];
}

export interface ASTMOrder {
  sampleId: string;
  testId: string;
  priority: string;
  orderedDateTime: string;
  results: ASTMResult[];
}

export interface ASTMResult {
  testCode: string;
  parameterCode: string;
  value: string;
  unit: string;
  referenceRange: string;
  abnormalFlag: string; // N, L, H, LL, HH, A
  resultStatus: string; // F=final, P=preliminary, C=corrected
  operatorId: string;
  resultDateTime: string;
  instrumentId: string;
}

// ASTM control characters
const ENQ = '\x05';
const STX = '\x02';
const ETX = '\x03';
const EOT = '\x04';
const ACK = '\x06';
const NAK = '\x15';
const ETB = '\x17';
const CR = '\r';
const LF = '\n';

/**
 * Parse raw ASTM byte stream into structured messages
 * Handles both LIS1-A (older) and LIS2-A2 (E1394) formats
 */
export function parseASTMStream(rawData: string): ASTMMessage[] {
  const messages: ASTMMessage[] = [];
  
  // Strip control chars and split into frames
  const cleaned = rawData.replace(/[\x02\x03\x05\x04\x06\x15\x17]/g, '');
  const lines = cleaned.split(/[\r\n]+/).filter(l => l.trim().length > 0);
  
  let currentMessage: ASTMMessage | null = null;
  let currentPatient: ASTMPatient | null = null;
  let currentOrder: ASTMOrder | null = null;

  for (const line of lines) {
    const frameNum = line.match(/^(\d+)/)?.[1] || '';
    const recordLine = frameNum ? line.substring(frameNum.length) : line;
    const recordType = recordLine.charAt(0);
    const fields = recordLine.split('|');

    switch (recordType) {
      case 'H': // Header
        if (currentMessage) messages.push(currentMessage);
        currentMessage = {
          header: parseHeader(fields),
          patients: [],
          rawFrames: [line],
        };
        currentPatient = null;
        currentOrder = null;
        break;

      case 'P': // Patient
        currentPatient = parsePatient(fields);
        if (currentMessage) currentMessage.patients.push(currentPatient);
        currentOrder = null;
        break;

      case 'O': // Order / Test Order
        currentOrder = parseOrder(fields);
        if (currentPatient) currentPatient.orders.push(currentOrder);
        break;

      case 'R': // Result
        const result = parseResult(fields);
        if (currentOrder) currentOrder.results.push(result);
        else if (currentPatient && currentPatient.orders.length > 0) {
          currentPatient.orders[currentPatient.orders.length - 1].results.push(result);
        }
        break;

      case 'C': // Comment — skip for now
        break;

      case 'L': // Terminator
        if (currentMessage) {
          messages.push(currentMessage);
          currentMessage = null;
        }
        break;
    }

    if (currentMessage) currentMessage.rawFrames.push(line);
  }

  if (currentMessage) messages.push(currentMessage);
  return messages;
}

function parseHeader(fields: string[]): ASTMHeader {
  return {
    senderId: getComponent(fields[4], 0),
    senderName: getComponent(fields[4], 1) || getComponent(fields[4], 0),
    receiverId: getComponent(fields[9], 0) || '',
    processingId: fields[11] || 'P',
    messageDateTime: fields[13] || '',
    version: fields[12] || 'E1394-97',
  };
}

function parsePatient(fields: string[]): ASTMPatient {
  const nameParts = (fields[5] || '').split('^');
  return {
    patientId: getComponent(fields[2], 0) || fields[3] || '',
    labPatientId: fields[3] || '',
    patientName: nameParts.join(' ').trim(),
    dateOfBirth: fields[7] || '',
    gender: fields[8] || '',
    orders: [],
  };
}

function parseOrder(fields: string[]): ASTMOrder {
  return {
    sampleId: getComponent(fields[2], 0) || fields[3] || '',
    testId: getComponent(fields[4], 3) || getComponent(fields[4], 0) || '',
    priority: fields[5] || 'R',
    orderedDateTime: fields[6] || '',
    results: [],
  };
}

function parseResult(fields: string[]): ASTMResult {
  const testParts = (fields[2] || '').split('^');
  return {
    testCode: testParts[3] || testParts[0] || '',
    parameterCode: testParts[3] || testParts[2] || testParts[0] || '',
    value: fields[3] || '',
    unit: fields[4] || '',
    referenceRange: fields[5] || '',
    abnormalFlag: fields[6] || 'N',
    resultStatus: fields[8] || 'F',
    operatorId: fields[10] || '',
    resultDateTime: fields[12] || '',
    instrumentId: fields[13] || '',
  };
}

function getComponent(field: string | undefined, index: number): string {
  if (!field) return '';
  const parts = field.split('^');
  return parts[index] || '';
}

/**
 * Generate ASTM ACK response
 */
export function generateACK(): Buffer {
  return Buffer.from([0x06]); // ACK
}

/**
 * Generate ASTM ENQ (initiate session)
 */
export function generateENQ(): Buffer {
  return Buffer.from([0x05]); // ENQ
}

/**
 * Generate ASTM EOT (end session)
 */
export function generateEOT(): Buffer {
  return Buffer.from([0x04]); // EOT
}

/**
 * Calculate ASTM checksum for a frame
 */
export function calculateChecksum(frame: string): string {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) {
    sum += frame.charCodeAt(i);
  }
  return (sum % 256).toString(16).toUpperCase().padStart(2, '0');
}
