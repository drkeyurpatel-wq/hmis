#!/usr/bin/env node

/**
 * Health1 Session End Hook
 * Saves session state to .claude/session-state.json for next session pickup.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const stateDir = path.join(process.cwd(), ".claude");
const stateFile = path.join(stateDir, "session-state.json");

// Get current branch
let branch = "unknown";
try {
  branch = execSync("git branch --show-current 2>/dev/null", { encoding: "utf-8" }).trim();
} catch (e) {}

// Get last commit message
let lastCommit = "";
try {
  lastCommit = execSync("git log --oneline -1 2>/dev/null", { encoding: "utf-8" }).trim();
} catch (e) {}

// Get modified files count
let modifiedCount = 0;
try {
  const status = execSync("git status --porcelain 2>/dev/null", { encoding: "utf-8" });
  modifiedCount = status.split("\n").filter((l) => l.trim()).length;
} catch (e) {}

const state = {
  savedAt: new Date().toISOString(),
  currentBranch: branch,
  lastCommit: lastCommit,
  uncommittedFiles: modifiedCount,
  notes: "",
};

// Merge with existing state to preserve manual notes
if (fs.existsSync(stateFile)) {
  try {
    const existing = JSON.parse(fs.readFileSync(stateFile, "utf-8"));
    if (existing.notes) state.notes = existing.notes;
    if (existing.lastTask) state.lastTask = existing.lastTask;
    if (existing.openIssues) state.openIssues = existing.openIssues;
  } catch (e) {}
}

if (!fs.existsSync(stateDir)) {
  fs.mkdirSync(stateDir, { recursive: true });
}
fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
console.error(`[Session] State saved to .claude/session-state.json`);
