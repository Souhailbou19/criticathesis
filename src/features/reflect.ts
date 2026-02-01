import * as vscode from "vscode";
import { Policy } from "./policy";

export async function reflectOnTask(policy: Policy): Promise<void> {
  const ed = vscode.window.activeTextEditor;
  if (!ed) {
    vscode.window.showInformationMessage("Open a TypeScript file to reflect.");
    return;
  }
  const doc = ed.document;
  const selected = ed.selection.isEmpty
    ? doc.lineAt(ed.selection.active.line).text.trim()
    : doc.getText(ed.selection).trim();

  const Qs = vscode.workspace.getConfiguration().get<string[]>("ct.questions.template", []);
  const answers: Array<{ q: string; a: string }> = [];

  for (const q of Qs) {
    const a = await vscode.window.showInputBox({
      title: q,
      placeHolder: "Write a short note (Enter to skip)",
      ignoreFocusOut: true
    });
    answers.push({ q, a: a ?? "" });
  }

  // mark as reflected for this exact document version
  await policy.recordReflection(doc.uri, doc.version);

  const md = [
    "# Reflection",
    "",
    "## Context",
    "```",
    selected || "<no selection>",
    "```",
    "",
    "## Notes"
  ];
  for (const { q, a } of answers) {
    md.push(`- **${q}**${a ? ` — ${a}` : ""}`);
  }

  const note = await vscode.workspace.openTextDocument({ language: "markdown", content: md.join("\n") });
  await vscode.window.showTextDocument(note, { preview: false });
  vscode.window.showInformationMessage("Reflection saved for this file/version.");
}
