// bot/src/engine.ts — Generic TPA Portal Bot Engine
// Config-driven Playwright automation — one engine, N TPA configs

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { TPAConfig, FlowStep, FlowDefinition, BotAction, BotRunRecord, ClaimData } from './types';
import { fetchPendingClaims, updateClaimFromBot, logBotRun, updateBotRun, uploadScreenshot, uploadBotDocument, fetchPayerByCode } from './supabase';
import { logger } from './logger';

// ═══ Config Loader ═══

export function loadTPAConfig(tpaCode: string): TPAConfig {
  const configPath = path.join(__dirname, '..', 'tpa-configs', `${tpaCode}.json`);
  if (!fs.existsSync(configPath)) {
    throw new Error(`TPA config not found: ${configPath}`);
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

export function listAvailableTPAs(): string[] {
  const dir = path.join(__dirname, '..', 'tpa-configs');
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}

// ═══ Template Resolution ═══
// Replaces {{field}} in config values with actual claim data

function resolveTemplate(template: string, claim: ClaimData): string {
  return template.replace(/\{\{(\w+(?:\.\w+)?)\}\}/g, (_, key) => {
    const value = (claim as any)[key];
    return value !== undefined && value !== null ? String(value) : '';
  });
}

// ═══ Main Engine Class ═══

export class BotEngine {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: TPAConfig;
  private centreId: string;
  private outputs: Record<string, string> = {};

  constructor(config: TPAConfig, centreId: string) {
    this.config = config;
    this.centreId = centreId;
  }

  // ─── Lifecycle ───

  async init(): Promise<void> {
    logger.info({ tpa: this.config.tpa_code }, 'Initializing browser');
    this.browser = await chromium.launch({
      headless: process.env.HEADLESS !== 'false',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    this.context = await this.browser.newContext({
      viewport: { width: 1366, height: 768 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    });
    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(30000);
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }

  // ─── Login ───

  async login(): Promise<boolean> {
    if (!this.page) throw new Error('Browser not initialized');
    const auth = this.config.auth;
    const prefix = this.config.env_prefix;
    const username = process.env[`${prefix}_USERNAME`];
    const password = process.env[`${prefix}_PASSWORD`];

    if (!username || !password) {
      throw new Error(`Missing credentials: ${prefix}_USERNAME / ${prefix}_PASSWORD`);
    }

    logger.info({ tpa: this.config.tpa_code, url: auth.login_url }, 'Logging in');

    try {
      await this.page.goto(auth.login_url, { waitUntil: 'networkidle', timeout: 30000 });

      if (auth.captcha) {
        logger.warn('CAPTCHA detected — cannot auto-login. Manual intervention required.');
        await this.takeScreenshot('captcha_detected');
        return false;
      }

      await this.page.fill(auth.selectors.username, username);
      await this.page.fill(auth.selectors.password, password);
      await this.page.click(auth.selectors.submit);

      // Wait for success indicator
      await this.page.waitForSelector(auth.selectors.success, { timeout: 15000 });

      if (auth.otp && auth.selectors.otp_input) {
        logger.warn('OTP required — waiting for manual entry (60s timeout)');
        // In production, this would integrate with an SMS reader or manual input
        await this.page.waitForSelector(auth.selectors.success, { timeout: 60000 });
      }

      logger.info({ tpa: this.config.tpa_code }, 'Login successful');
      return true;
    } catch (error: any) {
      logger.error({ error: error.message, tpa: this.config.tpa_code }, 'Login failed');
      await this.takeScreenshot('login_failed');
      return false;
    }
  }

  // ─── Execute a Flow ───

  async executeFlow(
    flowName: string,
    flow: FlowDefinition,
    claim?: ClaimData
  ): Promise<{ success: boolean; outputs: Record<string, string>; stepsCompleted: number }> {
    if (!this.page) throw new Error('Browser not initialized');

    this.outputs = {};
    let stepsCompleted = 0;

    logger.info({ tpa: this.config.tpa_code, flow: flowName, steps: flow.steps.length }, 'Executing flow');

    for (const step of flow.steps) {
      try {
        await this.executeStep(step, claim);
        stepsCompleted++;
        logger.debug({ step: stepsCompleted, total: flow.steps.length, action: step.action }, 'Step completed');
      } catch (error: any) {
        logger.error({ error: error.message, step: stepsCompleted + 1, action: step.action }, 'Step failed');
        await this.takeScreenshot(`${flowName}_step${stepsCompleted + 1}_failed`);
        return { success: false, outputs: this.outputs, stepsCompleted };
      }
    }

    return { success: true, outputs: this.outputs, stepsCompleted };
  }

  // ─── Execute Single Step ───

  private async executeStep(step: FlowStep, claim?: ClaimData): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');
    const resolve = (val: string) => claim ? resolveTemplate(val, claim) : val;

    switch (step.action) {
      case 'goto':
        const url = step.url.startsWith('http') ? resolve(step.url) : `${this.config.portal.url}${resolve(step.url)}`;
        await this.page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        break;

      case 'wait':
        await this.page.waitForSelector(resolve(step.selector), { timeout: step.timeout || 10000 });
        break;

      case 'fill':
        await this.page.waitForSelector(resolve(step.selector), { timeout: 5000 });
        await this.page.fill(resolve(step.selector), resolve(step.value));
        break;

      case 'select':
        await this.page.selectOption(resolve(step.selector), resolve(step.value));
        break;

      case 'click':
        await this.page.waitForSelector(resolve(step.selector), { timeout: 5000 });
        await this.page.click(resolve(step.selector));
        await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
        break;

      case 'upload': {
        const files = resolve(step.files).split(',').map(f => f.trim()).filter(Boolean);
        if (files.length > 0) {
          const input = await this.page.waitForSelector(resolve(step.selector), { timeout: 5000 });
          await input?.setInputFiles(files);
        }
        break;
      }

      case 'download': {
        const [download] = await Promise.all([
          this.page.waitForEvent('download', { timeout: 30000 }),
          this.page.click(resolve(step.selector)),
        ]);
        const buffer = await download.createReadStream().then(stream => {
          const chunks: Buffer[] = [];
          return new Promise<Buffer>((res, rej) => {
            stream.on('data', (c: Buffer) => chunks.push(c));
            stream.on('end', () => res(Buffer.concat(chunks)));
            stream.on('error', rej);
          });
        });
        this.outputs[step.output] = `downloaded_${download.suggestedFilename()}`;
        // Store buffer for later upload
        this.outputs[`${step.output}_buffer`] = buffer.toString('base64');
        this.outputs[`${step.output}_filename`] = download.suggestedFilename();
        break;
      }

      case 'extract': {
        const el = await this.page.waitForSelector(resolve(step.selector), { timeout: 5000 });
        const text = await el?.textContent() || '';
        this.outputs[step.output] = text.trim();
        logger.info({ output: step.output, value: text.trim() }, 'Extracted value');
        break;
      }

      case 'extract_table': {
        const rows = await this.page.$$(resolve(step.selector));
        const tableData: Record<string, string>[] = [];
        for (const row of rows) {
          const cells = await row.$$('td');
          const rowData: Record<string, string> = {};
          for (let i = 0; i < Math.min(cells.length, step.columns.length); i++) {
            rowData[step.columns[i]] = (await cells[i].textContent() || '').trim();
          }
          tableData.push(rowData);
        }
        this.outputs[step.output] = JSON.stringify(tableData);
        break;
      }

      case 'screenshot':
        await this.takeScreenshot(resolve(step.name));
        break;

      case 'sleep':
        await new Promise(r => setTimeout(r, step.ms));
        break;

      case 'if_visible': {
        const visible = await this.page.isVisible(resolve(step.selector)).catch(() => false);
        const branch = visible ? step.then : (step.else || []);
        for (const subStep of branch) {
          await this.executeStep(subStep, claim);
        }
        break;
      }

      case 'log':
        logger.info({ message: resolve(step.message) }, 'Flow log');
        break;
    }
  }

  // ─── Screenshot ───

  async takeScreenshot(name: string): Promise<string | null> {
    if (!this.page) return null;
    try {
      const buffer = await this.page.screenshot({ fullPage: false });
      const filename = `${this.config.tpa_code}/${Date.now()}_${name}.png`;
      const url = await uploadScreenshot(filename, buffer);
      return url;
    } catch (e: any) {
      logger.error({ error: e.message }, 'Screenshot failed');
      return null;
    }
  }

  // ═══ High-Level Actions ═══

  async pollClaimStatuses(): Promise<{ processed: number; updated: number }> {
    const claims = await fetchPendingClaims(this.config.payer_id, 'check_status');
    if (claims.length === 0) {
      logger.info({ tpa: this.config.tpa_code }, 'No claims to poll');
      return { processed: 0, updated: 0 };
    }

    logger.info({ tpa: this.config.tpa_code, count: claims.length }, 'Polling claim statuses');

    const flow = this.config.flows.check_status;
    if (!flow) throw new Error('check_status flow not defined');

    let processed = 0, updated = 0;

    for (const claim of claims) {
      try {
        // Rate limiting
        await this.rateLimit();

        const result = await this.executeFlow('check_status', flow, claim);
        processed++;

        if (result.success && result.outputs.portal_status) {
          const portalStatus = result.outputs.portal_status;
          const mappedStatus = this.config.status_mapping[portalStatus];

          if (mappedStatus && mappedStatus !== claim.tpa_claim_number) {
            const updates: Record<string, any> = { status: mappedStatus };
            if (result.outputs.approved_amount) {
              updates.approved_amount = parseFloat(result.outputs.approved_amount.replace(/[₹,]/g, ''));
            }
            if (result.outputs.tpa_claim_number) {
              updates.tpa_claim_number = result.outputs.tpa_claim_number;
            }
            await updateClaimFromBot(claim.id, updates);
            updated++;
            logger.info({ claim: claim.claim_number, portalStatus, mappedStatus }, 'Claim status updated');
          }
        }
      } catch (error: any) {
        logger.error({ error: error.message, claim: claim.claim_number }, 'Polling failed for claim');
      }
    }

    return { processed, updated };
  }

  async submitPreauths(): Promise<{ processed: number; updated: number }> {
    const flow = this.config.flows.submit_preauth;
    if (!flow) throw new Error('submit_preauth flow not defined');

    const claims = await fetchPendingClaims(this.config.payer_id, 'submit_preauth');
    let processed = 0, updated = 0;

    for (const claim of claims) {
      try {
        await this.rateLimit();
        const result = await this.executeFlow('submit_preauth', flow, claim);
        processed++;

        if (result.success) {
          const updates: Record<string, any> = {};
          if (result.outputs.tpa_preauth_number) {
            updates.tpa_preauth_number = result.outputs.tpa_preauth_number;
          }
          if (Object.keys(updates).length > 0) {
            await updateClaimFromBot(claim.id, updates);
            updated++;
          }
        }
      } catch (error: any) {
        logger.error({ error: error.message, claim: claim.claim_number }, 'Pre-auth submission failed');
      }
    }
    return { processed, updated };
  }

  async downloadLetters(): Promise<{ processed: number; updated: number }> {
    const flow = this.config.flows.download_letter;
    if (!flow) throw new Error('download_letter flow not defined');

    const claims = await fetchPendingClaims(this.config.payer_id, 'download_letter');
    let processed = 0, updated = 0;

    for (const claim of claims) {
      try {
        await this.rateLimit();
        const result = await this.executeFlow('download_letter', flow, claim);
        processed++;

        if (result.success && result.outputs.letter_path_buffer) {
          const buffer = Buffer.from(result.outputs.letter_path_buffer, 'base64');
          const filename = result.outputs.letter_path_filename || 'letter.pdf';
          await uploadBotDocument(claim.id, filename, buffer, 'application/pdf');
          updated++;
        }
      } catch (error: any) {
        logger.error({ error: error.message, claim: claim.claim_number }, 'Letter download failed');
      }
    }
    return { processed, updated };
  }

  // ─── Rate Limiter ───
  private lastRequest = 0;
  private async rateLimit(): Promise<void> {
    const minGap = (60 / this.config.rate_limit.requests_per_minute) * 1000;
    const elapsed = Date.now() - this.lastRequest;
    if (elapsed < minGap) {
      await new Promise(r => setTimeout(r, minGap - elapsed));
    }
    this.lastRequest = Date.now();
  }
}

// ═══ Run a Full Bot Cycle ═══

export async function runBotCycle(
  tpaCode: string,
  action: BotAction,
  centreId: string
): Promise<void> {
  const config = loadTPAConfig(tpaCode);
  const engine = new BotEngine(config, centreId);

  const run: BotRunRecord = {
    payer_id: config.payer_id,
    centre_id: centreId,
    action,
    status: 'running',
    started_at: new Date().toISOString(),
    steps_completed: 0,
    total_steps: 0,
    claims_processed: 0,
    claims_updated: 0,
  };

  const runId = await logBotRun(run);
  const startTime = Date.now();

  try {
    await engine.init();
    const loggedIn = await engine.login();

    if (!loggedIn) {
      await updateBotRun(runId!, {
        status: config.auth.captcha ? 'captcha_blocked' : 'failed',
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        error_message: 'Login failed',
      });
      return;
    }

    let result = { processed: 0, updated: 0 };

    switch (action) {
      case 'check_status':
      case 'poll_all':
        result = await engine.pollClaimStatuses();
        break;
      case 'submit_preauth':
        result = await engine.submitPreauths();
        break;
      case 'download_letter':
        result = await engine.downloadLetters();
        break;
    }

    await updateBotRun(runId!, {
      status: 'success',
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      claims_processed: result.processed,
      claims_updated: result.updated,
    });

    logger.info({ tpa: tpaCode, action, ...result, durationMs: Date.now() - startTime }, 'Bot cycle complete');
  } catch (error: any) {
    const screenshotUrl = await engine.takeScreenshot('fatal_error');
    await updateBotRun(runId!, {
      status: 'failed',
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      error_message: error.message,
      screenshot_url: screenshotUrl || undefined,
    });
    logger.error({ error: error.message, tpa: tpaCode }, 'Bot cycle failed');
  } finally {
    await engine.close();
  }
}
