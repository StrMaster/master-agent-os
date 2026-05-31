export type EmailPayload = {
  to: string;
  subject: string;
  body: string;
  fromName?: string;
  replyTo?: string;
};

export type EmailResult = {
  ok: boolean;
  id?: string;
  error?: string;
};

export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return { ok: false, error: "Missing RESEND_API_KEY" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${payload.fromName ?? "Master Agent OS"} <onboarding@resend.dev>`,
        to: [payload.to],
        subject: payload.subject,
        text: payload.body,
        reply_to: payload.replyTo,
      }),
    });

    const data = await res.json() as { id?: string; message?: string };

    if (!res.ok) {
      return { ok: false, error: data.message ?? "Email send failed" };
    }

    return { ok: true, id: data.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function generateOutreachEmail(params: {
  leadName: string;
  company?: string;
  website?: string;
  observation?: string;
}): Promise<{ subject: string; body: string }> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const res = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    system: `You are a professional outreach specialist. Write short, personalized cold emails.
Return ONLY valid JSON: {"subject": "...", "body": "..."}
Rules: under 100 words, personal observation, one clear CTA, no hype.`,
    messages: [{
      role: "user",
      content: `Write outreach email for:
Name: ${params.leadName}
Company: ${params.company ?? "unknown"}
Website: ${params.website ?? "unknown"}
Observation: ${params.observation ?? "I came across your business and noticed an opportunity"}`,
    }],
  });

  const raw = res.content[0]?.type === "text" ? res.content[0].text : "{}";
  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(clean) as { subject: string; body: string };
  } catch {
    return {
      subject: `Quick question for ${params.company ?? params.leadName}`,
      body: `Hi ${params.leadName},\n\n${params.observation ?? "I came across your business and saw an opportunity to help."}\n\nWould you be open to a quick chat?\n\nBest,\nLinas`,
    };
  }
}
