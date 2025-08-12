#!/usr/bin/env node
/**
 * CI/CD Integration Hook for Recursive Sprint Accountability
 * Integrates with GitHub Actions, pre-commit hooks, and MCP tools
 */

import { readFile, writeFile, access } from 'fs/promises';
import { join } from 'path';
import { execSync } from 'child_process';
import RecursiveSprintAccountabilityEngine from '../oversight/recursive-sprint-accountability-engine.js';

export class CICDIntegrationHook {
  constructor() {
    this.engine = null;
    this.integrationPoints = {
      preCommit: false,
      prValidation: false,
      deploymentGate: false,
      mcpToolValidation: false
    };
  }

  async initialize() {
    console.log('🔗 Initializing CI/CD Integration Hook...');
    
    try {
      // Load configuration
      const configPath = join(process.cwd(), '.claude', 'oversight', 'recursive-config.json');
      const config = JSON.parse(await readFile(configPath, 'utf8'));
      
      this.engine = new RecursiveSprintAccountabilityEngine(config);
      await this.engine.initialize();
      
      // Detect existing CI/CD infrastructure
      await this.detectCICDInfrastructure();
      
      console.log('✅ CI/CD Integration Hook initialized');
    } catch (error) {
      console.error('❌ CI/CD Integration initialization failed:', error.message);
      throw error;
    }
  }

  async detectCICDInfrastructure() {
    console.log('🔍 Detecting CI/CD infrastructure...');
    
    // Check for GitHub Actions
    try {
      await access(join(process.cwd(), '.github', 'workflows'));
      console.log('   ✅ GitHub Actions detected');
      this.integrationPoints.prValidation = true;
    } catch {
      console.log('   ⚪ GitHub Actions not found');
    }

    // Check for pre-commit hooks
    try {
      await access(join(process.cwd(), '.git', 'hooks', 'pre-commit'));
      console.log('   ✅ Pre-commit hooks detected');
      this.integrationPoints.preCommit = true;
    } catch {
      console.log('   ⚪ Pre-commit hooks not found');
    }

    // Check for MCP tools
    try {
      await access(join(process.cwd(), 'src', 'tools'));
      console.log('   ✅ MCP tools detected');
      this.integrationPoints.mcpToolValidation = true;
    } catch {
      console.log('   ⚪ MCP tools not found');
    }

    // Check for deployment configs
    const deploymentFiles = ['Dockerfile', 'docker-compose.yml', 'k8s', 'deployment'];
    for (const file of deploymentFiles) {
      try {
        await access(join(process.cwd(), file));
        console.log(`   ✅ Deployment configuration detected (${file})`);
        this.integrationPoints.deploymentGate = true;
        break;
      } catch {
        // Continue checking
      }
    }
  }

  async validateCommit(commitMessage, changedFiles) {
    console.log('\n🔍 Pre-commit validation starting...');
    
    const validation = {
      commitMessage: await this.validateCommitMessage(commitMessage),
      changedFiles: await this.validateChangedFiles(changedFiles),
      sprintAlignment: await this.validateSprintAlignment(commitMessage, changedFiles),
      timestamp: new Date().toISOString()
    };

    const overallValid = validation.commitMessage.valid && 
                        validation.changedFiles.valid && 
                        validation.sprintAlignment.valid;

    if (!overallValid) {
      console.log('🚫 Pre-commit validation failed:');
      if (!validation.commitMessage.valid) {
        console.log(`   ❌ Commit message: ${validation.commitMessage.reason}`);
      }
      if (!validation.changedFiles.valid) {
        console.log(`   ❌ Changed files: ${validation.changedFiles.reason}`);
      }
      if (!validation.sprintAlignment.valid) {
        console.log(`   ❌ Sprint alignment: ${validation.sprintAlignment.reason}`);
      }
      
      console.log('\n💡 Suggestions:');
      validation.commitMessage.suggestions?.forEach(s => console.log(`   • ${s}`));
      validation.changedFiles.suggestions?.forEach(s => console.log(`   • ${s}`));
      validation.sprintAlignment.suggestions?.forEach(s => console.log(`   • ${s}`));
    } else {
      console.log('✅ Pre-commit validation passed');
    }

    // Log validation result
    await this.logValidationResult('pre-commit', validation);

    return { valid: overallValid, validation };
  }

