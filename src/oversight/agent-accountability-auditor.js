#!/usr/bin/env node
/**
 * Agent Accountability Auditor
 * Continuously monitors agent performance and compliance with sprint objectives
 */

import { readFile, writeFile, access, mkdir } from 'fs/promises';
import { join } from 'path';
import { execSync } from 'child_process';

export class AgentAccountabilityAuditor {
  constructor() {
    this.auditDir = join(process.cwd(), '.claude', 'audit');
    this.sprintDir = join(process.cwd(), '.claude', 'sprint');
    this.memoryNamespace = 'agent-accountability';
  }

  async initialize() {
    await mkdir(this.auditDir, { recursive: true });
    await this.initializeAuditDatabase();
  }

  async initializeAuditDatabase() {
    const auditSchema = {
      agents: [],
      tasks: [],
      violations: [],
      metrics: {
        lastUpdated: new Date().toISOString(),
        totalTasks: 0,
        complianceRate: 0,
        averageAccountabilityScore: 0
      }
    };

    const auditFile = join(this.auditDir, 'accountability-database.json');
    
    try {
      await access(auditFile);
    } catch {
      await writeFile(auditFile, JSON.stringify(auditSchema, null, 2));
    }
  }

  async auditAgent(agentId, taskDetails) {
    await this.initialize();

    const audit = {
      agentId,
      taskId: taskDetails.id || `task-${Date.now()}`,
      timestamp: new Date().toISOString(),
      taskDetails,
      accountabilityChecks: {},
      overallScore: 0,
      complianceLevel: 'unknown',
      violations: [],
      recommendations: [],
      requiresOversight: false
    };

    try {
      // 1. Sprint Context Awareness Check
      audit.accountabilityChecks.sprintContextAwareness = await this.checkSprintContextAwareness(agentId);
      
      // 2. Task-Sprint Alignment Check
      audit.accountabilityChecks.taskAlignment = await this.checkTaskAlignment(taskDetails);
      
      // 3. Historical Performance Check
      audit.accountabilityChecks.historicalPerformance = await this.checkHistoricalPerformance(agentId);
      
      // 4. Quality Standards Compliance
      audit.accountabilityChecks.qualityCompliance = await this.checkQualityCompliance(agentId, taskDetails);
      
      // 5. Documentation and Communication
      audit.accountabilityChecks.documentation = await this.checkDocumentationCompliance(agentId, taskDetails);

      // Calculate overall accountability score
      audit.overallScore = this.calculateAccountabilityScore(audit.accountabilityChecks);
      audit.complianceLevel = this.determineComplianceLevel(audit.overallScore);
      audit.requiresOversight = audit.overallScore < 0.75;

      // Generate violations and recommendations
      audit.violations = this.identifyViolations(audit.accountabilityChecks);
      audit.recommendations = this.generateRecommendations(audit.accountabilityChecks, audit.overallScore);

      // Store audit result
      await this.storeAuditResult(audit);

      // Trigger alerts if necessary
      if (audit.requiresOversight) {
        await this.triggerOversightAlert(audit);
      }

      return audit;

    } catch (error) {
      audit.error = error.message;
      audit.overallScore = 0;
      audit.complianceLevel = 'error';
      audit.requiresOversight = true;
      return audit;
    }
  }

