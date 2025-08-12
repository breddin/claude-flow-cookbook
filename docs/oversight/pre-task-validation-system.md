# Agent Pre-Task Validation Hook

## Purpose
This hook ensures every agent validates their understanding of sprint context and task alignment before executing any work. It acts as a mandatory gate that prevents context-unaware execution.

## Integration Points

### MCP Integration
```javascript
// Pre-task validation hook
mcp__claude-flow__pre_task_validation({
  agentId: "agent_123",
  taskDescription: "Implement user authentication system",
  sprintId: "current",
  requiredValidations: [
    "sprint-context-awareness",
    "goal-alignment", 
    "constraint-compliance",
    "architectural-consistency"
  ]
});
```

### Claude Flow Hooks Integration
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "node src/oversight/pre-task-validation-hook.js validate {{tool_input.task || 'general-task'}}"
          }
        ]
      }
    ]
  }
}
```

## Validation Process

### Phase 1: Sprint Context Check
1. **Sprint Document Access**: Verify agent has recently accessed sprint documentation
2. **Context Acknowledgment**: Confirm agent has acknowledged current sprint context
3. **Goal Understanding**: Validate agent understands sprint objectives and priorities

### Phase 2: Task Alignment Validation  
1. **Goal Alignment**: Ensure task aligns with sprint goals (minimum 70% alignment)
2. **Requirement Satisfaction**: Verify task addresses sprint requirements
3. **Constraint Compliance**: Check task doesn't violate sprint constraints

### Phase 3: Capability Assessment
1. **Agent-Task Match**: Confirm agent has required capabilities for the task
2. **Resource Availability**: Verify necessary resources are available
3. **Dependency Check**: Ensure task dependencies are satisfied

### Phase 4: Quality Gate Preparation
1. **Acceptance Criteria Awareness**: Confirm agent understands success criteria
2. **Quality Standards**: Verify agent commits to quality standards
3. **Documentation Requirements**: Ensure documentation obligations are understood

## Enforcement Mechanisms

### Automatic Blocks
```javascript
// Conditions that automatically block task execution
const blockingConditions = [
  {
    condition: 'sprint-context-not-acknowledged',
    severity: 'critical',
    action: 'block-execution',
    message: 'Must acknowledge current sprint context before proceeding'
  },
  {
    condition: 'goal-alignment-below-threshold',
    severity: 'high', 
    threshold: 0.5,
    action: 'block-execution',
    message: 'Task alignment with sprint goals too low'
  },
  {
    condition: 'constraint-violation-detected',
    severity: 'high',
    action: 'block-execution', 
    message: 'Task violates sprint constraints'
  },
  {
    condition: 'capability-mismatch',
    severity: 'medium',
    action: 'require-oversight',
    message: 'Agent capabilities may not match task requirements'
  }
];
```

### Warning Conditions
```javascript
// Conditions that allow execution but require attention
const warningConditions = [
  {
    condition: 'low-goal-alignment',
    threshold: 0.7,
    action: 'warn-and-proceed',
    message: 'Consider revising task for better goal alignment'
  },
  {
    condition: 'historical-performance-concern',
    threshold: 0.6,
    action: 'recommend-oversight',
    message: 'Agent has recent performance concerns'
  },
  {
    condition: 'complex-task-simple-agent',
    action: 'suggest-collaboration',
    message: 'Consider involving specialist agents for this task'
  }
];
```

## Agent Response Requirements

### Mandatory Acknowledgments
Every agent must provide:

1. **Sprint Context Confirmation**
   ```javascript
   const sprintAcknowledgment = {
     sprintId: "current",
     goalsUnderstood: true,
     constraintsAcknowledged: true,
     acceptanceCriteriaReviewed: true,
     estimatedAlignment: 0.85,
     timestamp: new Date().toISOString()
   };
   ```

2. **Task Analysis Submission**
   ```javascript
   const taskAnalysis = {
     taskDescription: "Implement OAuth 2.0 authentication",
     alignedGoals: ["Secure user management", "Industry standard auth"],
     relevantConstraints: ["GDPR compliance", "OAuth 2.0 mandatory"],
     successCriteria: ["Encrypted tokens", "Multi-factor support"],
     estimatedEffort: "3 days",
     requiredResources: ["OAuth library", "security review"]
   };
   ```

3. **Capability Declaration**
   ```javascript
   const capabilityDeclaration = {
     taskType: "authentication-implementation",
     confidenceLevel: 0.9,
     requiredSkills: ["OAuth 2.0", "JWT", "Security patterns"],
     availableSkills: ["OAuth 2.0", "JWT", "Security patterns", "Node.js"],
     skillGaps: [],
     needsAssistance: false,
     recommendedCollaborators: []
   };
   ```

## Integration Examples

### MCP Tool Chain
```javascript
// Complete pre-task validation flow
async function validateAgentTask(agentId, taskDescription) {
  // 1. Sprint context validation
  const sprintValidation = await mcp__claude-flow__sprint_context_validate({
    agentId,
    taskDescription,
    currentSprintId: "current"
  });
  
  if (!sprintValidation.passed) {
    throw new ValidationError(`Sprint context validation failed: ${sprintValidation.issues.join(', ')}`);
  }
  
  // 2. Agent accountability audit
  const accountabilityAudit = await mcp__claude-flow__agent_accountability_audit({
    agentId,
    taskDetails: {
      description: taskDescription,
      type: "implementation"
    }
  });
  
  if (accountabilityAudit.requiresOversight) {
    console.warn(`⚠️  Agent ${agentId} requires oversight (Score: ${accountabilityAudit.overallScore})`);
  }
  
  // 3. Task complexity assessment
  const complexityAssessment = await mcp__claude-flow__task_complexity_assess({
    taskDescription,
    agentCapabilities: await getAgentCapabilities(agentId)
  });
  
  // 4. Generate validation result
  return {
    approved: sprintValidation.passed && accountabilityAudit.overallScore >= 0.6,
    requiresOversight: accountabilityAudit.requiresOversight || complexityAssessment.complexity > 0.8,
    recommendations: [
      ...sprintValidation.recommendations,
      ...accountabilityAudit.recommendations
    ],
    conditions: {
      sprintAlignment: sprintValidation.complianceScore,
      accountabilityScore: accountabilityAudit.overallScore,
      taskComplexity: complexityAssessment.complexity
    }
  };
}
```

### Settings.json Integration
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "node src/oversight/pre-task-validation-hook.js --agent-id=${AGENT_ID} --task='{{tool_input}}'"
          }
        ]
      }
    ],
    "PreEditFile": [
      {
        "hooks": [
          {
            "type": "command", 
            "command": "node src/oversight/sprint-context-validator.js validate ${AGENT_ID} 'File edit: {{tool_input.path}}'"
          }
        ]
      }
    ],
    "PreBash": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node src/oversight/agent-accountability-auditor.js audit ${AGENT_ID} 'Command execution: {{tool_input.command}}'"
          }
        ]
      }
    ]
  }
}
```

