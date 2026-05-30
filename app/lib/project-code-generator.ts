import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type ProjectFile = {
  path: string;
  content: string;
};

export type ProjectSpec = {
  name: string;
  description: string;
  type: "ai-consultant" | "landing-page" | "saas-tool" | "chatbot";
  industry?: string;
  features?: string[];
};

export async function generateProjectFiles(spec: ProjectSpec): Promise<ProjectFile[]> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 8192,
    system: `You are an expert Next.js developer building production-ready AI-powered applications.

Generate complete, working code files for a Next.js 14 project.

Rules:
- Use TypeScript
- Use Tailwind CSS for styling
- Use App Router (app/ directory)
- Keep code clean and production-ready
- Include Anthropic SDK for AI features
- Return ONLY valid JSON array of files

Format:
[
  {"path": "app/page.tsx", "content": "..."},
  {"path": "app/api/chat/route.ts", "content": "..."},
  {"path": "app/components/ChatWidget.tsx", "content": "..."}
]`,
    messages: [
      {
        role: "user",
        content: `Generate a complete Next.js project for:

Name: ${spec.name}
Description: ${spec.description}
Type: ${spec.type}
Industry: ${spec.industry ?? "general"}
Features: ${spec.features?.join(", ") ?? "AI chat, modern UI"}

Generate these files:
1. app/page.tsx - Main landing page with hero section
2. app/api/chat/route.ts - AI chat API endpoint using Anthropic
3. app/components/ChatWidget.tsx - Chat UI component
4. app/globals.css - Tailwind CSS globals

Return ONLY a JSON array of {path, content} objects.`,
      },
    ],
  });

  const raw = response.content[0]?.type === "text" ? response.content[0].text : "";
  const clean = raw.replace(/```json|```/g, "").trim();

  try {
    const files = JSON.parse(clean) as ProjectFile[];
    return Array.isArray(files) ? files : [];
  } catch {
    throw new Error("Failed to parse generated project files");
  }
}
