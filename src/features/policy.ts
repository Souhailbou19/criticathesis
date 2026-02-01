import * as vscode from "vscode";

type Mode = "off" | "soft" | "hard";
type Stamp = { ts: number; docVersion: number };

export class Policy {
  constructor(private ws: vscode.Memento, private gs: vscode.Memento) {}

  mode(): Mode {
    return vscode.workspace.getConfiguration().get<Mode>("ct.gating.mode", "hard");
  }

  async setMode(m: Mode) {
    await vscode.workspace.getConfiguration().update("ct.gating.mode", m, vscode.ConfigurationTarget.Global);
  }

  windowMinutes(): number {
    return vscode.workspace.getConfiguration().get<number>("ct.gating.windowMinutes", 20);
  }

  private keyFor(uri: vscode.Uri) {
    return `ct:reflect:${uri.toString()}`;
  }

  recordReflection(uri: vscode.Uri, docVersion: number) {
    const stamp: Stamp = { ts: Date.now(), docVersion };
    return this.ws.update(this.keyFor(uri), stamp);
  }

  reflectionValid(uri: vscode.Uri, docVersion: number): boolean {
    const stamp = this.ws.get<Stamp>(this.keyFor(uri));
    if (!stamp) {
      return false;
    }
    const ageMin = (Date.now() - stamp.ts) / 60000;
    return ageMin <= this.windowMinutes() && stamp.docVersion === docVersion;
  }

  shouldGate(uri?: vscode.Uri, docVersion?: number): { gate: boolean; reason: string } {
    const m = this.mode();
    if (m === "off") {
      return { gate: false, reason: "mode:off" };
    }

    const editor = vscode.window.activeTextEditor;
    const doc = uri
      ? vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString())
      : editor?.document;

    if (!doc) {
      return { gate: m === "hard", reason: "no-doc" };
    }

    const valid = this.reflectionValid(doc.uri, docVersion ?? doc.version);
    if (valid) {
      return { gate: false, reason: "recent-reflection" };
    }

    //  Case of reflection isn't valid.
    return { gate: m === "hard", reason: `mode:${m}` };
  }
}