  async validateCommitMessage(commitMessage) {
    const validation = {
      valid: true,
      reasons: [],
      suggestions: []
    };

    // Check message length
    if (commitMessage.length < 10) {
      validation.valid = false;
      validation.reasons.push('Commit message too short (minimum 10 characters)');
      validation.suggestions.push('Provide a more descriptive commit message');
    }

    // Check for sprint reference
    const sprintPattern = /(?:sprint|task|feature|fix|docs)[\s\-_]?\d+/i;
    if (!sprintPattern.test(commitMessage)) {
      validation.valid = false;
      validation.reasons.push('No sprint/task reference found');
      validation.suggestions.push('Include sprint or task reference (e.g., "feat-123" or "sprint-5")');
    }

    // Check for conventional commit format
    const conventionalPattern = /^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?: .+/;
    if (!conventionalPattern.test(commitMessage)) {
      validation.suggestions.push('Consider using conventional commit format (feat:, fix:, docs:, etc.)');
    }

    return {
      valid: validation.valid,
      reason: validation.reasons.join(', '),
      suggestions: validation.suggestions
    };
  }

  async validateChangedFiles(changedFiles) {
    const validation = {
      valid: true,
      reasons: [],
      suggestions: []
    };

    // Check for critical files without tests
    const criticalPatterns = [
      /src\/.*\.js$/,
      /src\/.*\.ts$/,
      /lib\/.*\.js$/,
      /lib\/.*\.ts$/
    ];

    const testPatterns = [
      /test.*\.js$/,
      /test.*\.ts$/,
      /.*\.test\.js$/,
      /.*\.test\.ts$/,
      /.*\.spec\.js$/,
      /.*\.spec\.ts$/
    ];

    const criticalFiles = changedFiles.filter(file => 
      criticalPatterns.some(pattern => pattern.test(file))
    );

    const testFiles = changedFiles.filter(file =>
      testPatterns.some(pattern => pattern.test(file))
    );

    if (criticalFiles.length > 0 && testFiles.length === 0) {
      validation.suggestions.push('Consider adding tests for changed source files');
    }

    // Check for documentation updates
    const docPatterns = [/README\.md$/, /docs\/.*\.md$/, /.*\.md$/];
    const docFiles = changedFiles.filter(file =>
      docPatterns.some(pattern => pattern.test(file))
    );

    if (criticalFiles.length > 3 && docFiles.length === 0) {
      validation.suggestions.push('Consider updating documentation for significant changes');
    }

    // Check for too many files in single commit
    if (changedFiles.length > 20) {
      validation.valid = false;
      validation.reasons.push(`Too many files changed (${changedFiles.length} > 20)`);
      validation.suggestions.push('Break large changes into smaller, focused commits');
    }

    return {
      valid: validation.valid,
      reason: validation.reasons.join(', '),
      suggestions: validation.suggestions
    };
  }

  async validateSprintAlignment(commitMessage, changedFiles) {
    try {
      // Load current sprint context
      const sprintContext = await this.loadCurrentSprintContext();
      
      if (!sprintContext) {
        return {
          valid: true,
          reason: 'No active sprint context found',
          suggestions: ['Set up sprint context in .claude/oversight/current-sprint.json']
        };
      }

      // Create task data from commit
      const taskData = {
        id: `commit_${Date.now()}`,
        type: this.inferTaskType(commitMessage, changedFiles),
        description: commitMessage,
        complexity: this.estimateComplexity(changedFiles),
        changedFiles: changedFiles.length
      };

      // Validate against sprint context
      const result = await this.engine.processAgentTask('commit-validation', taskData, sprintContext);
      
      return {
        valid: result.finalResult.status === 'approved',
        reason: result.finalResult.status === 'blocked' ? 
          `Sprint alignment score: ${(result.phases.verification.score * 100).toFixed(1)}%` : 
          'Aligned with sprint goals',
        suggestions: result.finalResult.status === 'blocked' ? 
          result.improvements?.guidance || [] : []
      };

    } catch (error) {
      console.warn('⚠️  Sprint alignment validation failed:', error.message);
      return {
        valid: true,
        reason: 'Sprint validation unavailable',
        suggestions: []
      };
    }
  }

