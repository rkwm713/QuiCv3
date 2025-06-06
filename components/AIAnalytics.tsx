import React, { useState } from 'react';
import { GeminiService } from '../services/geminiService';

interface AIAnalyticsProps {
  comparisonData?: any;
  poleData?: any[];
  hasComparisonRun?: boolean;
}

const AIAnalytics: React.FC<AIAnalyticsProps> = ({ 
  comparisonData, 
  poleData = [],
  hasComparisonRun = false 
}) => {
  const [geminiService] = useState(() => new GeminiService());
  const [activeAnalysis, setActiveAnalysis] = useState<'overview' | 'mismatches' | 'anomalies' | 'reports' | 'validation' | 'predictions' | 'recommendations' | 'chat'>('overview');
  const [analysisResults, setAnalysisResults] = useState<{
    overview?: string;
    mismatches?: string;
    anomalies?: string;
    reports?: { [key: string]: string };
    validation?: string;
    predictions?: string;
    recommendations?: string;
  }>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{type: 'user' | 'ai', content: string}>>([]);
  const [selectedReportType, setSelectedReportType] = useState<'technical' | 'executive' | 'field'>('executive');

  const runAnalysis = async (type: 'overview' | 'mismatches' | 'anomalies') => {
    if (!hasComparisonRun) {
      setError('Please run a comparison first to generate AI insights');
      return;
    }

    setLoading(type);
    setError(null);

    try {
      let result = '';
      
      switch (type) {
        case 'overview':
          result = await geminiService.analyzeMatchData(comparisonData || {});
          break;
        case 'mismatches':
          result = await geminiService.analyzeSpecificationMismatches(comparisonData?.mismatches || {});
          break;
        case 'anomalies':
          result = await geminiService.identifyAnomalies(poleData);
          break;
      }
      
      setAnalysisResults(prev => ({ ...prev, [type]: result }));
    } catch (err) {
      setError(`Failed to generate ${type} analysis. Please check your API connection.`);
      console.error(`Error generating ${type} analysis:`, err);
    } finally {
      setLoading(null);
    }
  };

  const runAdvancedAnalysis = async (type: 'reports' | 'validation' | 'predictions' | 'recommendations') => {
    if (!hasComparisonRun && type !== 'validation') {
      setError('Please run a comparison first to generate AI insights');
      return;
    }

    setLoading(type);
    setError(null);

    try {
      let result = '';
      
      switch (type) {
        case 'reports':
          result = await geminiService.generateDetailedReport(
            { comparisonData, poleData, hasComparisonRun }, 
            selectedReportType
          );
          setAnalysisResults(prev => ({ 
            ...prev, 
            reports: { ...prev.reports, [selectedReportType]: result }
          }));
          break;
        case 'validation':
          result = await geminiService.validateDataQuality(poleData);
          setAnalysisResults(prev => ({ ...prev, validation: result }));
          break;
        case 'predictions':
          result = await geminiService.generatePredictiveInsights(poleData);
          setAnalysisResults(prev => ({ ...prev, predictions: result }));
          break;
        case 'recommendations':
          result = await geminiService.generateSmartRecommendations(poleData);
          setAnalysisResults(prev => ({ ...prev, recommendations: result }));
          break;
      }
    } catch (err) {
      setError(`Failed to generate ${type} analysis. Please check your API connection.`);
      console.error(`Error generating ${type} analysis:`, err);
    } finally {
      setLoading(null);
    }
  };

  const sendChatMessage = async () => {
    if (!chatMessage.trim()) return;

    const userMessage = chatMessage.trim();
    setChatMessage('');
    setChatHistory(prev => [...prev, { type: 'user', content: userMessage }]);
    setLoading('chat');

    try {
      const projectContext = {
        hasComparisonRun,
        totalPoles: poleData.length,
        comparisonStats: comparisonData,
        currentAnalysis: activeAnalysis
      };

      const response = await geminiService.enhancedContextualChat(
        userMessage, 
        projectContext, 
        chatHistory
      );
      setChatHistory(prev => [...prev, { type: 'ai', content: response }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { 
        type: 'ai', 
        content: 'Sorry, I encountered an error processing your question. Please try again.' 
      }]);
      console.error('Error in chat:', err);
    } finally {
      setLoading(null);
    }
  };

  const AnalysisCard: React.FC<{ 
    title: string; 
    description: string; 
    type: 'overview' | 'mismatches' | 'anomalies';
    icon: React.ReactNode;
    color: string;
  }> = ({ title, description, type, icon, color }) => (
    <div 
      onClick={() => {
        setActiveAnalysis(type);
        if (!analysisResults[type]) {
          runAnalysis(type);
        }
      }}
      className={`
        p-6 rounded-xl border cursor-pointer transition-all duration-300 hover:scale-105
        ${activeAnalysis === type 
          ? `border-${color}-500/50 bg-${color}-500/10 shadow-lg shadow-${color}-500/20` 
          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
        }
      `}
    >
      <div className="flex items-center space-x-3 mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-${color}-500/20`}>
          {icon}
        </div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>
      <p className="text-slate-400 text-sm">{description}</p>
    </div>
  );

  const AdvancedAnalysisCard: React.FC<{ 
    title: string; 
    description: string; 
    type: 'reports' | 'validation' | 'predictions' | 'recommendations';
    icon: React.ReactNode;
    color: string;
    requiresComparison?: boolean;
  }> = ({ title, description, type, icon, color, requiresComparison = true }) => (
    <div 
      onClick={() => {
        if (requiresComparison && !hasComparisonRun) {
          setError('Please run a comparison first to generate this analysis');
          return;
        }
        setActiveAnalysis(type);
        if (type === 'reports') {
          if (!analysisResults.reports?.[selectedReportType]) {
            runAdvancedAnalysis(type);
          }
        } else if (!analysisResults[type]) {
          runAdvancedAnalysis(type);
        }
      }}
      className={`
        p-6 rounded-xl border cursor-pointer transition-all duration-300 hover:scale-105
        ${activeAnalysis === type 
          ? `border-${color}-500/50 bg-${color}-500/10 shadow-lg shadow-${color}-500/20` 
          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
        }
        ${requiresComparison && !hasComparisonRun ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <div className="flex items-center space-x-3 mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-${color}-500/20`}>
          {icon}
        </div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {requiresComparison && !hasComparisonRun && (
          <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        )}
      </div>
      <p className="text-slate-400 text-sm">{description}</p>
    </div>
  );

  const formatAnalysisText = (text: string) => {
    return text.split('\n').map((line, index) => {
      if (line.startsWith('## ') || line.startsWith('**') && line.endsWith('**')) {
        return (
          <h3 key={index} className="text-xl font-semibold text-emerald-400 mt-6 mb-3">
            {line.replace(/[#*]/g, '')}
          </h3>
        );
      }
      if (line.startsWith('- ') || line.startsWith('• ')) {
        return (
          <li key={index} className="text-slate-300 ml-4 mb-2">
            {line.substring(2)}
          </li>
        );
      }
      if (line.startsWith('1. ') || line.startsWith('2. ') || line.startsWith('3. ') || line.startsWith('4. ') || line.startsWith('5. ')) {
        return (
          <div key={index} className="text-slate-300 mb-3">
            <span className="font-semibold text-cyan-400">{line.substring(0, 3)}</span>
            {line.substring(3)}
          </div>
        );
      }
      if (line.trim() === '') {
        return <br key={index} />;
      }
      return (
        <p key={index} className="text-slate-300 mb-2">
          {line}
        </p>
      );
    });
  };

  if (!hasComparisonRun && activeAnalysis !== 'validation') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 mx-auto bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-slate-200">AI Analytics Ready</h3>
          <p className="text-slate-400">
            Upload both data files and run a comparison to unlock AI-powered insights about your pole data.
          </p>
          <button
            onClick={() => setActiveAnalysis('validation')}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Try Data Validation</span>
          </button>
          <div className="inline-flex items-center space-x-2 text-emerald-400 text-sm">
            <span>Powered by Google Gemini 2.5 Pro</span>
            <div className="flex space-x-1">
              <div className="w-1 h-1 bg-emerald-400 rounded-full animate-pulse"></div>
              <div className="w-1 h-1 bg-emerald-400 rounded-full animate-pulse delay-100"></div>
              <div className="w-1 h-1 bg-emerald-400 rounded-full animate-pulse delay-200"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">AI Analytics</h2>
            <p className="text-slate-400">Powered by Google Gemini 2.5 Pro Preview</p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveAnalysis('chat')}
              className={`
                px-4 py-2 rounded-lg transition-all duration-300 flex items-center space-x-2
                ${activeAnalysis === 'chat' 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' 
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }
              `}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span>Ask AI</span>
            </button>
          </div>
        </div>
      </div>

      {/* Analysis Cards */}
      {activeAnalysis !== 'chat' && (
        <div className="p-6 border-b border-slate-700">
          {/* Core Analysis Cards */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-4">Core Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <AnalysisCard
                title="Data Quality Overview"
                description="Comprehensive analysis of match rates, patterns, and overall data quality"
                type="overview"
                color="emerald"
                icon={
                  <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
              />
              <AnalysisCard
                title="Specification Issues"
                description="AI analysis of pole specification mismatches and safety concerns"
                type="mismatches"
                color="yellow"
                icon={
                  <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                }
              />
              <AnalysisCard
                title="Anomaly Detection"
                description="Identify unusual patterns, outliers, and data quality flags"
                type="anomalies"
                color="purple"
                icon={
                  <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              />
            </div>
          </div>

          {/* Advanced AI Features */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Advanced AI Features</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <AdvancedAnalysisCard
                title="Smart Reports"
                description="Generate detailed technical, executive, or field operation reports"
                type="reports"
                color="blue"
                icon={
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                }
              />
              <AdvancedAnalysisCard
                title="Data Validation"
                description="Comprehensive data quality validation and scoring"
                type="validation"
                color="cyan"
                requiresComparison={false}
                icon={
                  <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              />
              <AdvancedAnalysisCard
                title="Predictive Insights"
                description="AI predictions for maintenance needs and risk assessment"
                type="predictions"
                color="orange"
                icon={
                  <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                }
              />
              <AdvancedAnalysisCard
                title="Smart Recommendations"
                description="Intelligent suggestions for process improvements"
                type="recommendations"
                color="pink"
                icon={
                  <svg className="w-6 h-6 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-6">
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-red-400 font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* Report Type Selector for Reports */}
        {activeAnalysis === 'reports' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-3">Select Report Type:</label>
            <div className="flex space-x-3">
              {(['executive', 'technical', 'field'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedReportType(type)}
                  className={`
                    px-4 py-2 rounded-lg capitalize transition-all duration-300
                    ${selectedReportType === type 
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' 
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }
                  `}
                >
                  {type} Report
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Analysis Results */}
        {activeAnalysis !== 'chat' && (
          <div className="space-y-6">
            {loading === activeAnalysis ? (
                            <div className="text-center py-12">
                <div className="w-12 h-12 mx-auto solid-yellow-glow rounded-full flex items-center justify-center animate-pulse mb-4">
                  <svg className="w-6 h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Analyzing Your Data</h3>
                <p className="text-slate-400">Gemini AI is processing your pole data...</p>
              </div>
            ) : (() => {
              let content = '';
              if (activeAnalysis === 'reports') {
                content = analysisResults.reports?.[selectedReportType] || '';
              } else {
                content = analysisResults[activeAnalysis] || '';
              }
              
              return content ? (
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                  <div className="prose prose-slate max-w-none">
                    {formatAnalysisText(content)}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-slate-400">Click on an analysis card above to generate AI insights</p>
                </div>
              );
            })()}
          </div>
        )}

        {/* Chat Interface */}
        {activeAnalysis === 'chat' && (
          <div className="space-y-6">
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 h-96 flex flex-col">
              {/* Chat Messages */}
              <div className="flex-1 overflow-auto p-4 space-y-4">
                {chatHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 mx-auto bg-gradient-to-r from-yellow-400/20 to-blue-500/20 rounded-full flex items-center justify-center mb-4">
                      <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Enhanced AI Assistant</h3>
                    <p className="text-slate-400 text-sm">Ask questions about your pole data analysis, get recommendations, or explore insights from your specific dataset.</p>
                    <div className="mt-4 space-y-2 text-xs text-slate-500">
                      <p>• Try: "What are the most critical issues in my data?"</p>
                      <p>• Try: "Which poles need immediate attention?"</p>
                      <p>• Try: "Generate a summary for my manager"</p>
                    </div>
                  </div>
                ) : (
                  chatHistory.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`
                          max-w-[80%] p-3 rounded-lg
                          ${message.type === 'user'
                            ? 'bg-emerald-500/20 text-emerald-100 ml-4'
                            : 'bg-slate-700 text-slate-200 mr-4'
                          }
                        `}
                      >
                        <div className="text-sm">
                          {message.type === 'ai' ? formatAnalysisText(message.content) : message.content}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                {loading === 'chat' && (
                  <div className="flex justify-start">
                    <div className="bg-slate-700 p-3 rounded-lg mr-4">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse"></div>
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse delay-100"></div>
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse delay-200"></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="border-t border-slate-700 p-4">
                <div className="flex space-x-3">
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                    placeholder="Ask about your pole data analysis..."
                    className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                    disabled={loading === 'chat'}
                  />
                  <button
                    onClick={sendChatMessage}
                    disabled={!chatMessage.trim() || loading === 'chat'}
                    className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIAnalytics; 