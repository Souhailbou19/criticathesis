import json
from collections import Counter
from pathlib import Path
import sys

def load_events(path: Path):
    events = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                events.append(json.loads(line))
            except json.JSONDecodeError as e:
                print(f"Skipping invalid JSON line: {e}")
    return events

def main(log_path: str):
    path = Path(log_path)
    if not path.is_file():
        print(f"Log file not found: {path}")
        return

    events = load_events(path)
    if not events:
        print("No events in log file.")
        return

    # --- Basic counts by type ---
    by_type = Counter(ev.get("type", "unknown") for ev in events)

    # --- Intent choices ---
    intent_priorities = Counter()
    intent_notes_nonempty = 0

    # --- Suggestions / gating ---
    gating_modes = Counter()
    gated_counts = Counter()  # True/False

    # --- Alternatives ---
    alternatives_shown_counts = Counter()  # how many alternatives shown
    alternative_labels = Counter()
    alternative_has_intent = Counter()     # True/False

    for ev in events:
        etype = ev.get("type")
        data = ev.get("data") or {}

        if etype == "intent_chosen":
            p = data.get("priority", "unknown")
            intent_priorities[p] += 1
            note = (data.get("note") or "").strip()
            if note:
                intent_notes_nonempty += 1

        elif etype == "suggestion_requested":
            mode = data.get("mode", "unknown")
            gating_modes[mode] += 1
            gated = bool(data.get("gated", False))
            gated_counts[gated] += 1

        elif etype == "alternatives_shown":
            count = int(data.get("count", 0))
            alternatives_shown_counts[count] += 1

        elif etype == "alternative_chosen":
            label = data.get("label", "unknown")
            alternative_labels[label] += 1
            has_intent = bool(data.get("hasIntent", False))
            alternative_has_intent[has_intent] += 1

    # --------- PRINT SUMMARY ---------
    total_events = len(events)
    print("=" * 60)
    print(f"CT extension log analysis for: {path}")
    print(f"Total events: {total_events}")
    print("=" * 60)
    print()

    # 1) Events by type
    print("1) Events by type")
    for t, c in by_type.most_common():
        print(f"   {t:22s} : {c}")
    print()

    # 2) Intent choices
    total_intent = sum(intent_priorities.values())
    print("2) Intent choices (intent_chosen)")
    print(f"   Total intent_chosen events: {total_intent}")
    if total_intent > 0:
        for p, c in intent_priorities.most_common():
            share = c / total_intent * 100
            print(f"   - {p:12s}: {c}  ({share:.1f}%)")
        print(f"   Notes non-empty: {intent_notes_nonempty} "
              f"({(intent_notes_nonempty / total_intent * 100):.1f}% of intents)")
    print()

    # 3) Suggestions & gating
    print("3) Suggestion requests & gating")
    total_sugg = by_type.get("suggestion_requested", 0)
    print(f"   Total suggestion_requested: {total_sugg}")
    if total_sugg > 0:
        print("   Gating modes seen:")
        for m, c in gating_modes.most_common():
            share = c / total_sugg * 100
            print(f"     - {m:8s}: {c} ({share:.1f}%)")
        print("   Requests gated vs not-gated:")
        for g, c in gated_counts.items():
            label = "gated" if g else "not gated"
            share = c / total_sugg * 100
            print(f"     - {label:10s}: {c} ({share:.1f}%)")
    print()

    # 4) Alternatives
    print("4) Alternatives")
    total_alt_shown = by_type.get("alternatives_shown", 0)
    total_alt_chosen = by_type.get("alternative_chosen", 0)
    print(f"   alternatives_shown events: {total_alt_shown}")
    print(f"   alternative_chosen events: {total_alt_chosen}")
    if total_alt_shown > 0:
        print("   Distribution of how many alternatives were shown:")
        for n, c in sorted(alternatives_shown_counts.items()):
            share = c / total_alt_shown * 100
            print(f"     - {n} alternatives: {c} ({share:.1f}%)")
    if total_alt_chosen > 0:
        print("   Alternatives chosen by label:")
        for label, c in alternative_labels.most_common():
            share = c / total_alt_chosen * 100
            print(f"     - {label}: {c} ({share:.1f}%)")
        print("   Chosen with/without intent:")
        for has_intent, c in alternative_has_intent.items():
            label = "with intent" if has_intent else "without intent"
            share = c / total_alt_chosen * 100
            print(f"     - {label:13s}: {c} ({share:.1f}%)")
    print()

if __name__ == "__main__":
    # default path if none given
    if len(sys.argv) > 1:
        log_file = sys.argv[1]
    else:
        log_file = ".ct-logs/ct-log.jsonl"
    main(log_file)
