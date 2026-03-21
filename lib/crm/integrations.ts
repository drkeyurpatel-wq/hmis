// lib/crm/integrations.ts
// LeadSquared + DialShree API integration layer

import { createClient } from '@/lib/supabase/client';
let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

// ============================================================
// CONFIG LOADER
// ============================================================
async function getConfig(centreId: string, provider: string): Promise<any | null> {
  if (!sb()) return null;
  const { data } = await sb().from('hmis_integration_config')
    .select('*').eq('centre_id', centreId).eq('provider', provider).eq('is_enabled', true).maybeSingle();
  return data?.config || null;
}

async function logSync(centreId: string, provider: string, direction: string, entityType: string, entityId: string, externalId: string, status: string, req?: any, res?: any, error?: string) {
  if (!sb()) return;
  await sb().from('hmis_integration_sync_log').insert({
    centre_id: centreId, provider, direction, entity_type: entityType,
    entity_id: entityId || null, external_id: externalId || null,
    status, request_payload: req || null, response_payload: res || null, error_message: error || null,
  });
}

// ============================================================
// LEADSQUARED CLIENT
// ============================================================
export class LeadSquaredClient {
  private host: string;
  private accessKey: string;
  private secretKey: string;
  private centreId: string;

  constructor(centreId: string, config: { api_host: string; access_key: string; secret_key: string }) {
    this.centreId = centreId;
    this.host = config.api_host; // e.g. https://api-in21.leadsquared.com
    this.accessKey = config.access_key;
    this.secretKey = config.secret_key;
  }

  private async request(method: string, path: string, body?: any): Promise<any> {
    const url = `${this.host}${path}?accessKey=${this.accessKey}&secretKey=${this.secretKey}`;
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  }

  // Push lead to LeadSquared
  async pushLead(lead: any): Promise<{ success: boolean; lsId?: string; error?: string }> {
    const payload = [
      { Attribute: 'FirstName', Value: lead.first_name },
      { Attribute: 'LastName', Value: lead.last_name || '' },
      { Attribute: 'Phone', Value: lead.phone },
      { Attribute: 'EmailAddress', Value: lead.email || '' },
      { Attribute: 'Source', Value: lead.source || 'HMIS' },
      { Attribute: 'mx_City', Value: lead.city || '' },
      { Attribute: 'mx_Department', Value: lead.interested_department || '' },
      { Attribute: 'mx_Procedure', Value: lead.interested_procedure || '' },
      { Attribute: 'mx_HMIS_Lead_ID', Value: lead.id },
      { Attribute: 'mx_Centre', Value: lead.centre_name || '' },
    ];
    try {
      const res = await this.request('POST', '/v2/LeadManagement.svc/Lead.Capture', payload);
      const lsId = res?.Message?.Id || res?.Message?.AliasId;
      await logSync(this.centreId, 'leadsquared', 'push', 'lead', lead.id, lsId, lsId ? 'success' : 'error', payload, res);
      return lsId ? { success: true, lsId } : { success: false, error: res?.ExceptionMessage || 'Unknown error' };
    } catch (e: any) {
      await logSync(this.centreId, 'leadsquared', 'push', 'lead', lead.id, '', 'error', payload, null, e.message);
      return { success: false, error: e.message };
    }
  }

  // Push activity to LeadSquared
  async pushActivity(leadLsId: string, activity: any): Promise<{ success: boolean }> {
    const payload = {
      RelatedProspectId: leadLsId,
      ActivityEvent: activity.activity_type === 'call' ? 201 : activity.activity_type === 'email' ? 202 : 200,
      ActivityNote: activity.description || activity.subject || '',
      ActivityDateTime: activity.performed_at || new Date().toISOString(),
      Fields: [
        { SchemaName: 'mx_Custom_1', Value: activity.call_disposition || '' },
        { SchemaName: 'mx_Custom_2', Value: activity.call_duration_seconds || 0 },
      ],
    };
    try {
      const res = await this.request('POST', '/v2/ProspectActivity.svc/Create', payload);
      await logSync(this.centreId, 'leadsquared', 'push', 'activity', activity.id, '', res?.Status === 'Success' ? 'success' : 'error', payload, res);
      return { success: res?.Status === 'Success' };
    } catch (e: any) {
      return { success: false };
    }
  }

