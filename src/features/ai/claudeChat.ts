import { buildSystemPrompt, type BusinessSnapshot } from "./buildSystemPrompt";
import type { ChatMsg } from "@/types";
import { askWarkahAI } from "@/lib/ai.functions";

export async function sendToClaudeAPI(
  userMessage: string,
  history: ChatMsg[],
  snapshot: BusinessSnapshot
): Promise<string> {
  const systemPrompt = buildSystemPrompt(snapshot, snapshot.language ?? "ms");
  const recent = history.slice(-6);
  const messages = [
    ...recent.map((m) => ({
      role: (m.from === "user" ? "user" : "assistant") as "user" | "assistant",
      content: m.text,
    })),
    { role: "user" as const, content: userMessage },
  ];

  const result = await askWarkahAI({ data: { systemPrompt, messages } });
  return result.reply;
}
