import * as vscode from "vscode";
import { reflectOnTask } from "./features/reflect";
import { suggestSolution } from "./features/suggest";
import { Policy } from "./features/policy";
import { makeStatusBar } from "./features/status";
import { IntentChoice, IntentPriority, setLastIntent } from "./features/intent";
import { initTelemetry, logEvent } from "./features/telemetry";


// Phase 1/2 helpers 

const TS_LANGUAGES = ["typescript", "typescriptreact"];

let intentPanel: vscode.WebviewPanel | undefined;
let latestIntentCallback: ((choice: IntentChoice) => void) | undefined;

function isTypeScriptDocument(doc: vscode.TextDocument): boolean {
  return TS_LANGUAGES.includes(doc.languageId);
}

function looksLikeFunctionSignature(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  const functionRegex = /^(export\s+)?(async\s+)?function\s+\w+\s*\(/;
  const arrowFunctionRegex =
    /^(export\s+)?(const|let|var)\s+\w+[\w\s:<,>\[\]\?]*=\s*(async\s+)?\(/;

  return functionRegex.test(trimmed) || arrowFunctionRegex.test(trimmed);
}

// Show (or reuse) the micro-prompt webview
function showIntentPromptPanel(
  extensionUri: vscode.Uri,
  onChoice: (choice: IntentChoice) => void
) {
  latestIntentCallback = onChoice;

  if (intentPanel) {
    intentPanel.reveal(vscode.ViewColumn.Beside);
    intentPanel.webview.postMessage({ type: "reset" });
    return;
  }

  intentPanel = vscode.window.createWebviewPanel(
    "ctIntentPrompt",
    "Critical Thinking: Choose Focus",
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    }
  );

  intentPanel.webview.html = getIntentPromptHtml();

  intentPanel.onDidDispose(() => {
    intentPanel = undefined;
  });

  intentPanel.webview.onDidReceiveMessage((message: any) => {
    if (!message || typeof message !== "object") return;
    if (message.type !== "intentChoice") return;

    const rawPriority = message.priority;
    const priority: IntentPriority =
      rawPriority === "performance" ||
      rawPriority === "readability" ||
      rawPriority === "robustness"
        ? rawPriority
        : "none";

    const note = typeof message.note === "string" ? message.note : "";

    if (latestIntentCallback) {
      latestIntentCallback({ priority, note, timestamp: Date.now() });
    }
  });
}

// HTML for the micro-prompt webview
function getIntentPromptHtml(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Critical Thinking Focus</title>
<style>
 body {
   font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
   padding: 12px 16px;
   color: #e5e5e5;
   background-color: #1e1e1e;
 }
 h2 {
   font-size: 16px;
   margin-bottom: 8px;
 }
 .options {
   display: flex;
   gap: 8px;
   margin: 8px 0 12px;
   flex-wrap: wrap;
 }
 button.option {
   padding: 4px 10px;
   border-radius: 999px;
   border: 1px solid #555;
   background: #252525;
   cursor: pointer;
   font-size: 12px;
 }
 button.option.selected {
   border-color: #569cd6;
   background: #003a5d;
 }
 .note-label {
   font-size: 12px;
   margin-bottom: 4px;
 }
 input#note {
   width: 100%;
   padding: 4px 6px;
   border-radius: 4px;
   border: 1px solid #555;
   background: #252525;
   color: inherit;
   font-size: 12px;
 }
 .footer {
   margin-top: 10px;
   display: flex;
   justify-content: flex-end;
   gap: 8px;
 }
 button.primary {
   padding: 4px 12px;
   border-radius: 4px;
   border: none;
   background: #0e639c;
   color: white;
   cursor: pointer;
   font-size: 12px;
 }
 button.secondary {
   padding: 4px 8px;
   border-radius: 4px;
   border: 1px solid #555;
   background: transparent;
   color: inherit;
   cursor: pointer;
   font-size: 12px;
 }
 small.hint {
   display: block;
   margin-top: 4px;
   font-size: 11px;
   color: #aaaaaa;
 }
</style>
</head>
<body>
  <h2>What should this function prioritize?</h2>
  <div class="options" id="options">
    <button class="option" data-priority="performance">Performance</button>
    <button class="option" data-priority="readability">Readability</button>
    <button class="option" data-priority="robustness">Robustness</button>
    <button class="option selected" data-priority="none">No specific priority</button>
  </div>

  <div class="note-label">Optional note (≤10 words)</div>
  <input id="note" type="text" placeholder="e.g., handle flaky network / retries" />
  <small class="hint">This helps shape suggestions and trade-offs.</small>

  <div class="footer">
    <button class="secondary" id="skip">Skip</button>
    <button class="primary" id="confirm">Confirm</button>
  </div>

<script>
(function () {
  const vscode = acquireVsCodeApi();

  const optionButtons = Array.from(document.querySelectorAll("button.option"));
  const noteInput = document.getElementById("note");
  const confirmButton = document.getElementById("confirm");
  const skipButton = document.getElementById("skip");

  function selectPriority(value) {
    optionButtons.forEach(btn => {
      if (btn.getAttribute("data-priority") === value) {
        btn.classList.add("selected");
      } else {
        btn.classList.remove("selected");
      }
    });
  }

  optionButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const value = btn.getAttribute("data-priority") || "none";
      selectPriority(value);
    });
  });

  confirmButton.addEventListener("click", () => {
    let selected = "none";
    const selectedBtn = optionButtons.find(btn =>
      btn.classList.contains("selected")
    );
    if (selectedBtn) {
      selected = selectedBtn.getAttribute("data-priority") || "none";
    }

    const note = (noteInput.value || "").trim();
    const words = note.split(/\\s+/).filter(Boolean);
    if (words.length > 10) {
      alert("Please keep the note to 10 words or fewer.");
      return;
    }

    vscode.postMessage({
      type: "intentChoice",
      priority: selected,
      note: note
    });
  });

  skipButton.addEventListener("click", () => {
    vscode.postMessage({
      type: "intentChoice",
      priority: "none",
      note: ""
    });
  });

  window.addEventListener("message", event => {
    const msg = event.data;
    if (msg && msg.type === "reset") {
      selectPriority("none");
      noteInput.value = "";
    }
  });
})();
</script>
</body>
</html>
`;
}

// Main extension entrypoint

export function activate(context: vscode.ExtensionContext) {
  console.log("[critical-thinking-extension] NEW ACTIVATE VERSION");
   initTelemetry(context);

  const policy = new Policy(context.workspaceState, context.globalState);
  const status = makeStatusBar(policy);

  const reflectCommand = vscode.commands.registerCommand(
    "ct.reflect.selection",
    () => reflectOnTask(policy)
  );

  const suggestCommand = vscode.commands.registerCommand(
    "ct.suggest.solution",
    () => suggestSolution(policy)
  );

  const toggleCommand = vscode.commands.registerCommand(
    "ct.toggle.gating",
    async () => {
      const current = policy.mode();
      const order: Array<ReturnType<Policy["mode"]>> = ["off", "soft", "hard"];
      const next = order[(order.indexOf(current) + 1) % order.length];
      await policy.setMode(next);
      vscode.window.showInformationMessage(
        `CT gating: ${next.toUpperCase()}`
      );
      status.update();
    }
  );

  const changeListener = vscode.workspace.onDidChangeTextDocument((event) => {
    // keep your existing status behaviour
    status.update();

    const doc = event.document;
    if (!isTypeScriptDocument(doc)) return;
    if (event.contentChanges.length === 0) return;

    const lastChange = event.contentChanges[event.contentChanges.length - 1];
    const insertedText = lastChange.text;

    if (!insertedText.includes("\n") && !insertedText.includes("{")) {
      return;
    }

    const lineIndex = lastChange.range.start.line;
    const currentLineText = doc.lineAt(lineIndex).text;
    const prevLineIndex = Math.max(0, lineIndex - 1);
    const prevLineText = doc.lineAt(prevLineIndex).text;

    const functionDetected =
      looksLikeFunctionSignature(currentLineText) ||
      looksLikeFunctionSignature(prevLineText);

    if (!functionDetected) return;

        logEvent({
      type: "intent_prompt_shown",
      timestamp: Date.now(),
      fileUri: doc.uri.toString(),
      data: {
        line: lineIndex,
        languageId: doc.languageId,
      },
    }).catch(console.error);

    showIntentPromptPanel(context.extensionUri, (choice) => {
      const enrichedChoice: IntentChoice = {
        priority: choice.priority,
        note: choice.note,
        timestamp: choice.timestamp ?? Date.now(),
        fileUri: doc.uri.toString(),
      };

      setLastIntent(enrichedChoice);
            logEvent({
        type: "intent_chosen",
        timestamp: enrichedChoice.timestamp,
        fileUri: enrichedChoice.fileUri,
        data: {
          priority: enrichedChoice.priority,
          note: enrichedChoice.note,
        },
      }).catch(console.error);

      console.log(
        "[critical-thinking-extension] Intent choice:",
        enrichedChoice.priority,
        "| note:",
        enrichedChoice.note,
        "| file:",
        enrichedChoice.fileUri
      );

      vscode.window.setStatusBarMessage(
        `🧠 CT intent: ${enrichedChoice.priority}${
          enrichedChoice.note ? " – " + enrichedChoice.note : ""
        }`,
        4000
      );
    });
  });

  const editorChangeListener = vscode.window.onDidChangeActiveTextEditor(() => {
    status.update();
  });

  context.subscriptions.push(
    reflectCommand,
    suggestCommand,
    toggleCommand,
    changeListener,
    editorChangeListener
  );

  status.update();
}

export function deactivate() {}
