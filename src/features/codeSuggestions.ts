// src/features/codeSuggestions.ts
import * as vscode from "vscode";
import { IntentChoice } from "./intent";
import type { CodeAlternative } from "./alternativesPanel";
import { callLlmForAlternatives } from "./llmClient";

export interface CodeSuggestionContext {
  intent: IntentChoice | null;
  functionSignature: string;
  surroundingText: string;
}

/**
 * Main entry: get code alternatives for the current context.
 *
 * - If ct.llm.useFake is true, we use a local stub.
 * - Otherwise,  we call the real OpenAI LLM via callLlmForAlternatives.
 * - If the LLM fails,  we fall back to the fake stub and log it.
 */
export async function getCodeAlternativesForContext(
  ctx: CodeSuggestionContext
): Promise<CodeAlternative[]> {
  const config = vscode.workspace.getConfiguration("ct");
  const useFake = config.get<boolean>("llm.useFake") ?? true;

  if (useFake) {
    console.log(
      "[critical-thinking-extension] getCodeAlternativesForContext: using FAKE local alternatives (ct.llm.useFake = true)"
    );
    return getFakeAlternatives(ctx);
  }

  try {
    console.log(
      "[critical-thinking-extension] getCodeAlternativesForContext: calling REAL OpenAI LLM (ct.llm.useFake = false)"
    );

    const alts = await callLlmForAlternatives(ctx);

    if (!alts || alts.length === 0) {
      console.warn(
        "[critical-thinking-extension] LLM returned no alternatives, falling back to FAKE stub"
      );
      return getFakeAlternatives(ctx);
    }

    console.log(
      "[critical-thinking-extension] LLM returned",
      alts.length,
      "alternatives"
    );

    return alts;
  } catch (err) {
    console.error(
      "[critical-thinking-extension] LLM call failed, falling back to FAKE stub:",
      err
    );
    return getFakeAlternatives(ctx);
  }
}

/**
 * Fake/stub alternatives: used when:
 * - ct.llm.useFake = true, or
 * - LLM fails.
 *
 */
function getFakeAlternatives(ctx: CodeSuggestionContext): CodeAlternative[] {
  const priority = ctx.intent?.priority ?? "none";
  const note = ctx.intent?.note ?? "";

  const sig =
    ctx.functionSignature.trim() ||
    "export function solve(input: unknown): unknown";
  const normalizedSig = sig.endsWith("{") ? sig : `${sig} {`;

  const focusPhrase =
    priority === "performance"
      ? "performance (speed, fewer allocations)"
      : priority === "readability"
      ? "readability and clear structure"
      : priority === "robustness"
      ? "robustness (errors, edge cases, retries)"
      : "a balanced trade-off";

  const rationaleSuffix =
    note && priority !== "none"
      ? ` with the specific concern: "${note}".`
      : ".";

  const alt1: CodeAlternative = {
    id: "alt1",
    label: "[FAKE] template A",
    code: `${normalizedSig}
  // FAKE suggestion focusing on ${focusPhrase}.
  // TODO: implement deliberately, justify each step.
}
`,
    rationale: `FAKE alternative: emphasizes ${focusPhrase}${rationaleSuffix}`,
  };

  const alt2: CodeAlternative = {
    id: "alt2",
    label: "[FAKE] template B",
    code: `${normalizedSig}
  // FAKE alternative giving a contrasting structure.
  // Try to compare this with the first suggestion.
}
`,
    rationale:
      "FAKE alternative: contrasting structure so students can compare trade-offs.",
  };

  return [alt1, alt2];
}
