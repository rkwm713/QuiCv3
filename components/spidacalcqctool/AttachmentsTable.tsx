// /components/SpidaQcTool/AttachmentsTable.tsx

import React from 'react';
import { Attachment } from './types';
import { formatMetersToFeetInches } from '../../utils/measurements';

interface AttachmentsTableProps {
  attachments: Attachment[];
}

const AttachmentsTable: React.FC<AttachmentsTableProps> = ({ attachments }) => {
  // Sort attachments by height in descending order (top of the pole first)
  const sortedAttachments = [...attachments].sort((a, b) => b.height - a.height);

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
      <thead>
        <tr>
          <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Attachment Type</th>
          <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Owner</th>
          <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Description/Size</th>
          <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Height (ft/in)</th>
        </tr>
      </thead>
      <tbody>
        {sortedAttachments.map((att, index) => (
          <tr key={index} style={{ 
            opacity: att.synthetic ? 0.7 : 1, 
            fontStyle: att.synthetic ? 'italic' : 'normal' 
          }}>
            <td style={{ border: '1px solid #ddd', padding: '8px' }}>
              {att.type}
              {att.synthetic && <span style={{ color: '#9ca3af', fontSize: '0.8em', marginLeft: '4px' }}>🤖</span>}
            </td>
            <td style={{ border: '1px solid #ddd', padding: '8px' }}>{att.owner}</td>
            <td style={{ border: '1px solid #ddd', padding: '8px' }}>{att.description}</td>
            <td style={{ border: '1px solid #ddd', padding: '8px' }}>{formatMetersToFeetInches(att.height)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default AttachmentsTable;