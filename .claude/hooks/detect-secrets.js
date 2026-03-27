#!/usr/bin/env node

/**
 * Health1 Secret Detection Hook
 * Fires on PreToolUse:Bash — scans commands for leaked credentials.
 * Warns on detection. Critical for PHI/PII compliance.
 */

const command = process.argv[2] || "";

const patterns = [
  { name: "OpenAI/Anthropic API key", regex: /sk-[a-zA-Z0-9]{20,}/ },
  { name: "GitHub PAT", regex: /ghp_[a-zA-Z0-9]{36}/ },
  { name: "AWS Access Key", regex: /AKIA[0-9A-Z]{16}/ },
  { name: "Supabase key", regex: /sbp_[a-zA-Z0-9]{40,}/ },
  { name: "Supabase service_role", regex: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+/ },
  { name: "Generic password", regex: /password\s*=\s*['"][^'"]{8,}/ },
  { name: "Aadhaar number", regex: /\b[2-9]\d{3}\s?\d{4}\s?\d{4}\b/ },
  { name: "Indian phone number in data", regex: /\+91[6-9]\d{9}/ },
];

let found = false;

for (const p of patterns) {
  if (p.regex.test(command)) {
    if (!found) {
      console.error("[Secret Hook] ⚠️  Potential credential detected in command:");
      found = true;
    }
    console.error(`  → ${p.name}`);
  }
}

if (found) {
  console.error("[Secret Hook] Never paste secrets in commands. Use .env files.");
  // Exit 0 = warn. Change to exit 2 to hard-block.
  process.exit(0);
}
