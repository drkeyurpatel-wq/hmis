// app/api/claims/notify/route.ts
// Server-side WhatsApp notification sender for claims
// Keeps WHATSAPP_ACCESS_TOKEN server-side only

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { phone, templateName, params, centreId, claimId } = await req.json();

    if (!phone || !templateName) {
      return NextResponse.json({ error: 'Missing phone or templateName' }, { status: 400 });
    }

    const apiUrl = process.env.WHATSAPP_API_URL || process.env.NEXT_PUBLIC_WHATSAPP_API_URL;
    const token = process.env.WHATSAPP_ACCESS_TOKEN;

    if (!apiUrl || !token) {
      // WhatsApp not configured — silently succeed (notification logged in DB already)
      return NextResponse.json({ success: true, sent: false, reason: 'WhatsApp not configured' });
    }

    // Format phone: ensure 91 prefix
    const clean = phone.replace(/[\s\-\(\)+]/g, '');
    const formatted = clean.length === 10 ? `91${clean}` : clean;

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: formatted,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'en' },
          components: params?.length > 0
            ? [{ type: 'body', parameters: params.map((p: string) => ({ type: 'text', text: p })) }]
            : [],
        },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({ success: true, sent: true, messageId: data.messages?.[0]?.id });
    } else {
      const err = await res.json().catch(() => ({ error: { message: 'Unknown' } }));
      return NextResponse.json({ success: false, error: err.error?.message }, { status: 502 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
