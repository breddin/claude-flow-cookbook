#!/usr/bin/env node
/**
 * Recursive Learning Enhancement for Sprint Accountability
 * Implements critic-fixer cycles, ELO ranking, and verification layers
 */

import { readFile, writeFile, access, mkdir } from 'fs/promises';
import { join } from 'path';

/**
 * Verification Layer - "Truth is enforced, not assumed"
 */
export class VerificationLayer {
  constructor(mode = 'moderate') {
    this.mode = mode; // strict, moderate, dev
    this.verificationMemory = new Map();
    this.successPatterns = new Map();
    this.rollbackHistory = [];
    
    this.thresholds = {
      strict: 0.9,
      moderate: 0.7,
      dev: 0.5
    };
  }

  async enforceVerification(agentOutput, sprintContext) {
    const verificationId = `verify_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`🔍 Verification Layer: Enforcing verification (mode: ${this.mode})`);
    
    const verificationChecks = {
      sprintAlignment: await this.verifySprintAlignment(agentOutput, sprintContext),
      qualityStandards: await this.verifyQualityStandards(agentOutput),
      crossAgentConsistency: await this.verifyCrossAgentConsistency(agentOutput),
      historicalCompliance: await this.verifyHistoricalCompliance(agentOutput),
      contextAccuracy: await this.verifyContextAccuracy(agentOutput, sprintContext)
    };

    const verificationScore = this.calculateVerificationScore(verificationChecks);
    const threshold = this.thresholds[this.mode];
    
    const result = {
      verificationId,
      timestamp: new Date().toISOString(),
      mode: this.mode,
      score: verificationScore,
      threshold,
      verified: verificationScore >= threshold,
      checks: verificationChecks,
      agentOutput,
      sprintContext
    };

    if (!result.verified) {
      console.log(`🚫 Verification failed (${verificationScore.toFixed(3)} < ${threshold})`);
      await this.triggerRollback(result);
      this.rollbackHistory.push(result);
    } else {
      console.log(`✅ Verification passed (${verificationScore.toFixed(3)} >= ${threshold})`);
      await this.storeSuccessPattern(result);
    }

    // Store verification result
    this.verificationMemory.set(verificationId, result);
    await this.persistVerificationMemory();

    return result;
  }

  async verifySprintAlignment(agentOutput, sprintContext) {
    // Check if agent output aligns with sprint goals
    const sprintGoals = sprintContext.goals || [];
    const outputKeywords = this.extractKeywords(agentOutput.description || '');
    const goalKeywords = sprintGoals.flatMap(goal => this.extractKeywords(goal));
    
    const alignmentScore = this.calculateKeywordAlignment(outputKeywords, goalKeywords);
    
    return {
      score: alignmentScore,
      passed: alignmentScore > 0.6,
      details: {
        outputKeywords: outputKeywords.slice(0, 10),
        goalKeywords: goalKeywords.slice(0, 10),
        alignmentScore
      }
    };
  }

  async verifyQualityStandards(agentOutput) {
    // Verify against quality standards
    const qualityChecks = {
      hasDescription: !!(agentOutput.description && agentOutput.description.length > 10),
      hasValidType: !!(agentOutput.type && ['implementation', 'debugging', 'analysis', 'documentation'].includes(agentOutput.type)),
      hasComplexityEstimate: !!(agentOutput.complexity && agentOutput.complexity >= 0 && agentOutput.complexity <= 1),
      hasProperStructure: this.validateOutputStructure(agentOutput)
    };

    const qualityScore = Object.values(qualityChecks).filter(Boolean).length / Object.keys(qualityChecks).length;

    return {
      score: qualityScore,
      passed: qualityScore > 0.75,
      details: qualityChecks
    };
  }

  async verifyCrossAgentConsistency(agentOutput) {
    // Check consistency with other agent outputs
    const recentOutputs = Array.from(this.verificationMemory.values())
      .filter(v => v.verified && Date.now() - new Date(v.timestamp).getTime() < 24 * 60 * 60 * 1000)
      .map(v => v.agentOutput);

    if (recentOutputs.length === 0) {
      return { score: 1.0, passed: true, details: { reason: 'No recent outputs to compare' } };
    }

    // Simple consistency check based on task types and complexity
    const consistencyScore = this.calculateConsistencyScore(agentOutput, recentOutputs);

    return {
      score: consistencyScore,
      passed: consistencyScore > 0.5,
      details: {
        comparedOutputs: recentOutputs.length,
        consistencyFactors: ['type', 'complexity', 'description_similarity']
      }
    };
  }

  async verifyHistoricalCompliance(agentOutput) {
    // Check against historical compliance patterns
    const successPattern = this.successPatterns.get(agentOutput.type) || null;
    
    if (!successPattern) {
      return { score: 0.8, passed: true, details: { reason: 'No historical pattern available' } };
    }

    const complianceScore = this.calculateHistoricalCompliance(agentOutput, successPattern);

    return {
      score: complianceScore,
      passed: complianceScore > 0.6,
      details: {
        historicalPattern: successPattern.summary,
        complianceFactors: ['complexity_range', 'description_patterns', 'success_indicators']
      }
    };
  }

  async verifyContextAccuracy(agentOutput, sprintContext) {
    // Verify the accuracy of sprint context understanding
    const contextElements = [
      'goals', 'requirements', 'constraints', 'acceptance_criteria'
    ];

    let accuracyScore = 0;
    const details = {};

    for (const element of contextElements) {
      if (sprintContext[element]) {
        const elementScore = this.calculateContextElementAccuracy(agentOutput, sprintContext[element]);
        accuracyScore += elementScore;
        details[element] = elementScore;
      }
    }

    accuracyScore = accuracyScore / contextElements.length;

    return {
      score: accuracyScore,
      passed: accuracyScore > 0.6,
      details
    };
  }

  calculateVerificationScore(checks) {
    const scores = Object.values(checks).map(check => check.score);
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  async triggerRollback(verificationResult) {
    console.log(`🔄 Triggering rollback for verification ${verificationResult.verificationId}`);
    
    // Generate improvement guidance based on failed checks
    const guidance = this.generateImprovementGuidance(verificationResult);
    
    const rollbackAction = {
      verificationId: verificationResult.verificationId,
      timestamp: new Date().toISOString(),
      failedChecks: Object.entries(verificationResult.checks)
        .filter(([_, check]) => !check.passed)
        .map(([name, check]) => ({ name, score: check.score, details: check.details })),
      improvementGuidance: guidance,
      requiresReexecution: true
    };

    console.log('📋 Improvement Guidance:');
    guidance.forEach(item => console.log(`   • ${item}`));

    return rollbackAction;
  }

  generateImprovementGuidance(verificationResult) {
    const guidance = [];
    const { checks } = verificationResult;

    if (!checks.sprintAlignment.passed) {
      guidance.push(`Improve sprint alignment (${(checks.sprintAlignment.score * 100).toFixed(1)}%) - Review sprint goals and ensure task directly supports them`);
    }

    if (!checks.qualityStandards.passed) {
      guidance.push(`Enhance quality standards (${(checks.qualityStandards.score * 100).toFixed(1)}%) - Provide detailed description, proper type, and complexity estimate`);
    }

    if (!checks.crossAgentConsistency.passed) {
      guidance.push(`Improve consistency with team (${(checks.crossAgentConsistency.score * 100).toFixed(1)}%) - Review recent agent outputs for alignment`);
    }

    if (!checks.historicalCompliance.passed) {
      guidance.push(`Learn from historical patterns (${(checks.historicalCompliance.score * 100).toFixed(1)}%) - Study successful similar tasks`);
    }

    if (!checks.contextAccuracy.passed) {
      guidance.push(`Improve context accuracy (${(checks.contextAccuracy.score * 100).toFixed(1)}%) - Verify understanding of sprint context`);
    }

    return guidance;
  }

  async storeSuccessPattern(verificationResult) {
    const { agentOutput } = verificationResult;
    const type = agentOutput.type || 'general';
    
    if (!this.successPatterns.has(type)) {
      this.successPatterns.set(type, {
        count: 0,
        examples: [],
        summary: {
          avgComplexity: 0,
          commonKeywords: [],
          successFactors: []
        }
      });
    }

    const pattern = this.successPatterns.get(type);
    pattern.count++;
    pattern.examples.push({
      timestamp: verificationResult.timestamp,
      score: verificationResult.score,
      output: agentOutput
    });

    // Keep only last 10 examples
    if (pattern.examples.length > 10) {
      pattern.examples = pattern.examples.slice(-10);
    }

    // Update summary
    pattern.summary = this.calculatePatternSummary(pattern.examples);
    this.successPatterns.set(type, pattern);
  }

  calculatePatternSummary(examples) {
    const avgComplexity = examples.reduce((sum, ex) => sum + (ex.output.complexity || 0), 0) / examples.length;
    
    const allKeywords = examples.flatMap(ex => this.extractKeywords(ex.output.description || ''));
    const keywordCounts = {};
    allKeywords.forEach(keyword => {
      keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
    });
    
    const commonKeywords = Object.entries(keywordCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([keyword]) => keyword);

    return {
      avgComplexity,
      commonKeywords,
      successFactors: ['proper_documentation', 'complexity_estimation', 'sprint_alignment']
    };
  }

  extractKeywords(text) {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 20);
  }

  calculateKeywordAlignment(outputKeywords, goalKeywords) {
    if (goalKeywords.length === 0) return 0.5;
    
    const matches = outputKeywords.filter(keyword => goalKeywords.includes(keyword));
    return matches.length / Math.max(outputKeywords.length, goalKeywords.length, 1);
  }

  validateOutputStructure(output) {
    const requiredFields = ['description', 'type'];
    return requiredFields.every(field => output[field] !== undefined);
  }

  calculateConsistencyScore(output, recentOutputs) {
    if (recentOutputs.length === 0) return 1.0;

    let consistencyScore = 0;
    let factors = 0;

    // Type consistency
    const sameTypeOutputs = recentOutputs.filter(recent => recent.type === output.type);
    consistencyScore += (sameTypeOutputs.length / recentOutputs.length) * 0.3;
    factors += 0.3;

    // Complexity consistency  
    const avgComplexity = recentOutputs.reduce((sum, recent) => sum + (recent.complexity || 0), 0) / recentOutputs.length;
    const complexityDiff = Math.abs((output.complexity || 0) - avgComplexity);
    consistencyScore += Math.max(0, 1 - complexityDiff * 2) * 0.4;
    factors += 0.4;

    // Description similarity
    const outputKeywords = this.extractKeywords(output.description || '');
    const recentKeywords = recentOutputs.flatMap(recent => this.extractKeywords(recent.description || ''));
    const similarity = this.calculateKeywordAlignment(outputKeywords, recentKeywords);
    consistencyScore += similarity * 0.3;
    factors += 0.3;

    return consistencyScore / factors;
  }

  calculateHistoricalCompliance(output, pattern) {
    let complianceScore = 0;

    // Complexity range compliance
    const complexityInRange = Math.abs((output.complexity || 0) - pattern.summary.avgComplexity) < 0.3;
    complianceScore += complexityInRange ? 0.4 : 0;

    // Keyword pattern compliance
    const outputKeywords = this.extractKeywords(output.description || '');
    const commonKeywordMatches = outputKeywords.filter(keyword => 
      pattern.summary.commonKeywords.includes(keyword)
    );
    complianceScore += (commonKeywordMatches.length / Math.max(pattern.summary.commonKeywords.length, 1)) * 0.4;

    // Structure compliance (always good if we got this far)
    complianceScore += 0.2;

    return complianceScore;
  }

  calculateContextElementAccuracy(output, contextElement) {
    // Simple accuracy check based on keyword presence
    const outputKeywords = this.extractKeywords(output.description || '');
    const contextKeywords = this.extractKeywords(JSON.stringify(contextElement));
    
    return this.calculateKeywordAlignment(outputKeywords, contextKeywords);
  }

  async persistVerificationMemory() {
    try {
      const memoryDir = join(process.cwd(), '.claude', 'verification');
      await mkdir(memoryDir, { recursive: true });
      
      const memoryData = {
        verificationMemory: Array.from(this.verificationMemory.entries()),
        successPatterns: Array.from(this.successPatterns.entries()),
        rollbackHistory: this.rollbackHistory.slice(-50), // Keep last 50
        lastUpdated: new Date().toISOString()
      };

      await writeFile(
        join(memoryDir, 'verification-memory.json'),
        JSON.stringify(memoryData, null, 2)
      );
    } catch (error) {
      console.warn('⚠️  Could not persist verification memory:', error.message);
    }
  }

  async loadVerificationMemory() {
    try {
      const memoryFile = join(process.cwd(), '.claude', 'verification', 'verification-memory.json');
      const data = JSON.parse(await readFile(memoryFile, 'utf8'));
      
      this.verificationMemory = new Map(data.verificationMemory || []);
      this.successPatterns = new Map(data.successPatterns || []);
      this.rollbackHistory = data.rollbackHistory || [];
      
      console.log(`📚 Loaded verification memory: ${this.verificationMemory.size} records`);
    } catch (error) {
      console.log('📚 No existing verification memory found, starting fresh');
    }
  }

  getStats() {
    const totalVerifications = this.verificationMemory.size;
    const successfulVerifications = Array.from(this.verificationMemory.values())
      .filter(v => v.verified).length;
    const rollbacks = this.rollbackHistory.length;
    
    return {
      totalVerifications,
      successfulVerifications,
      rollbacks,
      successRate: totalVerifications > 0 ? successfulVerifications / totalVerifications : 0,
      patterns: this.successPatterns.size,
      mode: this.mode
    };
  }
}

/**
 * ELO Ranking System for Agent Performance
 */
export class AgentELORankingSystem {
  constructor() {
    this.agentRatings = new Map();
    this.performanceHistory = new Map();
    this.taskComplexityRatings = new Map();
    this.initialRating = 1500;
    this.kFactor = 32;
  }

  async updateAgentRating(agentId, taskResult, sprintCompliance) {
    const currentRating = this.agentRatings.get(agentId) || this.initialRating;
    
    // Calculate expected performance based on task complexity and agent rating
    const taskComplexity = taskResult.complexity || 0.5;
    const expectedScore = this.calculateExpectedScore(currentRating, taskComplexity);
    
    // Calculate actual performance score
    const actualScore = this.calculateActualScore(taskResult, sprintCompliance);
    
    // ELO rating update
    const ratingChange = this.kFactor * (actualScore - expectedScore);
    const newRating = Math.max(800, Math.min(2400, currentRating + ratingChange));
    
    // Update rating
    this.agentRatings.set(agentId, newRating);
    
    // Store performance history
    await this.storePerformanceHistory(agentId, {
      timestamp: new Date().toISOString(),
      previousRating: currentRating,
      newRating: newRating,
      ratingChange: ratingChange,
      taskResult: taskResult,
      sprintCompliance: sprintCompliance,
      expectedScore: expectedScore,
      actualScore: actualScore
    });

    const performanceClass = this.classifyPerformance(newRating);
    
    console.log(`🏆 Agent ${agentId} rating: ${currentRating.toFixed(0)} → ${newRating.toFixed(0)} (${ratingChange > 0 ? '+' : ''}${ratingChange.toFixed(0)}) [${performanceClass}]`);

    return {
      agentId,
      previousRating: currentRating,
      newRating: newRating,
      ratingChange: ratingChange,
      performanceClass: performanceClass,
      expectedScore: expectedScore,
      actualScore: actualScore,
      improvement: ratingChange > 0
    };
  }

  calculateExpectedScore(agentRating, taskComplexity) {
    // Expected score based on agent capability vs task difficulty
    // Higher rated agents expected to perform better on complex tasks
    const taskDifficultyRating = 1500 + (taskComplexity - 0.5) * 800; // Scale complexity to ELO range
    const ratingDifference = agentRating - taskDifficultyRating;
    
    // Standard ELO expected score formula
    return 1 / (1 + Math.pow(10, -ratingDifference / 400));
  }

  calculateActualScore(taskResult, sprintCompliance) {
    let score = 0;

    // Task completion quality (40%)
    if (taskResult.completed) score += 0.4;
    if (taskResult.quality && taskResult.quality > 0.8) score += 0.1;
    if (taskResult.onTime) score += 0.1;

    // Sprint compliance (40%)
    if (sprintCompliance.overallCompliance) {
      score += sprintCompliance.overallCompliance * 0.4;
    }

    // Bonus factors (20%)
    if (taskResult.innovative) score += 0.1;
    if (taskResult.helpedOthers) score += 0.05;
    if (taskResult.documentation) score += 0.05;

    return Math.max(0, Math.min(1, score));
  }

  classifyPerformance(rating) {
    if (rating >= 2200) return 'Master';
    if (rating >= 2000) return 'Expert';
    if (rating >= 1800) return 'Advanced';
    if (rating >= 1600) return 'Intermediate';
    if (rating >= 1400) return 'Developing';
    if (rating >= 1200) return 'Novice';
    return 'Beginner';
  }

  async storePerformanceHistory(agentId, performanceData) {
    if (!this.performanceHistory.has(agentId)) {
      this.performanceHistory.set(agentId, []);
    }

    const history = this.performanceHistory.get(agentId);
    history.push(performanceData);

    // Keep only last 50 performance records
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }

    this.performanceHistory.set(agentId, history);
    await this.persistRankings();
  }

  async persistRankings() {
    try {
      const rankingDir = join(process.cwd(), '.claude', 'rankings');
      await mkdir(rankingDir, { recursive: true });
      
      const rankingData = {
        agentRatings: Array.from(this.agentRatings.entries()),
        performanceHistory: Array.from(this.performanceHistory.entries()),
        taskComplexityRatings: Array.from(this.taskComplexityRatings.entries()),
        lastUpdated: new Date().toISOString(),
        systemInfo: {
          initialRating: this.initialRating,
          kFactor: this.kFactor
        }
      };

      await writeFile(
        join(rankingDir, 'agent-rankings.json'),
        JSON.stringify(rankingData, null, 2)
      );
    } catch (error) {
      console.warn('⚠️  Could not persist agent rankings:', error.message);
    }
  }

  async loadRankings() {
    try {
      const rankingFile = join(process.cwd(), '.claude', 'rankings', 'agent-rankings.json');
      const data = JSON.parse(await readFile(rankingFile, 'utf8'));
      
      this.agentRatings = new Map(data.agentRatings || []);
      this.performanceHistory = new Map(data.performanceHistory || []);
      this.taskComplexityRatings = new Map(data.taskComplexityRatings || []);
      
      console.log(`🏆 Loaded agent rankings: ${this.agentRatings.size} agents`);
    } catch (error) {
      console.log('🏆 No existing rankings found, starting fresh');
    }
  }

  getTopPerformers(limit = 10) {
    return Array.from(this.agentRatings.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([agentId, rating]) => ({
        agentId,
        rating: rating.toFixed(0),
        performanceClass: this.classifyPerformance(rating)
      }));
  }

  getAgentStats(agentId) {
    const rating = this.agentRatings.get(agentId) || this.initialRating;
    const history = this.performanceHistory.get(agentId) || [];
    
    const recentHistory = history.slice(-10);
    const recentAvgRatingChange = recentHistory.length > 0 
      ? recentHistory.reduce((sum, h) => sum + h.ratingChange, 0) / recentHistory.length
      : 0;

    return {
      agentId,
      currentRating: rating.toFixed(0),
      performanceClass: this.classifyPerformance(rating),
      totalTasks: history.length,
      recentTasks: recentHistory.length,
      recentAvgRatingChange: recentAvgRatingChange.toFixed(1),
      trending: recentAvgRatingChange > 5 ? 'up' : recentAvgRatingChange < -5 ? 'down' : 'stable'
    };
  }
}

/**
 * Critic-Fixer Cycle Implementation
 */
export class CriticFixerCycle {
  constructor() {
    this.maxCycles = 3;
    this.improvementThreshold = 0.1;
  }

  async evaluateAndImprove(solutions, evaluationContext) {
    console.log(`🔄 Starting critic-fixer cycle with ${solutions.length} solutions`);
    
    let currentSolutions = [...solutions];
    let cycle = 0;
    let improvements = [];

    while (cycle < this.maxCycles) {
      cycle++;
      console.log(`   Cycle ${cycle}/${this.maxCycles}`);

      // Critic phase: Evaluate all solutions
      const criticResults = await this.criticPhase(currentSolutions, evaluationContext);
      
      // Fixer phase: Improve poor-performing solutions
      const fixedSolutions = await this.fixerPhase(criticResults, evaluationContext);
      
      // Check for improvements
      const improvement = this.calculateImprovement(criticResults, fixedSolutions);
      improvements.push(improvement);
      
      if (improvement.significantImprovement) {
        currentSolutions = fixedSolutions.map(fs => fs.solution);
        console.log(`   ✨ Cycle ${cycle} improved solutions by ${(improvement.avgImprovement * 100).toFixed(1)}%`);
      } else {
        console.log(`   ⏹️  Cycle ${cycle} converged (improvement < ${this.improvementThreshold})`);
        break;
      }
    }

    // Final evaluation
    const finalEvaluation = await this.criticPhase(currentSolutions, evaluationContext);

    return {
      originalSolutions: solutions,
      finalSolutions: currentSolutions,
      cycles: cycle,
      improvements: improvements,
      finalScores: finalEvaluation.map(cr => cr.score),
      avgImprovement: improvements.reduce((sum, imp) => sum + imp.avgImprovement, 0) / improvements.length
    };
  }

  async criticPhase(solutions, evaluationContext) {
    console.log(`     🔍 Critic phase: Evaluating ${solutions.length} solutions`);
    
    const evaluations = [];

    for (let i = 0; i < solutions.length; i++) {
      const solution = solutions[i];
      const evaluation = await this.evaluateSolution(solution, evaluationContext);
      
      evaluations.push({
        solutionIndex: i,
        solution: solution,
        score: evaluation.score,
        strengths: evaluation.strengths,
        weaknesses: evaluation.weaknesses,
        improvementAreas: evaluation.improvementAreas
      });
    }

    // Sort by score (best first)
    evaluations.sort((a, b) => b.score - a.score);
    
    console.log(`     📊 Scores: ${evaluations.map(e => e.score.toFixed(2)).join(', ')}`);
    
    return evaluations;
  }

  async fixerPhase(criticResults, evaluationContext) {
    console.log(`     🔧 Fixer phase: Improving solutions`);
    
    const fixedSolutions = [];

    for (const criticResult of criticResults) {
      if (criticResult.score < 0.8 && criticResult.improvementAreas.length > 0) {
        // Apply fixes to low-scoring solutions
        const improvedSolution = await this.applySolutionFixes(
          criticResult.solution, 
          criticResult.improvementAreas, 
          evaluationContext
        );
        
        // Re-evaluate improved solution
        const newEvaluation = await this.evaluateSolution(improvedSolution, evaluationContext);
        
        fixedSolutions.push({
          originalScore: criticResult.score,
          improvedScore: newEvaluation.score,
          improvement: newEvaluation.score - criticResult.score,
          solution: improvedSolution,
          appliedFixes: criticResult.improvementAreas
        });
        
        if (newEvaluation.score > criticResult.score) {
          console.log(`     ⬆️  Solution ${criticResult.solutionIndex}: ${criticResult.score.toFixed(2)} → ${newEvaluation.score.toFixed(2)}`);
        }
      } else {
        // Keep high-scoring solutions as-is
        fixedSolutions.push({
          originalScore: criticResult.score,
          improvedScore: criticResult.score,
          improvement: 0,
          solution: criticResult.solution,
          appliedFixes: []
        });
      }
    }

    return fixedSolutions;
  }

  async evaluateSolution(solution, evaluationContext) {
    // Multi-factor solution evaluation
    const factors = {
      sprintAlignment: this.evaluateSprintAlignment(solution, evaluationContext),
      technicalQuality: this.evaluateTechnicalQuality(solution),
      implementationFeasibility: this.evaluateImplementationFeasibility(solution),
      riskAssessment: this.evaluateRiskAssessment(solution),
      innovationFactor: this.evaluateInnovationFactor(solution)
    };

    // Weighted scoring
    const weights = {
      sprintAlignment: 0.3,
      technicalQuality: 0.25,
      implementationFeasibility: 0.25,
      riskAssessment: 0.15,
      innovationFactor: 0.05
    };

    let totalScore = 0;
    const strengths = [];
    const weaknesses = [];
    const improvementAreas = [];

    for (const [factor, score] of Object.entries(factors)) {
      const weightedScore = score * weights[factor];
      totalScore += weightedScore;

      if (score > 0.8) {
        strengths.push(factor);
      } else if (score < 0.6) {
        weaknesses.push(factor);
        improvementAreas.push(factor);
      }
    }

    return {
      score: totalScore,
      factors: factors,
      strengths: strengths,
      weaknesses: weaknesses,
      improvementAreas: improvementAreas
    };
  }

  evaluateSprintAlignment(solution, evaluationContext) {
    // Evaluate how well solution aligns with sprint goals
    if (!evaluationContext.sprintGoals) return 0.7; // Default if no goals provided
    
    const solutionKeywords = this.extractSolutionKeywords(solution);
    const goalKeywords = evaluationContext.sprintGoals.flatMap(goal => 
      goal.toLowerCase().split(/\s+/).filter(word => word.length > 3)
    );

    const matchingKeywords = solutionKeywords.filter(keyword => goalKeywords.includes(keyword));
    return Math.min(1.0, matchingKeywords.length / Math.max(goalKeywords.length * 0.3, 1));
  }

  evaluateTechnicalQuality(solution) {
    // Evaluate technical soundness
    let score = 0.5; // Base score

    // Check for technical detail
    if (solution.technicalDetails && solution.technicalDetails.length > 50) score += 0.2;
    
    // Check for architecture consideration
    if (solution.architecture && Object.keys(solution.architecture).length > 0) score += 0.15;
    
    // Check for testing strategy
    if (solution.testing && solution.testing.strategy) score += 0.1;
    
    // Check for error handling
    if (solution.errorHandling) score += 0.05;

    return Math.min(1.0, score);
  }

  evaluateImplementationFeasibility(solution) {
    // Evaluate how realistic the implementation is
    let score = 0.6; // Base score

    // Complexity assessment
    if (solution.complexity && solution.complexity <= 0.7) score += 0.2;
    else if (solution.complexity && solution.complexity > 0.9) score -= 0.1;

    // Resource requirements
    if (solution.resourceRequirements && solution.resourceRequirements.realistic) score += 0.15;
    
    // Timeline feasibility
    if (solution.timeline && solution.timeline.realistic) score += 0.05;

    return Math.min(1.0, Math.max(0.1, score));
  }

  evaluateRiskAssessment(solution) {
    // Evaluate risk factors
    let score = 0.7; // Base score assuming moderate risk

    if (solution.risks) {
      const riskCount = solution.risks.length;
      const mitigationCount = solution.risks.filter(risk => risk.mitigation).length;
      
      if (riskCount === 0) score += 0.2; // No identified risks might be unrealistic
      else if (mitigationCount / riskCount > 0.8) score += 0.3; // Good risk management
      else if (mitigationCount / riskCount < 0.5) score -= 0.2; // Poor risk management
    }

    return Math.min(1.0, Math.max(0.1, score));
  }

  evaluateInnovationFactor(solution) {
    // Evaluate innovative aspects
    let score = 0.5; // Base score

    if (solution.innovative && solution.innovative.features) score += 0.3;
    if (solution.novel && solution.novel.approach) score += 0.2;

    return Math.min(1.0, score);
  }

  async applySolutionFixes(solution, improvementAreas, evaluationContext) {
    const improvedSolution = { ...solution };

    for (const area of improvementAreas) {
      switch (area) {
        case 'sprintAlignment':
          improvedSolution.sprintAlignmentEnhancement = await this.enhanceSprintAlignment(solution, evaluationContext);
          break;
        case 'technicalQuality':
          improvedSolution.technicalEnhancements = await this.enhanceTechnicalQuality(solution);
          break;
        case 'implementationFeasibility':
          improvedSolution.feasibilityImprovements = await this.enhanceFeasibility(solution);
          break;
        case 'riskAssessment':
          improvedSolution.riskMitigations = await this.enhanceRiskAssessment(solution);
          break;
        case 'innovationFactor':
          improvedSolution.innovativeEnhancements = await this.enhanceInnovation(solution);
          break;
      }
    }

    return improvedSolution;
  }

  async enhanceSprintAlignment(solution, evaluationContext) {
    return {
      alignmentStrategy: 'Enhanced alignment with sprint goals',
      specificGoalMapping: evaluationContext.sprintGoals || [],
      alignmentScore: 'improved'
    };
  }

  async enhanceTechnicalQuality(solution) {
    return {
      addedArchitecture: 'Layered architecture with clear separation of concerns',
      addedTesting: 'Unit tests, integration tests, and end-to-end testing strategy',
      addedErrorHandling: 'Comprehensive error handling and logging',
      codeQuality: 'Code review process and static analysis integration'
    };
  }

  async enhanceFeasibility(solution) {
    return {
      simplifiedApproach: 'Broken down into smaller, manageable phases',
      resourceOptimization: 'Optimized resource requirements',
      realisticTimeline: 'Adjusted timeline based on team capacity',
      dependencyManagement: 'Clear dependency identification and management'
    };
  }

  async enhanceRiskAssessment(solution) {
    return {
      identifiedRisks: [
        { risk: 'Technical complexity', mitigation: 'Proof of concept development' },
        { risk: 'Timeline pressure', mitigation: 'Agile approach with MVP focus' },
        { risk: 'Resource constraints', mitigation: 'Staged implementation approach' }
      ],
      contingencyPlans: 'Multiple fallback options identified'
    };
  }

  async enhanceInnovation(solution) {
    return {
      innovativeAspects: 'Unique approach to problem solving',
      novelTechniques: 'Modern best practices and emerging patterns',
      futureProofing: 'Extensible design for future enhancements'
    };
  }

  extractSolutionKeywords(solution) {
    const text = JSON.stringify(solution).toLowerCase();
    return text.replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 20);
  }

  calculateImprovement(originalResults, fixedResults) {
    const originalAvg = originalResults.reduce((sum, r) => sum + r.score, 0) / originalResults.length;
    const improvedAvg = fixedResults.reduce((sum, r) => sum + r.improvedScore, 0) / fixedResults.length;
    
    const avgImprovement = improvedAvg - originalAvg;
    const significantImprovement = avgImprovement > this.improvementThreshold;

    return {
      originalAverage: originalAvg,
      improvedAverage: improvedAvg,
      avgImprovement: avgImprovement,
      significantImprovement: significantImprovement,
      improvementCount: fixedResults.filter(r => r.improvement > 0).length
    };
  }
}

export default {
  VerificationLayer,
  AgentELORankingSystem,
  CriticFixerCycle
};
