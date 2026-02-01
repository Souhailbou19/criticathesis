import * as vscode from "vscode";
import { Policy } from "./policy";

export function makeStatusBar(policy: Policy) {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
  item.command = "ct.reflect.selection";

  function update() {
    const ed = vscode.window.activeTextEditor;
    if (!ed || (ed.document.languageId !== "typescript" && ed.document.languageId !== "typescriptreact")) {
      item.hide();
      return;
    }
    const { gate, reason } = policy.shouldGate(ed.document.uri, ed.document.version);
    if (gate) {
      item.text = "$(question) Reflect first";
      item.tooltip = `Critical Thinking: ${reason}. Click to reflect on this task.`;
    } else {
      item.text = "$(check) Ready to Suggest";
      item.tooltip = "Reflection valid for this file/version.";
    }
    item.show();
  }

  return { update, dispose: () => item.dispose() };
}