  async checkSprintContextAwareness(agentId) {
    try {
      // Check if agent has recently accessed sprint documentation
      const sprintAccessLog = await this.getSprintAccessLog(agentId);
      const lastAccess = sprintAccessLog ? new Date(sprintAccessLog.timestamp) : null;
      const hoursSinceAccess = lastAccess ? (Date.now() - lastAccess.getTime()) / (1000 * 60 * 60) : Infinity;
      
      // Check if agent has acknowledged current sprint context
      const contextAcknowledgment = await this.getContextAcknowledgment(agentId);
      
      // Score based on recency of access and acknowledgment
      let score = 0;
      const issues = [];
      
      if (hoursSinceAccess < 24) {
        score += 0.4;
      } else {
        issues.push('No recent access to sprint documentation');
      }
      
      if (contextAcknowledgment && contextAcknowledgment.acknowledged) {
        score += 0.4;
      } else {
        issues.push('Sprint context not acknowledged');
      }
      
      if (contextAcknowledgment && contextAcknowledgment.sprintGoalsUnderstood) {
        score += 0.2;
      } else {
        issues.push('Sprint goals understanding not confirmed');
      }

      return {
        score,
        passed: score >= 0.7,
        issues,
        details: {
          lastSprintAccess: lastAccess?.toISOString(),
          hoursSinceAccess: Math.round(hoursSinceAccess),
          contextAcknowledged: contextAcknowledgment?.acknowledged || false
        }
      };

    } catch (error) {
      return {
        score: 0,
        passed: false,
        issues: [`Error checking sprint context awareness: ${error.message}`],
        details: {}
      };
    }
  }

  async checkTaskAlignment(taskDetails) {
    try {
      // Load current sprint goals and requirements
      const sprintContext = await this.loadSprintContext();
      
      // Analyze task alignment with sprint goals
      const goalAlignment = this.calculateGoalAlignment(taskDetails, sprintContext.goals);
      
      // Check requirement satisfaction
      const requirementAlignment = this.calculateRequirementAlignment(taskDetails, sprintContext.requirements);
      
      // Check constraint compliance
      const constraintCompliance = this.checkConstraintCompliance(taskDetails, sprintContext.constraints);
      
      const overallAlignment = (goalAlignment + requirementAlignment + constraintCompliance) / 3;
      
      const issues = [];
      if (goalAlignment < 0.6) issues.push('Low alignment with sprint goals');
      if (requirementAlignment < 0.6) issues.push('Poor requirement satisfaction');
      if (constraintCompliance < 0.8) issues.push('Constraint violations detected');

      return {
        score: overallAlignment,
        passed: overallAlignment >= 0.7,
        issues,
        details: {
          goalAlignment,
          requirementAlignment,
          constraintCompliance,
          alignedGoals: this.getAlignedGoals(taskDetails, sprintContext.goals)
        }
      };

    } catch (error) {
      return {
        score: 0,
        passed: false,
        issues: [`Error checking task alignment: ${error.message}`],
        details: {}
      };
    }
  }

  async checkHistoricalPerformance(agentId) {
    try {
      const performanceHistory = await this.getAgentPerformanceHistory(agentId);
      
      if (!performanceHistory || performanceHistory.length === 0) {
        return {
          score: 0.5, // Neutral score for new agents
          passed: true,
          issues: [],
          details: { status: 'new-agent', historyCount: 0 }
        };
      }

      // Calculate metrics from historical performance
      const recentTasks = performanceHistory.slice(-10); // Last 10 tasks
      const successRate = recentTasks.filter(task => task.status === 'completed').length / recentTasks.length;
      const averageQuality = recentTasks.reduce((sum, task) => sum + (task.qualityScore || 0.5), 0) / recentTasks.length;
      const onTimeDelivery = recentTasks.filter(task => task.onTime).length / recentTasks.length;
      
      const performanceScore = (successRate * 0.4 + averageQuality * 0.4 + onTimeDelivery * 0.2);
      
      const issues = [];
      if (successRate < 0.8) issues.push('Low task completion rate');
      if (averageQuality < 0.7) issues.push('Below-average quality scores');
      if (onTimeDelivery < 0.7) issues.push('Frequent delivery delays');

      return {
        score: performanceScore,
        passed: performanceScore >= 0.7,
        issues,
        details: {
          tasksAnalyzed: recentTasks.length,
          successRate: Math.round(successRate * 100),
          averageQuality: Math.round(averageQuality * 100),
          onTimeDelivery: Math.round(onTimeDelivery * 100)
        }
      };

    } catch (error) {
      return {
        score: 0.5,
        passed: true,
        issues: [`Could not assess historical performance: ${error.message}`],
        details: {}
      };
    }
  }

