export type IntentPriority =
  | "performance"
  | "readability"
  | "robustness"
  | "none";

export interface IntentChoice {
  priority: IntentPriority;
  note: string;
  timestamp: number;
  fileUri?: string;
}

let lastIntent: IntentChoice | null = null;

export function setLastIntent(choice: IntentChoice): void {
  lastIntent = choice;
}

export function getLastIntent(): IntentChoice | null {
  return lastIntent;
}
