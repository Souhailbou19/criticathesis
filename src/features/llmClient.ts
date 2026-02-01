// src/features/llmClient.ts
import * as vscode from "vscode";
import { CodeSuggestionContext } from "./codeSuggestions";
import { CodeAlternative } from "./alternativesPanel";

/**
 * Call OpenAI's Chat Completions API to get two full code alternatives.
 * Uses JSON mode (response_format: { type: "json_object" }).
 */
export async function callLlmForAlternatives(
  ctx: CodeSuggestionContext
): Promise<CodeAlternative[]> {
  const config = vscode.workspace.getConfiguration("ct");

  const model =
    config.get<string>("llm.openaiModel") ?? "gpt-4o-mini";

  const maxContextChars =
    config.get<number>("llm.maxContextChars") ?? 8000;

  // Prefer env var, then optional setting override
  const apiKeyFromSettings = config.get<string>("llm.apiKey") ?? "";
  const apiKey = process.env.OPENAI_API_KEY || apiKeyFromSettings;

  if (!apiKey) {
    throw new Error(
      "No OpenAI API key. Set OPENAI_API_KEY env var or ct.llm.apiKey in settings."
    );
  }

  // Trim surrounding text to avoid sending huge files
  const surroundingText =
    ctx.surroundingText.length > maxContextChars
      ? ctx.surroundingText.slice(0, maxContextChars)
      : ctx.surroundingText;

  const priority = ctx.intent?.priority ?? "none";
  const note = ctx.intent?.note ?? "";

  const intentSummary =
    priority === "none"
      ? "No specific priority was chosen."
      : `The student chose priority = "${priority}"${
          note ? ` with note "${note}".` : "."
        }`;

  const systemPrompt = `
You are a strict teaching assistant inside Visual Studio Code.

You MUST return TWO concrete TypeScript implementations of a function, not templates.
Your output MUST be a single JSON object with this exact shape:

{
  "alternatives": [
    {
      "id": "alt1",
      "label": "short human-readable label",
      "code": "full TypeScript function implementation as a string",
      "rationale": "2–4 sentences explaining the trade-offs"
    },
    {
      "id": "alt2",
      "label": "another label",
      "code": "another full implementation",
      "rationale": "another 2–4 sentences"
    }
  ]
}

Hard requirements:
- The "code" fields must contain FULL function implementations with real logic.
- Do NOT use "TODO", "..." or pseudo-code.
- Do NOT say "fill in the logic" or similar.
- Code must be valid TypeScript, compilable, and self-contained.
- Do NOT include anything before or after the JSON object. No markdown, no comments outside JSON.
`.trim();

  const userPrompt = `
We are working in a TypeScript file.

Function signature (or nearest line):
${ctx.functionSignature}

Project context (trimmed):
${surroundingText}

Intent:
${intentSummary}

Please propose exactly two contrasting implementations:
- One implementation that leans more into the chosen priority.
- One implementation that shows an alternative trade-off.
Both must be fully implemented functions.
`.trim();

  // Use global fetch via globalThis to avoid TS lib issues
  const fetchFn = (globalThis as any).fetch;
  if (!fetchFn) {
    throw new Error("fetch is not available in this environment.");
  }

  console.log(
    "[critical-thinking-extension] Calling OpenAI Chat Completions with model:",
    model
  );

  const response = await fetchFn("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.5,
      max_tokens: 800,
    }),
  } as any);

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `OpenAI API error: ${response.status} ${response.statusText}${
        text ? " – " + text : ""
      }`
    );
  }

  const data = (await response.json()) as any;

  const content =
    data?.choices?.[0]?.message?.content ||
    data?.choices?.[0]?.message?.content?.[0]?.text ||
    "";

  if (!content || typeof content !== "string") {
    console.error(
      "[critical-thinking-extension] Unexpected OpenAI response structure:",
      JSON.stringify(data, null, 2)
    );
    throw new Error("OpenAI responded with no usable JSON content.");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    console.error(
      "[critical-thinking-extension] Failed to parse OpenAI JSON:",
      content
    );
    throw new Error("Failed to parse JSON from OpenAI response.");
  }

  const rawAlts: any[] = Array.isArray(parsed.alternatives)
    ? parsed.alternatives
    : [];

  const alternatives: CodeAlternative[] = rawAlts
    .filter(
      (alt) => alt && typeof alt.code === "string" && alt.code.trim().length > 0
    )
    .map((alt, index) => ({
      id:
        typeof alt.id === "string" && alt.id.trim()
          ? alt.id
          : `alt${index + 1}`,
      label:
        typeof alt.label === "string" && alt.label.trim()
          ? alt.label
          : `Alternative ${index + 1}`,
      code: alt.code,
      rationale:
        typeof alt.rationale === "string" ? alt.rationale : "",
    }));

  console.log(
    "[critical-thinking-extension] Parsed",
    alternatives.length,
    "alternatives from OpenAI"
  );

  return alternatives;
}
