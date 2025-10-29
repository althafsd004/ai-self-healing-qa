/**
 * Test Generation Script for AI Self-Healing QA Framework
 * 
 * This script automates the generation of Playwright test files from plain text test descriptions.
 * It reads test input files, sends them to Gemini API for conversion to Playwright code,
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
 *   - Gemini API key set in environment variable GEMINI_API_KEY
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
 * Gemini API Configuration
 * Set the GEMINI_API_KEY environment variable with your API key
 */
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('Error: GEMINI_API_KEY environment variable is not set');
  process.exit(1);
}

/**
 * Input and output file paths
 * Modify these paths to process different test modules
 */
const INPUT_FILE = 'test-inputs/module-A/login.txt';
const OUTPUT_FILE = 'playwright-tests/module-A/login.spec.js';

// Gemini API endpoint
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Main function to orchestrate the test generation process
 * 1. Read the test description from input file
 * 2. Call Gemini API to convert description to Playwright code
 * 3. Save the generated code to output file
 */
async function generateTest() {
  try {
    console.log('Starting test generation process...');
    
    // Step 1: Read the test description from input file
    const testDescription = await readTestInput(INPUT_FILE);
    console.log(`Read test description from: ${INPUT_FILE}`);
    
    // Step 2: Generate Playwright code using Gemini API
    const generatedCode = await generatePlaywrightCode(testDescription);
    console.log('Successfully generated Playwright test code');
    
    // Step 3: Save the generated code to output file
    await saveTestOutput(OUTPUT_FILE, generatedCode);
    console.log(`Test file saved to: ${OUTPUT_FILE}`);
    
    console.log('Test generation completed successfully!');
  } catch (error) {
    console.error('Error during test generation:', error.message);
    process.exit(1);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Read the test description from input file
 * @param {string} filePath - Path to the input file
 * @returns {Promise<string>} - Test description content
 */
async function readTestInput(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content.trim()) {
      throw new Error('Input file is empty');
    }
    return content;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Input file not found: ${filePath}`);
    }
    throw error;
  }
}

/**
 * Save the generated test code to output file
 * @param {string} filePath - Path to save the output file
 * @param {string} content - Generated test code
 */
async function saveTestOutput(filePath, content) {
  try {
    // Ensure output directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, content, 'utf8');
  } catch (error) {
    throw new Error(`Failed to save output file: ${error.message}`);
  }
}

/**
 * Generate Playwright test code using Gemini API
 * @param {string} testDescription - Plain text test description
 * @returns {Promise<string>} - Generated Playwright test code
 */
async function generatePlaywrightCode(testDescription) {
  try {
    // Construct prompt for Gemini API
    const prompt = `You are an expert test automation engineer specializing in Playwright.

Given the following test description, generate a complete, production-ready Playwright test file.

Test Description:
${testDescription}

Requirements:
1. Use modern Playwright syntax with async/await
2. Include proper imports and test structure
3. Add meaningful assertions
4. Include comments for clarity
5. Handle potential errors gracefully
6. Use Page Object Model patterns where appropriate

Generate the complete Playwright test code:`;
    
    // Call Gemini API with the prompt
    const response = await axios.post(GEMINI_API_URL, {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2000,
      }
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Extract the generated code from the API response
    if (!response.data || !response.data.candidates || !response.data.candidates[0]) {
      throw new Error('Gemini API returned invalid response');
    }
    
    const generatedCode = response.data.candidates[0].content.parts[0].text.trim();
    
    // Validate that we received code
    if (!generatedCode) {
      throw new Error('Gemini API returned empty response');
    }
    
    return generatedCode;
    
  } catch (error) {
    // Provide detailed error messages for common API issues
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
