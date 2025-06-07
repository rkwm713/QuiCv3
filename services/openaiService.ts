// OpenAI service to replace Gemini AI integration
// This mirrors the GeminiService interface so existing components can switch imports
// All requests are routed through the Netlify Function "/openai-analysis" which securely
// calls the OpenAI Chat Completion API without exposing the API key to the browser.

import { getApiBaseUrl, validateEnvironment } from '../utils/env';

export class OpenAIService {
  private baseUrl: string;

  constructor() {
    // Validate environment configuration on initialization (client-side safe)
    validateEnvironment();

    // Centralised API base (e.g. http://localhost:8888/.netlify/functions or production path)
    this.baseUrl = getApiBaseUrl();
  }

  /**
   * Generic helper that forwards an arbitrary prompt to the Netlify OpenAI function
   */
  async generateAnalysis(prompt: string, analysisType: string = 'general'): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/openai-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, analysisType })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API error: ${response.status} – ${errorData.error || 'Unknown error'}`);
      }

      const data = await response.json();
      return data.result || 'No response generated';
    } catch (error) {
      console.error('Error calling Netlify OpenAI function:', error);
      throw error;
    }
  }

  /* =========================
   * Domain-specific helpers
   * ========================= */

  async analyzeMatchData(matchData: any): Promise<string> {
    const prompt = `
As a utility pole data analysis expert, analyze this pole comparison data and provide comprehensive insights:

DATA SUMMARY:
- Total poles analyzed: ${matchData.totalPoles || 'N/A'}
- Successful matches: ${matchData.matchedPoles || 'N/A'}
- Match rate: ${matchData.matchRate || 'N/A'}%
- Tier 1 (SCID) matches: ${matchData.tier1Matches || 'N/A'}
- Tier 2 (Pole Number) matches: ${matchData.tier2Matches || 'N/A'}
- Tier 3 (Coordinate) matches: ${matchData.tier3Matches || 'N/A'}
- Tier 4 (Fuzzy) matches: ${matchData.tier4Matches || 'N/A'}
- Unmatched poles: ${matchData.unmatchedPoles || 'N/A'}

Sample mismatches: ${JSON.stringify(matchData.sampleMismatches || [], null, 2)}

Please provide:
1. **Data Quality Assessment** – Overall quality score and key issues
2. **Match Pattern Analysis** – What the tier distribution tells us
3. **Critical Issues** – Most important problems to address first
4. **Recommendations** – Specific actionable steps to improve data quality
5. **Risk Assessment** – Potential construction/engineering risks from mismatches

Format your response in clear sections with bullet points where appropriate.
    `;

    return this.generateAnalysis(prompt, 'match-data');
  }

  async analyzeSpecificationMismatches(specData: any): Promise<string> {
    const prompt = `
Analyze these pole specification mismatches between SPIDA and Katapult data:

SPECIFICATION CONFLICTS:
${JSON.stringify(specData, null, 2)}

As a utility engineering expert, provide:
1. **Critical Safety Issues** – Specification differences that could impact safety
2. **Engineering Impact** – How these mismatches affect design integrity
3. **Field Verification Needed** – Which poles require immediate field inspection
4. **Standardization Opportunities** – Patterns suggesting data standardization needs
5. **Construction Priorities** – Order of resolution based on risk level

Focus on actionable insights for field engineers and project managers.
    `;

    return this.generateAnalysis(prompt, 'spec-mismatches');
  }

  async generateExecutiveSummary(projectData: any): Promise<string> {
    const prompt = `
Create an executive summary for this utility pole data quality control project:

PROJECT DATA:
${JSON.stringify(projectData, null, 2)}

Provide a professional executive summary including:
1. **Project Overview** – Brief description of data comparison scope
2. **Key Metrics** – Most important statistics for stakeholders
3. **Data Quality Status** – Overall assessment with confidence level
4. **Business Impact** – How data quality affects project timeline/budget
5. **Next Steps** – Top 3 recommended actions
6. **Risk Mitigation** – Key risks and proposed solutions

