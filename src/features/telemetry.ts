// src/features/telemetry.ts
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export type TelemetryEventType =
  | "intent_prompt_shown"
  | "intent_chosen"
  | "suggestion_requested"
  | "alternatives_shown"
  | "alternative_chosen"
  | "error";

export interface TelemetryEvent {
  type: TelemetryEventType;
  timestamp: number;
  fileUri?: string;
  data?: Record<string, unknown>;
}

let logFilePath: string | undefined;

export function initTelemetry(context: vscode.ExtensionContext): void {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    // No workspace → no logging
    logFilePath = undefined;
    return;
  }

  const workspaceRoot = folders[0].uri.fsPath;
  const logDir = path.join(workspaceRoot, ".ct-logs");

  try {
    fs.mkdirSync(logDir, { recursive: true });
    logFilePath = path.join(logDir, "ct-log.jsonl");
    console.log("[critical-thinking-extension] Telemetry log:", logFilePath);
  } catch (err) {
    console.error(
      "[critical-thinking-extension] Failed to init telemetry log:",
      err
    );
    logFilePath = undefined;
  }
}

export async function logEvent(ev: TelemetryEvent): Promise<void> {
  if (!logFilePath) {
    return;
  }
  try {
    const line = JSON.stringify(ev) + "\n";
    await fs.promises.appendFile(logFilePath, line, "utf8");
  } catch (err) {
    console.error(
      "[critical-thinking-extension] Failed to write telemetry event:",
      err
    );
  }
}
