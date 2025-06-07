import React, { useState } from 'react';
import { ComparisonRow } from '../../types';

interface QCToolTableProps {
  rows: ComparisonRow[];
  sortField: keyof ComparisonRow;
  sortDirection: 'asc' | 'desc';
  onSort: (field: keyof ComparisonRow) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  threshold: number;
  onThresholdChange: (threshold: number) => void;
}

const SortIcon: React.FC<{ field: keyof ComparisonRow; sortField: keyof ComparisonRow; sortDirection: 'asc' | 'desc' }> = ({ field, sortField, sortDirection }) => {
  if (sortField !== field) {
    return (
      <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    );
  }
  return sortDirection === 'asc' ? (
    <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
    </svg>
  ) : (
    <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
    </svg>
  );
};

const StatusBadge: React.FC<{ status: ComparisonRow['status'] }> = ({ status }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'Match': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50';
      case 'Changed': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50';
      case 'Added': return 'bg-blue-500/20 text-blue-300 border-blue-500/50';
      case 'Removed': return 'bg-red-500/20 text-red-300 border-red-500/50';
      case 'Katapult-Only': return 'bg-purple-500/20 text-purple-300 border-purple-500/50';
      case 'Katapult-Mismatch': return 'bg-orange-500/20 text-orange-300 border-orange-500/50';
      default: return 'bg-slate-500/20 text-slate-300 border-slate-500/50';
    }
  };

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getStatusColor()}`}>
      {status}
    </span>
  );
};

const DeltaDisplay: React.FC<{ delta: number | undefined; label?: string }> = ({ delta, label }) => {
  if (delta === undefined) return <span className="text-slate-500">-</span>;
  
  const absDelta = Math.abs(delta);
  const isSignificant = absDelta >= 0.1;
  
  let colorClass = 'text-slate-400';
  if (isSignificant) {
    colorClass = delta > 0 ? 'text-blue-400' : 'text-red-400';
  }
  
  return (
    <span className={`font-mono ${colorClass}`} title={label}>
      {delta > 0 ? '+' : ''}{delta.toFixed(1)} ft
    </span>
  );
};

const ExpandableRow: React.FC<{ 
  row: ComparisonRow; 
  isExpanded: boolean; 
  onToggle: () => void;
}> = ({ row, isExpanded, onToggle }) => {
  const formatHeight = (height: number): string => {
    return `${height.toFixed(1)} ft`;
  };

  const formatPoleScid = (key: string): string => {
    return key.split('-')[0];
  };

  const getMainDelta = () => {
    if (row.deltaHeightMeasRec !== undefined) return row.deltaHeightMeasRec;
    if (row.deltaHeightMeasKat !== undefined) return row.deltaHeightMeasKat;
    return undefined;
  };

  const getStatusIcon = () => {
    switch (row.status) {
      case 'Match': return '✓';
      case 'Changed': return '△';
      case 'Added': return '+';
      case 'Removed': return '−';
      case 'Katapult-Only': return 'K';
      case 'Katapult-Mismatch': return '⚠';
      default: return '?';
    }
  };

  return (
    <>
      {/* Compact Row */}
      <tr 
        className="hover:bg-slate-750 transition-colors cursor-pointer border-l-4 border-transparent hover:border-slate-600"
        onClick={onToggle}
      >
        <td className="px-4 py-3">
          <div className="flex items-center space-x-2">
            <button className="text-slate-400 hover:text-white transition-colors">
              <svg 
                className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <span className="text-sm font-mono text-white font-medium">{formatPoleScid(row.key)}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="text-sm text-slate-300">
            <div className="font-medium">{row.measured?.owner || row.recommended?.owner || 'N/A'}</div>
            <div className="text-xs text-slate-400">{row.measured?.size || row.recommended?.size || 'N/A'}</div>
            <div className="text-xs text-slate-500">{row.measured?.type || row.recommended?.type || 'Unknown'}</div>
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="text-sm font-mono text-slate-300">
            <div>{row.measured ? formatHeight(row.measured.height) : '-'}</div>
            {row.recommended && row.recommended.height !== row.measured?.height && (
              <div className="text-xs text-blue-400">→ {formatHeight(row.recommended.height)}</div>
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="text-sm">
            <DeltaDisplay delta={getMainDelta()} />
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center space-x-2">
            <span className="text-lg">{getStatusIcon()}</span>
            <StatusBadge status={row.status} />
          </div>
        </td>
      </tr>

      {/* Expanded Details Row */}
      {isExpanded && (
        <tr className="bg-slate-900/50 border-l-4 border-emerald-500/30">
          <td colSpan={5} className="px-4 py-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Measured Data */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-emerald-400 flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span>Measured Design</span>
                </h4>
                {row.measured ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Owner:</span>
                      <span className="text-white">{row.measured.owner}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Type:</span>
                      <span className="text-white">{row.measured.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Size:</span>
                      <span className="text-white">{row.measured.size}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Height:</span>
                      <span className="text-white font-mono">{formatHeight(row.measured.height)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500 italic">No measured data available</div>
                )}
              </div>

              {/* Recommended Data */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-blue-400 flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Recommended Design</span>
                </h4>
                {row.recommended ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Owner:</span>
                      <span className="text-white">{row.recommended.owner}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Type:</span>
                      <span className="text-white">{row.recommended.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Size:</span>
                      <span className="text-white">{row.recommended.size}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Height:</span>
                      <span className="text-white font-mono">{formatHeight(row.recommended.height)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500 italic">No recommended data available</div>
                )}
              </div>

              {/* Katapult Data & Deltas */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-purple-400 flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <span>Katapult & Deltas</span>
                </h4>
                <div className="space-y-3">
                  {row.katapult ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Owner:</span>
                        <span className="text-white">{row.katapult.owner}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Type:</span>
                        <span className="text-white">{row.katapult.type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Size:</span>
                        <span className="text-white">{row.katapult.size}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Height:</span>
                        <span className="text-white font-mono">{formatHeight(row.katapult.height)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500 italic">No Katapult data available</div>
                  )}
                  
                  <div className="border-t border-slate-700 pt-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Δ Meas-Rec:</span>
                      <DeltaDisplay delta={row.deltaHeightMeasRec} />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Δ Meas-Kat:</span>
                      <DeltaDisplay delta={row.deltaHeightMeasKat} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

// Filter options for QC Tool statuses
const QC_STATUS_OPTIONS = ['Match', 'Added', 'Removed', 'Changed', 'Katapult-Only', 'Katapult-Mismatch'] as const;

export const QCToolTable: React.FC<QCToolTableProps> = ({ rows, sortField, sortDirection, onSort, statusFilter, onStatusFilterChange, threshold, onThresholdChange }) => {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'compact' | 'detailed'>('compact');

  const handleHeaderClick = (field: keyof ComparisonRow) => {
    onSort(field);
  };

  const toggleRowExpansion = (rowKey: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(rowKey)) {
      newExpanded.delete(rowKey);
    } else {
      newExpanded.add(rowKey);
    }
    setExpandedRows(newExpanded);
  };

  const expandAll = () => {
    setExpandedRows(new Set(rows.map(row => row.key)));
  };

  const collapseAll = () => {
    setExpandedRows(new Set());
  };

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-slate-400">
        <div className="text-center">
          <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p>No attachment comparisons found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Table Controls */}
      <div className="flex items-center justify-between bg-slate-750 px-4 py-3 rounded-b-lg border border-slate-600 border-t-0">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-slate-300">View:</span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode('compact')}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                  viewMode === 'compact' 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                Compact
              </button>
              <button
                onClick={() => setViewMode('detailed')}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                  viewMode === 'detailed' 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                Detailed
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-sm text-slate-300">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              className="px-3 py-1 bg-slate-700 text-white rounded border border-slate-600 text-sm"
            >
              <option value="">All Statuses</option>
              {QC_STATUS_OPTIONS.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-sm text-slate-300">Threshold:</label>
            <input
              type="number"
              value={threshold}
              onChange={(e) => onThresholdChange(parseFloat(e.target.value) || 0.5)}
              step="0.1"
              min="0"
              max="10"
              className="w-20 px-2 py-1 bg-slate-700 text-white rounded border border-slate-600 text-sm"
            />
            <span className="text-sm text-slate-300">ft</span>
          </div>
        </div>
        
        {viewMode === 'compact' && (
          <div className="flex items-center space-x-2">
            <button
              onClick={expandAll}
              className="px-3 py-1 text-xs bg-slate-700 text-slate-300 hover:bg-slate-600 rounded-md font-medium transition-colors"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="px-3 py-1 text-xs bg-slate-700 text-slate-300 hover:bg-slate-600 rounded-md font-medium transition-colors"
            >
              Collapse All
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-700 sticky top-0">
            <tr>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-600"
                onClick={() => handleHeaderClick('key')}
              >
                <div className="flex items-center space-x-1">
                  <span>Pole (SCID)</span>
                  <SortIcon field="key" sortField={sortField} sortDirection={sortDirection} />
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                Attachment Info
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                Height Info
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-600"
                onClick={() => handleHeaderClick('deltaHeightMeasRec')}
              >
                <div className="flex items-center space-x-1">
                  <span>Main Δ</span>
                  <SortIcon field="deltaHeightMeasRec" sortField={sortField} sortDirection={sortDirection} />
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-600"
                onClick={() => handleHeaderClick('status')}
              >
                <div className="flex items-center space-x-1">
                  <span>Status</span>
                  <SortIcon field="status" sortField={sortField} sortDirection={sortDirection} />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-slate-800 divide-y divide-slate-700">
            {rows.map((row) => (
              <ExpandableRow
                key={row.key}
                row={row}
                isExpanded={expandedRows.has(row.key)}
                onToggle={() => toggleRowExpansion(row.key)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}; 