Write in professional language suitable for project stakeholders and executives.
    `;

    return this.generateAnalysis(prompt, 'executive-summary');
  }

  async identifyAnomalies(poleData: any[]): Promise<string> {
    const prompt = `
Analyze this pole data for anomalies and unusual patterns:

POLE DATA SAMPLE:
${JSON.stringify(poleData.slice(0, 50), null, 2)}

Identify:
1. **Statistical Outliers** – Poles with unusual capacity percentages, coordinates, or specifications
2. **Geographic Anomalies** – Coordinate clusters or isolated poles that seem suspicious
3. **Specification Patterns** – Unusual pole spec distributions or unexpected combinations
4. **Data Consistency Issues** – Fields that don't align with typical utility standards
5. **Quality Flags** – Specific records that need manual review

Provide specific pole IDs/SCIDs where possible and explain why each anomaly is significant.
    `;

    return this.generateAnalysis(prompt, 'anomaly-detection');
  }

  /* ========= Advanced / Extended features copied from previous GeminiService ========= */

  async generateDetailedReport(projectData: any, analysisType: 'technical' | 'executive' | 'field'): Promise<string> {
    const prompts: Record<typeof analysisType, string> = {
      technical: `
Generate a comprehensive technical report for utility pole data analysis:

PROJECT DATA:
${JSON.stringify(projectData, null, 2)}

Include:
1. **Technical Analysis Summary**
2. **Methodology and Data Processing**
3. **Statistical Analysis** – Match rates, error distributions, confidence intervals
4. **Quality Metrics** – Data integrity scores and validation results
5. **Engineering Implications** – Technical risks and mitigation strategies
6. **Detailed Findings** – Specific technical issues and their resolution
7. **Recommendations** – Technical solutions and process improvements

Format as a professional technical document with specific metrics and references.
      `,
      executive: `
Generate an executive-level report for utility pole data quality project:

PROJECT DATA:
${JSON.stringify(projectData, null, 2)}

Include:
1. **Executive Summary** – Key findings in 2–3 bullet points
2. **Business Impact** – Timeline and budget implications
3. **Risk Assessment** – High-level risks and mitigation
4. **ROI Analysis** – Cost-benefit of data quality improvements
5. **Strategic Recommendations** – Business decisions needed
6. **Resource Requirements** – Personnel and tools needed
7. **Next Steps** – Prioritized action plan

Keep technical details minimal, focus on business impact and decisions.
      `,
      field: `
Generate a field operations report for utility pole data reconciliation:

PROJECT DATA:
${JSON.stringify(projectData, null, 2)}

Include:
1. **Field Work Summary** – What needs verification in the field
2. **Priority Locations** – Poles requiring immediate inspection
3. **Safety Concerns** – Critical issues affecting worker safety
4. **Equipment Requirements** – Tools and resources needed
5. **Work Order Priorities** – Suggested order of field operations
6. **Documentation Needs** – What data to collect during inspections
7. **Quality Checkpoints** – Validation steps for field crews

Focus on actionable field guidance and crew safety.
      `
    } as const;

    return this.generateAnalysis(prompts[analysisType], `detailed-report-${analysisType}`);
  }

  async validateDataQuality(poleData: any[]): Promise<string> {
    const prompt = `
Perform comprehensive data quality validation on this utility pole dataset:

POLE DATA SAMPLE:
${JSON.stringify(poleData.slice(0, 100), null, 2)}

Analyze and report:
1. **Data Completeness** – Missing fields and their impact
2. **Data Consistency** – Internal consistency checks
3. **Data Accuracy** – Suspicious values and likely errors
4. **Format Validation** – Non-standard formats and encoding issues
5. **Range Validation** – Values outside expected ranges
6. **Relationship Validation** – Inconsistent relationships between fields
7. **Quality Score** – Overall data quality rating (1-100)
8. **Improvement Plan** – Specific steps to enhance data quality