  async validatePullRequest(prData) {
    console.log('\n🔍 Pull Request validation starting...');
    
    const validation = {
      title: await this.validatePRTitle(prData.title),
      description: await this.validatePRDescription(prData.body),
      changes: await this.validatePRChanges(prData.files),
      sprintCompliance: await this.validatePRSprintCompliance(prData),
      timestamp: new Date().toISOString()
    };

    const overallValid = validation.title.valid && 
                        validation.description.valid && 
                        validation.changes.valid && 
                        validation.sprintCompliance.valid;

    // Generate PR review comment
    const reviewComment = this.generatePRReviewComment(validation);

    // Log validation result
    await this.logValidationResult('pull-request', validation);

    return { 
      valid: overallValid, 
      validation, 
      reviewComment 
    };
  }

  async validatePRTitle(title) {
    const validation = {
      valid: true,
      reasons: [],
      suggestions: []
    };

    if (!title || title.length < 10) {
      validation.valid = false;
      validation.reasons.push('PR title too short');
      validation.suggestions.push('Provide a descriptive title (minimum 10 characters)');
    }

    // Check for sprint reference
    const sprintPattern = /(?:sprint|task|feature|fix|docs)[\s\-_]?\d+/i;
    if (!sprintPattern.test(title)) {
      validation.suggestions.push('Include sprint or task reference in title');
    }

    return {
      valid: validation.valid,
      reason: validation.reasons.join(', '),
      suggestions: validation.suggestions
    };
  }

  async validatePRDescription(description) {
    const validation = {
      valid: true,
      reasons: [],
      suggestions: []
    };

    if (!description || description.length < 50) {
      validation.valid = false;
      validation.reasons.push('PR description too short');
      validation.suggestions.push('Provide detailed description (minimum 50 characters)');
    }

    // Check for required sections
    const requiredSections = ['## Summary', '## Changes', '## Testing'];
    const missingSections = requiredSections.filter(section => 
      !description.includes(section)
    );

    if (missingSections.length > 0) {
      validation.suggestions.push(`Consider adding sections: ${missingSections.join(', ')}`);
    }

    return {
      valid: validation.valid,
      reason: validation.reasons.join(', '),
      suggestions: validation.suggestions
    };
  }

  async validatePRChanges(files) {
    const validation = {
      valid: true,
      reasons: [],
      suggestions: []
    };

    if (files.length > 50) {
      validation.valid = false;
      validation.reasons.push(`Too many files changed (${files.length})`);
      validation.suggestions.push('Consider breaking into smaller PRs');
    }

    // Analyze change patterns
    const additions = files.reduce((sum, file) => sum + (file.additions || 0), 0);
    const deletions = files.reduce((sum, file) => sum + (file.deletions || 0), 0);

    if (additions > 1000) {
      validation.suggestions.push('Large number of additions - ensure adequate testing');
    }

    if (deletions > 500) {
      validation.suggestions.push('Significant deletions - verify no breaking changes');
    }

    return {
      valid: validation.valid,
      reason: validation.reasons.join(', '),
      suggestions: validation.suggestions
    };
  }

  async validatePRSprintCompliance(prData) {
    try {
      const sprintContext = await this.loadCurrentSprintContext();
      
      if (!sprintContext) {
        return {
          valid: true,
          reason: 'No sprint context available',
          suggestions: []
        };
      }

      const taskData = {
        id: `pr_${prData.number}`,
        type: this.inferTaskType(prData.title, prData.files.map(f => f.filename)),
        description: `${prData.title}\n\n${prData.body}`,
        complexity: this.estimateComplexity(prData.files.map(f => f.filename)),
        filesChanged: prData.files.length,
        additions: prData.files.reduce((sum, f) => sum + f.additions, 0),
        deletions: prData.files.reduce((sum, f) => sum + f.deletions, 0)
      };

      const result = await this.engine.processAgentTask(
        prData.user.login, 
        taskData, 
        sprintContext
      );

      return {
        valid: result.finalResult.status === 'approved',
        reason: result.finalResult.status === 'blocked' ? 
          `Sprint compliance: ${(result.phases.verification.score * 100).toFixed(1)}%` : 
          'Compliant with sprint goals',
        suggestions: result.finalResult.status === 'blocked' ? 
          result.improvements?.guidance || [] : [],
        result: result
      };

    } catch (error) {
      console.warn('⚠️  PR sprint compliance validation failed:', error.message);
      return {
        valid: true,
        reason: 'Sprint validation unavailable',
        suggestions: []
      };
    }
  }