  async checkQualityCompliance(agentId, taskDetails) {
    const qualityChecks = {
      codeQuality: 0.5,
      testCoverage: 0.5,
      documentation: 0.5,
      securityCompliance: 0.5,
      performanceStandards: 0.5
    };

    const issues = [];

    try {
      // Check if agent follows coding standards
      if (taskDetails.type === 'implementation' || taskDetails.type === 'coding') {
        const codeQualityScore = await this.assessCodeQuality(agentId, taskDetails);
        qualityChecks.codeQuality = codeQualityScore;
        if (codeQualityScore < 0.7) issues.push('Code quality below standards');
      }

      // Check test coverage expectations
      if (taskDetails.requiresTesting) {
        const testCoverageScore = await this.assessTestCoverage(agentId, taskDetails);
        qualityChecks.testCoverage = testCoverageScore;
        if (testCoverageScore < 0.8) issues.push('Insufficient test coverage');
      }

      // Check documentation completeness
      const documentationScore = await this.assessDocumentation(agentId, taskDetails);
      qualityChecks.documentation = documentationScore;
      if (documentationScore < 0.7) issues.push('Incomplete documentation');

      // Security compliance check
      if (taskDetails.securityRelevant) {
        const securityScore = await this.assessSecurityCompliance(agentId, taskDetails);
        qualityChecks.securityCompliance = securityScore;
        if (securityScore < 0.9) issues.push('Security compliance issues');
      }

      const overallQualityScore = Object.values(qualityChecks).reduce((sum, score) => sum + score, 0) / Object.keys(qualityChecks).length;

      return {
        score: overallQualityScore,
        passed: overallQualityScore >= 0.7,
        issues,
        details: qualityChecks
      };

    } catch (error) {
      return {
        score: 0.5,
        passed: false,
        issues: [`Error assessing quality compliance: ${error.message}`],
        details: qualityChecks
      };
    }
  }

  async checkDocumentationCompliance(agentId, taskDetails) {
    try {
      const documentationChecks = {
        taskDocumentation: await this.checkTaskDocumentation(agentId, taskDetails),
        decisionLogging: await this.checkDecisionLogging(agentId, taskDetails),
        progressReporting: await this.checkProgressReporting(agentId, taskDetails),
        knowledgeSharing: await this.checkKnowledgeSharing(agentId, taskDetails)
      };

      const averageScore = Object.values(documentationChecks).reduce((sum, score) => sum + score, 0) / Object.keys(documentationChecks).length;
      
      const issues = [];
      if (documentationChecks.taskDocumentation < 0.7) issues.push('Insufficient task documentation');
      if (documentationChecks.decisionLogging < 0.7) issues.push('Poor decision logging');
      if (documentationChecks.progressReporting < 0.7) issues.push('Inadequate progress reporting');
      if (documentationChecks.knowledgeSharing < 0.7) issues.push('Limited knowledge sharing');

      return {
        score: averageScore,
        passed: averageScore >= 0.7,
        issues,
        details: documentationChecks
      };

    } catch (error) {
      return {
        score: 0.5,
        passed: false,
        issues: [`Error checking documentation compliance: ${error.message}`],
        details: {}
      };
    }
  }

