// AttachmentPointTable.tsx
// Clean comparison table for normalized attachment points

import React from 'react';
import { AttachmentPointComparison } from './types';
import { formatHeightFtIn } from './comparisonHelpers';

interface AttachmentPointTableProps {
  comparisons: AttachmentPointComparison[];
}

const AttachmentPointTable: React.FC<AttachmentPointTableProps> = ({ comparisons }) => {
  // Sort by height (highest first)
  const sortedComparisons = [...comparisons].sort((a, b) => {
    const aHeight = a.spidaPoint?.height || a.katapultPoint?.height || 0;
    const bHeight = b.spidaPoint?.height || b.katapultPoint?.height || 0;
    return bHeight - aHeight;
  });

  const getMatchStatusStyle = (matchType: string) => {
    switch (matchType) {
      case 'exact':
        return { backgroundColor: '#22c55e', color: 'white' };
      case 'height-only':
        return { backgroundColor: '#f59e0b', color: 'white' };
      case 'spida-only':
        return { backgroundColor: '#ef4444', color: 'white' };
      case 'katapult-only':
        return { backgroundColor: '#3b82f6', color: 'white' };
      default:
        return { backgroundColor: '#6b7280', color: 'white' };
    }
  };

  const getMatchStatusIcon = (matchType: string) => {
    switch (matchType) {
      case 'exact':
        return '✅';
      case 'height-only':
        return '⚠️';
      case 'spida-only':
        return '❌';
      case 'katapult-only':
        return '📍';
      default:
        return '❓';
    }
  };

  const getMatchStatusText = (matchType: string) => {
    switch (matchType) {
      case 'exact':
        return 'Exact Match';
      case 'height-only':
        return 'Height Match';
      case 'spida-only':
        return 'SPIDA Only';
      case 'katapult-only':
        return 'Katapult Only';
      default:
        return 'Unknown';
    }
  };

  const DeltaCell: React.FC<{ heightDifference?: number }> = ({ heightDifference }) => {
    if (heightDifference === undefined) {
      return <span className="text-slate-400 text-xs">N/A</span>;
    }
    
    if (heightDifference < 0.01) {
      return <span className="text-slate-400 text-xs">—</span>;
    }
    
    const chipClasses = "px-1.5 rounded text-xs font-mono text-amber-400 bg-amber-900/40";
    
    return (
      <span className={chipClasses}>
        Δ {formatHeightFtIn(heightDifference)}
      </span>
    );
  };

  return (
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        marginTop: 0,
        border: 'none',
        fontSize: '0.9em',
        backgroundColor: '#1e1e1e',
        color: '#ffffff',
      }}
    >
      <thead className="sticky top-0 z-[5] bg-slate-700/90 backdrop-blur font-medium text-xs border-b border-slate-600">
        <tr>
          <th style={styles.thCondensed}>Match Status</th>
          <th style={styles.thCondensed}>SPIDA Attachment Point</th>
          <th style={{...styles.thCondensed, textAlign: 'center'}}>SPIDA Height</th>
          <th style={styles.thCondensed}>Katapult Attachment Point</th>
          <th style={{...styles.thCondensed, textAlign: 'center'}}>Katapult Height</th>
          <th style={{...styles.thCondensed, textAlign: 'center'}}>Difference</th>
        </tr>
      </thead>
      <tbody>
        {sortedComparisons.map((comparison, idx) => (
          <tr
            key={idx}
            className={`${idx % 2 === 0 ? 'bg-slate-800' : 'bg-slate-900'} text-white`}
          >
            {/* Match Status */}
            <td style={styles.td}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.1em' }}>
                  {getMatchStatusIcon(comparison.matchType)}
                </span>
                <span
                  style={{
                    ...getMatchStatusStyle(comparison.matchType),
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '0.8em',
                    fontWeight: 'bold'
                  }}
                >
                  {getMatchStatusText(comparison.matchType)}
                </span>
              </div>
            </td>

            {/* SPIDA Attachment Point */}
            <td style={styles.td}>
              {comparison.spidaPoint ? (
                <div>
                  <div style={{ fontWeight: '600', color: '#d1d5db' }}>
                    {comparison.spidaPoint.owner} — {comparison.spidaPoint.description}
                  </div>
                  <div style={{ fontSize: '0.8em', color: '#9ca3af', marginTop: '2px' }}>
                    {comparison.spidaPoint.wires.length} wire(s)
                    {comparison.spidaPoint.synthetic && 
                      <span style={{ color: '#f59e0b', marginLeft: '4px' }}>(synthetic)</span>
                    }
                  </div>
                </div>
              ) : (
                <span style={{ color: '#6b7280', fontStyle: 'italic' }}>No SPIDA data</span>
              )}
            </td>

            {/* SPIDA Height */}
            <td style={{ ...styles.td, textAlign: 'center', fontFamily: 'monospace', fontSize: '1.4em', fontWeight: 600 }}>
              {comparison.spidaPoint ? (
                formatHeightFtIn(comparison.spidaPoint.height)
              ) : (
                <span style={{ color: '#6b7280' }}>—</span>
              )}
            </td>

            {/* Katapult Attachment Point */}
            <td style={styles.td}>
              {comparison.katapultPoint ? (
                <div>
                  <div style={{ fontWeight: '600', color: '#d1d5db' }}>
                    {comparison.katapultPoint.owner} — {comparison.katapultPoint.description}
                  </div>
                  <div style={{ fontSize: '0.8em', color: '#9ca3af', marginTop: '2px' }}>
                    {comparison.katapultPoint.wires.length} wire(s)
                    {comparison.katapultPoint.synthetic && 
                      <span style={{ color: '#f59e0b', marginLeft: '4px' }}>(synthetic)</span>
                    }
                  </div>
                </div>
              ) : (
                <span style={{ color: '#6b7280', fontStyle: 'italic' }}>No Katapult data</span>
              )}
            </td>

            {/* Katapult Height */}
            <td style={{ ...styles.td, textAlign: 'center', fontFamily: 'monospace', fontSize: '1.4em', fontWeight: 600 }}>
              {comparison.katapultPoint ? (
                formatHeightFtIn(comparison.katapultPoint.height)
              ) : (
                <span style={{ color: '#6b7280' }}>—</span>
              )}
            </td>

            {/* Height Difference */}
            <td style={{ ...styles.td, textAlign: 'center' }}>
              <DeltaCell heightDifference={comparison.heightDifference} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const styles = {
  thCondensed: {
    padding: '8px 12px',
    textAlign: 'left' as const,
    color: '#e2e8f0',
  },
  td: {
    border: '1px solid #4a5568',
    padding: '10px 12px',
    verticalAlign: 'top' as const,
  },
};

export default AttachmentPointTable; 