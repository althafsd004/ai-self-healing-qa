/**
 * Test Generation Script for AI Self-Healing QA Framework
 * 
 * This script automates the generation of Playwright test files from plain text test descriptions.
 * It reads test input files, sends them to OpenAI API for conversion to Playwright code,
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
 *   - Required packages: fs, path, openai
 *   - OpenAI API key set in environment variable or replace placeholder
 * 
 * Future Enhancements:
 *   - Add command-line arguments for custom input/output paths
 *   - Support batch processing of multiple test files
 *   - Add error handling for API rate limits
 *   - Implement caching to avoid regenerating unchanged tests
 */

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * OpenAI API Configuration
 * Replace 'YOUR_OPENAI_API_KEY_HERE' with your actual API key
 * or set the OPENAI_API_KEY environment variable
 */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'YOUR_OPENAI_API_KEY_HERE';

/**
 * Input and output file paths
 * Modify these paths to process different test modules
 */
const INPUT_FILE = 'test-inputs/module-A/login.txt';
const OUTPUT_FILE = 'playwright-tests/module-A/login.spec.js';

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Main function to orchestrate the test generation process
 * 1. Read the test description from input file
 * 2. Call OpenAI API to convert description to Playwright code
 * 3. Save the generated code to output file
 */
async function generateTest() {
  try {
    console.log('Starting test generation process...');
    
    // Step 1: Read the test description from the input file
    console.log(`Reading test description from: ${INPUT_FILE}`);
    const testDescription = readTestInput(INPUT_FILE);
    console.log('Test description loaded successfully.');
    
    // Step 2: Generate Playwright code using OpenAI API
    console.log('Calling OpenAI API to generate Playwright code...');
    const playwrightCode = await generatePlaywrightCode(testDescription);
    console.log('Playwright code generated successfully.');
    
    // Step 3: Save the generated code to the output file
    console.log(`Saving generated code to: ${OUTPUT_FILE}`);
    saveTestOutput(OUTPUT_FILE, playwrightCode);
    console.log('Test generation completed successfully!');
    
  } catch (error) {
    console.error('Error during test generation:', error.message);
    process.exit(1);
  }
}

// ============================================================================
// FILE OPERATIONS
// ============================================================================

/**
 * Read test description from input file
 * @param {string} filePath - Path to the input text file
 * @returns {string} - Content of the test description file
 */
function readTestInput(filePath) {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`Input file not found: ${filePath}`);
    }
    
    // Read file content with UTF-8 encoding
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Validate that content is not empty
    if (!content.trim()) {
      throw new Error('Input file is empty');
    }
    
    return content;
  } catch (error) {
    throw new Error(`Failed to read input file: ${error.message}`);
  }
}

/**
 * Save generated Playwright code to output file
 * Creates necessary directories if they don't exist
 * @param {string} filePath - Path to the output file
 * @param {string} content - Generated Playwright code to save
 */
function saveTestOutput(filePath, content) {
  try {
    // Extract directory path from file path
    const directory = path.dirname(filePath);
    
    // Create directory structure if it doesn't exist
    // recursive: true allows creating nested directories
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
      console.log(`Created directory: ${directory}`);
    }
    
    // Write the generated code to the file
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Successfully saved test file: ${filePath}`);
    
  } catch (error) {
    throw new Error(`Failed to save output file: ${error.message}`);
  }
}

// ============================================================================
// OPENAI API INTEGRATION
// ============================================================================

/**
 * Generate Playwright test code using OpenAI API
 * Sends the test description to OpenAI and receives Playwright code
 * @param {string} testDescription - Plain text description of the test
 * @returns {Promise<string>} - Generated Playwright test code
 */
async function generatePlaywrightCode(testDescription) {
  try {
    // Validate API key is configured
    if (OPENAI_API_KEY === 'YOUR_OPENAI_API_KEY_HERE') {
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable or update the script.');
    }
    
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
    });
    
    // Construct the prompt for OpenAI
    // This prompt guides the AI to generate proper Playwright test code
    const prompt = `You are an expert in test automation using Playwright.

Given the following test description, generate a complete Playwright test file in JavaScript.

Requirements:
- Use Playwright's test syntax (test.describe, test, expect)
- Include all necessary imports
- Add appropriate assertions
- Include comments explaining each step
- Follow Playwright best practices
- Make the test maintainable and readable

Test Description:
${testDescription}

Generate the complete Playwright test code:`;
    
    // Call OpenAI API with the prompt
    // Using gpt-4 for higher quality code generation
    // Adjust model and parameters as needed for your use case
    const response = await openai.chat.completions.create({
      model: 'gpt-4', // Can be changed to 'gpt-3.5-turbo' for faster/cheaper generation
      messages: [
        {
          role: 'system',
          content: 'You are an expert test automation engineer specializing in Playwright. Generate clean, maintainable test code.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3, // Lower temperature for more consistent code generation
      max_tokens: 2000, // Adjust based on expected test complexity
    });
    
    // Extract the generated code from the API response
    const generatedCode = response.choices[0].message.content.trim();
    
    // Validate that we received code
    if (!generatedCode) {
      throw new Error('OpenAI API returned empty response');
    }
    
    return generatedCode;
    
  } catch (error) {
    // Provide detailed error messages for common API issues
    if (error.status === 401) {
      throw new Error('OpenAI API authentication failed. Check your API key.');
    } else if (error.status === 429) {
      throw new Error('OpenAI API rate limit exceeded. Please try again later.');
    } else if (error.status === 500) {
      throw new Error('OpenAI API server error. Please try again later.');
    } else {
      throw new Error(`OpenAI API error: ${error.message}`);
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
