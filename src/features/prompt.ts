import * as vscode from "vscode";

type Answers = {
  claim: string;
  goal: "Verify" | "Summarize" | "Extract Entities";
  strictness: "Low" | "Medium" | "High";
};

export async function askQuestions(): Promise<void> {
  const ed = vscode.window.activeTextEditor;
  const prefill =
    ed
      ? (ed.selection.isEmpty
          ? ed.document.lineAt(ed.selection.active.line).text.trim()
          : ed.document.getText(ed.selection).trim())
      : "";

  const claim = await vscode.window.showInputBox({
    title: "Claim or text to analyze",
    value: prefill,
    validateInput: (v) => {
      if (v.trim().length) {
        return null;
      } else {
        return "Please enter some text";
      }
    },
  });
  if (!claim) {
    return;
  }

  const goal = await vscode.window.showQuickPick(
    ["Verify", "Summarize", "Extract Entities"],
    { title: "Choose action", canPickMany: false, placeHolder: "Select one" }
  );
  if (!goal) {
    return;
  }

  const strictness = await vscode.window.showQuickPick(
    ["Low", "Medium", "High"],
    { title: "Strictness / Rigor" }
  );
  if (!strictness) {
    return;
  }

  const answers: Answers = {
    claim,
    goal: goal as any,
    strictness: strictness as any,
  };

  const cfg = vscode.workspace.getConfiguration();
  const baseUrl = (cfg.get<string>("ct.api.baseUrl") || "").trim();
  const apiKey = (cfg.get<string>("ct.api.key") || "").trim();

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Running analysis…",
      cancellable: true,
    },
    async (_progress, token) => {
      const controller = new AbortController();
      token.onCancellationRequested(() => controller.abort());

      let data: any = {
        echo: answers,
        note: "No backend configured; showing local result.",
      };

      if (baseUrl) {
        try {
          const res = await fetch(`${baseUrl}/analyze`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
            },
            body: JSON.stringify(answers),
            signal: controller.signal,
          });
          if (!res.ok) {
            throw new Error(`HTTP ${res.status} ${res.statusText}`);
          }
          data = await res.json();
        } catch (e: any) {
          if (e?.name === "AbortError") {
            return;
          }
          vscode.window.showWarningMessage(
            `Backend call failed: ${e?.message ?? e}`
          );
        }
      }

      const md = renderResult(answers, data);
      const doc = await vscode.workspace.openTextDocument({
        language: "markdown",
        content: md,
      });
      await vscode.window.showTextDocument(doc, { preview: false });
    }
  );
}

function renderResult(a: Answers, data: any): string {
  return [
    "# Critical Thinking Result",
    "",
    `**Goal:** ${a.goal}  |  **Strictness:** ${a.strictness}`,
    "",
    `> **Claim/Text**`,
    `> ${a.claim}`,
    "",
    "---",
    "## Output",
    "```json",
    JSON.stringify(data, null, 2),
    "```",
  ].join("\n");
}
