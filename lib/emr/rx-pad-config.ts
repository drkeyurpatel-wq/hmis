// lib/emr/rx-pad-config.ts
// Configuration for Rx pad printing on pre-printed letterheads
// Each doctor can have custom settings stored in their profile

export interface RxPadConfig {
  /** Top margin in mm — clearance for printed letterhead header. Default 65mm */
  topMarginMm: number;
  /** Bottom margin in mm. Default 20mm */
  bottomMarginMm: number;
  /** Left margin in mm. Default 15mm */
  leftMarginMm: number;
  /** Right margin in mm. Default 15mm */
  rightMarginMm: number;
  /** Font size for prescription content */
  fontSize: 'small' | 'medium' | 'large';
  /** Show patient phone on prescription */
  showPatientPhone: boolean;
  /** Show diagnosis on prescription */
  showDiagnosis: boolean;
  /** Max prescriptions per page before page break */
  maxRxPerPage: number;
}

export const DEFAULT_RX_PAD_CONFIG: RxPadConfig = {
  topMarginMm: 65,
  bottomMarginMm: 20,
  leftMarginMm: 15,
  rightMarginMm: 15,
  fontSize: 'medium',
  showPatientPhone: true,
  showDiagnosis: true,
  maxRxPerPage: 8,
};

export const FONT_SIZE_MAP: Record<RxPadConfig['fontSize'], string> = {
  small: '9pt',
  medium: '10pt',
  large: '11pt',
};

/** Convert mm to CSS mm unit string */
export const mm = (val: number) => `${val}mm`;
