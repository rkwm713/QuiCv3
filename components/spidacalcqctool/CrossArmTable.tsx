// CrossArmTable.tsx
// Display component for cross-arm mapping with SPIDA vs Katapult comparison

import React from 'react';
import { CrossArmGroup } from './crossArmMapper';

interface CrossArmTableProps {
  crossArmMatches: Array<{
    spidaGroup: CrossArmGroup | null;
    katapultGroup: CrossArmGroup | null;
    heightDifferenceFt?: number;
    matchType: 'exact' | 'close' | 'spida-only' | 'katapult-only';
  }>;
}

const CrossArmTable: React.FC<CrossArmTableProps> = ({ crossArmMatches }) => {
  const getMatchStatusStyle = (matchType: string) => {
    switch (matchType) {
      case 'exact':
        return { backgroundColor: '#22c55e', color: 'white' };
      case 'close':
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
      case 'close':
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
      case 'close':
        return 'Close Match';
      case 'spida-only':
        return 'SPIDA Only';
      case 'katapult-only':
        return 'Katapult Only';
      default:
        return 'Unknown';
    }
  };

  if (crossArmMatches.length === 0) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center', 
        color: '#a0aec0',
        fontStyle: 'italic',
        backgroundColor: '#1a202c',
        border: '1px dashed #4a5568',
        borderRadius: '4px'
      }}>
        No cross-arms found on this pole
      </div>
    );
  }

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
          <th style={styles.th}>Match Status</th>
          <th style={styles.th}>SPIDA Cross-arm</th>
          <th style={{...styles.th, textAlign: 'center'}}>SPIDA Height</th>
          <th style={styles.th}>Katapult Cross-arm</th>
          <th style={{...styles.th, textAlign: 'center'}}>Katapult Height</th>
          <th style={{...styles.th, textAlign: 'center'}}>Height Diff</th>
          <th style={styles.th}>Wires on Arm</th>
        </tr>
      </thead>
      <tbody>
        {crossArmMatches.map((match, idx) => (
          <React.Fragment key={idx}>
            {/* Cross-arm parent row */}
            <tr className={`${idx % 2 === 0 ? 'bg-slate-800' : 'bg-slate-900'} text-white`}>
              {/* Match Status */}
              <td style={styles.td}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.1em' }}>
                    {getMatchStatusIcon(match.matchType)}
                  </span>
                  <span
                    style={{
                      ...getMatchStatusStyle(match.matchType),
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.8em',
                      fontWeight: 'bold'
                    }}
                  >
                    {getMatchStatusText(match.matchType)}
                  </span>
                </div>
              </td>

              {/* SPIDA Cross-arm */}
              <td style={styles.td}>
                {match.spidaGroup ? (
                  <div>
                    <div style={{ fontWeight: '600', color: '#d1d5db' }}>
                      🔧 {match.spidaGroup.armId}
                    </div>
                    <div style={{ fontSize: '0.8em', color: '#9ca3af', marginTop: '2px' }}>
                      {match.spidaGroup.wires.length} wire(s) on {
                        new Set(match.spidaGroup.wires
                          .filter(w => w.insulatorId) 
                          .map(w => w.insulatorId)
                        ).size
                      } insulator(s)
                    </div>
                  </div>
                ) : (
                  <span style={{ color: '#6b7280', fontStyle: 'italic' }}>No SPIDA cross-arm</span>
                )}
              </td>

              {/* SPIDA Height */}
              <td style={{ ...styles.td, textAlign: 'center', fontFamily: 'monospace', fontSize: '1.4em', fontWeight: 600 }}>
                {match.spidaGroup ? (
                  `${match.spidaGroup.armHeight.toFixed(1)}ft`
                ) : (
                  <span style={{ color: '#6b7280' }}>—</span>
                )}
              </td>

              {/* Katapult Cross-arm */}
              <td style={styles.td}>
                {match.katapultGroup ? (
                  <div>
                    <div style={{ fontWeight: '600', color: '#d1d5db' }}>
                      🔧 {match.katapultGroup.armId}
                      {match.katapultGroup.isPseudo && 
                        <span style={{ color: '#f59e0b', marginLeft: '4px', fontSize: '0.8em' }}>(pseudo)</span>
                      }
                    </div>
                    <div style={{ fontSize: '0.8em', color: '#9ca3af', marginTop: '2px' }}>
                      {match.katapultGroup.wires.length} wire(s) at same height
                    </div>
                  </div>
                ) : (
                  <span style={{ color: '#6b7280', fontStyle: 'italic' }}>No Katapult cross-arm</span>
                )}
              </td>

              {/* Katapult Height */}
              <td style={{ ...styles.td, textAlign: 'center', fontFamily: 'monospace', fontSize: '1.4em', fontWeight: 600 }}>
                {match.katapultGroup ? (
                  `${match.katapultGroup.armHeight.toFixed(1)}ft`
                ) : (
                  <span style={{ color: '#6b7280' }}>—</span>
                )}
              </td>

              {/* Height Difference */}
              <td style={{ ...styles.td, textAlign: 'center' }}>
                {match.heightDifferenceFt !== undefined ? (
                  <span style={{
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '0.8em',
                    fontFamily: 'monospace',
                    backgroundColor: match.heightDifferenceFt < 0.1 ? '#22c55e' : 
                                   match.heightDifferenceFt < 1.0 ? '#f59e0b' : '#ef4444',
                    color: 'white'
                  }}>
                    ±{match.heightDifferenceFt.toFixed(1)}ft
                  </span>
                ) : (
                  <span style={{ color: '#6b7280', fontSize: '0.8em' }}>N/A</span>
                )}
              </td>

              {/* Wire Count Summary */}
              <td style={styles.td}>
                <div style={{ fontSize: '0.9em' }}>
                  {match.spidaGroup && (
                    <div style={{ color: '#a0aec0' }}>
                      SPIDA: {match.spidaGroup.wires.length} wires
                    </div>
                  )}
                  {match.katapultGroup && (
                    <div style={{ color: '#a0aec0' }}>
                      Katapult: {match.katapultGroup.wires.length} wires
                    </div>
                  )}
                </div>
              </td>
            </tr>

            {/* Wire detail rows for SPIDA */}
            {match.spidaGroup?.wires.map((wire, wireIdx) => (
              <tr
                key={`spida-${wireIdx}`}
                className="bg-slate-900/60 text-slate-300"
              >
                <td style={{ ...styles.tdChild, paddingLeft: '1rem' }}>
                  <span style={{ color: '#22c55e', fontSize: '0.8em' }}>SPIDA</span>
                </td>
                <td style={{ ...styles.tdChild, paddingLeft: '2rem' }}>
                  <div style={{ fontWeight: 400, color: '#a0aec0' }}>
                    🔌 {wire.wireOwner} — {wire.wireType}
                    {wire.insulatorId && (
                      <span style={{ color: '#9ca3af', fontSize: '0.8em', marginLeft: '8px' }}>
                        (via {wire.insulatorId})
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ ...styles.tdChild, textAlign: 'center', fontFamily: 'monospace', fontSize: '1.1em' }}>
                  {wire.crossArmHt.toFixed(1)}ft
                </td>
                <td colSpan={4} style={{ ...styles.tdChild, color: '#6b7280', fontStyle: 'italic' }}>
                  Wire ID: {wire.wireId}
                </td>
              </tr>
            ))}

            {/* Wire detail rows for Katapult */}
            {match.katapultGroup?.wires.map((wire, wireIdx) => (
              <tr
                key={`katapult-${wireIdx}`}
                className="bg-slate-900/60 text-slate-300"
              >
                <td style={{ ...styles.tdChild, paddingLeft: '1rem' }}>
                  <span style={{ color: '#3b82f6', fontSize: '0.8em' }}>Katapult</span>
                </td>
                <td style={{ ...styles.tdChild, paddingLeft: '2rem', color: '#6b7280' }}>
                  —
                </td>
                <td style={{ ...styles.tdChild, textAlign: 'center', color: '#6b7280' }}>
                  —
                </td>
                <td style={{ ...styles.tdChild, paddingLeft: '2rem' }}>
                  <div style={{ fontWeight: 400, color: '#a0aec0' }}>
                    🔌 {wire.wireOwner} — {wire.wireType}
                  </div>
                </td>
                <td style={{ ...styles.tdChild, textAlign: 'center', fontFamily: 'monospace', fontSize: '1.1em' }}>
                  {wire.crossArmHt.toFixed(1)}ft
                </td>
                <td style={{ ...styles.tdChild, color: '#6b7280', fontStyle: 'italic' }}>
                  Wire ID: {wire.wireId}
                </td>
              </tr>
            ))}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  );
};

const styles = {
  th: {
    padding: '8px 12px',
    textAlign: 'left' as const,
    color: '#e2e8f0',
  },
  td: {
    border: '1px solid #4a5568',
    padding: '10px 12px',
    verticalAlign: 'top' as const,
  },
  tdChild: {
    border: '1px solid #4a5568',
    padding: '6px 12px',
    verticalAlign: 'top' as const,
  },
};

export default CrossArmTable; 