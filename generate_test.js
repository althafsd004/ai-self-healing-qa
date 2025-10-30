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
 * 1. Read the test description from input file
 * 2. Call Perplexity API to convert description to Playwright code
 * 3. Save the generated code to output file
 */
async function generateTest() {
  try {
    console.log('Starting test generation...');
    
    // Step 1: Read the test description from input file
    const testDescription = readTestInput(INPUT_FILE);
    console.log(`Read test description from: ${INPUT_FILE}`);
    
    // Step 2: Generate Playwright code using Perplexity API
    console.log('Calling Perplexity API...');
    const playwrightCode = await generatePlaywrightCode(testDescription);
    
    // Step 3: Save the generated code to the output file
    saveTestOutput(OUTPUT_FILE, playwrightCode);
    console.log(`Test file generated successfully: ${OUTPUT_FILE}`);
    
  } catch (error) {
    console.error('Error generating test:', error.message);
    process.exit(1);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Read test description from the input file
 * @param {string} filePath - Path to the input file
 * @returns {string} - Content of the input file
 */
function readTestInput(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(`Failed to read input file: ${error.message}`);
  }
}

/**
 * Save the generated Playwright code to the output file
 * @param {string} filePath - Path to the output file
 * @param {string} code - Generated Playwright code
 */
function saveTestOutput(filePath, code) {
  try {
    // Create directory if it doesn't exist
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Clean up the code by removing markdown code blocks if present
    let cleanCode = code;
    if (code.includes('```javascript') || code.includes('```js')) {
      cleanCode = code.replace(/```(?:javascript|js)\n?/g, '').replace(/```\n?/g, '');
    }
    
    fs.writeFileSync(filePath, cleanCode.trim());
  } catch (error) {
    throw new Error(`Failed to write output file: ${error.message}`);
  }
}

/**
 * Generate Playwright code using Perplexity API
 * @param {string} testDescription - Plain text description of the test
 * @returns {Promise<string>} - Generated Playwright code
 */
async function generatePlaywrightCode(testDescription) {
  try {
    // Construct the prompt for Perplexity API
    const prompt = `You are a Playwright test code generator. Generate a complete, working Playwright test file based on this description:\n\n${testDescription}\n\nRequirements:\n- Use modern Playwright syntax\n- Include proper imports and test structure\n- Add meaningful test descriptions\n- Use best practices for selectors\n- Include appropriate waits and assertions\n- Return ONLY the JavaScript code, no explanations\n\nGenerate the complete test file:`;
    
    // Make API request to Perplexity
    const response = await axios.post(
      PERPLEXITY_API_URL,
      {
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [
          {
            role: 'system',
            content: 'You are a Playwright test code generator. Generate clean, working code without any markdown formatting or explanations.'
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
    
    // Extract the generated code from the API response
    if (!response.data || !response.data.choices || !response.data.choices[0]) {
      throw new Error('Perplexity API returned invalid response');
    }
    
    const generatedCode = response.data.choices[0].message.content.trim();
    
    // Validate that we received code
    if (!generatedCode) {
      throw new Error('Perplexity API returned empty response');
    }
    
    return generatedCode;
    
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