  generatePRReviewComment(validation) {
    const sections = [];

    sections.push('## 🤖 Recursive Sprint Accountability Review\n');

    if (validation.title.valid && validation.description.valid && 
        validation.changes.valid && validation.sprintCompliance.valid) {
      sections.push('✅ **Overall Status: APPROVED**\n');
      sections.push('This PR meets all accountability standards and is approved for merge.\n');
    } else {
      sections.push('⚠️ **Overall Status: NEEDS ATTENTION**\n');
      sections.push('This PR has areas that need improvement before merge.\n');
    }

    // Title validation
    sections.push('### 📝 Title Validation');
    sections.push(validation.title.valid ? '✅ **PASSED**' : '❌ **FAILED**');
    if (!validation.title.valid) {
      sections.push(`- ${validation.title.reason}`);
    }
    validation.title.suggestions.forEach(s => sections.push(`- 💡 ${s}`));
    sections.push('');

    // Description validation
    sections.push('### 📋 Description Validation');
    sections.push(validation.description.valid ? '✅ **PASSED**' : '❌ **FAILED**');
    if (!validation.description.valid) {
      sections.push(`- ${validation.description.reason}`);
    }
    validation.description.suggestions.forEach(s => sections.push(`- 💡 ${s}`));
    sections.push('');

    // Changes validation
    sections.push('### 🔄 Changes Validation');
    sections.push(validation.changes.valid ? '✅ **PASSED**' : '❌ **FAILED**');
    if (!validation.changes.valid) {
      sections.push(`- ${validation.changes.reason}`);
    }
    validation.changes.suggestions.forEach(s => sections.push(`- 💡 ${s}`));
    sections.push('');

    // Sprint compliance
    sections.push('### 🎯 Sprint Compliance');
    sections.push(validation.sprintCompliance.valid ? '✅ **PASSED**' : '❌ **FAILED**');
    if (!validation.sprintCompliance.valid) {
      sections.push(`- ${validation.sprintCompliance.reason}`);
    }
    validation.sprintCompliance.suggestions.forEach(s => sections.push(`- 💡 ${s}`));
    sections.push('');

    sections.push('---');
    sections.push('*This review was generated by the Recursive Sprint Accountability System*');

    return sections.join('\n');
  }

  inferTaskType(message, files) {
    const messageL = message.toLowerCase();
    
    if (messageL.includes('test') || files.some(f => f.includes('test'))) return 'testing';
    if (messageL.includes('doc') || files.some(f => f.includes('doc') || f.endsWith('.md'))) return 'documentation';
    if (messageL.includes('fix') || messageL.includes('bug')) return 'debugging';
    if (messageL.includes('feat') || messageL.includes('add')) return 'implementation';
    if (messageL.includes('refactor') || messageL.includes('clean')) return 'refactoring';
    
    return 'implementation';
  }

  estimateComplexity(files) {
    const complexity = Math.min(files.length / 20, 1); // Normalize to 0-1
    return Math.max(0.1, complexity);
  }

  async loadCurrentSprintContext() {
    try {
      const sprintFile = join(process.cwd(), '.claude', 'oversight', 'current-sprint.json');
      return JSON.parse(await readFile(sprintFile, 'utf8'));
    } catch {
      return null;
    }
  }

  async logValidationResult(type, validation) {
    try {
      const logDir = join(process.cwd(), '.claude', 'oversight', 'validation-logs');
      const logFile = join(logDir, `${type}-${new Date().toISOString().split('T')[0]}.json`);
      
      let logs = [];
      try {
        logs = JSON.parse(await readFile(logFile, 'utf8'));
      } catch {
        // File doesn't exist, start fresh
      }

      logs.push({
        timestamp: new Date().toISOString(),
        type: type,
        validation: validation
      });

      // Keep only last 100 entries
      if (logs.length > 100) {
        logs = logs.slice(-100);
      }

      await writeFile(logFile, JSON.stringify(logs, null, 2));
    } catch (error) {
      console.warn('⚠️  Could not log validation result:', error.message);
    }
  }

