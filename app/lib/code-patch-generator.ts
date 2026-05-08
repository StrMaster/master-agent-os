import OpenAI from "openai";

const openai = new OpenAI({
  apiKey:
    process.env.OPENAI_API_KEY,
});

export async function generateCodePatch(
  context: {
    filePath: string;

    currentContent: string;

    taskTitle: string;

    taskSummary: string;
  }
) {
  const response =
    await openai.chat.completions.create({
      model: "gpt-4.1-mini",

      temperature: 0.1,

      messages: [
        {
          role: "system",

          content: `
You are the Execution Agent for Master Agent OS.

Your job:
- modify existing frontend code safely
- preserve working structure
- avoid breaking syntax

Rules:
- Return ONLY raw code.
- No markdown.
- No explanations.
- No code fences.
- Preserve imports unless necessary.
- Do not touch backend logic.
- Keep edits minimal and safe.
- Never respond in German.
          `,
        },

        {
          role: "user",

          content: `
Task:
${context.taskTitle}

Summary:
${context.taskSummary}

File:
${context.filePath}

Current content:
${context.currentContent}
          `,
        },
      ],
    });

  return (
    response.choices[0]
      ?.message?.content || ""
  );
}