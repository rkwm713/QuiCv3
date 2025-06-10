// /components/SpidaQcTool/GuyMatchingTable.tsx

import React from 'react';
import { MatchResult } from './types';

interface GuyMatchingTableProps {
  matchResults: MatchResult[];
}

const GuyMatchingTable: React.FC<GuyMatchingTableProps> = ({ matchResults }) => {
  if (matchResults.length === 0) {
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
        No guy attachments found on this pole
      </div>
    );
  }

  const matchedCount = matchResults.filter(r => r.status === 'matched').length;
  const totalCount = matchResults.length;
  const allMatch = matchedCount === totalCount;

  return (
    <div>
      {/* Summary Header */}
      <div style={{ 
        marginBottom: '16px', 
        padding: '12px', 
        backgroundColor: allMatch ? '#1c4532' : '#744210',
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <span style={{ fontSize: '1.2em' }}>
          {allMatch ? '✅' : '⚠️'}
        </span>
        <div>
          <div style={{ fontWeight: 'bold', color: '#ffffff' }}>
            Guy Matching: {matchedCount}/{totalCount} matched
          </div>
          <div style={{ fontSize: '0.9em', color: '#e2e8f0' }}>
            {allMatch ? 'All guys match exactly (no tolerance)' : 'Some guys do not match - review required'}
          </div>
        </div>
      </div>

      {/* Results Table */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.9em',
          backgroundColor: '#1e1e1e',
          color: '#ffffff',
        }}
      >
        <thead>
          <tr style={{ backgroundColor: '#2d3748' }}>
            <th style={styles.th}>Status</th>
            <th style={styles.th}>Owner</th>
            <th style={styles.th}>Height (inches)</th>
            <th style={styles.th}>Katapult ID</th>
            <th style={styles.th}>SPIDA ID</th>
          </tr>
        </thead>
        <tbody>
          {matchResults.map((result, idx) => (
            <tr
              key={idx}
              style={{
                backgroundColor: idx % 2 === 0 ? '#2d3748' : '#1a202c',
              }}
            >
              {/* Status */}
              <td style={styles.td}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.1em' }}>
                    {result.status === 'matched' ? '✅' : 
                     result.status === 'unmatched_katapult' ? '🔶' : '🔷'}
                  </span>
                  <span style={{
                    color: result.status === 'matched' ? '#68d391' : 
                           result.status === 'unmatched_katapult' ? '#f6ad55' : '#63b3ed',
                    fontWeight: 'bold',
                    textTransform: 'capitalize'
                  }}>
                    {result.status === 'matched' ? 'Matched' :
                     result.status === 'unmatched_katapult' ? 'Katapult Only' : 'SPIDA Only'}
                  </span>
                </div>
              </td>

              {/* Owner */}
              <td style={styles.td}>
                <span style={{ fontWeight: 'bold' }}>
                  {result.owner}
                </span>
              </td>

              {/* Height */}
              <td style={styles.td}>
                <span style={{ 
                  fontFamily: 'monospace', 
                  fontSize: '1.1em',
                  fontWeight: 'bold'
                }}>
                  {result.height_in}"
                </span>
              </td>

              {/* Katapult ID */}
              <td style={styles.td}>
                {'katapult_id' in result ? (
                  <code style={{ 
                    backgroundColor: '#3182ce', 
                    color: 'white', 
                    padding: '2px 6px', 
                    borderRadius: '4px',
                    fontSize: '0.8em'
                  }}>
                    {result.katapult_id}
                  </code>
                ) : (
                  <span style={{ color: '#718096' }}>—</span>
                )}
              </td>

              {/* SPIDA ID */}
              <td style={styles.td}>
                {'spida_id' in result ? (
                  <code style={{ 
                    backgroundColor: '#38a169', 
                    color: 'white', 
                    padding: '2px 6px', 
                    borderRadius: '4px',
                    fontSize: '0.8em'
                  }}>
                    {result.spida_id}
                  </code>
                ) : (
                  <span style={{ color: '#718096' }}>—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const styles = {
  th: {
    border: '1px solid #4a5568',
    padding: '10px 12px',
    textAlign: 'left' as const,
    fontWeight: 600,
    color: '#e2e8f0',
  },
  td: {
    border: '1px solid #4a5568',
    padding: '10px 12px',
    verticalAlign: 'top' as const,
  },
};

export default GuyMatchingTable; 