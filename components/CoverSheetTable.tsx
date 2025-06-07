import React, { useState, useMemo, useEffect } from 'react';
import { ProcessedPole } from '../types';
import { OpenAIService } from '../services/openaiService';
import { getAnalysisLoadPercent } from '../services/dataProcessingService';

interface CoverSheetRow {
  id: string;
  scid: string;
  poleNumber: string;
  existingLoading: string;
  finalLoading: string;
  notes: string;
  isGeneratingNotes: boolean;
}

interface CoverSheetTableProps {
  data: ProcessedPole[];
}

export const CoverSheetTable: React.FC<CoverSheetTableProps> = ({ data }) => {
  const [coverSheetData, setCoverSheetData] = useState<CoverSheetRow[]>([]);
  const [isGeneratingAllNotes, setIsGeneratingAllNotes] = useState(false);
  const aiService = new OpenAIService();

  // Transform ProcessedPole data to CoverSheet format
  const transformedData = useMemo(() => {
    return data
      .filter(pole => pole.spida) // Only include poles with SPIDA data
      .map(pole => {
        const scid = pole.displaySpidaScid || 'N/A';
        
        // Format pole number as PLXXXXXX
        let poleNumber = 'N/A';
        if (pole.displaySpidaPoleNum && pole.displaySpidaPoleNum !== 'N/A') {
          const cleanNum = pole.displaySpidaPoleNum.replace(/\D/g, '');
          if (cleanNum) {
            poleNumber = `PL${cleanNum.padStart(6, '0')}`;
          }
        }

        // Format loading percentages
        const existingLoading = pole.editableSpidaExistingPct && pole.editableSpidaExistingPct !== 'N/A' 
          ? `${parseFloat(pole.editableSpidaExistingPct).toFixed(2)}%` 
          : 'N/A';
        
        const finalLoading = pole.editableSpidaFinalPct && pole.editableSpidaFinalPct !== 'N/A' 
          ? `${parseFloat(pole.editableSpidaFinalPct).toFixed(2)}%` 
          : 'N/A';

        return {
          id: pole.id,
          scid,
          poleNumber,
          existingLoading,
          finalLoading,
          notes: '',
          isGeneratingNotes: false,
        };
      })
      .sort((a, b) => {
        // Sort by SCID numerically (SCID 1 comes first)
        const scidA = parseInt(a.scid) || 0;
        const scidB = parseInt(b.scid) || 0;
        return scidA - scidB;
      });
  }, [data]);

  // Initialize coverSheetData when transformedData changes
  useEffect(() => {
    setCoverSheetData(transformedData);
  }, [transformedData]);

  // Generate AI notes for a specific pole
  const generateNotesForPole = async (poleId: string) => {
    const poleIndex = coverSheetData.findIndex(row => row.id === poleId);
    if (poleIndex === -1) return;

    const pole = data.find(p => p.id === poleId);
    if (!pole?.spida?.rawData) return;

    // Update state to show loading
    setCoverSheetData(prev => 
      prev.map((row, index) => 
        index === poleIndex 
          ? { ...row, isGeneratingNotes: true, notes: 'Generating notes...' }
          : row
      )
    );

    try {
      // Get raw SPIDA data for this pole
      const rawData = pole.spida.rawData;
      
      // Extract measured and recommended designs
      let measuredDesign = null;
      let recommendedDesign = null;

      // Handle different SPIDA data structures
      if (rawData.designs) {
        measuredDesign = rawData.designs.find((d: any) => d.layerType === "Measured");
        recommendedDesign = rawData.designs.find((d: any) => d.layerType === "Recommended");
      } else {
        measuredDesign = rawData.measuredDesign;
        recommendedDesign = rawData.recommendedDesign;
      }

      // Extract specifications
      const getSpecFromDesign = (design: any) => {
        if (!design) return null;
        const pole = design.pole || design.structure?.pole;
        if (!pole) return null;
        
        return {
          height: pole.length?.value || pole.length || null,
          class: pole.class || pole.classOfPole || null,
          species: pole.species || null,
        };
      };

      const measuredSpec = getSpecFromDesign(measuredDesign);
      const recommendedSpec = getSpecFromDesign(recommendedDesign);

      // Get loading percentages
      const existingPct = getAnalysisLoadPercent(measuredDesign);
      const finalPct = getAnalysisLoadPercent(recommendedDesign);

      // Create context for AI
      const analysisContext = {
        poleId: pole.displaySpidaScid,
        poleNumber: coverSheetData[poleIndex].poleNumber,
        measuredDesign: {
          specification: measuredSpec,
          loadingPercent: existingPct,
          hasDesign: !!measuredDesign
        },
        recommendedDesign: {
          specification: recommendedSpec,
          loadingPercent: finalPct,
          hasDesign: !!recommendedDesign
        },
        differences: {
          specChanged: JSON.stringify(measuredSpec) !== JSON.stringify(recommendedSpec),
          loadingChanged: existingPct !== finalPct,
          hasRecommendedDesign: !!recommendedDesign
        }
      };

      // Try AI generation first, fall back to rule-based notes if AI fails
      let notes = '';
      
      try {
        const prompt = `
You are a utility pole engineering expert. Generate a single, concise sentence describing the work being done from the measured design to the recommended design for this pole:

POLE ANALYSIS:
- Pole ID: ${analysisContext.poleId}
- Pole Number: ${analysisContext.poleNumber}

MEASURED DESIGN:
- Specification: ${JSON.stringify(measuredSpec)}
- Loading: ${existingPct || 'N/A'}%

RECOMMENDED DESIGN:
- Specification: ${JSON.stringify(recommendedSpec)}
- Loading: ${finalPct || 'N/A'}%

CHANGES DETECTED:
- Specification changed: ${analysisContext.differences.specChanged}
- Loading changed: ${analysisContext.differences.loadingChanged}
- Has recommended design: ${analysisContext.differences.hasRecommendedDesign}

Generate ONE SENTENCE that describes:
- The type of work being performed (e.g., "pole replacement", "structural upgrade", "capacity enhancement", "design verification")
- The key change being made (if any)
- The purpose or benefit

Examples:
- "Pole replacement from 35ft Class 4 to 40ft Class 3 to increase capacity from 67.3% to 45.2%"
- "Structural analysis verification with no design changes required"
- "Capacity enhancement through design optimization reducing loading from 89.1% to 68.4%"

Keep it professional, concise, and specific to the actual changes observed.
        `;

        notes = await aiService.generateAnalysis(prompt, 'coversheet-notes');
      } catch (error) {
        console.warn('AI generation failed, using rule-based fallback:', error);
        
        // Rule-based fallback for development
        const existingNum = existingPct ? parseFloat(existingPct) : null;
        const finalNum = finalPct ? parseFloat(finalPct) : null;
        
        if (!analysisContext.differences.hasRecommendedDesign) {
          notes = 'Structural analysis verification with current design configuration';
        } else if (analysisContext.differences.specChanged && analysisContext.differences.loadingChanged) {
          const loadingChange = existingNum && finalNum ? ` reducing loading from ${existingNum.toFixed(1)}% to ${finalNum.toFixed(1)}%` : '';
          notes = `Pole replacement with structural upgrade${loadingChange}`;
        } else if (analysisContext.differences.specChanged) {
          notes = 'Pole replacement with updated specifications for enhanced structural integrity';
        } else if (analysisContext.differences.loadingChanged) {
          const loadingChange = existingNum && finalNum ? ` from ${existingNum.toFixed(1)}% to ${finalNum.toFixed(1)}%` : '';
          notes = `Capacity optimization reducing pole loading${loadingChange}`;
        } else {
          notes = 'Design verification and structural analysis completed with no changes required';
        }
      }
      
      // Update with generated notes
      setCoverSheetData(prev => 
        prev.map((row, index) => 
          index === poleIndex 
            ? { ...row, isGeneratingNotes: false, notes: notes.trim() }
            : row
        )
      );

    } catch (error) {
      console.error('Error generating notes for pole:', poleId, error);
      setCoverSheetData(prev => 
        prev.map((row, index) => 
          index === poleIndex 
            ? { ...row, isGeneratingNotes: false, notes: 'Error generating notes' }
            : row
        )
      );
    }
  };

  // Generate AI notes for all poles
  const generateAllNotes = async () => {
    setIsGeneratingAllNotes(true);
    
    try {
      for (let i = 0; i < coverSheetData.length; i++) {
        await generateNotesForPole(coverSheetData[i].id);
        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error('Error generating all notes:', error);
    } finally {
      setIsGeneratingAllNotes(false);
    }
  };

  // Export to CSV
  const exportToCsv = () => {
    const headers = ['SCID', 'Pole Number', 'Existing Loading %', 'Final Loading %', 'Notes'];
    const csvContent = [
      headers.join(','),
      ...coverSheetData.map(row => [
        row.scid,
        row.poleNumber,
        row.existingLoading,
        row.finalLoading,
        `"${row.notes.replace(/"/g, '""')}"` // Escape quotes in notes
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'cover_sheet.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!data || data.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
        <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center">
          <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-slate-200">No cover sheet data</h3>
          <p className="text-slate-400 max-w-md">
            Load your SPIDA and Katapult files and run the comparison to generate a cover sheet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header with Controls */}
      <div className="flex-shrink-0 p-4 bg-slate-800/90 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-200">Cover Sheet</h3>
            <p className="text-sm text-slate-400">
              Showing {coverSheetData.length} pole{coverSheetData.length !== 1 ? 's' : ''} from SPIDA data
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={generateAllNotes}
              disabled={isGeneratingAllNotes}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
            >
              {isGeneratingAllNotes ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span>Generate All Notes</span>
                </>
              )}
            </button>
            
            <button
              onClick={exportToCsv}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full divide-y divide-slate-700/50">
          <thead className="bg-slate-800/50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider border-r border-slate-700/30 min-w-[120px]">
                SCID
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider border-r border-slate-700/30 min-w-[150px]">
                Pole Number
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider border-r border-slate-700/30 min-w-[140px]">
                Existing Loading %
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider border-r border-slate-700/30 min-w-[140px]">
                Final Loading %
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider min-w-[300px]">
                <div className="flex items-center space-x-2">
                  <span>Notes</span>
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider min-w-[100px]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {coverSheetData.map((row, index) => (
              <tr 
                key={row.id} 
                className={`
                  transition-all duration-200 hover:bg-slate-700/20
                  ${index % 2 === 0 ? 'bg-slate-800/20' : 'bg-slate-800/10'}
                `}
              >
                <td className="px-4 py-3 text-sm text-slate-300 border-r border-slate-700/20">
                  {row.scid}
                </td>
                <td className="px-4 py-3 text-sm text-slate-300 border-r border-slate-700/20 font-mono">
                  {row.poleNumber}
                </td>
                <td className="px-4 py-3 text-sm text-slate-300 border-r border-slate-700/20 text-center">
                  <span className={`
                    px-2 py-1 rounded-md text-xs font-medium
                    ${row.existingLoading !== 'N/A' && parseFloat(row.existingLoading) > 90 
                      ? 'bg-red-500/20 text-red-400' 
                      : 'bg-slate-700/50 text-slate-300'
                    }
                  `}>
                    {row.existingLoading}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-300 border-r border-slate-700/20 text-center">
                  <span className={`
                    px-2 py-1 rounded-md text-xs font-medium
                    ${row.finalLoading !== 'N/A' && parseFloat(row.finalLoading) > 90 
                      ? 'bg-red-500/20 text-red-400' 
                      : 'bg-slate-700/50 text-slate-300'
                    }
                  `}>
                    {row.finalLoading}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-300">
                  {row.isGeneratingNotes ? (
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 animate-spin text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span className="text-emerald-400">Generating notes...</span>
                    </div>
                  ) : row.notes ? (
                    <span className="text-slate-200">{row.notes}</span>
                  ) : (
                    <span className="text-slate-500 italic">No notes generated</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  <button
                    onClick={() => generateNotesForPole(row.id)}
                    disabled={row.isGeneratingNotes || isGeneratingAllNotes}
                    className="inline-flex items-center space-x-1 px-2 py-1 text-xs bg-emerald-600/20 text-emerald-400 rounded hover:bg-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <span>Generate</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}; 