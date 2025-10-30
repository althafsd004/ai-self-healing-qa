#!/usr/bin/env node
/**
 * debug_test.js
 *
 * Purpose:
 *  - Read a failed Playwright/Jest test file and its error log
 *  - Send both as context to Perplexity API to request a corrected test script
 *  - Overwrite the original test file with the LLM-corrected code
 *
 * Usage:
 *  node debug_test.js --test ./playwright-tests/example.spec.ts --log ./test-inputs/last_failure.log [--backup]
 *
 * Notes:
 *  - This script is modular with clear functions and robust error handling
 *  - Requires Perplexity API key in environment variable PERPLEXITY_API_KEY
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

// Perplexity API Configuration
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || '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';

if (!PERPLEXITY_API_KEY) {
  console.error('Error: PERPLEXITY_API_KEY environment variable is not set');
  process.exit(1);
}

// Perplexity API endpoint
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

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
Usage: node debug_test.js --test <test_file> --log <error_log> [options]

Options:
  --test <file>     Path to the failing test file
  --log <file>      Path to the error log file
  --backup          Create a backup before overwriting (default)
  --no-backup       Skip creating a backup
  --dry-run         Print the corrected code without writing to file
  -h, --help        Show this help message

Example:
  node debug_test.js --test ./playwright-tests/login.spec.js --log ./test-inputs/error.log
`);
}

// -------------------------------
// File Operations
// -------------------------------

async function ensureReadable(filePath) {
  try {
    await access(filePath, fs.constants.R_OK);
  } catch (error) {
    throw new Error(`File not readable: ${filePath}`);
  }
}

async function backupFile(filePath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${filePath}.backup.${timestamp}`;
  await copyFile(filePath, backupPath);
  return backupPath;
}

// -------------------------------
// Perplexity API Integration
// -------------------------------

async function callPerplexity({ testContent, logContent, fileName }) {
  const prompt = `You are a test debugging expert. I have a failing Playwright test and its error log. Please analyze the error and provide a corrected version of the test file.

**Test File (${fileName}):**
\`\`\`javascript
${testContent}
\`\`\`

**Error Log:**
\`\`\`
${logContent}
\`\`\`

**Requirements:**
- Fix the specific issues mentioned in the error log
- Keep the test structure and intent intact
- Use proper Playwright syntax and best practices
- Add proper waits and assertions as needed
- Return ONLY the corrected JavaScript code, no explanations

Corrected test file:`;

  try {
    const response = await axios.post(
      PERPLEXITY_API_URL,
      {
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [
          {
            role: 'system',
            content: 'You are a Playwright test debugging expert. Analyze failing tests and provide corrected code without any markdown formatting or explanations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      },
      {
        headers: {
          'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.data || !response.data.choices || !response.data.choices[0]) {
      throw new Error('Perplexity API returned invalid response');
    }

    let correctedCode = response.data.choices[0].message.content.trim();
    
    // Clean up the response by removing markdown code blocks if present
    if (correctedCode.includes('```javascript') || correctedCode.includes('```js')) {
      correctedCode = correctedCode.replace(/```(?:javascript|js)\n?/g, '').replace(/```\n?/g, '');
    }
    
    return correctedCode.trim();
    
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      if (status === 401 || status === 403) {
        throw new Error('Perplexity API authentication failed. Check your API key.');
      } else if (status === 429) {
        throw new Error('Perplexity API rate limit exceeded. Please try again later.');
      } else if (status === 500) {
        throw new Error('Perplexity API server error. Please try again later.');
      } else {
        throw new Error(`Perplexity API error: ${error.response.data?.error?.message || error.message}`);
      }
    } else {
      throw new Error(`Perplexity API error: ${error.message}`);
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

  const fixedContent = await callPerplexity({
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
