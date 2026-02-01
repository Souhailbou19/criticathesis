import * as vscode from "vscode";
import { Policy } from "./policy";
import { reflectOnTask } from "./reflect";
import { getLastIntent } from "./intent";
import { logEvent } from "./telemetry";
import {
  CodeSuggestionContext,
  getCodeAlternativesForContext,
} from "./codeSuggestions";
import { showAlternativesPanel } from "./alternativesPanel";

export async function suggestSolution(policy: Policy): Promise<void> {
  const ed = vscode.window.activeTextEditor;
  if (!ed) {
    vscode.window.showInformationMessage("Open a TypeScript file first.");
    return;
  }

  const doc = ed.document;
  const gate = policy.shouldGate(doc.uri, doc.version);

  // --- Gating behaviour (same as before) ---
  if (gate.gate) {
    const mode = vscode.workspace
      .getConfiguration()
      .get<string>("ct.gating.mode");

    if (mode === "hard") {
      const choice = await vscode.window.showWarningMessage(
        "Please reflect on the task before requesting a suggestion.",
        "Reflect now",
        "Cancel"
      );
      if (choice !== "Reflect now") {
        return;
      }
      await reflectOnTask(policy);
    } else {
      const choice = await vscode.window.showInformationMessage(
        "Tip: Reflect on the task to clarify inputs, outputs, and edge cases.",
        "Reflect now",
        "Continue"
      );
      if (choice === "Reflect now") {
        await reflectOnTask(policy);
      }
    }
  }

  const mode =
    vscode.workspace.getConfiguration().get<string>("ct.gating.mode") ?? "hard";

  logEvent({
    type: "suggestion_requested",
    timestamp: Date.now(),
    fileUri: doc.uri.toString(),
    data: {
      gated: gate.gate,
      mode,
    },
  }).catch(console.error);

  // --- Read last intent for this file ---
  const editorIntent = getLastIntent();
  const sameFileIntent =
    editorIntent && editorIntent.fileUri === doc.uri.toString()
      ? editorIntent
      : null;

  if (sameFileIntent) {
    vscode.window.setStatusBarMessage(
      ` Using CT intent: ${sameFileIntent.priority}${
        sameFileIntent.note ? " – " + sameFileIntent.note : ""
      }`,
      3000
    );
  }

  // --- Build suggestion context ---
  const cursorLine = ed.selection.active.line;

  let signatureLineText = doc.lineAt(cursorLine).text;
  if (!signatureLineText.trim() && cursorLine > 0) {
    // If cursor is on an empty line, look one line up
    signatureLineText = doc.lineAt(cursorLine - 1).text;
  }

  const context: CodeSuggestionContext = {
    intent: sameFileIntent,
    functionSignature: signatureLineText,
    surroundingText: doc.getText(),
  };

  console.log("[critical-thinking-extension] suggestSolution context:", {
    intent: context.intent,
    functionSignature: context.functionSignature.slice(0, 120),
  });

  // --- Get alternatives (LLM or fake) ---
  const alternatives = await getCodeAlternativesForContext(context);

  if (!alternatives.length) {
    vscode.window.showInformationMessage(
      "No suggestions could be generated for this context."
    );
    return;
  }

  logEvent({
    type: "alternatives_shown",
    timestamp: Date.now(),
    fileUri: doc.uri.toString(),
    data: {
      count: alternatives.length,
      labels: alternatives.map((a) => a.label),
      hasIntent: !!sameFileIntent,
    },
  }).catch(console.error);

  // --- Show alternatives panel and let user pick ---
  const chosen = await showAlternativesPanel(alternatives);

  if (!chosen) {
    // User cancelled or closed the panel
    return;
  }

  logEvent({
    type: "alternative_chosen",
    timestamp: Date.now(),
    fileUri: doc.uri.toString(),
    data: {
      id: chosen.id,
      label: chosen.label,
      hasIntent: !!sameFileIntent,
    },
  }).catch(console.error);

 
   const targetDoc = await vscode.workspace.openTextDocument(doc.uri);
  const targetEditor = await vscode.window.showTextDocument(targetDoc, {
    preview: false,
  });

  const insertAt = targetEditor.selection.active;
  const snippet = new vscode.SnippetString(chosen.code);

  await targetEditor.insertSnippet(snippet, insertAt);

  vscode.window.setStatusBarMessage(
    ` Inserted CT suggestion: ${chosen.label}`,
    3000
  );

  vscode.window.setStatusBarMessage(
    ` Inserted CT suggestion: ${chosen.label}`,
    3000
  );
}
