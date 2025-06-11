import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PoleComparison, AttachmentRow } from './types';

interface FourLayerPoleViewProps {
  poleComparisons: PoleComparison[];
  onExport?: () => void;
}

const FourLayerPoleView: React.FC<FourLayerPoleViewProps> = ({ 
  poleComparisons, 
  onExport 
}) => {
  const [poleIndex, setPoleIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const totalPoles = poleComparisons.length;
  const currentPole = poleComparisons[poleIndex];

  // Navigation handlers
  const goToPrevPole = () => {
    setPoleIndex(prev => Math.max(0, prev - 1));
  };

  const goToNextPole = () => {
    setPoleIndex(prev => Math.min(totalPoles - 1, prev + 1));
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrevPole();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNextPole();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Reset scroll on pole change
  useEffect(() => {
    if (tableRef.current) {
      tableRef.current.scrollTop = 0;
    }
  }, [poleIndex]);

  // Format height in feet and inches
  const formatHeight = (feet: number): string => {
    const wholeFeet = Math.floor(feet);
    const inches = Math.round((feet - wholeFeet) * 12);
    return `${wholeFeet}′ ${inches}″`;
  };

  // Render layer items with improved UI cues
  const renderLayer = (items: AttachmentRow[]) => {
    if (!items || items.length === 0) {
      return <span className="text-gray-400 italic font-medium">--- Not Found ---</span>;
    }
    
    return (
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={`${item.ref}-${index}`}>
            <span className={item.synthetic ? 'italic text-slate-500' : 'font-medium text-slate-900'}>
              {item.desc}
              {item.synthetic && <span className="ml-1 text-xs">(implicit)</span>}
            </span>
            {item.desc.includes('(+') && (
              <span className="ml-2 text-xs font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">
                MOVE
              </span>
            )}
            {item.children && item.children.length > 0 && (
              <ul className="list-disc ml-4 mt-1 text-sm leading-relaxed text-slate-700">
                {item.children.map((child, childIndex) => (
                  <li key={`${child.ref}-${childIndex}`} className="text-slate-600">
                    {child.desc}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Get color class for bucket row
  const getBucketRowClass = (color: string) => {
    switch (color) {
      case 'red': return 'border-l-red-600 bg-red-50/80';
      case 'amber': return 'border-l-amber-500 bg-amber-50/80';
      case 'green': return 'border-l-emerald-600 bg-emerald-50/80';
      case 'grey': return 'border-l-slate-300 bg-white';
      default: return 'border-l-slate-300 bg-white';
    }
  };

  if (!currentPole) {
    return (
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">No Poles to Display</h2>
        </div>
        <div className="p-4 text-center text-gray-600">
          No pole comparison data available. Please run the QC analysis first.
        </div>
      </div>
    );
  }

  const overallStatus = useMemo(() => {
    if (currentPole.buckets.some(b => b.colour === 'red')) return 'red';
    if (currentPole.buckets.some(b => b.colour === 'amber')) return 'amber';
    return 'green';
  }, [currentPole]);

  return (
    <div ref={containerRef} className="space-y-4 focus:outline-none" tabIndex={0}>
      {/* TopBar - Navigation */}
      <div className="card border-slate-200 shadow-lg">
        <div className="card-header bg-slate-50 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={goToPrevPole}
                disabled={poleIndex === 0}
                className="btn btn-outline border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span>Prev</span>
              </button>
              
              <div className="text-center">
                <h2 className="font-bold text-xl text-slate-900">{currentPole.poleId}</h2>
                <p className="text-sm text-slate-600 font-medium">
                  Pole {poleIndex + 1} of {totalPoles}
                </p>
              </div>
              
              <button
                onClick={goToNextPole}
                disabled={poleIndex === totalPoles - 1}
                className="btn btn-outline border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Next</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-sm text-slate-600 font-medium">Overall Status:</span>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                overallStatus === 'green' 
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : overallStatus === 'amber'
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-red-100 text-red-800 border border-red-200'
              }`}>
                {overallStatus.toUpperCase()}
              </span>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="mt-4">
            <div className="w-full bg-slate-200 rounded-full h-2.5">
              <div 
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  overallStatus === 'green' ? 'bg-emerald-500' :
                  overallStatus === 'amber' ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${((poleIndex + 1) / totalPoles) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="card border-slate-200 shadow-lg">
        <div className="card-header bg-slate-50 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h3 className="card-title text-slate-900 font-semibold">Four-Layer Height Comparison</h3>
            <div className="text-sm text-slate-600 font-medium">
              Use arrow keys to navigate • {currentPole.buckets.filter(b => b.colour !== 'green').length} issues found
            </div>
          </div>
        </div>
        
        <div ref={tableRef} className="max-h-[70vh] overflow-y-auto bg-white rounded-lg shadow-inner">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-slate-800 text-white text-sm font-semibold z-10">
              <tr>
                <th className="w-24 p-4 text-right border-r border-slate-600">Height</th>
                <th className="p-4 text-left border-r border-slate-600 text-blue-300">Measured (SPIDA)</th>
                <th className="p-4 text-left border-r border-slate-600 text-green-300">Recommended (SPIDA)</th>
                <th className="p-4 text-left border-r border-slate-600 text-purple-300">Measured (Katapult)</th>
                <th className="p-4 text-left text-orange-300">Kat. Proposed</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {currentPole.buckets.map((bucket, index) => (
                <tr 
                  key={`${bucket.height_ft}-${index}`} 
                  className={`border-b border-gray-300 border-l-4 ${getBucketRowClass(bucket.colour)} hover:bg-slate-50 transition-colors`}
                >
                  <td className="p-4 text-right font-mono text-sm font-medium text-slate-900 border-r border-gray-300 bg-slate-50">
                    {formatHeight(bucket.height_ft)}
                  </td>
                  <td className="p-4 text-sm text-slate-800 border-r border-gray-300">
                    {renderLayer(bucket.SpidaMeasured)}
                  </td>
                  <td className="p-4 text-sm text-slate-800 border-r border-gray-300">
                    {renderLayer(bucket.SpidaRecommended)}
                  </td>
                  <td className="p-4 text-sm text-slate-800 border-r border-gray-300">
                    {renderLayer(bucket.KatMeasured)}
                  </td>
                  <td className="p-4 text-sm text-slate-800">
                    {renderLayer(bucket.KatRecommended)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Status Bar & Legend */}
      <div className="card border-slate-200 shadow-lg">
        <div className="card-header bg-slate-50 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 border-l-4 border-emerald-600"></div>
                <span className="text-sm text-slate-700 font-medium">Match (&le;0.5 ft)</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 border-l-4 border-amber-500"></div>
                <span className="text-sm text-slate-700 font-medium">Minor Issue (0.5-1.0 ft)</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 border-l-4 border-red-600"></div>
                <span className="text-sm text-slate-700 font-medium">Major Issue (&gt;1.0 ft)</span>
              </div>
            </div>
            
            {onExport && (
              <button 
                onClick={onExport}
                className="btn btn-outline border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Export CSV</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FourLayerPoleView; 