#!/usr/bin/env node
/**
 * debug_test.js
 *
 * Purpose:
 *  - Read a failed Playwright/Jest test file and its error log
 *  - Send both as context to Gemini API to request a corrected test script
 *  - Overwrite the original test file with the LLM-corrected code
 *
 * Usage:
 *  node debug_test.js --test ./playwright-tests/example.spec.ts --log ./test-inputs/last_failure.log [--backup]
 *
 * Notes:
 *  - This script is modular with clear functions and robust error handling
 *  - Requires Gemini API key in environment variable GEMINI_API_KEY
 *  - Safe by default: creates a timestamped backup unless --no-backup is provided
 */

// -------------------------------
// Configuration and Imports
// -------------------------------

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { promisify } = require('util');

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const copyFile = promisify(fs.copyFile);
const access = promisify(fs.access);

// Gemini API Configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('Error: GEMINI_API_KEY environment variable is not set');
  process.exit(1);
}

// Gemini API endpoint
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;

// -------------------------------
// CLI Argument Parsing
// -------------------------------

function parseArgs(argv) {
  const args = { backup: true };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--test') args.testPath = argv[++i];
    else if (a === '--log') args.logPath = argv[++i];
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
  console.log(`
Usage: node debug_test.js --test <path> --log <path> [--backup|--no-backup] [--dry-run]

Options:
  --test         Path to the failed test file to fix (required)
  --log          Path to the error log describing the failure (required)
  --backup       Make a timestamped backup before overwrite (default)
  --no-backup    Do not create a backup
  --dry-run      Show the suggested fix without writing changes
  -h, --help     Show this help

Environment:
  GEMINI_API_KEY  Your Gemini API key
`);
}

// -------------------------------
// Helper Functions
// -------------------------------

async function ensureReadable(filePath) {
  try {
    await access(filePath, fs.constants.R_OK);
  } catch (err) {
    throw new Error(`Cannot read file: ${filePath}`);
  }
}

async function backupFile(filePath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.dirname(filePath);
  const base = path.basename(filePath, path.extname(filePath));
  const ext = path.extname(filePath);
  const backupPath = path.join(dir, `${base}.backup-${timestamp}${ext}`);
  await copyFile(filePath, backupPath);
  return backupPath;
}

/**
 * Call Gemini API to generate a fixed test file
 * @param {Object} params - Parameters
 * @param {string} params.testContent - Original test file content
 * @param {string} params.logContent - Error log content
 * @param {string} params.fileName - Name of the test file
 * @returns {Promise<string>} - Fixed test code
 */
async function callGemini({ testContent, logContent, fileName }) {
  const prompt = `You are an expert test automation engineer. Below is a Playwright/Jest test file that has failed, along with the error log.

Test File Name: ${fileName}

Test File Content:
\`\`\`
${testContent}
\`\`\`

Error Log:
\`\`\`
${logContent}
\`\`\`

Please analyze the failure and provide a corrected version of the test file. Return ONLY the corrected code without any explanation or markdown formatting. Make sure to:
1. Fix any syntax errors
2. Correct logical issues causing the test to fail
3. Update selectors if they appear to be incorrect
4. Improve error handling if needed
5. Maintain the original test structure and intent

Return the complete corrected test file:`;

  try {
    const response = await axios.post(GEMINI_API_URL, {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4000,
      }
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.data || !response.data.candidates || !response.data.candidates[0]) {
      throw new Error('Gemini API returned invalid response');
    }

    const content = response.data.candidates[0].content.parts[0].text;

    if (!content || typeof content !== 'string') {
      throw new Error('Gemini API returned empty content');
    }

    return content.trim();

  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      if (status === 401 || status === 403) {
        throw new Error('Gemini API authentication failed. Check your API key.');
      } else if (status === 429) {
        throw new Error('Gemini API rate limit exceeded. Please try again later.');
      } else if (status === 500) {
        throw new Error('Gemini API server error. Please try again later.');
      } else {
        throw new Error(`Gemini API error: ${error.response.data?.error?.message || error.message}`);
      }
    } else {
      throw new Error(`Gemini API error: ${error.message}`);
    }
  }
}

// -------------------------------
// Core Workflow
// -------------------------------

async function generateFix({ testPath, logPath, backup, dryRun }) {
  await ensureReadable(testPath);
  await ensureReadable(logPath);

  const [testContent, logContent] = await Promise.all([
    readFile(testPath, 'utf8'),
    readFile(logPath, 'utf8'),
  ]);

  const fixedContent = await callGemini({
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
