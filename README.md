# Critical Thinking Extension (VS Code)

A Visual Studio Code extension that encourages critical thinking when using AI coding assistants for TypeScript tasks.

Instead of instantly accepting the first AI suggestion, this extension:
- asks you to reflect on the task,
- lets you choose an implementation intent (performance / readability / robustness),
- and shows multiple AI-generated alternatives side-by-side so you can deliberately pick and adapt one.

> Developed as part of a bachelor thesis on critical thinking in AI-assisted programming.

---

## Features

### 🧠 Reflection panel

Command: **`CT: Reflect on Current Task`** (`ct.reflect.selection`)

- Opens a small panel with structured questions, for example:
  - What is the user story or requirement in one sentence?  
  - What are the exact inputs and outputs (types)?  
  - Which edge cases do you need to consider?  
  - What invariants must always hold?  
  - How will you test this (happy path, edge cases, errors)?
- Your answers are stored locally (per file) and used to decide whether you’ve “reflected recently” for gating.
- Designed to be short but high-impact before asking for help.

---

###  Gating modes (off / soft / hard)

Command: **`CT: Toggle Gating Mode (off/soft/hard)`** (`ct.toggle.gating`)

Configuration key: `ct.gating.mode`

- **off**  
  No gate. You can request suggestions any time.
- **soft**  
  If you haven’t reflected recently for this file, you get a gentle reminder:
  > “Tip: Reflect on the task to clarify inputs, outputs, and edge cases.”
- **hard**  
  You **must** complete a reflection for the current file before requesting suggestions.

The time window for when a reflection “counts” is configurable via:

- `ct.gating.windowMinutes` (default: 20 minutes)

---

### Intent prompt (performance / readability / robustness)

Trigger: typing a TypeScript function signature, e.g.:

```ts
export async function fetchWithRetry(url: string, maxRetries: number): Promise<Response> {
  // ...
}
