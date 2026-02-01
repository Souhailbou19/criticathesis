// src/features/alternativesPanel.ts
import * as vscode from "vscode";

export interface CodeAlternative {
  id: string;
  label: string;
  code: string;
  rationale: string;
}

let panel: vscode.WebviewPanel | undefined;

export async function showAlternativesPanel(
  alternatives: CodeAlternative[]
): Promise<CodeAlternative | null> {
  return new Promise((resolve) => {
    if (!alternatives.length) {
      resolve(null);
      return;
    }

    // Always start with a fresh panel
    if (panel) {
      panel.dispose();
    }

    panel = vscode.window.createWebviewPanel(
      "ctAlternatives",
      "Critical Thinking: Alternatives",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: false,
      }
    );

    panel.webview.html = getAlternativesHtml(alternatives);

    panel.onDidDispose(() => {
      panel = undefined;
      // If user closes without choosing, resolve null (if not already resolved)
      resolve(null);
    });

    panel.webview.onDidReceiveMessage((message: any) => {
      if (!message || typeof message !== "object") {
        return;
      }

      if (message.type === "choose") {
        const id = String(message.id);
        const chosen =
          alternatives.find((alt) => alt.id === id) ?? null;
        if (chosen) {
          resolve(chosen);
          panel?.dispose();
        }
      } else if (message.type === "cancel") {
        resolve(null);
        panel?.dispose();
      }
    });
  });
}

function getAlternativesHtml(alternatives: CodeAlternative[]): string {
  const data = JSON.stringify(alternatives);
  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Critical Thinking Alternatives</title>
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
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .card {
    border-radius: 6px;
    border: 1px solid #3c3c3c;
    padding: 8px 10px;
    background: #252525;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .label {
    font-weight: 600;
    font-size: 13px;
  }
  .rationale {
    font-size: 12px;
    color: #c0c0c0;
  }
  pre {
    margin: 4px 0;
    padding: 6px;
    background: #1e1e1e;
    border-radius: 4px;
    font-size: 11px;
    overflow-x: auto;
  }
  .actions {
    margin-top: 6px;
    display: flex;
    justify-content: flex-end;
  }
  button {
    padding: 4px 10px;
    border-radius: 4px;
    border: 1px solid #555;
    background: #0e639c;
    color: white;
    cursor: pointer;
    font-size: 12px;
  }
  .footer {
    margin-top: 10px;
    display: flex;
    justify-content: flex-end;
  }
  .footer button {
    background: transparent;
    border: 1px solid #555;
  }
</style>
</head>
<body>
  <h2>Compare suggested implementations</h2>
  <div id="grid" class="grid"></div>
  <div class="footer">
    <button id="cancel">Cancel</button>
  </div>
<script>
(function () {
  const vscode = acquireVsCodeApi();
  const alternatives = ${data};
  const grid = document.getElementById('grid');

  alternatives.forEach((alt) => {
    const card = document.createElement('div');
    card.className = 'card';

    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = alt.label;
    card.appendChild(label);

    const rationale = document.createElement('div');
    rationale.className = 'rationale';
    rationale.textContent = alt.rationale;
    card.appendChild(rationale);

    const pre = document.createElement('pre');
    pre.textContent = alt.code;
    card.appendChild(pre);

    const actions = document.createElement('div');
    actions.className = 'actions';

    const btn = document.createElement('button');
    btn.textContent = 'Use this version';
    btn.addEventListener('click', () => {
      vscode.postMessage({ type: 'choose', id: alt.id });
    });

    actions.appendChild(btn);
    card.appendChild(actions);

    grid.appendChild(card);
  });

  const cancelBtn = document.getElementById('cancel');
  cancelBtn.addEventListener('click', () => {
    vscode.postMessage({ type: 'cancel' });
  });
})();
</script>
</body>
</html>
`;
}
