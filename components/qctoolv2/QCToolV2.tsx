import React, { useState } from 'react';
import { performQCComparison, debugParsedData } from './dataProcessing';
import { ComparisonResults } from './types';
import ComparisonResultsComponent from './ComparisonResults';

/**
 * QC Tool v2: Advanced Quality Control Analysis for SPIDAcalc vs Katapult Data
 * 
 * Implements a four-layer comparison model:
 * - Measured-SPIDA vs. Recommended-SPIDA
 * - Measured-Katapult vs. Recommended-Katapult
 * 
 * Features height bucketing, synthetic insulator injection, and color-coded delta analysis.
 */

interface QCToolV2Props {
  spidaJson?: any;
  katapultJson?: any;
  spidaFileName?: string | null;
  katapultFileName?: string | null;
}

const QCToolV2: React.FC<QCToolV2Props> = ({
  spidaJson,
  katapultJson,
  spidaFileName: _spidaFileName,
  katapultFileName: _katapultFileName,
}) => {
  const [activeSection, setActiveSection] = useState<'analysis' | 'reports'>('analysis');
  const [isRunningComparison, setIsRunningComparison] = useState(false);
  const [comparisonResults, setComparisonResults] = useState<ComparisonResults | null>(null);

  const hasData = spidaJson || katapultJson;
  const hasBothFiles = spidaJson && katapultJson;

  const runComparison = async () => {
    if (!spidaJson || !katapultJson) {
      alert('Both SPIDA and Katapult files are required for comparison.');
      return;
    }

    setIsRunningComparison(true);
    try {
      console.log('🚀 Starting QC Tool v2 Four-Layer Analysis');
      debugParsedData(spidaJson, katapultJson);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      const results = performQCComparison(spidaJson, katapultJson);
      
      console.log('✅ QC Analysis Complete:', {
        totalPoles: results.totalPoles,
        bucketSummary: results.summary
      });
      
      setComparisonResults(results);
      setActiveSection('analysis');
    } catch (error) {
      console.error('❌ Error running QC comparison:', error);
      alert('Error running comparison. Please check the console for details.');
    } finally {
      setIsRunningComparison(false);
    }
  };

  const exportResults = () => {
    if (!comparisonResults) return;
    
    const csvContent = generateCSVExport(comparisonResults);
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QC_Analysis_Results_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const generateCSVExport = (results: ComparisonResults): string => {
    const headers = [
      'Pole ID', 'SCID', 'Height (ft)', 'Bucket Color', 
      'Measured-SPIDA', 'Recommended-SPIDA', 
      'Measured-Katapult', 'Kat. Proposed'
    ];
    
    const rows = results.poleComparisons.flatMap(pc => 
      pc.buckets.map(bucket => {
        const formatLayer = (items: any[]) => 
          items.map(item => `${item.type}: ${item.desc}${item.synthetic ? ' (synthetic)' : ''}`).join('; ');
        
        return [
          pc.poleId, pc.scid || '', bucket.height_ft.toFixed(1), bucket.colour,
          formatLayer(bucket.SpidaMeasured), formatLayer(bucket.SpidaRecommended),
          formatLayer(bucket.KatMeasured), formatLayer(bucket.KatRecommended)
        ];
      })
    );
    
    return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="card-header">
          <h1 className="card-title text-2xl">QC Tool v2</h1>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="card">
        <div className="card-header">
          <div className="flex space-x-4 border-b border-gray-200">
            {[
              { id: 'analysis', name: 'Analysis', icon: '🔍' },
              { id: 'reports', name: 'Reports', icon: '📄' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id as any)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeSection === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Sections */}
      <div className="space-y-6">
        {activeSection === 'analysis' && (
          <>
            {comparisonResults ? (
              <ComparisonResultsComponent 
                results={comparisonResults} 
                onExport={exportResults}
              />
            ) : (
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">Run Analysis</h2>
                </div>
                <div className="p-6">
                  {!hasData && (
                    <div className="alert alert-info">
                      <div className="flex items-center space-x-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Please load SPIDA and Katapult data files to begin analysis.</span>
                      </div>
                    </div>
                  )}

                  {hasData && !hasBothFiles && (
                     <div className="alert alert-warning">
                       <p>
                         {!spidaJson ? 'Missing SPIDA file.' : 'Missing Katapult file.'} Load both to enable comparison.
                       </p>
                     </div>
                  )}
                  
                  {hasBothFiles && (
                    <div className="text-center py-8">
                      <h3 className="text-lg font-semibold mb-4">Ready for Four-Layer QC Analysis</h3>
                      <p className="text-gray-600 mb-6">
                        Both SPIDA and Katapult files are loaded. Run the analysis to see results.
                      </p>
                      <button 
                        onClick={runComparison}
                        disabled={isRunningComparison}
                        className="btn btn-primary px-8 py-3"
                      >
                        {isRunningComparison ? 'Running Analysis...' : 'Run QC Analysis'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {activeSection === 'reports' && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">QC Reports</h2>
            </div>
            <div className="p-6 space-y-4">
              {comparisonResults ? (
                <div>
                  <h3 className="font-semibold mb-4">Analysis Complete - Export Options:</h3>
                  <div className="space-y-2">
                    <button 
                      onClick={exportResults}
                      className="btn btn-outline w-full text-left p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">Download Four-Layer CSV Report</h4>
                          <p className="text-sm text-gray-600">Export complete bucket analysis to CSV format.</p>
                        </div>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                    </button>
                    
                    <div className="p-4 border rounded-lg bg-green-50 border-green-200">
                      <h4 className="font-medium text-green-800 mb-2">Analysis Summary</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600 font-medium">Total Poles:</span>
                          <span className="ml-2 font-semibold">{comparisonResults.totalPoles}</span>
                        </div>
                        <div>
                          <span className="text-emerald-600 font-medium">Green Buckets:</span>
                          <span className="ml-2 font-semibold">{comparisonResults.summary.greenBuckets}</span>
                        </div>
                        <div>
                          <span className="text-amber-600 font-medium">Amber Buckets:</span>
                          <span className="ml-2 font-semibold">{comparisonResults.summary.amberBuckets}</span>
                        </div>
                        <div>
                          <span className="text-red-600 font-medium">Red Buckets:</span>
                          <span className="ml-2 font-semibold">{comparisonResults.summary.redBuckets}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="alert alert-info">
                  <span>Run the QC analysis first to generate reports.</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QCToolV2; 
