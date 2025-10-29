#!/usr/bin/env node

/**
 * debug_test.js
 *
 * Purpose:
 *  - Read a failed Playwright/Jest test file and its error log
 *  - Send both as context to OpenAI to request a corrected test script
 *  - Overwrite the original test file with the LLM-corrected code
 *
 * Usage:
 *  node debug_test.js --test ./playwright-tests/example.spec.ts --log ./test-inputs/last_failure.log [--model gpt-4o-mini] [--backup]
 *
 * Notes:
 *  - This script is modular with clear functions and robust error handling
 *  - Requires an OpenAI API key in environment variable OPENAI_API_KEY (placeholder below)
 *  - Safe by default: creates a timestamped backup unless --no-backup is provided
 */

// -------------------------------
// Configuration and Imports
// -------------------------------

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const copyFile = promisify(fs.copyFile);
const access = promisify(fs.access);

// Placeholder: You can also hardcode temporarily for local testing, but prefer env var.
// Example: process.env.OPENAI_API_KEY = "YOUR_OPENAI_API_KEY_HERE";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "YOUR_OPENAI_API_KEY_HERE"; // <-- replace in CI/Secrets

// Default model (can be overridden via --model flag)
const DEFAULT_MODEL = 'gpt-4o-mini';

// -------------------------------
// CLI Argument Parsing
// -------------------------------

function parseArgs(argv) {
  const args = { model: DEFAULT_MODEL, backup: true };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--test') args.testPath = argv[++i];
    else if (a === '--log') args.logPath = argv[++i];
    else if (a === '--model') args.model = argv[++i];
    else if (a === '--backup') args.backup = true;
    else if (a === '--no-backup') args.backup = false;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '-h' || a === '--help') args.help = true;
    else {
      console.warn(`Unknown argument: ${a}`);
    }
  }
  return args;
}

function printHelp() {
  console.log(`\nUsage: node debug_test.js --test <path> --log <path> [--model <model>] [--backup|--no-backup] [--dry-run]\n\nOptions:\n  --test         Path to the failed test file to fix (required)\n  --log          Path to the error log describing the failure (required)\n  --model        OpenAI model to use (default: ${DEFAULT_MODEL})\n  --backup       Make a timestamped backup before overwrite (default)\n  --no-backup    Do not create a backup\n  --dry-run      Show the suggested fix without writing changes\n  -h, --help     Show this help\n\nEnvironment:\n  OPENAI_API_KEY  Your OpenAI API key (or replace placeholder in file)\n`);
}

// -------------------------------
// File Utilities
// -------------------------------

async function ensureReadable(filePath) {
  if (!filePath) throw new Error('Missing file path');
  try {
    await access(filePath, fs.constants.R_OK);
  } catch (e) {
    throw new Error(`File not readable or does not exist: ${filePath}`);
  }
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return [
    d.getFullYear(),
    pad(d.getMonth() + 1),
    pad(d.getDate()),
    pad(d.getHours()),
    pad(d.getMinutes()),
    pad(d.getSeconds()),
  ].join('');
}

async function backupFile(srcPath) {
  const dir = path.dirname(srcPath);
  const base = path.basename(srcPath);
  const dest = path.join(dir, `${base}.bak.${timestamp()}`);
  await copyFile(srcPath, dest);
  return dest;
}

// -------------------------------
// OpenAI Client (fetch-based to avoid extra deps)
// -------------------------------

async function callOpenAI({ apiKey, model, testContent, logContent, fileName }) {
  if (!apiKey || apiKey === 'YOUR_OPENAI_API_KEY_HERE') {
    throw new Error('OPENAI_API_KEY is missing. Set env var or edit placeholder.');
  }

  const systemPrompt = `You are a senior QA engineer. Given a failing test file and its error log, produce a corrected, runnable version of the test that fixes the root cause. Keep original project conventions (Playwright/Jest where applicable), preserve intents, and include comments on the fix. Output ONLY the full corrected file content with no surrounding fences.`;

  const userPrompt = [
    `Project file: ${fileName}`,
    '--- FAILED TEST CONTENT START ---',
    testContent,
    '--- FAILED TEST CONTENT END ---',
    '',
    '--- ERROR LOG START ---',
    logContent,
    '--- ERROR LOG END ---',
    '',
    'Please return only the corrected file content. Do not include markdown code fences.'
  ].join('\n');

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.2,
  };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`OpenAI API error ${res.status}: ${txt}`);
  }

  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('OpenAI API returned empty content');
  }
  return content.trim();
}

// -------------------------------
// Core Workflow
// -------------------------------

async function generateFix({ testPath, logPath, model, backup, dryRun }) {
  await ensureReadable(testPath);
  await ensureReadable(logPath);

  const [testContent, logContent] = await Promise.all([
    readFile(testPath, 'utf8'),
    readFile(logPath, 'utf8'),
  ]);

  const fixedContent = await callOpenAI({
    apiKey: OPENAI_API_KEY,
    model,
    testContent,
    logContent,
    fileName: path.basename(testPath),
  });

  if (dryRun) {
    console.log('\n--- Suggested corrected file (dry run) ---\n');
    console.log(fixedContent);
    console.log('\n--- End corrected file ---\n');
    return { wrote: false };
  }

  if (backup) {
    const b = await backupFile(testPath);
    console.log(`Backup created at: ${b}`);
  }

  await writeFile(testPath, fixedContent, 'utf8');
  console.log(`Overwrote ${testPath} with corrected content.`);
  return { wrote: true };
}

// -------------------------------
// Entrypoint
// -------------------------------

(async function main() {
  try {
    const args = parseArgs(process.argv);
    if (args.help || !args.testPath || !args.logPath) {
      printHelp();
      process.exit(args.help ? 0 : 1);
    }

    await generateFix(args);
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
})();