  calculateAccountabilityScore(checks) {
    const weights = {
      sprintContextAwareness: 0.25,
      taskAlignment: 0.25,
      historicalPerformance: 0.2,
      qualityCompliance: 0.2,
      documentation: 0.1
    };

    let totalScore = 0;
    let totalWeight = 0;

    for (const [checkName, check] of Object.entries(checks)) {
      if (weights[checkName] && check.score !== undefined) {
        totalScore += check.score * weights[checkName];
        totalWeight += weights[checkName];
      }
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  determineComplianceLevel(score) {
    if (score >= 0.9) return 'excellent';
    if (score >= 0.8) return 'good';
    if (score >= 0.7) return 'acceptable';
    if (score >= 0.5) return 'needs-improvement';
    return 'non-compliant';
  }

  identifyViolations(checks) {
    const violations = [];
    
    for (const [checkName, check] of Object.entries(checks)) {
      if (!check.passed) {
        violations.push({
          category: checkName,
          severity: check.score < 0.3 ? 'high' : check.score < 0.6 ? 'medium' : 'low',
          issues: check.issues || [],
          score: check.score
        });
      }
    }

    return violations;
  }

  generateRecommendations(checks, overallScore) {
    const recommendations = [];

    // Sprint context awareness recommendations
    if (checks.sprintContextAwareness?.score < 0.7) {
      recommendations.push({
        priority: 'high',
        category: 'sprint-awareness',
        action: 'Review current sprint documentation and acknowledge understanding',
        impact: 'Ensures alignment with sprint objectives'
      });
    }

    // Task alignment recommendations
    if (checks.taskAlignment?.score < 0.7) {
      recommendations.push({
        priority: 'high',
        category: 'task-alignment',
        action: 'Revise task approach to better align with sprint goals',
        impact: 'Improves sprint objective achievement'
      });
    }

    // Quality compliance recommendations
    if (checks.qualityCompliance?.score < 0.7) {
      recommendations.push({
        priority: 'medium',
        category: 'quality',
        action: 'Implement additional quality assurance measures',
        impact: 'Improves deliverable quality and reduces technical debt'
      });
    }

    // Historical performance recommendations
    if (checks.historicalPerformance?.score < 0.7) {
      recommendations.push({
        priority: 'medium',
        category: 'performance',
        action: 'Analyze past performance issues and implement improvements',
        impact: 'Enhances future task execution reliability'
      });
    }

    // Documentation recommendations
    if (checks.documentation?.score < 0.7) {
      recommendations.push({
        priority: 'low',
        category: 'documentation',
        action: 'Improve documentation practices and knowledge sharing',
        impact: 'Facilitates better team collaboration and knowledge transfer'
      });
    }

    // Overall score recommendations
    if (overallScore < 0.5) {
      recommendations.unshift({
        priority: 'critical',
        category: 'oversight',
        action: 'Require immediate oversight and guidance before proceeding',
        impact: 'Prevents potential sprint objective failures'
      });
    }

    return recommendations;
  }

  async storeAuditResult(audit) {
    const auditFile = join(this.auditDir, 'accountability-database.json');
    
    try {
      const content = await readFile(auditFile, 'utf8');
      const database = JSON.parse(content);
      
      // Add new audit result
      database.agents = database.agents || [];
      database.tasks = database.tasks || [];
      
      // Update or add agent record
      const agentIndex = database.agents.findIndex(a => a.agentId === audit.agentId);
      if (agentIndex >= 0) {
        database.agents[agentIndex].lastAudit = audit.timestamp;
        database.agents[agentIndex].lastScore = audit.overallScore;
        database.agents[agentIndex].taskCount = (database.agents[agentIndex].taskCount || 0) + 1;
      } else {
        database.agents.push({
          agentId: audit.agentId,
          firstSeen: audit.timestamp,
          lastAudit: audit.timestamp,
          lastScore: audit.overallScore,
          taskCount: 1
        });
      }
      
      // Add task record
      database.tasks.push({
        taskId: audit.taskId,
        agentId: audit.agentId,
        timestamp: audit.timestamp,
        score: audit.overallScore,
        complianceLevel: audit.complianceLevel,
        violationCount: audit.violations.length,
        requiresOversight: audit.requiresOversight
      });
      
      // Keep only last 1000 task records
      if (database.tasks.length > 1000) {
        database.tasks = database.tasks.slice(-1000);
      }
      
      // Update metrics
      database.metrics.lastUpdated = audit.timestamp;
      database.metrics.totalTasks = database.tasks.length;
      database.metrics.complianceRate = database.tasks.filter(t => t.complianceLevel !== 'non-compliant').length / database.tasks.length;
      database.metrics.averageAccountabilityScore = database.tasks.reduce((sum, t) => sum + t.score, 0) / database.tasks.length;
      
      await writeFile(auditFile, JSON.stringify(database, null, 2));

    } catch (error) {
      console.error('Failed to store audit result:', error.message);
    }
  }

  async triggerOversightAlert(audit) {
    const alert = {
      type: 'accountability-alert',
      severity: audit.overallScore < 0.3 ? 'critical' : 'warning',
      agentId: audit.agentId,
      taskId: audit.taskId,
      score: audit.overallScore,
      violations: audit.violations,
      recommendations: audit.recommendations,
      timestamp: audit.timestamp
    };

    // Store alert
    const alertFile = join(this.auditDir, 'oversight-alerts.json');
    let alerts = [];
    
    try {
      const content = await readFile(alertFile, 'utf8');
      alerts = JSON.parse(content);
    } catch {
      // File doesn't exist, start fresh
    }
    
    alerts.push(alert);
    
    // Keep only last 100 alerts
    if (alerts.length > 100) {
      alerts = alerts.slice(-100);
    }
    
    await writeFile(alertFile, JSON.stringify(alerts, null, 2));

    // Could integrate with notification system here
    console.warn(`⚠️  OVERSIGHT ALERT: Agent ${audit.agentId} requires attention (Score: ${Math.round(audit.overallScore * 100)}%)`);
  }

  async generateAccountabilityReport(agentId = null, timeframe = '7d') {
    const auditFile = join(this.auditDir, 'accountability-database.json');
    
    try {
      const content = await readFile(auditFile, 'utf8');
      const database = JSON.parse(content);
      
      // Filter data based on timeframe
      const cutoffDate = new Date();
      const days = parseInt(timeframe.replace('d', ''));
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      let filteredTasks = database.tasks.filter(task => 
        new Date(task.timestamp) >= cutoffDate &&
        (!agentId || task.agentId === agentId)
      );
      
      const report = {
        timeframe,
        agentFilter: agentId,
        generatedAt: new Date().toISOString(),
        summary: {
          totalTasks: filteredTasks.length,
          uniqueAgents: [...new Set(filteredTasks.map(t => t.agentId))].length,
          averageScore: filteredTasks.length > 0 ? filteredTasks.reduce((sum, t) => sum + t.score, 0) / filteredTasks.length : 0,
          complianceRate: filteredTasks.length > 0 ? filteredTasks.filter(t => t.complianceLevel !== 'non-compliant').length / filteredTasks.length : 0,
          oversightRequired: filteredTasks.filter(t => t.requiresOversight).length
        },
        complianceLevels: this.analyzeComplianceLevels(filteredTasks),
        topViolations: this.analyzeTopViolations(filteredTasks),
        agentPerformance: this.analyzeAgentPerformance(filteredTasks, database.agents),
        trends: this.analyzeTrends(filteredTasks)
      };
      
      return report;

    } catch (error) {
      return {
        error: `Failed to generate report: ${error.message}`,
        timeframe,
        agentFilter: agentId
      };
    }
  }

  analyzeComplianceLevels(tasks) {
    const levels = {};
    
    for (const task of tasks) {
      levels[task.complianceLevel] = (levels[task.complianceLevel] || 0) + 1;
    }
    
    return levels;
  }

  analyzeTopViolations(tasks) {
    // This would require violation details to be stored with tasks
    // For now, return placeholder data
    return [
      { category: 'sprint-awareness', count: 0 },
      { category: 'task-alignment', count: 0 },
      { category: 'quality-compliance', count: 0 }
    ];
  }

  analyzeAgentPerformance(tasks, agents) {
    const performance = {};
    
    for (const task of tasks) {
      if (!performance[task.agentId]) {
        performance[task.agentId] = {
          taskCount: 0,
          averageScore: 0,
          oversightRequired: 0
        };
      }
      
      performance[task.agentId].taskCount++;
      performance[task.agentId].averageScore += task.score;
      if (task.requiresOversight) {
        performance[task.agentId].oversightRequired++;
      }
    }
    
    // Calculate averages
    for (const agentId of Object.keys(performance)) {
      performance[agentId].averageScore /= performance[agentId].taskCount;
    }
    
    return performance;
  }

  analyzeTrends(tasks) {
    // Sort tasks by timestamp
    const sortedTasks = tasks.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    if (sortedTasks.length < 2) {
      return { trend: 'insufficient-data' };
    }
    
    const firstHalf = sortedTasks.slice(0, Math.floor(sortedTasks.length / 2));
    const secondHalf = sortedTasks.slice(Math.floor(sortedTasks.length / 2));
    
    const firstHalfAvg = firstHalf.reduce((sum, t) => sum + t.score, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, t) => sum + t.score, 0) / secondHalf.length;
    
    const change = secondHalfAvg - firstHalfAvg;
    
    return {
      trend: change > 0.05 ? 'improving' : change < -0.05 ? 'declining' : 'stable',
      change: Math.round(change * 100),
      firstPeriodAvg: Math.round(firstHalfAvg * 100),
      secondPeriodAvg: Math.round(secondHalfAvg * 100)
    };
  }

  // Helper methods for specific checks
  async getSprintAccessLog(agentId) {
    try {
      // Implementation would check actual file access logs or memory store
      return { timestamp: new Date().toISOString(), accessed: true };
    } catch {
      return null;
    }
  }

  async getContextAcknowledgment(agentId) {
    try {
      // Check if agent has acknowledged sprint context
      const acknowledgmentFile = join(this.auditDir, 'context-acknowledgments.json');
      const content = await readFile(acknowledgmentFile, 'utf8');
      const acknowledgments = JSON.parse(content);
      return acknowledgments[agentId];
    } catch {
      return null;
    }
  }

  async loadSprintContext() {
    // Implementation would load actual sprint context
    return {
      goals: ['Implement secure authentication', 'Improve system performance'],
      requirements: { functional: [], nonFunctional: [] },
      constraints: { technical: [], compliance: [] }
    };
  }

  calculateGoalAlignment(taskDetails, goals) {
    // Simplified implementation
    const taskDescription = taskDetails.description?.toLowerCase() || '';
    let maxAlignment = 0;
    
    for (const goal of goals) {
      const goalWords = goal.toLowerCase().split(/\s+/);
      const matches = goalWords.filter(word => taskDescription.includes(word)).length;
      const alignment = matches / goalWords.length;
      maxAlignment = Math.max(maxAlignment, alignment);
    }
    
    return maxAlignment;
  }

  calculateRequirementAlignment(taskDetails, requirements) {
    // Simplified implementation
    return 0.8; // Placeholder
  }

  checkConstraintCompliance(taskDetails, constraints) {
    // Simplified implementation
    return 0.9; // Placeholder
  }

  getAlignedGoals(taskDetails, goals) {
    // Return goals that align with the task
    return goals.filter(goal => this.calculateGoalAlignment(taskDetails, [goal]) > 0.3);
  }

  async getAgentPerformanceHistory(agentId) {
    // Implementation would retrieve actual performance history
    return [];
  }

  async assessCodeQuality(agentId, taskDetails) {
    // Implementation would assess actual code quality
    return 0.8;
  }

  async assessTestCoverage(agentId, taskDetails) {
    // Implementation would check test coverage
    return 0.75;
  }

  async assessDocumentation(agentId, taskDetails) {
    // Implementation would assess documentation quality
    return 0.7;
  }

  async assessSecurityCompliance(agentId, taskDetails) {
    // Implementation would check security compliance
    return 0.85;
  }

  async checkTaskDocumentation(agentId, taskDetails) {
    // Implementation would check task documentation
    return 0.8;
  }

  async checkDecisionLogging(agentId, taskDetails) {
    // Implementation would check decision logging
    return 0.7;
  }

  async checkProgressReporting(agentId, taskDetails) {
    // Implementation would check progress reporting
    return 0.75;
  }

  async checkKnowledgeSharing(agentId, taskDetails) {
    // Implementation would check knowledge sharing
    return 0.65;
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const auditor = new AgentAccountabilityAuditor();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'audit':
      const agentId = process.argv[3];
      const taskDescription = process.argv.slice(4).join(' ');
      
      if (!agentId || !taskDescription) {
        console.error('Usage: node agent-accountability-auditor.js audit <agentId> <taskDescription>');
        process.exit(1);
      }
      
      const taskDetails = {
        description: taskDescription,
        type: 'general',
        requiresTesting: true,
        securityRelevant: false
      };
      
      auditor.auditAgent(agentId, taskDetails)
        .then(result => {
          console.log('=== Agent Accountability Audit ===');
          console.log(`Agent: ${result.agentId}`);
          console.log(`Task: ${result.taskDetails.description}`);
          console.log(`Overall Score: ${Math.round(result.overallScore * 100)}%`);
          console.log(`Compliance Level: ${result.complianceLevel.toUpperCase()}`);
          console.log(`Requires Oversight: ${result.requiresOversight ? '⚠️  YES' : '✅ NO'}`);
          
          if (result.violations.length > 0) {
            console.log('\n🚨 Violations:');
            for (const violation of result.violations) {
              console.log(`  - ${violation.category} (${violation.severity}): ${violation.issues.join(', ')}`);
            }
          }
          
          if (result.recommendations.length > 0) {
            console.log('\n💡 Recommendations:');
            for (const rec of result.recommendations) {
              console.log(`  - [${rec.priority.toUpperCase()}] ${rec.action}`);
            }
          }
          
          process.exit(result.requiresOversight ? 1 : 0);
        })
        .catch(error => {
          console.error('Audit failed:', error.message);
          process.exit(1);
        });
      break;
      
    case 'report':
      const agentFilter = process.argv[3];
      const timeframe = process.argv[4] || '7d';
      
      auditor.generateAccountabilityReport(agentFilter, timeframe)
        .then(report => {
          console.log('=== Agent Accountability Report ===');
          console.log(`Timeframe: ${report.timeframe}`);
          console.log(`Agent Filter: ${report.agentFilter || 'All agents'}`);
          console.log(`Generated: ${report.generatedAt}`);
          
          if (report.error) {
            console.log('Error:', report.error);
            return;
          }
          
          console.log('\n📊 Summary:');
          console.log(`  Total Tasks: ${report.summary.totalTasks}`);
          console.log(`  Unique Agents: ${report.summary.uniqueAgents}`);
          console.log(`  Average Score: ${Math.round(report.summary.averageScore * 100)}%`);
          console.log(`  Compliance Rate: ${Math.round(report.summary.complianceRate * 100)}%`);
          console.log(`  Oversight Required: ${report.summary.oversightRequired} tasks`);
          
          console.log('\n📈 Compliance Levels:');
          for (const [level, count] of Object.entries(report.complianceLevels)) {
            console.log(`  ${level}: ${count} tasks`);
          }
          
          console.log('\n📉 Trend:', report.trends.trend);
        })
        .catch(error => {
          console.error('Report generation failed:', error.message);
          process.exit(1);
        });
      break;
      
    case 'init':
      auditor.initialize()
        .then(() => {
          console.log('✅ Agent accountability audit system initialized');
          console.log('Audit database created in .claude/audit/');
        })
        .catch(error => {
          console.error('Initialization failed:', error.message);
          process.exit(1);
        });
      break;
      
    default:
      console.log('Usage:');
      console.log('  node agent-accountability-auditor.js init');
      console.log('  node agent-accountability-auditor.js audit <agentId> <taskDescription>');
      console.log('  node agent-accountability-auditor.js report [agentId] [timeframe]');
      break;
  }
}

export default AgentAccountabilityAuditor;
