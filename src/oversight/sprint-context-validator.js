#!/usr/bin/env node
/**
 * Sprint Context Validation System
 * Ensures all agents have proper sprint context before task execution
 */

import { readFile, writeFile, access, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class SprintContextValidator {
  constructor() {
    this.sprintDir = join(process.cwd(), '.claude', 'sprint');
    this.auditDir = join(this.sprintDir, 'audit');
    this.currentSprintDir = join(this.sprintDir, 'current');
  }

  async initialize() {
    // Ensure sprint directories exist
    await mkdir(this.sprintDir, { recursive: true });
    await mkdir(this.auditDir, { recursive: true });
    await mkdir(this.currentSprintDir, { recursive: true });
    
    // Initialize default sprint documents if they don't exist
    await this.ensureSprintDocuments();
  }

  async ensureSprintDocuments() {
    const documents = [
      {
        path: join(this.currentSprintDir, 'sprint-goals.md'),
        content: `# Current Sprint Goals

## Primary Objectives
- [ ] Objective 1: [Description]
- [ ] Objective 2: [Description]
- [ ] Objective 3: [Description]

## Success Criteria
- Metric 1: [Target value]
- Metric 2: [Target value]
- Metric 3: [Target value]

## Priority Level
High / Medium / Low

## Stakeholders
- Product Owner: [Name]
- Scrum Master: [Name]
- Development Team: [Names]

---
*Last Updated: ${new Date().toISOString()}*
`
      },
      {
        path: join(this.currentSprintDir, 'requirements.md'),
        content: `# Sprint Requirements

## Functional Requirements
1. **Requirement 1**: [Detailed description]
2. **Requirement 2**: [Detailed description]
3. **Requirement 3**: [Detailed description]

## Non-Functional Requirements
- **Performance**: [Specific targets]
- **Security**: [Security requirements]
- **Scalability**: [Scalability needs]
- **Usability**: [UX requirements]

## Dependencies
- External API integrations
- Third-party libraries
- Infrastructure requirements

## Out of Scope
- Items explicitly excluded from this sprint

---
*Last Updated: ${new Date().toISOString()}*
`
      },
      {
        path: join(this.currentSprintDir, 'constraints.md'),
        content: `# Sprint Constraints

## Time Constraints
- Sprint Duration: [X weeks]
- Key Milestones:
  - Week 1: [Milestone description]
  - Week 2: [Milestone description]
  - Final: [Delivery date]

## Technical Constraints
- Programming Languages: [Allowed languages]
- Frameworks: [Required/preferred frameworks]
- Architecture Patterns: [Mandatory patterns]
- Code Quality Standards: [Quality gates]

## Resource Constraints
- Team Size: [Number of developers]
- Budget Limitations: [If any]
- Infrastructure Limits: [Server, database, etc.]

## Regulatory/Compliance Constraints
- GDPR compliance required
- Security standards (SOC2, PCI, etc.)
- Accessibility requirements (WCAG 2.1)
- Industry regulations

---
*Last Updated: ${new Date().toISOString()}*
`
      },
      {
        path: join(this.currentSprintDir, 'architecture-decisions.md'),
        content: `# Architectural Decisions

## Active Decisions

### Decision 1: [Technology Choice]
- **Status**: Accepted
- **Date**: ${new Date().toISOString().split('T')[0]}
- **Decision**: [What was decided]
- **Rationale**: [Why this decision was made]
- **Consequences**: [Positive and negative consequences]
- **Alternatives Considered**: [Other options evaluated]

### Decision 2: [Design Pattern]
- **Status**: Accepted
- **Date**: ${new Date().toISOString().split('T')[0]}
- **Decision**: [What was decided]
- **Rationale**: [Why this decision was made]
- **Consequences**: [Positive and negative consequences]
- **Alternatives Considered**: [Other options evaluated]

## Decision Process
1. All architectural decisions must be documented here
2. Decisions require review by architecture-specialist agent
3. Significant decisions require team consensus
4. Deprecated decisions are moved to archive

---
*Last Updated: ${new Date().toISOString()}*
`
      },
      {
        path: join(this.currentSprintDir, 'acceptance-criteria.md'),
        content: `# Acceptance Criteria

## Definition of Done

### Code Quality
- [ ] Code review completed by at least 2 agents
- [ ] Unit test coverage > 80%
- [ ] Integration tests pass
- [ ] Static analysis passes (linting, security scan)
- [ ] Performance benchmarks met

### Documentation
- [ ] API documentation updated
- [ ] User documentation created/updated
- [ ] Architecture decisions documented
- [ ] Deployment guide updated

### Testing
- [ ] All acceptance criteria tests pass
- [ ] Manual testing completed
- [ ] Security testing completed
- [ ] Performance testing completed
- [ ] Accessibility testing (if applicable)

### Deployment
- [ ] Deployment to staging successful
- [ ] Database migrations tested
- [ ] Environment variables configured
- [ ] Monitoring and alerting configured

## Feature-Specific Criteria
*Add specific acceptance criteria for each feature/story in this sprint*

### Feature 1: [Name]
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

### Feature 2: [Name]
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

---
*Last Updated: ${new Date().toISOString()}*
`
      }
    ];

    for (const doc of documents) {
      try {
        await access(doc.path);
      } catch {
        await writeFile(doc.path, doc.content);
      }
    }
  }

  async validateAgentSprintAwareness(agentId, taskDescription) {
    await this.initialize();

    const validation = {
      agentId,
      taskDescription,
      timestamp: new Date().toISOString(),
      validations: {},
      overallCompliance: false,
      requiresAttention: [],
      recommendations: []
    };

    try {
      // Load current sprint context
      const sprintContext = await this.loadSprintContext();
      
      // Validate task alignment with sprint goals
      const goalAlignment = await this.validateGoalAlignment(taskDescription, sprintContext.goals);
      validation.validations.goalAlignment = goalAlignment;
      
      // Validate against constraints
      const constraintCompliance = await this.validateConstraints(taskDescription, sprintContext.constraints);
      validation.validations.constraintCompliance = constraintCompliance;
      
      // Validate architectural consistency
      const architecturalConsistency = await this.validateArchitecturalConsistency(taskDescription, sprintContext.architectureDecisions);
      validation.validations.architecturalConsistency = architecturalConsistency;
      
      // Validate acceptance criteria alignment
      const acceptanceCriteriaAlignment = await this.validateAcceptanceCriteria(taskDescription, sprintContext.acceptanceCriteria);
      validation.validations.acceptanceCriteriaAlignment = acceptanceCriteriaAlignment;

      // Calculate overall compliance
      const validationScores = Object.values(validation.validations).map(v => v.score);
      const averageScore = validationScores.reduce((sum, score) => sum + score, 0) / validationScores.length;
      validation.overallCompliance = averageScore >= 0.8;
      validation.complianceScore = averageScore;

      // Generate recommendations
      validation.recommendations = this.generateRecommendations(validation.validations);
      
      // Identify items requiring attention
      validation.requiresAttention = Object.entries(validation.validations)
        .filter(([_, v]) => v.score < 0.8)
        .map(([key, v]) => ({ area: key, issue: v.issues[0], score: v.score }));

      // Record validation in audit log
      await this.recordValidation(validation);

      return validation;

    } catch (error) {
      validation.error = error.message;
      validation.overallCompliance = false;
      return validation;
    }
  }

  async loadSprintContext() {
    const context = {};
    
    try {
      const goalsContent = await readFile(join(this.currentSprintDir, 'sprint-goals.md'), 'utf8');
      context.goals = this.parseSprintGoals(goalsContent);
      
      const requirementsContent = await readFile(join(this.currentSprintDir, 'requirements.md'), 'utf8');
      context.requirements = this.parseRequirements(requirementsContent);
      
      const constraintsContent = await readFile(join(this.currentSprintDir, 'constraints.md'), 'utf8');
      context.constraints = this.parseConstraints(constraintsContent);
      
      const architectureContent = await readFile(join(this.currentSprintDir, 'architecture-decisions.md'), 'utf8');
      context.architectureDecisions = this.parseArchitectureDecisions(architectureContent);
      
      const acceptanceContent = await readFile(join(this.currentSprintDir, 'acceptance-criteria.md'), 'utf8');
      context.acceptanceCriteria = this.parseAcceptanceCriteria(acceptanceContent);
      
    } catch (error) {
      console.warn(`Warning: Could not load sprint context: ${error.message}`);
    }
    
    return context;
  }

  parseSprintGoals(content) {
    const lines = content.split('\n');
    const goals = [];
    
    for (const line of lines) {
      if (line.trim().startsWith('- [ ]') || line.trim().startsWith('- [x]')) {
        const goal = line.replace(/^- \[[x ]\]/, '').trim();
        goals.push(goal);
      }
    }
    
    return goals;
  }

  parseRequirements(content) {
    const sections = {
      functional: [],
      nonFunctional: [],
      dependencies: [],
      outOfScope: []
    };
    
    let currentSection = null;
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line.includes('## Functional Requirements')) {
        currentSection = 'functional';
      } else if (line.includes('## Non-Functional Requirements')) {
        currentSection = 'nonFunctional';
      } else if (line.includes('## Dependencies')) {
        currentSection = 'dependencies';
      } else if (line.includes('## Out of Scope')) {
        currentSection = 'outOfScope';
      } else if (currentSection && (line.trim().startsWith('-') || line.trim().match(/^\d+\./))) {
        sections[currentSection].push(line.trim());
      }
    }
    
    return sections;
  }

  parseConstraints(content) {
    const constraints = {
      time: [],
      technical: [],
      resource: [],
      compliance: []
    };
    
    let currentSection = null;
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line.includes('## Time Constraints')) {
        currentSection = 'time';
      } else if (line.includes('## Technical Constraints')) {
        currentSection = 'technical';
      } else if (line.includes('## Resource Constraints')) {
        currentSection = 'resource';
      } else if (line.includes('## Regulatory/Compliance Constraints')) {
        currentSection = 'compliance';
      } else if (currentSection && line.trim().startsWith('-')) {
        constraints[currentSection].push(line.trim().substring(1).trim());
      }
    }
    
    return constraints;
  }

  parseArchitectureDecisions(content) {
    const decisions = [];
    const sections = content.split('### ').slice(1); // Skip first empty section
    
    for (const section of sections) {
      const lines = section.split('\n');
      const title = lines[0].trim();
      
      const decision = { title, details: {} };
      
      for (const line of lines.slice(1)) {
        if (line.startsWith('- **Status**:')) {
          decision.details.status = line.replace('- **Status**:', '').trim();
        } else if (line.startsWith('- **Decision**:')) {
          decision.details.decision = line.replace('- **Decision**:', '').trim();
        } else if (line.startsWith('- **Rationale**:')) {
          decision.details.rationale = line.replace('- **Rationale**:', '').trim();
        }
      }
      
      decisions.push(decision);
    }
    
    return decisions;
  }

  parseAcceptanceCriteria(content) {
    const criteria = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line.trim().startsWith('- [ ]') || line.trim().startsWith('- [x]')) {
        const criterion = line.replace(/^- \[[x ]\]/, '').trim();
        criteria.push(criterion);
      }
    }
    
    return criteria;
  }

  async validateGoalAlignment(taskDescription, goals) {
    const alignmentScores = goals.map(goal => {
      const keywords = goal.toLowerCase().split(/\s+/);
      const taskLower = taskDescription.toLowerCase();
      const matchCount = keywords.filter(keyword => taskLower.includes(keyword)).length;
      return matchCount / keywords.length;
    });
    
    const maxAlignment = Math.max(...alignmentScores, 0);
    
    return {
      score: maxAlignment,
      passed: maxAlignment >= 0.3,
      issues: maxAlignment < 0.3 ? ['Task does not clearly align with any sprint goals'] : [],
      details: { alignmentScores, maxAlignment }
    };
  }

  async validateConstraints(taskDescription, constraints) {
    const violations = [];
    let score = 1.0;
    
    // Check technical constraints
    for (const constraint of constraints.technical || []) {
      if (constraint.toLowerCase().includes('forbidden') && 
          taskDescription.toLowerCase().includes(constraint.toLowerCase().replace('forbidden', '').trim())) {
        violations.push(`Violates technical constraint: ${constraint}`);
        score -= 0.2;
      }
    }
    
    // Check compliance constraints
    for (const constraint of constraints.compliance || []) {
      if (constraint.toLowerCase().includes('required') && 
          !taskDescription.toLowerCase().includes(constraint.toLowerCase().replace('required', '').trim())) {
        violations.push(`Missing compliance requirement: ${constraint}`);
        score -= 0.15;
      }
    }
    
    score = Math.max(0, score);
    
    return {
      score,
      passed: violations.length === 0,
      issues: violations,
      details: { constraintsChecked: Object.keys(constraints).length }
    };
  }

  async validateArchitecturalConsistency(taskDescription, architectureDecisions) {
    const violations = [];
    let score = 1.0;
    
    for (const decision of architectureDecisions || []) {
      if (decision.details.status === 'Accepted') {
        // Check if task description conflicts with architectural decisions
        const decisionKeywords = decision.details.decision?.toLowerCase().split(/\s+/) || [];
        const taskLower = taskDescription.toLowerCase();
        
        // Simple keyword-based conflict detection
        if (decision.details.decision?.toLowerCase().includes('must not') && 
            decisionKeywords.some(keyword => taskLower.includes(keyword))) {
          violations.push(`Potential conflict with architectural decision: ${decision.title}`);
          score -= 0.3;
        }
      }
    }
    
    score = Math.max(0, score);
    
    return {
      score,
      passed: violations.length === 0,
      issues: violations,
      details: { decisionsChecked: architectureDecisions?.length || 0 }
    };
  }

  async validateAcceptanceCriteria(taskDescription, acceptanceCriteria) {
    const relevantCriteria = acceptanceCriteria.filter(criterion => {
      const criterionKeywords = criterion.toLowerCase().split(/\s+/);
      const taskLower = taskDescription.toLowerCase();
      return criterionKeywords.some(keyword => taskLower.includes(keyword));
    });
    
    const score = relevantCriteria.length > 0 ? 0.8 : 0.5; // Higher score if task relates to acceptance criteria
    
    return {
      score,
      passed: score >= 0.5,
      issues: relevantCriteria.length === 0 ? ['Task does not clearly relate to defined acceptance criteria'] : [],
      details: { relevantCriteria: relevantCriteria.length, totalCriteria: acceptanceCriteria.length }
    };
  }

  generateRecommendations(validations) {
    const recommendations = [];
    
    if (validations.goalAlignment?.score < 0.5) {
      recommendations.push('Consider revising task to better align with sprint goals');
    }
    
    if (validations.constraintCompliance?.score < 0.8) {
      recommendations.push('Review technical and compliance constraints before proceeding');
    }
    
    if (validations.architecturalConsistency?.score < 0.8) {
      recommendations.push('Consult architectural decisions to ensure consistency');
    }
    
    if (validations.acceptanceCriteriaAlignment?.score < 0.6) {
      recommendations.push('Clarify how task contributes to acceptance criteria');
    }
    
    return recommendations;
  }

  async recordValidation(validation) {
    const auditFile = join(this.auditDir, 'agent-sprint-validations.json');
    let validations = [];
    
    try {
      const content = await readFile(auditFile, 'utf8');
      validations = JSON.parse(content);
    } catch {
      // File doesn't exist or is invalid, start fresh
    }
    
    validations.push(validation);
    
    // Keep only the last 1000 validations
    if (validations.length > 1000) {
      validations = validations.slice(-1000);
    }
    
    await writeFile(auditFile, JSON.stringify(validations, null, 2));
  }

  async generateComplianceReport(agentId = null) {
    const auditFile = join(this.auditDir, 'agent-sprint-validations.json');
    let validations = [];
    
    try {
      const content = await readFile(auditFile, 'utf8');
      validations = JSON.parse(content);
    } catch {
      return { error: 'No validation data available' };
    }
    
    // Filter by agent if specified
    if (agentId) {
      validations = validations.filter(v => v.agentId === agentId);
    }
    
    // Calculate metrics
    const totalValidations = validations.length;
    const compliantValidations = validations.filter(v => v.overallCompliance).length;
    const complianceRate = totalValidations > 0 ? compliantValidations / totalValidations : 0;
    
    const averageScore = validations.length > 0 
      ? validations.reduce((sum, v) => sum + (v.complianceScore || 0), 0) / validations.length 
      : 0;
    
    const commonIssues = this.analyzeCommonIssues(validations);
    
    return {
      summary: {
        totalValidations,
        compliantValidations,
        complianceRate: Math.round(complianceRate * 100),
        averageScore: Math.round(averageScore * 100)
      },
      commonIssues,
      recentValidations: validations.slice(-10),
      agentFilter: agentId
    };
  }

  analyzeCommonIssues(validations) {
    const issues = {};
    
    for (const validation of validations) {
      for (const item of validation.requiresAttention || []) {
        const key = item.area;
        if (!issues[key]) {
          issues[key] = { count: 0, examples: [] };
        }
        issues[key].count++;
        if (issues[key].examples.length < 3) {
          issues[key].examples.push(item.issue);
        }
      }
    }
    
    return Object.entries(issues)
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, 5)
      .map(([area, data]) => ({ area, ...data }));
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new SprintContextValidator();
  
  const command = process.argv[2];
  const agentId = process.argv[3];
  const taskDescription = process.argv.slice(4).join(' ');
  
  switch (command) {
    case 'validate':
      if (!agentId || !taskDescription) {
        console.error('Usage: node sprint-context-validator.js validate <agentId> <taskDescription>');
        process.exit(1);
      }
      
      validator.validateAgentSprintAwareness(agentId, taskDescription)
        .then(result => {
          console.log('=== Sprint Context Validation ===');
          console.log(`Agent: ${result.agentId}`);
          console.log(`Task: ${result.taskDescription}`);
          console.log(`Compliance: ${result.overallCompliance ? '✅ PASSED' : '❌ FAILED'}`);
          console.log(`Score: ${Math.round((result.complianceScore || 0) * 100)}%`);
          
          if (result.requiresAttention?.length > 0) {
            console.log('\n⚠️  Issues requiring attention:');
            for (const issue of result.requiresAttention) {
              console.log(`  - ${issue.area}: ${issue.issue} (Score: ${Math.round(issue.score * 100)}%)`);
            }
          }
          
          if (result.recommendations?.length > 0) {
            console.log('\n💡 Recommendations:');
            for (const rec of result.recommendations) {
              console.log(`  - ${rec}`);
            }
          }
          
          process.exit(result.overallCompliance ? 0 : 1);
        })
        .catch(error => {
          console.error('Validation failed:', error.message);
          process.exit(1);
        });
      break;
      
    case 'report':
      validator.generateComplianceReport(agentId)
        .then(report => {
          console.log('=== Sprint Compliance Report ===');
          if (report.error) {
            console.log('Error:', report.error);
            return;
          }
          
          console.log(`Total validations: ${report.summary.totalValidations}`);
          console.log(`Compliance rate: ${report.summary.complianceRate}%`);
          console.log(`Average score: ${report.summary.averageScore}%`);
          
          if (report.commonIssues.length > 0) {
            console.log('\n🔍 Most common issues:');
            for (const issue of report.commonIssues) {
              console.log(`  ${issue.area}: ${issue.count} occurrences`);
            }
          }
        })
        .catch(error => {
          console.error('Report generation failed:', error.message);
          process.exit(1);
        });
      break;
      
    case 'init':
      validator.initialize()
        .then(() => {
          console.log('✅ Sprint context validation system initialized');
          console.log('Sprint documents created in .claude/sprint/current/');
          console.log('Please update the sprint documents with current sprint information.');
        })
        .catch(error => {
          console.error('Initialization failed:', error.message);
          process.exit(1);
        });
      break;
      
    default:
      console.log('Usage:');
      console.log('  node sprint-context-validator.js init');
      console.log('  node sprint-context-validator.js validate <agentId> <taskDescription>');
      console.log('  node sprint-context-validator.js report [agentId]');
      break;
  }
}

export default SprintContextValidator;
