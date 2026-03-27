#!/usr/bin/env node

/**
 * Health1 Console.log Warning Hook
 * Fires on PostToolUse:Edit for JS/TS files.
 * Warns if console.log statements are found in edited file.
 */

const fs = require("fs");
const path = require("path");

const filePath = process.argv[2];
if (!filePath || !fs.existsSync(filePath)) process.exit(0);

// Skip test files — console.log is acceptable there
if (
  filePath.includes("__tests__") ||
  filePath.includes(".test.") ||
  filePath.includes(".spec.")
) {
  process.exit(0);
}

const content = fs.readFileSync(filePath, "utf-8");
const lines = content.split("\n");
const matches = [];

lines.forEach((line, i) => {
  if (/console\.(log|debug|info)\(/.test(line) && !/\/\//.test(line.split("console")[0])) {
    matches.push(i + 1);
  }
});

if (matches.length > 0) {
  console.error(
    `[Clean Code Hook] ⚠️  ${matches.length} console.log(s) in ${path.basename(filePath)} at line(s): ${matches.join(", ")}`
  );
  console.error(
    `[Clean Code Hook] Remove before committing. Use proper error handling or logger.`
  );
}
