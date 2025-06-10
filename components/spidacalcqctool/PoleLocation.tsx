// /components/SpidaQcTool/PoleLocation.tsx

import React from 'react';
import { PoleLocationData } from './types';
import AttachmentsTable from './AttachmentsTable';
import { formatMetersToFeetInches } from '../../utils/measurements';

interface PoleLocationProps {
  pole: PoleLocationData;
}

const PoleLocation: React.FC<PoleLocationProps> = ({ pole }) => {
  const firstDesign = pole.designs[0]; // To get pole metadata

  return (
    <div style={{ border: '1px solid #ccc', padding: '16px', margin: '16px 0', borderRadius: '8px' }}>
      <h3>Pole Location: {pole.label}</h3>
      <p>
        This pole is a{' '}
        <strong>
          {firstDesign.pole.species}, Class {firstDesign.pole.classOfPole}
        </strong>
        , with a height of <strong>{formatMetersToFeetInches(firstDesign.pole.height.value)}</strong>.
      </p>

      {pole.designs.map((design) => (
        <div key={design.label} style={{ marginTop: '20px' }}>
          <h4>{design.label}</h4>
          <AttachmentsTable attachments={design.attachments} />
        </div>
      ))}
    </div>
  );
};

export default PoleLocation;