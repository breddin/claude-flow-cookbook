#!/usr/bin/env node
/**
 * Recursive Sprint Accountability Engine
 * Integrates verification layer, ELO ranking, and critic-fixer cycles
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { VerificationLayer, AgentELORankingSystem, CriticFixerCycle } from './recursive-learning-core.js';

export class RecursiveSprintAccountabilityEngine {
  constructor(options = {}) {
    this.verificationLayer = new VerificationLayer(options.verificationMode || 'moderate');
    this.eloSystem = new AgentELORankingSystem();
    this.criticFixerCycle = new CriticFixerCycle();
    
    this.sprintMemory = new Map();
    this.agentPerformanceCache = new Map();
    this.continuousLearning = options.continuousLearning !== false;
    this.adaptiveThresholds = options.adaptiveThresholds !== false;
    
    this.stats = {
      totalTasks: 0,
      verificationsPassed: 0,
      verificationsBlocked: 0,
      improvementCycles: 0,
      agentsRanked: 0
    };

    console.log('🧠 Recursive Sprint Accountability Engine initialized');
    console.log(`   Verification mode: ${this.verificationLayer.mode}`);
    console.log(`   Continuous learning: ${this.continuousLearning ? 'enabled' : 'disabled'}`);
    console.log(`   Adaptive thresholds: ${this.adaptiveThresholds ? 'enabled' : 'disabled'}`);
  }

  async initialize() {
    console.log('🚀 Initializing Recursive Sprint Accountability Engine...');
    
    // Load persistent data
    await Promise.all([
      this.verificationLayer.loadVerificationMemory(),
      this.eloSystem.loadRankings(),
      this.loadSprintMemory(),
      this.loadEngineStats()
    ]);

    // Adaptive threshold adjustment based on historical performance
    if (this.adaptiveThresholds) {
      await this.adjustAdaptiveThresholds();
    }

    console.log('✅ Recursive Sprint Accountability Engine ready');
    this.logSystemStats();
  }

  async processAgentTask(agentId, taskData, sprintContext) {
    console.log(`\n🎯 Processing task for agent ${agentId}`);
    this.stats.totalTasks++;

    const processingResult = {
      agentId,
      taskId: taskData.id || `task_${Date.now()}`,
      timestamp: new Date().toISOString(),
      phases: {
        verification: null,
        criticFixer: null,
        eloUpdate: null
      },
      finalResult: null,
      improvements: []
    };

    try {
      // Phase 1: Verification Layer - "Truth is enforced, not assumed"
      console.log('📋 Phase 1: Verification enforcement');
      const verificationResult = await this.verificationLayer.enforceVerification(taskData, sprintContext);
      processingResult.phases.verification = verificationResult;

      if (!verificationResult.verified) {
        this.stats.verificationsBlocked++;
        console.log('🚫 Task blocked by verification layer');
        
        // Generate improvement suggestions using critic-fixer cycle
        const improvementSuggestions = await this.generateImprovementSuggestions(
          taskData, 
          sprintContext, 
          verificationResult
        );
        
        processingResult.improvements = improvementSuggestions;
        processingResult.finalResult = {
          status: 'blocked',
          reason: 'verification_failed',
          verificationScore: verificationResult.score,
          improvementGuidance: verificationResult.checks,
          suggestions: improvementSuggestions
        };

        // Update ELO with negative performance
        await this.updateAgentELO(agentId, {
          completed: false,
          quality: verificationResult.score,
          onTime: false,
          complexity: taskData.complexity || 0.5
        }, { overallCompliance: verificationResult.score });

        return processingResult;
      }

      this.stats.verificationsPassed++;
      console.log('✅ Task passed verification layer');

      // Phase 2: Critic-Fixer Enhancement (if continuous learning enabled)
      if (this.continuousLearning && taskData.solutions && taskData.solutions.length > 1) {
        console.log('📋 Phase 2: Critic-fixer cycle enhancement');
        
        const criticFixerResult = await this.criticFixerCycle.evaluateAndImprove(
          taskData.solutions,
          {
            sprintGoals: sprintContext.goals || [],
            constraints: sprintContext.constraints || [],
            qualityStandards: sprintContext.qualityStandards || {}
          }
        );
        
        processingResult.phases.criticFixer = criticFixerResult;
        this.stats.improvementCycles++;
        
        // Use improved solutions if available
        if (criticFixerResult.finalSolutions.length > 0) {
          taskData.solutions = criticFixerResult.finalSolutions;
          taskData.enhanced = true;
          taskData.improvementCycles = criticFixerResult.cycles;
          console.log(`✨ Solutions enhanced through ${criticFixerResult.cycles} critic-fixer cycles`);
        }
      }

      // Phase 3: ELO Rating Update
      console.log('📋 Phase 3: ELO rating update');
      const sprintCompliance = await this.calculateSprintCompliance(taskData, sprintContext);
      const eloUpdate = await this.updateAgentELO(agentId, {
        completed: true,
        quality: verificationResult.score,
        onTime: true, // Assume on-time if it passed verification
        complexity: taskData.complexity || 0.5,
        innovative: taskData.enhanced || false,
        documentation: !!(taskData.documentation),
        helpedOthers: !!(taskData.collaboration)
      }, sprintCompliance);

      processingResult.phases.eloUpdate = eloUpdate;
      this.stats.agentsRanked++;

      // Phase 4: Continuous Learning Update
      if (this.continuousLearning) {
        await this.updateContinuousLearning(agentId, taskData, verificationResult, sprintCompliance);
      }

      processingResult.finalResult = {
        status: 'approved',
        verificationScore: verificationResult.score,
        eloRating: eloUpdate.newRating,
        performanceClass: eloUpdate.performanceClass,
        sprintCompliance: sprintCompliance.overallCompliance,
        enhanced: taskData.enhanced || false
      };

      console.log(`✅ Task approved for agent ${agentId} (Rating: ${eloUpdate.newRating.toFixed(0)})`);

      return processingResult;

    } catch (error) {
      console.error(`❌ Error processing task for agent ${agentId}:`, error);
      processingResult.finalResult = {
        status: 'error',
        error: error.message
      };
      return processingResult;
    }
  }

  async generateImprovementSuggestions(taskData, sprintContext, verificationResult) {
    console.log('💡 Generating improvement suggestions...');
    
    // Use critic-fixer cycle to generate better alternatives
    const alternativeSolutions = await this.generateAlternativeSolutions(taskData, sprintContext);
    
    if (alternativeSolutions.length > 0) {
      const criticFixerResult = await this.criticFixerCycle.evaluateAndImprove(
        alternativeSolutions,
        {
          sprintGoals: sprintContext.goals || [],
          constraints: sprintContext.constraints || [],
          qualityStandards: sprintContext.qualityStandards || {}
        }
      );

      return {
        type: 'alternative_solutions',
        count: criticFixerResult.finalSolutions.length,
        solutions: criticFixerResult.finalSolutions.slice(0, 3), // Top 3 alternatives
        improvementCycles: criticFixerResult.cycles,
        averageImprovement: criticFixerResult.avgImprovement
      };
    }

    // Fallback to verification-based suggestions
    return {
      type: 'verification_guidance',
      guidance: verificationResult.checks,
      recommendedActions: this.generateVerificationGuidance(verificationResult)
    };
  }

  async generateAlternativeSolutions(taskData, sprintContext) {
    // Generate alternative approaches based on task type and sprint context
    const alternatives = [];
    
    const baseApproach = {
      description: taskData.description || 'Task implementation',
      type: taskData.type || 'implementation',
      complexity: (taskData.complexity || 0.5) * 0.8, // Slightly simpler
      technicalDetails: 'Simplified approach focusing on core requirements',
      architecture: { pattern: 'layered', complexity: 'moderate' },
      testing: { strategy: 'unit_tests', coverage: 'basic' }
    };

    // Alternative 1: Conservative approach
    alternatives.push({
      ...baseApproach,
      name: 'Conservative Implementation',
      complexity: (taskData.complexity || 0.5) * 0.6,
      risks: [
        { risk: 'Technical debt', mitigation: 'Planned refactoring phase' }
      ]
    });

    // Alternative 2: Balanced approach
    alternatives.push({
      ...baseApproach,
      name: 'Balanced Implementation',
      complexity: taskData.complexity || 0.5,
      architecture: { pattern: 'microservices', complexity: 'moderate' },
      testing: { strategy: 'comprehensive', coverage: 'high' }
    });

    // Alternative 3: Innovative approach (if sprint allows)
    if (sprintContext.allowInnovation !== false) {
      alternatives.push({
        ...baseApproach,
        name: 'Innovative Implementation',
        complexity: (taskData.complexity || 0.5) * 1.2,
        innovative: { features: true },
        novel: { approach: true },
        risks: [
          { risk: 'New technology adoption', mitigation: 'Proof of concept first' },
          { risk: 'Timeline uncertainty', mitigation: 'Agile iterations' }
        ]
      });
    }

    return alternatives;
  }

  generateVerificationGuidance(verificationResult) {
    const actions = [];
    
    Object.entries(verificationResult.checks).forEach(([checkName, checkResult]) => {
      if (!checkResult.passed) {
        switch (checkName) {
          case 'sprintAlignment':
            actions.push('Review sprint goals and align task objectives');
            actions.push('Include specific sprint goal references in task description');
            break;
          case 'qualityStandards':
            actions.push('Provide detailed task description (minimum 50 characters)');
            actions.push('Specify valid task type and complexity estimate');
            break;
          case 'crossAgentConsistency':
            actions.push('Review recent team outputs for consistency patterns');
            actions.push('Align with established team conventions');
            break;
          case 'historicalCompliance':
            actions.push('Study successful similar tasks from history');
            actions.push('Apply proven patterns and approaches');
            break;
          case 'contextAccuracy':
            actions.push('Verify understanding of sprint requirements');
            actions.push('Include references to specific context elements');
            break;
        }
      }
    });

    return actions;
  }

  async updateAgentELO(agentId, taskResult, sprintCompliance) {
    return await this.eloSystem.updateAgentRating(agentId, taskResult, sprintCompliance);
  }

  async calculateSprintCompliance(taskData, sprintContext) {
    let compliance = 0;
    const factors = {};

    // Goal alignment
    if (sprintContext.goals && sprintContext.goals.length > 0) {
      factors.goalAlignment = this.calculateGoalAlignment(taskData, sprintContext.goals);
      compliance += factors.goalAlignment * 0.4;
    } else {
      factors.goalAlignment = 0.8; // Default if no goals
      compliance += 0.32;
    }

    // Constraint adherence
    if (sprintContext.constraints) {
      factors.constraintAdherence = this.calculateConstraintAdherence(taskData, sprintContext.constraints);
      compliance += factors.constraintAdherence * 0.3;
    } else {
      factors.constraintAdherence = 0.9; // Default if no constraints
      compliance += 0.27;
    }

    // Quality standards
    if (sprintContext.qualityStandards) {
      factors.qualityCompliance = this.calculateQualityCompliance(taskData, sprintContext.qualityStandards);
      compliance += factors.qualityCompliance * 0.3;
    } else {
      factors.qualityCompliance = 0.8; // Default
      compliance += 0.24;
    }

    return {
      overallCompliance: Math.min(1.0, compliance),
      factors: factors
    };
  }

  calculateGoalAlignment(taskData, goals) {
    const taskKeywords = this.extractKeywords(taskData.description || '');
    const goalKeywords = goals.flatMap(goal => this.extractKeywords(goal));
    
    if (goalKeywords.length === 0) return 0.8;
    
    const matches = taskKeywords.filter(keyword => goalKeywords.includes(keyword));
    return Math.min(1.0, matches.length / (goalKeywords.length * 0.3));
  }

  calculateConstraintAdherence(taskData, constraints) {
    // Simple constraint checking
    let adherence = 1.0;
    
    if (constraints.maxComplexity && taskData.complexity > constraints.maxComplexity) {
      adherence -= 0.3;
    }
    
    if (constraints.requiredPatterns) {
      const hasRequiredPatterns = constraints.requiredPatterns.every(pattern =>
        (taskData.architecture && JSON.stringify(taskData.architecture).includes(pattern))
      );
      if (!hasRequiredPatterns) adherence -= 0.2;
    }

    return Math.max(0, adherence);
  }

  calculateQualityCompliance(taskData, qualityStandards) {
    let compliance = 0;

    if (qualityStandards.requireTesting && taskData.testing) compliance += 0.3;
    if (qualityStandards.requireDocumentation && taskData.documentation) compliance += 0.3;
    if (qualityStandards.requireArchitecture && taskData.architecture) compliance += 0.2;
    if (qualityStandards.minimumComplexity && taskData.complexity >= qualityStandards.minimumComplexity) compliance += 0.2;

    return Math.min(1.0, compliance + 0.5); // Base 0.5 + quality factors
  }

  async updateContinuousLearning(agentId, taskData, verificationResult, sprintCompliance) {
    // Store learning data for future improvements
    const learningData = {
      agentId,
      timestamp: new Date().toISOString(),
      taskType: taskData.type,
      complexity: taskData.complexity,
      verificationScore: verificationResult.score,
      sprintCompliance: sprintCompliance.overallCompliance,
      successful: verificationResult.verified,
      improvements: taskData.enhanced || false
    };

    // Update agent performance cache
    if (!this.agentPerformanceCache.has(agentId)) {
      this.agentPerformanceCache.set(agentId, []);
    }

    const agentHistory = this.agentPerformanceCache.get(agentId);
    agentHistory.push(learningData);

    // Keep only last 50 records per agent
    if (agentHistory.length > 50) {
      agentHistory.splice(0, agentHistory.length - 50);
    }

    this.agentPerformanceCache.set(agentId, agentHistory);
  }

  async adjustAdaptiveThresholds() {
    console.log('🎛️  Adjusting adaptive thresholds based on historical performance...');
    
    const verificationStats = this.verificationLayer.getStats();
    
    if (verificationStats.totalVerifications > 50) {
      const successRate = verificationStats.successRate;
      
      if (successRate > 0.9) {
        // Too many passing - increase difficulty
        if (this.verificationLayer.mode === 'dev') {
          this.verificationLayer.mode = 'moderate';
          console.log('📈 Increased verification mode to moderate (high success rate)');
        } else if (this.verificationLayer.mode === 'moderate') {
          this.verificationLayer.mode = 'strict';
          console.log('📈 Increased verification mode to strict (high success rate)');
        }
      } else if (successRate < 0.6) {
        // Too many failing - decrease difficulty
        if (this.verificationLayer.mode === 'strict') {
          this.verificationLayer.mode = 'moderate';
          console.log('📉 Decreased verification mode to moderate (low success rate)');
        } else if (this.verificationLayer.mode === 'moderate') {
          this.verificationLayer.mode = 'dev';
          console.log('📉 Decreased verification mode to dev (low success rate)');
        }
      }
    }
  }

  extractKeywords(text) {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 20);
  }

  async loadSprintMemory() {
    try {
      const memoryFile = join(process.cwd(), '.claude', 'oversight', 'sprint-memory.json');
      const data = JSON.parse(await readFile(memoryFile, 'utf8'));
      
      this.sprintMemory = new Map(data.sprintMemory || []);
      console.log(`📚 Loaded sprint memory: ${this.sprintMemory.size} sprints`);
    } catch (error) {
      console.log('📚 No existing sprint memory found, starting fresh');
    }
  }

  async loadEngineStats() {
    try {
      const statsFile = join(process.cwd(), '.claude', 'oversight', 'engine-stats.json');
      const data = JSON.parse(await readFile(statsFile, 'utf8'));
      
      this.stats = { ...this.stats, ...data.stats };
      console.log(`📊 Loaded engine stats: ${this.stats.totalTasks} total tasks processed`);
    } catch (error) {
      console.log('📊 No existing engine stats found, starting fresh');
    }
  }

  async persistEngineData() {
    try {
      // Save sprint memory
      const sprintMemoryData = {
        sprintMemory: Array.from(this.sprintMemory.entries()),
        lastUpdated: new Date().toISOString()
      };

      await writeFile(
        join(process.cwd(), '.claude', 'oversight', 'sprint-memory.json'),
        JSON.stringify(sprintMemoryData, null, 2)
      );

      // Save engine stats
      const statsData = {
        stats: this.stats,
        lastUpdated: new Date().toISOString()
      };

      await writeFile(
        join(process.cwd(), '.claude', 'oversight', 'engine-stats.json'),
        JSON.stringify(statsData, null, 2)
      );

      console.log('💾 Engine data persisted');
    } catch (error) {
      console.warn('⚠️  Could not persist engine data:', error.message);
    }
  }

  logSystemStats() {
    console.log('\n📊 Recursive Sprint Accountability Engine Stats:');
    console.log(`   Total tasks processed: ${this.stats.totalTasks}`);
    console.log(`   Verifications passed: ${this.stats.verificationsPassed}`);
    console.log(`   Verifications blocked: ${this.stats.verificationsBlocked}`);
    console.log(`   Improvement cycles: ${this.stats.improvementCycles}`);
    console.log(`   Agents ranked: ${this.stats.agentsRanked}`);
    
    const verificationStats = this.verificationLayer.getStats();
    console.log(`   Verification success rate: ${(verificationStats.successRate * 100).toFixed(1)}%`);
    console.log(`   Current verification mode: ${verificationStats.mode}`);
    
    const topPerformers = this.eloSystem.getTopPerformers(3);
    if (topPerformers.length > 0) {
      console.log('   Top performers:');
      topPerformers.forEach((performer, index) => {
        console.log(`     ${index + 1}. ${performer.agentId} (${performer.rating}, ${performer.performanceClass})`);
      });
    }
    console.log('');
  }

  async getAgentRecommendations(agentId) {
    const agentStats = this.eloSystem.getAgentStats(agentId);
    const agentHistory = this.agentPerformanceCache.get(agentId) || [];
    
    const recommendations = {
      agentId,
      currentRating: agentStats.currentRating,
      performanceClass: agentStats.performanceClass,
      trending: agentStats.trending,
      recommendations: []
    };

    // Analyze recent performance patterns
    const recentTasks = agentHistory.slice(-10);
    
    if (recentTasks.length > 0) {
      const avgVerificationScore = recentTasks.reduce((sum, task) => sum + task.verificationScore, 0) / recentTasks.length;
      const avgCompliance = recentTasks.reduce((sum, task) => sum + task.sprintCompliance, 0) / recentTasks.length;
      
      if (avgVerificationScore < 0.7) {
        recommendations.recommendations.push('Focus on improving verification scores through better sprint alignment');
      }
      
      if (avgCompliance < 0.7) {
        recommendations.recommendations.push('Review sprint compliance patterns and improve goal alignment');
      }
      
      const taskTypes = [...new Set(recentTasks.map(task => task.taskType))];
      if (taskTypes.length === 1) {
        recommendations.recommendations.push(`Consider diversifying task types beyond ${taskTypes[0]}`);
      }
    }

    // Performance-based recommendations
    if (agentStats.currentRating < 1400) {
      recommendations.recommendations.push('Focus on completing basic tasks successfully to build rating');
    } else if (agentStats.currentRating > 1800) {
      recommendations.recommendations.push('Consider taking on more complex, innovative tasks');
    }

    return recommendations;
  }

  async shutdown() {
    console.log('🔄 Shutting down Recursive Sprint Accountability Engine...');
    
    await Promise.all([
      this.verificationLayer.persistVerificationMemory(),
      this.eloSystem.persistRankings(),
      this.persistEngineData()
    ]);

    this.logSystemStats();
    console.log('✅ Recursive Sprint Accountability Engine shutdown complete');
  }
}

export default RecursiveSprintAccountabilityEngine;