  // Pull leads from LeadSquared (last N hours)
  async pullLeads(hoursBack: number = 24): Promise<any[]> {
    const fromDate = new Date(Date.now() - hoursBack * 3600000).toISOString();
    const payload = {
      Parameter: { LookupName: 'CreatedOn', LookupValue: fromDate, Condition: 'GreaterThan' },
      Columns: { Include_CSV: 'ProspectID,FirstName,LastName,Phone,EmailAddress,Source,mx_City,mx_Department,mx_Procedure,mx_HMIS_Lead_ID' },
      Sorting: { ColumnName: 'CreatedOn', Direction: 'DESC' },
      Paging: { PageIndex: 1, PageSize: 100 },
    };
    try {
      const res = await this.request('POST', '/v2/LeadManagement.svc/Leads.Get', payload);
      const leads = Array.isArray(res) ? res : [];
      await logSync(this.centreId, 'leadsquared', 'pull', 'lead', '', '', 'success', null, { count: leads.length });
      return leads;
    } catch { return []; }
  }
}

// ============================================================
// DIALSHREE CLIENT
// ============================================================
export class DialShreeClient {
  private apiUrl: string;
  private apiKey: string;
  private agentId: string;
  private centreId: string;

  constructor(centreId: string, config: { api_url: string; api_key: string; agent_id: string }) {
    this.centreId = centreId;
    this.apiUrl = config.api_url;
    this.apiKey = config.api_key;
    this.agentId = config.agent_id;
  }

  private async request(method: string, path: string, body?: any): Promise<any> {
    const res = await fetch(`${this.apiUrl}${path}`, {
      method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  }

  // Click-to-call: initiate outbound call from HMIS
  async clickToCall(phoneNumber: string, leadId?: string): Promise<{ success: boolean; callId?: string; error?: string }> {
    try {
      const res = await this.request('POST', '/api/v1/call/initiate', {
        agent_id: this.agentId,
        phone_number: phoneNumber.replace(/[^0-9+]/g, ''),
        custom_data: { lead_id: leadId, source: 'hmis_crm' },
      });
      const callId = res?.call_id || res?.data?.call_id;
      await logSync(this.centreId, 'dialshree', 'push', 'call', leadId || '', callId, callId ? 'success' : 'error', { phone: phoneNumber }, res);
      return callId ? { success: true, callId } : { success: false, error: res?.message || 'Call initiation failed' };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  // Get call logs for a phone number
  async getCallLogs(phoneNumber: string, fromDate?: string): Promise<any[]> {
    try {
      const res = await this.request('GET', `/api/v1/call/logs?phone=${encodeURIComponent(phoneNumber)}&from=${fromDate || ''}`);
      return Array.isArray(res?.data) ? res.data : [];
    } catch { return []; }
  }

  // Get call recording URL
  async getRecording(callId: string): Promise<string | null> {
    try {
      const res = await this.request('GET', `/api/v1/call/recording/${callId}`);
      return res?.recording_url || null;
    } catch { return null; }
  }

  // Push contact to DialShree campaign
  async pushContact(lead: any, campaignId: string): Promise<{ success: boolean }> {
    try {
      const res = await this.request('POST', '/api/v1/contacts/add', {
        campaign_id: campaignId,
        contacts: [{ phone: lead.phone, first_name: lead.first_name, last_name: lead.last_name || '', custom_1: lead.id, custom_2: lead.interested_department || '' }],
      });
      return { success: res?.status === 'success' };
    } catch { return { success: false }; }
  }
}

// ============================================================
// FACTORY: get configured clients
// ============================================================
export async function getLeadSquaredClient(centreId: string): Promise<LeadSquaredClient | null> {
  const config = await getConfig(centreId, 'leadsquared');
  if (!config?.api_host || !config?.access_key) return null;
  return new LeadSquaredClient(centreId, config);
}

export async function getDialShreeClient(centreId: string): Promise<DialShreeClient | null> {
  const config = await getConfig(centreId, 'dialshree');
  if (!config?.api_url || !config?.api_key) return null;
  return new DialShreeClient(centreId, config);
}