Provide specific examples and quantitative assessments where possible.
    `;

    return this.generateAnalysis(prompt, 'data-validation');
  }

  async generatePredictiveInsights(poleData: any[], historicalData?: any): Promise<string> {
    const prompt = `
Generate predictive insights for utility pole maintenance and risk assessment:

CURRENT POLE DATA:
${JSON.stringify(poleData.slice(0, 50), null, 2)}

HISTORICAL DATA (if available):
${JSON.stringify(historicalData || 'No historical data provided', null, 2)}

Provide predictive analysis including:
1. **Maintenance Predictions** – Poles likely to need maintenance soon
2. **Risk Assessment** – Poles with elevated failure risk
3. **Capacity Planning** – Future capacity constraints and needs
4. **Geographic Patterns** – Regional trends and risk clusters
5. **Timeline Predictions** – Estimated timeframes for various interventions
6. **Cost Projections** – Anticipated maintenance and replacement costs
7. **Optimization Opportunities** – Efficiency improvements in pole management

Focus on actionable predictions with confidence levels and timeframes.
    `;

    return this.generateAnalysis(prompt, 'predictive-insights');
  }

  async generateSmartRecommendations(poleData: any[], userPreferences?: any): Promise<string> {
    const prompt = `
Generate intelligent recommendations for utility pole data management:

POLE DATA:
${JSON.stringify(poleData.slice(0, 50), null, 2)}

USER PREFERENCES:
${JSON.stringify(userPreferences || 'Standard recommendations', null, 2)}

Provide smart recommendations for:
1. **Immediate Actions** – Critical issues requiring urgent attention
2. **Process Improvements** – Better workflows and data management
3. **Technology Upgrades** – Tools and systems to enhance efficiency
4. **Training Needs** – Skills development for team members
5. **Quality Controls** – Preventive measures for data quality
6. **Automation Opportunities** – Tasks that can be automated
7. **Best Practices** – Industry standards and proven methods

Prioritize recommendations by impact and ease of implementation.
    `;

    return this.generateAnalysis(prompt, 'smart-recommendations');
  }

  async enhancedContextualChat(userMessage: string, projectContext: any, chatHistory: any[]): Promise<string> {
    const prompt = `
You are an expert AI assistant for utility pole data analysis in the QuiC application.

CURRENT PROJECT CONTEXT:
${JSON.stringify(projectContext, null, 2)}

RECENT CHAT HISTORY:
${JSON.stringify(chatHistory.slice(-10), null, 2)}

USER MESSAGE: "${userMessage}"

Provide a detailed, context-aware response that:
1. References specific data from the user's current project
2. Considers the conversation history for continuity
3. Offers actionable insights based on their actual data
4. Suggests follow-up questions or analyses
5. Provides relevant examples from their dataset
6. Maintains professional utility industry expertise

If the user asks about specific poles, reference their actual pole IDs/SCIDs. If they ask about patterns, analyze their actual data patterns.
    `;

    return this.generateAnalysis(prompt, 'contextual-chat');
  }

  async generateWorkflowSuggestions(currentStage: string, projectData: any): Promise<string> {
    const prompt = `
Generate intelligent workflow suggestions for utility pole data analysis project:

CURRENT STAGE: ${currentStage}
PROJECT DATA:
${JSON.stringify(projectData, null, 2)}

Based on the current stage and data state, suggest:
1. **Next Best Steps** – Most logical next actions
2. **Alternative Workflows** – Different approaches to consider
3. **Quality Gates** – Checkpoints before proceeding
4. **Parallel Tasks** – Activities that can be done simultaneously
5. **Resource Optimization** – How to use time and tools efficiently
6. **Risk Mitigation** – Potential issues and prevention strategies
7. **Success Metrics** – How to measure progress and quality

Provide specific, actionable guidance tailored to their current situation.
    `;

    return this.generateAnalysis(prompt, 'workflow-suggestions');
  }
} 