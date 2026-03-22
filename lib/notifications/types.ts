// lib/notifications/types.ts
// Shared types for the notification subsystem.

export interface NotificationResult {
  channel: 'whatsapp' | 'sms' | 'email';
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface DispatchResult {
  event: string;
  recipient: string;
  channels: NotificationResult[];
  /** True if at least one channel succeeded */
  delivered: boolean;
  timestamp: string;
}

export function createDispatchResult(event: string, recipient: string, channels: NotificationResult[]): DispatchResult {
  return {
    event,
    recipient,
    channels,
    delivered: channels.some(c => c.success),
    timestamp: new Date().toISOString(),
  };
}
