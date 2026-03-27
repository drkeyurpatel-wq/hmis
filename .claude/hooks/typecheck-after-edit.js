#!/usr/bin/env node

/**
 * Health1 TypeScript Check Hook
 * Fires on PostToolUse:Edit for .ts/.tsx files.
 * Runs a quick type-check on the edited file.
 * Warns on type errors but does not block.
 */

const { execSync } = require("child_process");
const path = require("path");

const filePath = process.argv[2];
if (!filePath) process.exit(0);

try {
  // Quick check — only the edited file and its imports
  execSync(`npx tsc --noEmit --pretty ${filePath} 2>&1`, {
    timeout: 15000,
    stdio: "pipe",
  });
} catch (err) {
  const output = err.stdout ? err.stdout.toString() : "";
  if (output.includes("error TS")) {
    const errorCount = (output.match(/error TS/g) || []).length;
    console.error(
      `[TypeCheck Hook] ⚠️  ${errorCount} type error(s) in ${path.basename(filePath)}`
    );
    // Show first 5 errors only
    const lines = output.split("\n").filter((l) => l.includes("error TS"));
    lines.slice(0, 5).forEach((l) => console.error(`  ${l.trim()}`));
    if (lines.length > 5) {
      console.error(`  ... and ${lines.length - 5} more`);
    }
  }
  // Exit 0 = warn only. Change to exit 2 to block edits with type errors.
  process.exit(0);
}
