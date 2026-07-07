import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

// i18n ratchet: files listed here are fully localized — raw English directly
// inside <Text> (or a raw placeholder=".." prop) must not creep back in.
// When a new file is localized, ADD it here. Never remove entries to "fix" a
// failure; localize the string instead.
const LOCALIZED_FILES = [
  "app/_layout.tsx",
  "app/index.tsx",
  "app/admin.tsx",
  "app/appearance.tsx",
  "app/alerts.tsx",
  "app/focus.tsx",
  "app/rules.tsx",
  "app/progress.tsx",
  "src/components/Banner.tsx",
  "src/components/EmptyState.tsx",
  "src/components/GlobalErrorBanner.tsx",
  "src/components/UrgeSurfingSheet.tsx",
  "src/components/XpPopup.tsx",
  "src/components/MoodPickerView.tsx",
  "src/components/MoodDetailView.tsx",
  "src/components/ParentPinCard.tsx",
  "src/components/streak/StreakPopup.tsx",
  "src/components/behavior/BlockScreenOverlay.tsx",
  "src/components/AlertCenterCard.tsx",
  "src/components/behavior/AIProtectionCard.tsx",
  "src/components/behavior/AppFeatureBlockingSettings.tsx",
  "src/components/behavior/CustomKeywordManager.tsx",
  "src/components/behavior/FocusModeCard.tsx",
  "src/components/behavior/UsageLimitsCard.tsx",
];

// Matches literal latin text as the first content inside a <Text …> element
// (word-bounded so <TextInput> doesn't match). `{expr}` children don't match.
const RAW_TEXT_CHILD = /<Text(?=[\s>])[^>]*>\s*([A-Za-z][^<{}\n]*)/g;
// Matches a hardcoded latin placeholder prop (localized ones use placeholder={t(...)}).
const RAW_PLACEHOLDER = /placeholder="([A-Za-z][^"]*)"/g;

test("localized files contain no raw English UI strings", () => {
  const offenders: string[] = [];

  for (const relPath of LOCALIZED_FILES) {
    const content = readFileSync(join(process.cwd(), ...relPath.split("/")), "utf8");

    for (const match of content.matchAll(RAW_TEXT_CHILD)) {
      offenders.push(`${relPath}: <Text> child "${match[1]!.trim()}"`);
    }
    for (const match of content.matchAll(RAW_PLACEHOLDER)) {
      offenders.push(`${relPath}: placeholder "${match[1]}"`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `Raw UI strings found — route them through t():\n${offenders.join("\n")}`,
  );
});

test("en and ar translation tables stay in key-parity", () => {
  const content = readFileSync(join(process.cwd(), "src", "i18n", "translations.ts"), "utf8");
  const keyPattern = /^\s*'([a-zA-Z0-9.]+)':/gm;
  const keys = [...content.matchAll(keyPattern)].map((m) => m[1]!);
  // The file declares en first, then ar mirrors it; every key must appear exactly twice.
  const counts = new Map<string, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  const unbalanced = [...counts.entries()].filter(([, n]) => n !== 2).map(([k, n]) => `${k} (×${n})`);
  assert.deepEqual(unbalanced, [], `Keys missing from one language table: ${unbalanced.join(", ")}`);
});
