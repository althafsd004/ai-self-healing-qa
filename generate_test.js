/**
 * Test Generation Script for AI Self-Healing QA Framework
 * 
 * This script automates the generation of Playwright test files from plain text test descriptions.
 * It reads test input files, sends them to Perplexity API for conversion to Playwright code,
 * and saves the generated test files in the appropriate directory structure.
 * 
 * Directory Structure:
 * - test-inputs/module-X/: Contains plain text test descriptions (e.g., login.txt)
 * - playwright-tests/module-X/: Output directory for generated Playwright test files (e.g., login.spec.js)
 * 
 * Usage:
 *   node generate_test.js
 * 
 * Prerequisites:
 *   - Node.js installed
 *   - Required packages: fs, path, axios
 *   - Perplexity API key set in environment variable PERPLEXITY_API_KEY
 * 
 * Future Enhancements:
 *   - Add command-line arguments for custom input/output paths
 *   - Support batch processing of multiple test files
 *   - Add error handling for API rate limits
 *   - Implement caching to avoid regenerating unchanged tests
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// ============================================================================
// CONFIGURATION
// ============================================================================

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

/**
 * Input and output file paths
 * Modify these paths to process different test modules
 */
const INPUT_FILE = 'test-inputs/module-A/login.txt';
const OUTPUT_FILE = 'playwright-tests/module-A/login.spec.js';

// Perplexity API endpoint
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Main function to orchestrate the test generation process
 * 1. Read test input file
 * 2. Generate Playwright code using Perplexity API
 * 3. Save the generated code to output file
 */
async function generateTest() {
  try {
    console.log('\n========================================');
    console.log('Test Generation Started');
    console.log('========================================\n');

    // Read test input file
    const testInput = await readTestInput(INPUT_FILE);
    console.log(`✓ Read test input from: ${INPUT_FILE}`);

    // Generate Playwright code
    const playwrightCode = await generatePlaywrightCode(testInput);
    console.log('✓ Generated Playwright code using Perplexity API');

    // Save to output file
    await saveTestOutput(OUTPUT_FILE, playwrightCode);
    console.log(`✓ Saved test to: ${OUTPUT_FILE}`);

    console.log('\n========================================');
    console.log('Test Generation Completed Successfully');
    console.log('========================================\n');
  } catch (error) {
    console.error('\n❌ Error generating test:');
    console.error(error.message);
    process.exit(1);
  }
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Reads the test input file
 * @param {string} filePath - Path to the test input file
 * @returns {Promise<string>} Test input content
 */
async function readTestInput(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to read test input file: ${error.message}`);
  }
}

/**
 * Saves the generated test code to output file
 * @param {string} filePath - Path to save the test file
 * @param {string} code - Generated Playwright code
 */
async function saveTestOutput(filePath, code) {
  try {
    // Create output directory if it doesn't exist
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, code, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to save test output file: ${error.message}`);
  }
}

/**
 * Generates Playwright test code using Perplexity API
 * Uses mistral-7b-instruct model for code generation
 * @param {string} testInput - Test description in plain text
 * @returns {Promise<string>} Generated Playwright test code
 */
