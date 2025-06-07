import React, { useState } from 'react';
import { generateMakeReadyReport } from '../services/makeReadyReportService';

interface MakeReadyReportProps {
  katapultJson: any | null;
  geoJson?: any | null;
}

/**
 * Make-Ready Report page.
 *
 * Assumes the user already uploaded Katapult (Job) JSON through the existing
 * FileLoader component in the Data-Management tab.  We simply reuse that raw
 * JSON object that lives in <App /> state and is forwarded into the dashboard
 * layout.
 */
export const MakeReadyReport: React.FC<MakeReadyReportProps> = ({ katapultJson, geoJson = null }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [log, setLog] = useState<string>('');

  const handleGenerate = async () => {
    if (!katapultJson) {
      setLog('Error: Katapult Job JSON has not been loaded yet.');
      return;
    }

    setLog('Generating Excel workbook...');
    setIsGenerating(true);
    setDownloadUrl(null);
    try {
      const blob = await generateMakeReadyReport(katapultJson, geoJson);
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setLog('Report generated successfully.');
    } catch (err) {
      console.error(err);
      setLog(`Error: ${(err as Error).message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6 p-4 max-w-2xl mx-auto">
      <h2 className="text-2xl font-semibold">Make-Ready Report</h2>

      <p className="text-sm text-muted">This tool converts your loaded Katapult Job JSON (and optional GeoJSON) into a formatted Excel workbook for make-ready engineering.  Click &quot;Generate Report&quot; once your Job JSON is loaded.</p>

      <button
        className="btn btn-primary"
        disabled={isGenerating}
        onClick={handleGenerate}
      >
        {isGenerating ? 'Generating…' : 'Generate Report'}
      </button>

      {downloadUrl && (
        <div className="space-y-2">
          <p className="text-success">Report ready!</p>
          <a
            href={downloadUrl}
            download={`make-ready-report-${Date.now()}.xlsx`}
            className="btn btn-secondary"
          >
            Download Excel
          </a>
        </div>
      )}

      {log && (
        <pre className="bg-base-200 p-3 rounded text-sm whitespace-pre-wrap">{log}</pre>
      )}
    </div>
  );
}; 