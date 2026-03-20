// lib/utils/data-export.ts
// Universal data export — CSV and JSON

export function exportToCSV(data: Record<string, any>[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(','),
    ...data.map(row => headers.map(h => {
      let val = row[h] ?? '';
      val = String(val).replace(/"/g, '""');
      return val.includes(',') || val.includes('"') || val.includes('\n') ? `"${val}"` : val;
    }).join(','))
  ].join('\n');

  downloadFile(csv, `${filename}.csv`, 'text/csv');
}

export function exportToJSON(data: any, filename: string) {
  const json = JSON.stringify(data, null, 2);
  downloadFile(json, `${filename}.json`, 'application/json');
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType + ';charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

// Patient data export (GDPR/DISHA compliant)
export function exportPatientData(patient: any, encounters: any[], admissions: any[], bills: any[]) {
  const data = {
    exportedAt: new Date().toISOString(),
    patient: {
      uhid: patient.uhid, name: `${patient.first_name} ${patient.last_name}`,
      gender: patient.gender, dob: patient.date_of_birth, age: patient.age_years,
      phone: patient.phone_primary, email: patient.email,
      address: [patient.address_line1, patient.address_line2, patient.city, patient.state, patient.pincode].filter(Boolean).join(', '),
      bloodGroup: patient.blood_group, allergies: patient.allergies,
    },
    encounters: encounters.map(e => ({
      date: e.encounter_date || e.date, type: e.encounter_type || e.type,
      doctor: e.doctor_name || e.doctor, diagnosis: e.diagnosis || e.chief_complaint,
      prescriptions: e.prescriptions || e.prescription_data,
    })),
    admissions: admissions.map(a => ({
      ipdNumber: a.ipd_number, admissionDate: a.admission_date,
      dischargeDate: a.actual_discharge, department: a.department,
      diagnosis: a.provisional_diagnosis, status: a.status,
    })),
    bills: bills.map(b => ({
      billNumber: b.bill_number, date: b.bill_date, type: b.bill_type,
      grossAmount: b.gross_amount, netAmount: b.net_amount,
      paidAmount: b.paid_amount, status: b.status,
    })),
  };
  exportToJSON(data, `patient-${patient.uhid}-${new Date().toISOString().split('T')[0]}`);
}
