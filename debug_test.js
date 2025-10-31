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

/**
 * Perplexity API Configuration
 * API Endpoint: https://api.perplexity.ai/chat/completions
 * Recommended Model: mistral-7b-instruct
 * Set the PERPLEXITY_API_KEY environment variable with your API key
 */
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
Usage: node debug_test.js --test <test-file> --log <error-log> [OPTIONS]

Options:
  --test <path>       Path to the failing test file (required)
  --log <path>        Path to the error log file (required)
  --backup            Create a timestamped backup of the test file (default: true)
  --no-backup         Do not create a backup before overwriting
  --dry-run           Print the corrected code without writing to file
  -h, --help          Display this help message

Example:
  node debug_test.js --test ./playwright-tests/login.spec.js --log ./test-inputs/error.log
`);
}

// -------------------------------
// Main Function
// -------------------------------
async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (!args.testPath || !args.logPath) {
    console.error('Error: Both --test and --log are required.');
    printHelp();
    process.exit(1);
  }

  console.log('\n===================================');
  console.log('AI Self-Healing QA Framework - Test Debugger');
  console.log('===================================\n');

  try {
    // Read test file and error log
    console.log(`Reading test file: ${args.testPath}`);
    const testContent = await safeReadFile(args.testPath);
    console.log(`Reading error log: ${args.logPath}`);
    const errorLog = await safeReadFile(args.logPath);

    // Call Perplexity API to fix the test
    console.log('\nSending to Perplexity API for correction...');
    const correctedTest = await callPerplexityAPI(testContent, errorLog);

    if (args.dryRun) {
      console.log('\n--- Corrected Test (Dry Run) ---');
      console.log(correctedTest);
      console.log('--- End of Corrected Test ---\n');
    } else {
      // Backup original test file if needed
      if (args.backup) {
        const backupPath = createBackupPath(args.testPath);
        console.log(`Creating backup: ${backupPath}`);
        await copyFile(args.testPath, backupPath);
      }

      // Write corrected test back to the original file
      console.log(`Writing corrected test to: ${args.testPath}`);
      await writeFile(args.testPath, correctedTest, 'utf8');

      console.log('\n✓ Test file successfully updated!');
    }
  } catch (error) {
    console.error('\n✗ Error during debug process:');
    console.error(error.message);
    process.exit(1);
  }
}

// -------------------------------
// Helper Functions
// -------------------------------

/**
 * Safely reads a file and throws a descriptive error if it fails
 * @param {string} filePath - Path to the file
 * @returns {Promise<string>} File contents
 */
async function safeReadFile(filePath) {
  try {
    await access(filePath, fs.constants.R_OK);
    return await readFile(filePath, 'utf8');
  } catch (error) {
    throw new Error(`Failed to read file "${filePath}": ${error.message}`);
  }
}

/**
 * Creates a timestamped backup path for a given file
 * @param {string} originalPath - Original file path
 * @returns {string} Backup file path with timestamp
 */
function createBackupPath(originalPath) {
  const dir = path.dirname(originalPath);
  const ext = path.extname(originalPath);
  const name = path.basename(originalPath, ext);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  return path.join(dir, `${name}.${timestamp}.bak${ext}`);
}

/**
 * Calls Perplexity API with the failed test and error log to generate a corrected test
 * Uses mistral-7b-instruct model for code correction
 * @param {string} testContent - The original test file content
 * @param {string} errorLog - The error log content
 * @returns {Promise<string>} Corrected test code
 */
async function callPerplexityAPI(testContent, errorLog) {
  const prompt = `You are an expert Playwright/Jest test engineer. Below is a test that failed and the error log. Please analyze the error and provide a corrected version of the test.

--- Original Test ---
${testContent}

--- Error Log ---
${errorLog}

--- Instructions ---
1. Fix the test based on the error log
2. Maintain the original test structure and intent
3. Use proper selectors and best practices
4. Add comments explaining the fixes
5. Return ONLY the corrected test code, no explanations

Corrected Test:`;

  try {
    const response = await axios.post(
      PERPLEXITY_API_URL,
      {
        model: 'mistral-7b-instruct',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 3000
      },
      {
        headers: {
          'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const correctedCode = response.data.choices[0].message.content;
    return extractCodeFromResponse(correctedCode);
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

/**
 * Extracts code from a response that may contain markdown code blocks or extra text
 * @param {string} response - Raw API response
 * @returns {string} Extracted code
 */
function extractCodeFromResponse(response) {
  // Try to extract from markdown code blocks
  const codeBlockRegex = /```(?:javascript|js|typescript|ts)?\n([\s\S]*?)```/g;
  const matches = [];
  let match;

  while ((match = codeBlockRegex.exec(response)) !== null) {
    matches.push(match[1]);
  }

  if (matches.length > 0) {
    // Return the largest code block (likely the main code)
    return matches.reduce((a, b) => a.length > b.length ? a : b).trim();
  }

  // If no code blocks, return trimmed response
  return response.trim();
}

// -------------------------------
// Execute Main
// -------------------------------
main();
