import React, { useState, useMemo } from 'react';
import { ComparisonResults } from './types';
import FourLayerPoleView from './FourLayerPoleView';

interface ComparisonResultsProps {
  results: ComparisonResults;
  onExport?: () => void;
}

type SortKey = 'poleId' | 'totalBuckets' | 'greenBuckets' | 'amberBuckets' | 'redBuckets';
type SortDirection = 'asc' | 'desc';

const ComparisonResultsComponent: React.FC<ComparisonResultsProps> = ({ results, onExport }) => {
  const [selectedTab, setSelectedTab] = useState<'bucket-overview' | 'pole-analysis' | 'color-summary'>('bucket-overview');
  const [colorFilter, setColorFilter] = useState<'all' | 'green' | 'amber' | 'red' | 'grey'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'redBuckets', direction: 'desc' });

  // Memoized color analysis with sorting
  const colorAnalysis = useMemo(() => {
    const analysis = results.poleComparisons.map(pc => {
      const green = pc.buckets.filter(b => b.colour === 'green').length;
      const amber = pc.buckets.filter(b => b.colour === 'amber').length;
      const red = pc.buckets.filter(b => b.colour === 'red').length;
      
      let overallStatus: 'green' | 'amber' | 'red' = 'green';
      if (red > 0) overallStatus = 'red';
      else if (amber > 0) overallStatus = 'amber';
      
      return {
        poleId: pc.poleId,
        scid: pc.scid,
        totalBuckets: pc.buckets.length,
        greenBuckets: green,
        amberBuckets: amber,
        redBuckets: red,
        overallStatus
      };
    });

    // Filtering
    const filtered = analysis.filter(item => {
      const searchMatch = searchTerm === '' || 
        item.poleId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.scid && item.scid.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const colorMatch = colorFilter === 'all' || item.overallStatus === colorFilter;
      
      return searchMatch && colorMatch;
    });

    // Sorting
    return filtered.sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [results.poleComparisons, searchTerm, colorFilter, sortConfig]);
  
  const requestSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  const getSortIndicator = (key: SortKey) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'desc' ? ' ▼' : ' ▲';
  };

  // Helper function to get color badge classes
  const getColorBadgeClass = (color: string) => {
    switch (color) {
      case 'green': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'amber': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'red': return 'bg-red-100 text-red-800 border-red-200';
      case 'grey': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="card">
        <div className="card-header">
          <div className="flex justify-between items-center">
            <div className="flex space-x-4 border-b border-gray-200">
              {[
                { id: 'color-summary', name: 'Pole Summary', icon: '🎨' },
                { id: 'pole-analysis', name: 'Detailed Pole View', icon: '🔍' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedTab(tab.id as any)}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    selectedTab === tab.id
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.name}
                </button>
              ))}
            </div>
            
            {onExport && (
              <button 
                onClick={onExport}
                className="btn btn-primary"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export Results
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content Sections */}
      {selectedTab === 'color-summary' && (
        <div className="card">
          <div className="card-header">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
              <h2 className="card-title">Pole Color Analysis</h2>
              
              {/* Filters */}
              <div className="flex flex-wrap gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status Filter</label>
                  <select 
                    value={colorFilter} 
                    onChange={(e) => setColorFilter(e.target.value as any)}
                    className="input text-sm"
                  >
                    <option value="all">All Statuses</option>
                    <option value="green">Green Poles</option>
                    <option value="amber">Amber Poles</option>
                    <option value="red">Red Poles</option>
                    <option value="grey">Grey Poles</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search poles or SCIDs..."
                    className="input text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div className="space-y-4 p-4">
            {/* Summary */}
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-semibold text-green-900 mb-2">Pole Status Distribution</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-green-600 font-medium">Total Poles:</span>
                  <span className="ml-2">{colorAnalysis.length}</span>
                </div>
                <div>
                  <span className="text-emerald-600 font-medium">Green Poles:</span>
                  <span className="ml-2">{colorAnalysis.filter(p => p.overallStatus === 'green').length}</span>
                </div>
                <div>
                  <span className="text-amber-600 font-medium">Amber Poles:</span>
                  <span className="ml-2">{colorAnalysis.filter(p => p.overallStatus === 'amber').length}</span>
                </div>
                <div>
                  <span className="text-red-600 font-medium">Red Poles:</span>
                  <span className="ml-2">{colorAnalysis.filter(p => p.overallStatus === 'red').length}</span>
                </div>
              </div>
            </div>

            {/* Detailed Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('poleId')}>
                      Pole / SCID {getSortIndicator('poleId')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Overall Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('totalBuckets')}>
                      Total Buckets {getSortIndicator('totalBuckets')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer text-emerald-700" onClick={() => requestSort('greenBuckets')}>
                      Green {getSortIndicator('greenBuckets')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer text-amber-700" onClick={() => requestSort('amberBuckets')}>
                      Amber {getSortIndicator('amberBuckets')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer text-red-700" onClick={() => requestSort('redBuckets')}>
                      Red {getSortIndicator('redBuckets')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {colorAnalysis.map((pole) => (
                    <tr key={pole.poleId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{pole.poleId}</div>
                        {pole.scid && (
                          <div className="text-sm text-gray-500">SCID: {pole.scid}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium border rounded ${getColorBadgeClass(pole.overallStatus)}`}>
                          {pole.overallStatus.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                        {pole.totalBuckets}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center font-medium">
                        {pole.greenBuckets}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center font-medium">
                        {pole.amberBuckets}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 text-center font-bold">
                        {pole.redBuckets}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {colorAnalysis.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No poles found matching the current filters.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedTab === 'pole-analysis' && (
        <FourLayerPoleView 
          poleComparisons={results.poleComparisons} 
          onExport={onExport}
        />
      )}
    </div>
  );
};

export default ComparisonResultsComponent;
