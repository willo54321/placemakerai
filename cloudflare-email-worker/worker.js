/**
 * Cloudflare Email Worker for PlacemakerAI
 *
 * This worker receives emails via Cloudflare Email Routing and forwards
 * them to the PlacemakerAI webhook endpoint to create enquiries.
 *
 * Deploy this worker to Cloudflare and configure Email Routing to send
 * emails to this worker.
 */

export default {
  async email(message, env, ctx) {
    // Read the email content
    const reader = message.raw.getReader();
    const chunks = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const rawEmail = new TextDecoder().decode(
      chunks.reduce((acc, chunk) => {
        const tmp = new Uint8Array(acc.length + chunk.length);
        tmp.set(acc);
        tmp.set(chunk, acc.length);
        return tmp;
      }, new Uint8Array())
    );

    // Parse basic email fields
    const headers = {};
    const headerSection = rawEmail.split('\r\n\r\n')[0] || rawEmail.split('\n\n')[0];
    const headerLines = headerSection.split(/\r?\n/);

    let currentHeader = '';
    for (const line of headerLines) {
      if (line.startsWith(' ') || line.startsWith('\t')) {
        // Continuation of previous header
        headers[currentHeader] += ' ' + line.trim();
      } else {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          currentHeader = line.substring(0, colonIndex).toLowerCase();
          headers[currentHeader] = line.substring(colonIndex + 1).trim();
        }
      }
    }

    // Extract body (simple approach - gets text after headers)
    const bodyStart = rawEmail.indexOf('\r\n\r\n');
    let body = bodyStart > 0 ? rawEmail.substring(bodyStart + 4) : '';

    // For multipart emails, try to extract plain text part
    const contentType = headers['content-type'] || '';
    if (contentType.includes('multipart')) {
      const boundaryMatch = contentType.match(/boundary="?([^";\s]+)"?/);
      if (boundaryMatch) {
        const boundary = boundaryMatch[1];
        const parts = body.split('--' + boundary);

        // Find text/plain part
        for (const part of parts) {
          if (part.includes('Content-Type: text/plain') || part.includes('content-type: text/plain')) {
            const partBodyStart = part.indexOf('\r\n\r\n') || part.indexOf('\n\n');
            if (partBodyStart > 0) {
              body = part.substring(partBodyStart + 4).replace(/--$/, '').trim();
              break;
            }
          }
        }
      }
    }

    // Clean up body - remove quoted-printable soft line breaks if present
    body = body.replace(/=\r?\n/g, '');
    // Decode common quoted-printable sequences
    body = body.replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );

    // Prepare payload for webhook
    const emailData = {
      from: message.from,
      fromName: headers['from']?.match(/^"?([^"<]+)"?\s*</)?.[1]?.trim(),
      to: message.to,
      subject: headers['subject'] || '(No Subject)',
      text: body.substring(0, 50000), // Limit body size
      headers: {
        'message-id': headers['message-id'],
        'date': headers['date'],
        'reply-to': headers['reply-to']
      },
      timestamp: new Date().toISOString()
    };

    // Forward to PlacemakerAI webhook
    const webhookUrl = env.WEBHOOK_URL || 'https://placemakerai.io/api/webhooks/email';
    const webhookSecret = env.WEBHOOK_SECRET;

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': webhookSecret ? `Bearer ${webhookSecret}` : ''
        },
        body: JSON.stringify(emailData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Webhook error:', response.status, errorText);
        // Don't reject - we still accepted the email
      } else {
        const result = await response.json();
        console.log('Email processed:', result);
      }
    } catch (error) {
      console.error('Failed to forward email to webhook:', error);
      // Don't throw - accept the email anyway to prevent bounces
    }

    // Optionally forward to a backup address
    if (env.FORWARD_TO) {
      await message.forward(env.FORWARD_TO);
    }
  }
};
