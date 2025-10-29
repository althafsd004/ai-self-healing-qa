# ai-self-healing-qa

AI-powered self-healing QA automation framework with intelligent test recovery and auto-fixing capabilities.

## Requirements Checklist

Before getting started, ensure you have the following:

- [ ] **Node.js** (v14 or higher) installed
- [ ] **npm** (comes with Node.js) or yarn package manager
- [ ] **OpenAI API Key** - Required for AI-powered test healing
- [ ] **GitHub Account** - For repository and workflow management
- [ ] **Git** installed locally

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/althafsd004/ai-self-healing-qa.git
cd ai-self-healing-qa
```

### 2. Install Dependencies

Run the following command to install all required npm packages:

```bash
npm install
```

This will install all dependencies listed in `package.json`, including:
- Playwright for browser automation
- OpenAI SDK for AI integration
- Other testing utilities

### 3. Configure OpenAI API Key

#### For Local Development:

Create a `.env` file in the project root:

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

#### For GitHub Workflow (CI/CD):

To use the AI self-healing features in GitHub Actions, you must add your OpenAI API key as a **GitHub Repository Secret**:

1. Navigate to your GitHub repository
2. Click on **Settings** tab
3. In the left sidebar, click on **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. Add the following secret:
   - **Name**: `OPENAI_API_KEY`
   - **Value**: Your OpenAI API key (starts with `sk-...`)
6. Click **Add secret**

⚠️ **Important**: The workflow file (`.github/workflows/main.yml`) is configured to use this secret. Ensure the secret name matches exactly: `OPENAI_API_KEY`

### 4. Run Tests

After installation and configuration:

```bash
# Run all tests
npm test

# Run tests in headed mode (with browser UI)
npm run test:headed

# Run tests in debug mode
npm run test:debug
```

## GitHub Workflow

The repository includes a GitHub Actions workflow that:
- Automatically runs tests on push/pull requests
- Uses AI to detect and fix failing tests
- Uploads test results and screenshots as artifacts
- Utilizes the `OPENAI_API_KEY` secret for AI-powered healing

## Project Structure

```
ai-self-healing-qa/
├── .github/
│   └── workflows/
│       └── main.yml          # GitHub Actions workflow
├── tests/                     # Test files
├── package.json              # Project dependencies
├── playwright.config.js      # Playwright configuration
└── README.md                 # This file
```

## Features

- 🤖 **AI-Powered Test Healing**: Automatically fixes failing tests using OpenAI
- 🔄 **Self-Recovery**: Detects and adapts to UI changes
- 📊 **Detailed Reporting**: Comprehensive test reports with screenshots
- 🚀 **CI/CD Integration**: Seamless GitHub Actions workflow
- 🎯 **Smart Locators**: Intelligent element detection and recovery

## Troubleshooting

### Common Issues:

1. **Tests fail with "OpenAI API key not found"**
   - Ensure `.env` file exists locally with `OPENAI_API_KEY`
   - For GitHub Actions, verify the secret is added in repository settings

2. **npm install fails**
   - Verify Node.js version: `node --version` (should be v14+)
   - Clear npm cache: `npm cache clean --force`
   - Delete `node_modules` and `package-lock.json`, then retry

3. **Workflow not running**
   - Check that the workflow file is in `.github/workflows/` directory
   - Ensure the `OPENAI_API_KEY` secret is properly configured

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the MIT License.
