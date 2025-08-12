#!/usr/bin/env node

/**
 * Pre-Task Validation Hook
 * 
 * This script implements the mandatory pre-task validation gate that ensures
 * every agent validates their understanding of sprint context and task alignment
 * before executing any work.
 * 
 * Usage:
 *   node src/oversight/pre-task-validation-hook.js validate <task-description>
 *   node src/oversight/pre-task-validation-hook.js --agent-id=<id> --task="<description>"
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Import our accountability and validation systems
const SprintContextValidator = require('./sprint-context-validator.js');
const AgentAccountabilityAuditor = require('./agent-accountability-auditor.js');

class PreTaskValidationHook {
  constructor(options = {}) {
    this.agentId = options.agentId || this.generateAgentId();
    this.workspaceRoot = options.workspaceRoot || process.cwd();
    this.validationConfig = {
      sprintAlignment: {
        minimumScore: 0.7,
        blockingThreshold: 0.5,
        warningThreshold: 0.6
      },
      agentAccountability: {
        minimumScore: 0.6,
        oversightThreshold: 0.75,
        blockingThreshold: 0.3
      },
      taskComplexity: {
        maxComplexityWithoutOversight: 0.8,
        requiresSpecialistThreshold: 0.9
      },
      historicalPerformance: {
        minimumSuccessRate: 0.7,
        recentTasksToAnalyze: 10
      }
    };
    
    this.sprintValidator = new SprintContextValidator();
    this.accountabilityAuditor = new AgentAccountabilityAuditor();
    
    this.initializeValidationSystem();
  }

  generateAgentId() {
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(4).toString('hex');
    return `agent_${timestamp}_${randomBytes}`;
  }

  async initializeValidationSystem() {
    try {
      // Ensure validation directories exist
      const dirs = [
        path.join(this.workspaceRoot, '.claude', 'validation', 'sessions'),
        path.join(this.workspaceRoot, '.claude', 'validation', 'audit-logs'),
        path.join(this.workspaceRoot, '.claude', 'validation', 'metrics')
      ];
      
      for (const dir of dirs) {
        await fs.mkdir(dir, { recursive: true });
      }
      
      // Initialize validation session
      this.sessionId = `session_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      this.sessionPath = path.join(this.workspaceRoot, '.claude', 'validation', 'sessions', `${this.sessionId}.json`);
      
    } catch (error) {
      console.warn('⚠️  Warning: Could not initialize validation system:', error.message);
    }
  }

  /**
   * Main validation entry point
   * @param {string} taskDescription - Description of the task to validate
   * @param {Object} options - Additional validation options
   * @returns {Promise<Object>} Validation result
   */
  async validateTask(taskDescription, options = {}) {
    const validationStart = Date.now();
    
    console.log(`🔍 Starting pre-task validation for agent ${this.agentId}`);
    console.log(`📋 Task: ${taskDescription}`);
    
    try {
      // Phase 1: Sprint Context Check
      console.log('📝 Phase 1: Sprint Context Validation...');
      const sprintValidation = await this.validateSprintContext(taskDescription);
      
      // Phase 2: Agent Accountability Audit
      console.log('🔎 Phase 2: Agent Accountability Audit...');
      const accountabilityAudit = await this.auditAgentAccountability(taskDescription);
      
      // Phase 3: Task Complexity Assessment
      console.log('⚖️  Phase 3: Task Complexity Assessment...');
      const complexityAssessment = await this.assessTaskComplexity(taskDescription);
      
      // Phase 4: Generate Final Validation Result
      console.log('✅ Phase 4: Generating Validation Result...');
      const validationResult = await this.generateValidationResult({
        sprintValidation,
        accountabilityAudit,
        complexityAssessment,
        taskDescription,
        validationDuration: Date.now() - validationStart
      });
      
      // Log validation session
      await this.logValidationSession(validationResult);
      
      // Handle validation result
      await this.handleValidationResult(validationResult);
      
      return validationResult;
      
    } catch (error) {
      console.error('❌ Pre-task validation failed:', error.message);
      await this.handleValidationError(error, taskDescription);
      throw error;
    }
  }

  /**
   * Validate sprint context awareness
   */
  async validateSprintContext(taskDescription) {
    try {
      // Use our sprint context validator
      const validation = await this.sprintValidator.validateAgentSprintAwareness({
        agentId: this.agentId,
        taskDescription,
        currentSprintId: 'current'
      });
      
      return {
        passed: validation.overallCompliance >= this.validationConfig.sprintAlignment.minimumScore,
        complianceScore: validation.overallCompliance,
        sprintGoalAlignment: validation.sprintGoalAlignment,
        constraintCompliance: validation.constraintCompliance,
        issues: validation.issues || [],
        recommendations: validation.recommendations || [],
        contextFreshness: validation.contextFreshness || 0.8
      };
      
    } catch (error) {
      console.warn('⚠️  Sprint context validation error:', error.message);
      return {
        passed: false,
        complianceScore: 0,
        sprintGoalAlignment: 0,
        constraintCompliance: 0,
        issues: [`Sprint validation error: ${error.message}`],
        recommendations: ['Manually verify sprint context awareness'],
        contextFreshness: 0
      };
    }
  }

  /**
   * Audit agent accountability
   */
  async auditAgentAccountability(taskDescription) {
    try {
      // Use our agent accountability auditor
      const audit = await this.accountabilityAuditor.auditAgent({
        agentId: this.agentId,
        currentTask: {
          description: taskDescription,
          type: this.inferTaskType(taskDescription),
          complexity: await this.estimateTaskComplexity(taskDescription)
        }
      });
      
      return {
        overallScore: audit.overallScore,
        requiresOversight: audit.overallScore < this.validationConfig.agentAccountability.oversightThreshold,
        performanceMetrics: audit.performanceMetrics,
        recommendations: audit.recommendations || [],
        riskFactors: audit.riskFactors || [],
        historicalContext: audit.historicalContext || {}
      };
      
    } catch (error) {
      console.warn('⚠️  Agent accountability audit error:', error.message);
      return {
        overallScore: 0.5, // Default neutral score
        requiresOversight: true,
        performanceMetrics: {},
        recommendations: ['Manual accountability review required'],
        riskFactors: [`Audit error: ${error.message}`],
        historicalContext: {}
      };
    }
  }

  /**
   * Assess task complexity
   */
  async assessTaskComplexity(taskDescription) {
    const complexityFactors = {
      // Keyword-based complexity indicators
      keywordComplexity: this.calculateKeywordComplexity(taskDescription),
      
      // Length-based complexity
      lengthComplexity: Math.min(taskDescription.length / 500, 1),
      
      // Technical domain complexity
      domainComplexity: this.calculateDomainComplexity(taskDescription),
      
      // Interdependency complexity
      interdependencyComplexity: this.calculateInterdependencyComplexity(taskDescription)
    };
    
    // Calculate overall complexity score (0-1)
    const overallComplexity = (
      complexityFactors.keywordComplexity * 0.3 +
      complexityFactors.lengthComplexity * 0.2 +
      complexityFactors.domainComplexity * 0.3 +
      complexityFactors.interdependencyComplexity * 0.2
    );
    
    return {
      complexity: overallComplexity,
      factors: complexityFactors,
      requiresSpecialist: overallComplexity > this.validationConfig.taskComplexity.requiresSpecialistThreshold,
      requiresOversight: overallComplexity > this.validationConfig.taskComplexity.maxComplexityWithoutOversight,
      estimatedEffort: this.estimateEffortFromComplexity(overallComplexity),
      recommendedApproach: this.recommendApproachFromComplexity(overallComplexity)
    };
  }

  calculateKeywordComplexity(taskDescription) {
    const complexKeywords = [
      'architecture', 'system', 'integration', 'security', 'performance',
      'scalability', 'migration', 'refactor', 'optimization', 'algorithm',
      'distributed', 'concurrent', 'async', 'database', 'api', 'infrastructure'
    ];
    
    const keywords = taskDescription.toLowerCase().split(/\s+/);
    const complexMatches = keywords.filter(word => 
      complexKeywords.some(complex => word.includes(complex))
    );
    
    return Math.min(complexMatches.length / 3, 1);
  }

  calculateDomainComplexity(taskDescription) {
    const domainPatterns = {
      'machine-learning': /\b(ml|ai|neural|model|training|algorithm|prediction)\b/gi,
      'security': /\b(auth|security|encryption|oauth|jwt|certificate|vulnerability)\b/gi,
      'database': /\b(sql|database|query|migration|schema|index|transaction)\b/gi,
      'infrastructure': /\b(deploy|docker|kubernetes|aws|cloud|server|infrastructure)\b/gi,
      'frontend': /\b(ui|ux|component|react|vue|angular|css|html|dom)\b/gi,
      'backend': /\b(api|server|microservice|endpoint|middleware|service)\b/gi
    };
    
    let domainCount = 0;
    for (const [domain, pattern] of Object.entries(domainPatterns)) {
      if (pattern.test(taskDescription)) {
        domainCount++;
      }
    }
    
    return Math.min(domainCount / 3, 1);
  }

  calculateInterdependencyComplexity(taskDescription) {
    const interdependencyKeywords = [
      'integrate', 'connect', 'synchronize', 'coordinate', 'collaborate',
      'dependency', 'relationship', 'interaction', 'communication', 'workflow'
    ];
    
    const matches = interdependencyKeywords.filter(keyword =>
      taskDescription.toLowerCase().includes(keyword)
    );
    
    return Math.min(matches.length / 3, 1);
  }

  estimateEffortFromComplexity(complexity) {
    if (complexity < 0.3) return 'low (1-2 hours)';
    if (complexity < 0.6) return 'medium (0.5-1 day)';
    if (complexity < 0.8) return 'high (1-3 days)';
    return 'very high (3+ days)';
  }

  recommendApproachFromComplexity(complexity) {
    if (complexity < 0.3) return 'autonomous execution';
    if (complexity < 0.6) return 'autonomous with periodic check-ins';
    if (complexity < 0.8) return 'collaborative execution with oversight';
    return 'specialist-led execution with team support';
  }

  inferTaskType(taskDescription) {
    const typePatterns = {
      'implementation': /\b(implement|create|build|develop|code|write)\b/gi,
      'debugging': /\b(debug|fix|resolve|troubleshoot|error|bug)\b/gi,
      'refactoring': /\b(refactor|improve|optimize|restructure|cleanup)\b/gi,
      'documentation': /\b(document|write|explain|describe|spec|guide)\b/gi,
      'testing': /\b(test|verify|validate|check|ensure|confirm)\b/gi,
      'analysis': /\b(analyze|investigate|research|study|examine)\b/gi,
      'deployment': /\b(deploy|release|publish|launch|deliver)\b/gi
    };
    
    for (const [type, pattern] of Object.entries(typePatterns)) {
      if (pattern.test(taskDescription)) {
        return type;
      }
    }
    
    return 'general';
  }

  async estimateTaskComplexity(taskDescription) {
    // Simple complexity estimation based on description length and keywords
    const baseComplexity = Math.min(taskDescription.length / 200, 1);
    const keywordComplexity = this.calculateKeywordComplexity(taskDescription);
    return (baseComplexity + keywordComplexity) / 2;
  }

  /**
   * Generate final validation result
   */
  async generateValidationResult(data) {
    const {
      sprintValidation,
      accountabilityAudit,
      complexityAssessment,
      taskDescription,
      validationDuration
    } = data;
    
    // Determine if task should be approved
    const approved = 
      sprintValidation.passed &&
      accountabilityAudit.overallScore >= this.validationConfig.agentAccountability.minimumScore;
    
    // Determine if oversight is required
    const requiresOversight =
      accountabilityAudit.requiresOversight ||
      complexityAssessment.requiresOversight ||
      sprintValidation.complianceScore < this.validationConfig.sprintAlignment.warningThreshold;
    
    // Compile all recommendations
    const recommendations = [
      ...sprintValidation.recommendations,
      ...accountabilityAudit.recommendations,
      ...(complexityAssessment.requiresSpecialist ? ['Consider involving specialist agents'] : [])
    ];
    
    // Identify blocking issues
    const blockingIssues = [];
    if (!sprintValidation.passed) {
      blockingIssues.push(`Sprint alignment too low (${sprintValidation.complianceScore.toFixed(2)})`);
    }
    if (accountabilityAudit.overallScore < this.validationConfig.agentAccountability.blockingThreshold) {
      blockingIssues.push(`Agent accountability score too low (${accountabilityAudit.overallScore.toFixed(2)})`);
    }
    
    return {
      approved,
      requiresOversight,
      blockingIssues,
      recommendations,
      agentId: this.agentId,
      taskDescription,
      validationTimestamp: new Date().toISOString(),
      validationDuration,
      conditions: {
        sprintAlignment: sprintValidation.complianceScore,
        accountabilityScore: accountabilityAudit.overallScore,
        taskComplexity: complexityAssessment.complexity,
        contextFreshness: sprintValidation.contextFreshness
      },
      metrics: {
        sprintValidation,
        accountabilityAudit,
        complexityAssessment
      }
    };
  }

  /**
   * Handle validation result
   */
  async handleValidationResult(result) {
    if (!result.approved) {
      console.log('\n❌ TASK BLOCKED - Validation Failed');
      console.log('🚫 Blocking Issues:');
      result.blockingIssues.forEach(issue => console.log(`   • ${issue}`));
      
      if (result.recommendations.length > 0) {
        console.log('\n💡 Recommendations:');
        result.recommendations.forEach(rec => console.log(`   • ${rec}`));
      }
      
      process.exit(1);
    }
    
    if (result.requiresOversight) {
      console.log('\n⚠️  OVERSIGHT REQUIRED');
      console.log('👀 This task requires oversight due to:');
      if (result.conditions.accountabilityScore < this.validationConfig.agentAccountability.oversightThreshold) {
        console.log(`   • Low accountability score (${result.conditions.accountabilityScore.toFixed(2)})`);
      }
      if (result.conditions.taskComplexity > this.validationConfig.taskComplexity.maxComplexityWithoutOversight) {
        console.log(`   • High task complexity (${result.conditions.taskComplexity.toFixed(2)})`);
      }
      if (result.conditions.sprintAlignment < this.validationConfig.sprintAlignment.warningThreshold) {
        console.log(`   • Low sprint alignment (${result.conditions.sprintAlignment.toFixed(2)})`);
      }
    }
    
    console.log('\n✅ VALIDATION PASSED - Task Approved');
    console.log('📊 Validation Summary:');
    console.log(`   • Sprint Alignment: ${(result.conditions.sprintAlignment * 100).toFixed(1)}%`);
    console.log(`   • Accountability Score: ${(result.conditions.accountabilityScore * 100).toFixed(1)}%`);
    console.log(`   • Task Complexity: ${(result.conditions.taskComplexity * 100).toFixed(1)}%`);
    console.log(`   • Context Freshness: ${(result.conditions.contextFreshness * 100).toFixed(1)}%`);
    
    if (result.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      result.recommendations.forEach(rec => console.log(`   • ${rec}`));
    }
  }

  /**
   * Log validation session for analysis and auditing
   */
  async logValidationSession(result) {
    try {
      const sessionData = {
        sessionId: this.sessionId,
        agentId: this.agentId,
        timestamp: new Date().toISOString(),
        validationResult: result,
        systemInfo: {
          nodeVersion: process.version,
          platform: process.platform,
          workspaceRoot: this.workspaceRoot
        }
      };
      
      await fs.writeFile(this.sessionPath, JSON.stringify(sessionData, null, 2));
      
      // Update metrics
      await this.updateValidationMetrics(result);
      
    } catch (error) {
      console.warn('⚠️  Warning: Could not log validation session:', error.message);
    }
  }

  /**
   * Update validation metrics
   */
  async updateValidationMetrics(result) {
    try {
      const metricsPath = path.join(this.workspaceRoot, '.claude', 'validation', 'metrics', 'validation-metrics.json');
      
      let metrics = {
        totalValidations: 0,
        approvedValidations: 0,
        blockedValidations: 0,
        oversightRequired: 0,
        averageScores: {
          sprintAlignment: 0,
          accountabilityScore: 0,
          taskComplexity: 0
        },
        commonIssues: {},
        lastUpdated: new Date().toISOString()
      };
      
      try {
        const existingMetrics = await fs.readFile(metricsPath, 'utf8');
        metrics = { ...metrics, ...JSON.parse(existingMetrics) };
      } catch (error) {
        // File doesn't exist yet, use defaults
      }
      
      // Update metrics
      metrics.totalValidations++;
      if (result.approved) metrics.approvedValidations++;
      else metrics.blockedValidations++;
      if (result.requiresOversight) metrics.oversightRequired++;
      
      // Update average scores
      const total = metrics.totalValidations;
      metrics.averageScores.sprintAlignment = 
        ((metrics.averageScores.sprintAlignment * (total - 1)) + result.conditions.sprintAlignment) / total;
      metrics.averageScores.accountabilityScore = 
        ((metrics.averageScores.accountabilityScore * (total - 1)) + result.conditions.accountabilityScore) / total;
      metrics.averageScores.taskComplexity = 
        ((metrics.averageScores.taskComplexity * (total - 1)) + result.conditions.taskComplexity) / total;
      
      // Track common issues
      result.blockingIssues.forEach(issue => {
        metrics.commonIssues[issue] = (metrics.commonIssues[issue] || 0) + 1;
      });
      
      metrics.lastUpdated = new Date().toISOString();
      
      await fs.writeFile(metricsPath, JSON.stringify(metrics, null, 2));
      
    } catch (error) {
      console.warn('⚠️  Warning: Could not update validation metrics:', error.message);
    }
  }

  /**
   * Handle validation errors
   */
  async handleValidationError(error, taskDescription) {
    console.error('💥 Validation system error:', error.message);
    console.log('🔄 Attempting graceful degradation...');
    
    // Try basic validation without advanced features
    const basicValidation = {
      approved: true, // Allow execution with warnings
      requiresOversight: true, // Require oversight due to validation failure
      blockingIssues: [`Validation system error: ${error.message}`],
      recommendations: [
        'Manual validation required due to system error',
        'Proceed with caution and oversight',
        'Report validation system issue to team'
      ],
      conditions: {
        sprintAlignment: 0.5, // Neutral score
        accountabilityScore: 0.5,
        taskComplexity: 0.8, // Assume high complexity for safety
        contextFreshness: 0.3
      }
    };
    
    console.log('\n⚠️  DEGRADED VALIDATION MODE');
    console.log('⚠️  Task approved with mandatory oversight due to validation system error');
    console.log('⚠️  Manual validation required');
    
    await this.logValidationSession(basicValidation);
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help') {
    console.log(`
Pre-Task Validation Hook

Usage:
  node pre-task-validation-hook.js validate <task-description>
  node pre-task-validation-hook.js --agent-id=<id> --task="<description>"

Examples:
  node pre-task-validation-hook.js validate "Implement user authentication system"
  node pre-task-validation-hook.js --agent-id=agent_123 --task="Refactor database queries for performance"

Options:
  --agent-id=<id>     Specify agent ID (generated if not provided)
  --task="<desc>"     Task description to validate
  --help              Show this help message
`);
    process.exit(0);
  }
  
  let agentId = null;
  let taskDescription = null;
  
  // Parse arguments
  if (args[0] === 'validate' && args[1]) {
    taskDescription = args[1];
  } else {
    for (const arg of args) {
      if (arg.startsWith('--agent-id=')) {
        agentId = arg.split('=')[1];
      } else if (arg.startsWith('--task=')) {
        taskDescription = arg.split('=')[1];
      }
    }
  }
  
  if (!taskDescription) {
    console.error('❌ Error: Task description is required');
    process.exit(1);
  }
  
  try {
    const validator = new PreTaskValidationHook({ agentId });
    await validator.validateTask(taskDescription);
    
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    process.exit(1);
  }
}

// Export for use as module
module.exports = PreTaskValidationHook;

// Run as CLI if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  });
}
