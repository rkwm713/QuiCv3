
import React from 'react';
import { ProcessedPole } from '../types';
import { MATCH_TIER_COLORS } from '../constants';

interface PoleDetailModalProps {
  pole: ProcessedPole | null;
  onClose: () => void;
}

const DetailItem: React.FC<{ label: string; value?: string | number | null; className?: string }> = ({ label, value, className }) => (
  <div className={`py-1 ${className}`}>
    <span className="font-semibold text-slate-400">{label}: </span>
    <span className="text-slate-200">{value ?? 'N/A'}</span>
  </div>
);

export const PoleDetailModal: React.FC<PoleDetailModalProps> = ({ pole, onClose }) => {
  if (!pole) return null;

  const tierColorClass = MATCH_TIER_COLORS[pole.matchTier] || 'text-slate-400';

  const formatDisplayValue = (value: string | number | null | undefined, isPercentage: boolean = false): string => {
    if (value === null || value === undefined || value === '') return 'N/A';
    return isPercentage ? `${value.toString()}%` : value.toString();
  };
  
  const formatKatapultPercentage = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return 'N/A';
    return `${value.toString()}%`;
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50 transition-opacity duration-300 ease-in-out">
      <div className="bg-slate-800 p-6 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className={`text-2xl font-bold ${tierColorClass}`}>{pole.matchTier}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
            aria-label="Close modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {pole.spida && (
            <section className="border border-slate-700 p-3 rounded-md">
              <h3 className="text-lg font-semibold text-sky-400 mb-2">SPIDA Data</h3>
              <DetailItem label="SCID" value={pole.spida.scid} />
              <DetailItem label="Pole #" value={pole.spida.poleNum} />
              <DetailItem label="Coordinates" value={pole.spida.coords ? `${pole.spida.coords.lat.toFixed(6)}, ${pole.spida.coords.lon.toFixed(6)}` : 'N/A'} />
              <DetailItem label="Pole Spec" value={pole.editableSpidaSpec} />
              <DetailItem label="Existing %" value={formatDisplayValue(pole.editableSpidaExistingPct, true)} />
              <DetailItem label="Final %" value={formatDisplayValue(pole.editableSpidaFinalPct, true)} />
              <DetailItem label="Comm Drop" value={pole.editableSpidaCommDrop} />
            </section>
          )}

          {pole.katapult && (
            <section className="border border-slate-700 p-3 rounded-md">
              <h3 className="text-lg font-semibold text-emerald-400 mb-2">Katapult Data</h3>
              <DetailItem label="SCID" value={pole.katapult.scid} />
              <DetailItem label="Pole #" value={pole.katapult.poleNum} />
              <DetailItem label="Coordinates" value={pole.katapult.coords ? `${pole.katapult.coords.lat.toFixed(6)}, ${pole.katapult.coords.lon.toFixed(6)}` : 'N/A'} />
              <DetailItem label="Pole Spec" value={pole.katapult.spec} />
              <DetailItem label="Existing %" value={formatKatapultPercentage(pole.katapult.existingPct)} />
              <DetailItem label="Final %" value={formatKatapultPercentage(pole.katapult.finalPct)} />
              <DetailItem label="Comm Drop" value={pole.katapult.commDrop !== null ? (pole.katapult.commDrop ? 'Yes' : 'No') : 'N/A'} />
            </section>
          )}
        </div>
        
        {pole.spida?.rawData && (
             <details className="mt-4 text-xs text-slate-500">
                <summary className="cursor-pointer hover:text-slate-400">Raw SPIDA Data (JSON)</summary>
                <pre className="bg-slate-900 p-2 rounded mt-1 max-h-40 overflow-auto">{JSON.stringify(pole.spida.rawData, null, 2)}</pre>
            </details>
        )}
        {pole.katapult?.rawData && (
             <details className="mt-2 text-xs text-slate-500">
                <summary className="cursor-pointer hover:text-slate-400">Raw Katapult Data (JSON)</summary>
                <pre className="bg-slate-900 p-2 rounded mt-1 max-h-40 overflow-auto">{JSON.stringify(pole.katapult.rawData, null, 2)}</pre>
            </details>
        )}

        <div className="mt-6 text-right">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-md shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-opacity-75"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};