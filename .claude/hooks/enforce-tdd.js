#!/usr/bin/env node

/**
 * Health1 TDD Enforcement Hook
 * Fires on PreToolUse:Edit for source files.
 * Warns (does not block) if no corresponding test file exists.
 *
 * Convention: src/lib/calc.ts → src/lib/__tests__/calc.test.ts
 *             src/app/api/route.ts → src/app/api/__tests__/route.test.ts
 */

const fs = require("fs");
const path = require("path");

const filePath = process.argv[2];
if (!filePath) process.exit(0);

// Skip if already a test file
if (
  filePath.includes("__tests__") ||
  filePath.includes(".test.") ||
  filePath.includes(".spec.")
) {
  process.exit(0);
}

// Skip non-logic files
const skipPatterns = [
  /\.css$/,
  /\.scss$/,
  /\.json$/,
  /\.md$/,
  /\.svg$/,
  /types?\//,
  /\.d\.ts$/,
  /layout\.tsx?$/,
  /loading\.tsx?$/,
  /error\.tsx?$/,
  /not-found\.tsx?$/,
  /globals/,
  /config/,
];

if (skipPatterns.some((p) => p.test(filePath))) {
  process.exit(0);
}

// Build expected test file path
const dir = path.dirname(filePath);
const ext = path.extname(filePath);
const base = path.basename(filePath, ext);
const testDir = path.join(dir, "__tests__");
const testFile = path.join(testDir, `${base}.test${ext}`);
const altTestFile = path.join(dir, `${base}.test${ext}`);

if (!fs.existsSync(testFile) && !fs.existsSync(altTestFile)) {
  console.error(
    `[TDD Hook] ⚠️  No test file found for ${filePath}`
  );
  console.error(
    `[TDD Hook] Expected: ${testFile}`
  );
  console.error(
    `[TDD Hook] Write your test FIRST (RED), then implement (GREEN).`
  );
  // Exit 0 = warn only. Change to exit 2 to hard-block edits without tests.
  process.exit(0);
}