  async installGitHook() {
    console.log('🔧 Installing Git pre-commit hook...');
    
    const hookScript = `#!/bin/bash
# Recursive Sprint Accountability Pre-commit Hook

# Get staged files
STAGED_FILES=$(git diff --cached --name-only)

# Get commit message (if available)
COMMIT_MSG=""
if [ -f .git/COMMIT_EDITMSG ]; then
    COMMIT_MSG=$(cat .git/COMMIT_EDITMSG)
fi

# Run validation
node src/oversight/cicd-integration-hook.js validate-commit --files "$STAGED_FILES" --message "$COMMIT_MSG"

exit $?
`;

    try {
      const hookPath = join(process.cwd(), '.git', 'hooks', 'pre-commit');
      await writeFile(hookPath, hookScript);
      execSync(`chmod +x "${hookPath}"`);
      console.log('✅ Git pre-commit hook installed');
    } catch (error) {
      console.error('❌ Failed to install Git hook:', error.message);
    }
  }

  async generateGitHubAction() {
    console.log('🔧 Generating GitHub Action workflow...');
    
    const workflow = `name: Recursive Sprint Accountability

on:
  pull_request:
    types: [opened, synchronize, reopened]
  push:
    branches: [main, master, develop]

jobs:
  accountability-check:
    name: Sprint Accountability Validation
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Initialize Accountability System
        run: |
          node src/cli/recursive-accountability.js init --mode moderate
          
      - name: Validate Pull Request
        if: github.event_name == 'pull_request'
        run: |
          node src/oversight/cicd-integration-hook.js validate-pr \\
            --pr-number \${{ github.event.number }} \\
            --pr-title "\${{ github.event.pull_request.title }}" \\
            --pr-body "\${{ github.event.pull_request.body }}"
            
      - name: Validate Commit
        if: github.event_name == 'push'
        run: |
          CHANGED_FILES=\$(git diff --name-only HEAD^ HEAD)
          COMMIT_MSG="\$(git log -1 --pretty=%B)"
          node src/oversight/cicd-integration-hook.js validate-commit \\
            --files "\$CHANGED_FILES" \\
            --message "\$COMMIT_MSG"
            
      - name: Upload Validation Results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: accountability-validation-results
          path: .claude/oversight/validation-logs/
`;

    try {
      const workflowDir = join(process.cwd(), '.github', 'workflows');
      await mkdir(workflowDir, { recursive: true });
      
      const workflowPath = join(workflowDir, 'recursive-sprint-accountability.yml');
      await writeFile(workflowPath, workflow);
      
      console.log('✅ GitHub Action workflow generated');
      console.log(`   Workflow saved to: .github/workflows/recursive-sprint-accountability.yml`);
    } catch (error) {
      console.error('❌ Failed to generate GitHub Action:', error.message);
    }
  }

  async shutdown() {
    if (this.engine) {
      await this.engine.shutdown();
    }
  }
}

// CLI interface for direct usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const hook = new CICDIntegrationHook();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'validate-commit':
      await hook.initialize();
      // Extract files and message from args
      const filesArg = process.argv.find(arg => arg.startsWith('--files'));
      const messageArg = process.argv.find(arg => arg.startsWith('--message'));
      
      const files = filesArg ? filesArg.split('=')[1].split(' ').filter(f => f) : [];
      const message = messageArg ? messageArg.split('=')[1] : '';
      
      const commitResult = await hook.validateCommit(message, files);
      await hook.shutdown();
      
      process.exit(commitResult.valid ? 0 : 1);
      break;
      
    case 'install-hook':
      await hook.installGitHook();
      break;
      
    case 'generate-action':
      await hook.generateGitHubAction();
      break;
      
    default:
      console.log('Usage: cicd-integration-hook.js [validate-commit|install-hook|generate-action]');
      process.exit(1);
  }
}

export default CICDIntegrationHook;