## Error Handling and Recovery

### Validation Failures
```javascript
// Handle different types of validation failures
const validationErrorHandlers = {
  'sprint-context-not-acknowledged': async (agentId) => {
    console.log(`🔄 Redirecting agent ${agentId} to sprint context acknowledgment`);
    return await initializeSprintContextAwareness(agentId);
  },
  
  'goal-alignment-insufficient': async (agentId, taskDescription) => {
    console.log(`🎯 Helping agent ${agentId} improve task alignment`);
    return await suggestTaskRefinements(agentId, taskDescription);
  },
  
  'capability-mismatch': async (agentId, taskDetails) => {
    console.log(`🤝 Suggesting collaboration for agent ${agentId}`);
    return await recommendCollaborativeApproach(agentId, taskDetails);
  },
  
  'historical-performance-concern': async (agentId) => {
    console.log(`📚 Providing additional guidance for agent ${agentId}`);
    return await providePerformanceGuidance(agentId);
  }
};
```

### Graceful Degradation
```javascript
// Allow execution with warnings in certain scenarios
const gracefulDegradationRules = [
  {
    condition: 'sprint-documentation-unavailable',
    fallback: 'use-cached-context',
    warning: 'Using cached sprint context - may be outdated'
  },
  {
    condition: 'validation-service-unavailable', 
    fallback: 'basic-validation-only',
    warning: 'Advanced validation unavailable - proceed with caution'
  },
  {
    condition: 'agent-history-unavailable',
    fallback: 'skip-historical-analysis',
    warning: 'Cannot assess historical performance'
  }
];
```

## Monitoring and Analytics

### Validation Metrics
```javascript
// Track validation effectiveness
const validationMetrics = {
  totalValidations: 0,
  passedValidations: 0,
  blockedTasks: 0,
  warningIssued: 0,
  averageAlignmentScore: 0,
  commonFailureReasons: {},
  agentPerformanceImpact: {},
  sprintObjectiveAchievement: 0.85
};
```

### Real-time Monitoring
```javascript
// Monitor validation system health
const validationHealthCheck = {
  sprintDocumentationAvailable: true,
  validationServiceResponsive: true,
  agentHistoryAccessible: true,
  lastValidationTimestamp: new Date().toISOString(),
  averageValidationTime: '1.2s',
  validationSuccessRate: 0.94
};
```

## Configuration and Customization

### Validation Thresholds
```javascript
const validationConfig = {
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
```

### Agent-Specific Rules
```javascript
const agentSpecificRules = {
  'senior-architect-agents': {
    relaxedGoalAlignment: true,
    autonomyLevel: 'high',
    oversightRequired: false
  },
  'junior-developer-agents': {
    stricterValidation: true,
    autonomyLevel: 'supervised',
    oversightRequired: true
  },
  'specialist-agents': {
    domainExpertise: true,
    crossDomainValidation: 'required'
  }
};
```

This pre-task validation system ensures that every agent operation is contextually aware and aligned with sprint objectives, while providing appropriate oversight and guidance based on agent capabilities and historical performance.
