#!/usr/bin/env node

/**
 * Health1 Session Start Hook
 * Loads saved session context from .claude/session-state.json if it exists.
 * Outputs context to stderr so Claude Code picks it up.
 */

const fs = require("fs");
const path = require("path");

const stateFile = path.join(process.cwd(), ".claude", "session-state.json");

if (fs.existsSync(stateFile)) {
  try {
    const state = JSON.parse(fs.readFileSync(stateFile, "utf-8"));
    console.error("[Session] Loaded previous session context:");
    if (state.lastTask) console.error(`  Last task: ${state.lastTask}`);
    if (state.currentBranch) console.error(`  Branch: ${state.currentBranch}`);
    if (state.openIssues && state.openIssues.length > 0) {
      console.error(`  Open issues: ${state.openIssues.join(", ")}`);
    }
    if (state.notes) console.error(`  Notes: ${state.notes}`);
    if (state.savedAt) console.error(`  Saved at: ${state.savedAt}`);
  } catch (err) {
    // Silently ignore corrupt state files
  }
}
