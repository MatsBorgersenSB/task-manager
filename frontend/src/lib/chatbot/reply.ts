import { CHATBOT_SYSTEM_PROMPT } from "@/lib/chatbot/prompt";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";
const MAX_TOKENS = 220;

/** Legacy keyword replies — used only when AI is unavailable. */
export function getSimpleReply(message: string): string {
  const text = message.toLowerCase();

  if (text.includes("export") || text.includes("excel") || text.includes("csv")) {
    return "Use Export to Excel or Export CSV in the toolbar above the task table. You can pick which columns to include with the Columns button.";
  }
  if (text.includes("internal") || text.includes("client")) {
    return "Client view shows client-safe fields. Internal view adds SB fields (status, owner, risk, notes). Open the dashboard and choose the view that matches your role.";
  }
  if (text.includes("comment")) {
    return "Open a task to see the Communication section in the panel. Client comments are visible to everyone; internal comments are for internal users only.";
  }
  if (text.includes("filter") || text.includes("sort")) {
    return "Use the Filter & sort section above the table to narrow by priority, status, due date, or change the sort order.";
  }
  if (text.includes("save") || text.includes("edit")) {
    return "Click a task row to open the panel. Edits save automatically after a short pause — watch for the Saving indicator at the bottom.";
  }
  if (text.includes("new") || text.includes("create")) {
    return 'Click "+ New Task" to create a task. Enter a title first — the panel saves and opens comments once the task exists.';
  }

  return "I can help with tasks, filters, exports, comments, and client vs internal views. What would you like to do in the app?";
}

type OpenAIChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

export async function getAIReply(message: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return getSimpleReply(message);
  }

  try {
    const response = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        temperature: 0.5,
        messages: [
          { role: "system", content: CHATBOT_SYSTEM_PROMPT },
          { role: "user", content: message },
        ],
      }),
    });

    if (!response.ok) {
      console.error("OpenAI chat error:", response.status, await response.text());
      return getSimpleReply(message);
    }

    const data = (await response.json()) as OpenAIChatResponse;
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return getSimpleReply(message);
    }

    return content;
  } catch (err) {
    console.error("OpenAI chat request failed:", err);
    return getSimpleReply(message);
  }
}