async function generatePlaywrightCode(testInput) {
  const prompt = `You are a Playwright test automation expert. Convert the following test description into a complete Playwright test file.

Requirements:
- Use modern Playwright syntax with async/await
- Include proper test structure with describe/test blocks
- Add meaningful assertions
- Use best practices for selectors
- Include comments for clarity

Test Description:
${testInput}

Provide ONLY the complete JavaScript test code, no explanations.`;

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
        max_tokens: 2000
      },
      {
        headers: {
          'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const generatedCode = response.data.choices[0].message.content;
    
    // Extract code from markdown code blocks if present
    return extractCodeFromMarkdown(generatedCode);
  } catch (error) {
    // Provide detailed error messages for common API issues
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
 * Extracts code from markdown code blocks
 * @param {string} text - Text that may contain markdown code blocks
 * @returns {string} Extracted code
 */
function extractCodeFromMarkdown(text) {
  // Match code blocks with optional language specifier
  const codeBlockRegex = /```(?:javascript|js)?\n([\s\S]*?)```/g;
  const matches = [];
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    matches.push(match[1]);
  }

  if (matches.length > 0) {
    // Return the largest code block (likely the main code)
    return matches.reduce((a, b) => a.length > b.length ? a : b).trim();
  }

  // If no code blocks found, return the text as-is
  return text.trim();
}

/**
 * Cleans up the generated code by removing explanatory text
 * @param {string} code - Raw generated code
 * @returns {string} Cleaned code
 */
function cleanGeneratedCode(code) {
  // Remove common prefixes/suffixes that might be added by the model
  let cleaned = code.trim();
  
  // Remove "Here is" type explanations at the start
  cleaned = cleaned.replace(/^(Here is|Here's).*?:\n/i, '');
  
  // Remove explanations after the code
  const lastClosingBrace = cleaned.lastIndexOf('}');
  if (lastClosingBrace !== -1) {
    // Keep everything up to and including the last closing brace
    cleaned = cleaned.substring(0, lastClosingBrace + 1);
  }
  
  return cleaned.trim();
}

/**
 * Extracts JavaScript code from a response that may contain markdown or explanatory text
 * @param {string} response - Raw response from API
 * @returns {string} Extracted JavaScript code
 */
function extractJavaScriptCode(response) {
  // First try to extract from markdown code blocks
  const codeBlockMatch = response.match(/```(?:javascript|js)?\n([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  
  // If no code block, look for code starting with common patterns
  const codePatterns = [
    /const.*require.*playwright/i,
    /import.*from.*playwright/i,
    /test\(/,
    /describe\(/
  ];
  
  for (const pattern of codePatterns) {
    const match = response.match(pattern);
    if (match) {
      // Extract from this point onwards
      const startIndex = match.index;
      const generatedCode = response.substring(startIndex);
      return cleanGeneratedCode(generatedCode);
    }
  }
  
  // If nothing worked, return cleaned response
  return cleanGeneratedCode(response);
}

/**
 * Validates that the generated code is valid Playwright test code
 * @param {string} code - Generated code to validate
 * @returns {boolean} True if valid
 * @throws {Error} If code is invalid
 */
function validateGeneratedCode(code) {
  // Check for required Playwright imports or requires
  const hasPlaywrightImport = /(?:import|require).*playwright/.test(code);
  
  // Check for test structure
  const hasTestStructure = /(?:test|describe)\(/.test(code);
  
  if (!hasPlaywrightImport) {
    throw new Error('Generated code does not include Playwright import/require');
  }
  
  if (!hasTestStructure) {
    throw new Error('Generated code does not include test structure (test/describe)');
  }
  
  return true;
}

/**
 * Generates Playwright code with validation and retry logic
 * @param {string} testInput - Test description
 * @param {number} maxRetries - Maximum number of retry attempts
 * @returns {Promise<string>} Validated Playwright code
 */
async function generatePlaywrightCodeWithRetry(testInput, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries}...`);
      
      const generatedCode = await generatePlaywrightCode(testInput);
      validateGeneratedCode(generatedCode);
      
      return generatedCode;
    } catch (error) {
      lastError = error;
      console.error(`Attempt ${attempt} failed: ${error.message}`);
      
      if (attempt < maxRetries) {
        console.log('Retrying...');
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
      }
    }
  }
  
  throw new Error(`Failed to generate valid code after ${maxRetries} attempts: ${lastError.message}`);
}

// ============================================================================
// SCRIPT EXECUTION
// ============================================================================

// Execute the main function if this script is run directly
// This allows the script to also be imported as a module in the future
if (require.main === module) {
  generateTest();
}

// Export functions for potential reuse in other scripts
module.exports = {
  generateTest,
  readTestInput,
  saveTestOutput,
  generatePlaywrightCode
};
