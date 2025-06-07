import React, { useState, useMemo, useEffect } from 'react';
import { ProcessedPole } from '../types';
import { OpenAIService } from '../services/openaiService';

// Enhanced change summary interface following the user's roadmap
interface PoleChangeSummary {
  poleId: string;
  added: string[];      // human-readable snippets
  removed: string[];
  relocated: string[];
  heightChange?: string;
  clearanceNote?: string;
  guyWireNote?: string;
  special?: string[];
  loadingChange?: string;
  specificationChange?: string;
}

interface CoverSheetRow {
  id: string;
  scid: string;
  poleNumber: string;
  existingLoading: string;
  finalLoading: string;
  notes: string;
  isGeneratingNotes: boolean;
  isEditingNotes: boolean;
}

interface CoverSheetTableProps {
  data: ProcessedPole[];
}

// Helper function to extract attachment changes
function extractAttachmentChanges(spidaData: any): { added: string[], removed: string[], relocated: string[] } {
  const added: string[] = [];
  const removed: string[] = [];
  const relocated: string[] = [];

  // Extract SPIDA attachments (measured vs recommended designs)
  let spidaMeasured: any = null;
  let spidaRecommended: any = null;

  if (spidaData?.designs) {
    spidaMeasured = spidaData.designs.find((d: any) => d.layerType === "Measured");
    spidaRecommended = spidaData.designs.find((d: any) => d.layerType === "Recommended");
  } else {
    spidaMeasured = spidaData?.measuredDesign;
    spidaRecommended = spidaData?.recommendedDesign;
  }

  // Compare measured vs recommended designs for changes
  if (spidaMeasured && spidaRecommended) {
    const measuredAttachments = extractAttachmentsFromDesign(spidaMeasured);
    const recommendedAttachments = extractAttachmentsFromDesign(spidaRecommended);

    // Find additions (in recommended but not in measured)
    recommendedAttachments.forEach(recAtt => {
      const matchFound = measuredAttachments.some(measAtt => 
        isSimilarAttachment(measAtt, recAtt));
      if (!matchFound) {
        added.push(formatAttachmentDescription(recAtt));
      }
    });

    // Find removals (in measured but not in recommended)
    measuredAttachments.forEach(measAtt => {
      const matchFound = recommendedAttachments.some(recAtt => 
        isSimilarAttachment(measAtt, recAtt));
      if (!matchFound) {
        removed.push(formatAttachmentDescription(measAtt));
      }
    });

    // Find relocations (same type but different height by >2 feet)
    measuredAttachments.forEach(measAtt => {
      const matchingRec = recommendedAttachments.find(recAtt => 
        isSimilarAttachment(measAtt, recAtt) && 
        Math.abs(recAtt.height - measAtt.height) > 2);
      if (matchingRec) {
        relocated.push(`${formatAttachmentDescription(measAtt)} moved from ${measAtt.height}′ to ${matchingRec.height}′`);
      }
    });
  }

  return { added, removed, relocated };
}

// Helper function to extract attachments from a design
function extractAttachmentsFromDesign(design: any): any[] {
  const attachments: any[] = [];
  
  if (design?.wires) {
    design.wires.forEach((wire: any) => {
      if (wire.attachments) {
        wire.attachments.forEach((att: any) => {
          attachments.push({
            type: 'wire-attachment',
            owner: wire.owner || 'Unknown',
            height: att.distance?.value || att.height || 0,
            wireType: wire.wireType || 'unknown'
          });
        });
      }
    });
  }

  if (design?.spans) {
    design.spans.forEach((span: any) => {
      if (span.wires) {
        span.wires.forEach((wire: any) => {
          if (wire.attachments) {
            wire.attachments.forEach((att: any) => {
              attachments.push({
                type: 'span-attachment',
                owner: wire.owner || 'Unknown',
                height: att.distance?.value || att.height || 0,
                wireType: wire.wireType || 'unknown'
              });
            });
          }
        });
      }
    });
  }

  return attachments;
}

// Helper function to check if two attachments are similar
function isSimilarAttachment(att1: any, att2: any): boolean {
  return att1.type === att2.type && 
         att1.owner === att2.owner && 
         att1.wireType === att2.wireType;
}

// Helper function to format attachment description
function formatAttachmentDescription(attachment: any): string {
  const height = Math.round(attachment.height);
  const owner = attachment.owner !== 'Unknown' ? ` (${attachment.owner})` : '';
  const wireType = attachment.wireType !== 'unknown' ? ` ${attachment.wireType}` : '';
  return `${attachment.type}${wireType} at ${height}′${owner}`;
}

// Enhanced function to summarize all pole changes
function summarizePoleChanges(pole: any): PoleChangeSummary {
  const poleId = pole.displaySpidaScid || pole.displayKatapultScid || pole.id;
  
  // Extract attachment changes
  const { added, removed, relocated } = extractAttachmentChanges(
    pole.spida?.rawData
  );

  // Check for height changes
  let heightChange: string | undefined;
  if (pole.spida?.rawData) {
    const measuredDesign = pole.spida.rawData.designs?.find((d: any) => d.layerType === "Measured");
    const recommendedDesign = pole.spida.rawData.designs?.find((d: any) => d.layerType === "Recommended");
    
    if (measuredDesign && recommendedDesign) {
      const measuredHeight = measuredDesign.pole?.length?.value || measuredDesign.structure?.pole?.length?.value;
      const recommendedHeight = recommendedDesign.pole?.length?.value || recommendedDesign.structure?.pole?.length?.value;
      
      if (measuredHeight && recommendedHeight && Math.abs(recommendedHeight - measuredHeight) > 1) {
        heightChange = `pole height changed from ${Math.round(measuredHeight)}′ to ${Math.round(recommendedHeight)}′`;
      }
    }
  }

  // Check for loading changes
  let loadingChange: string | undefined;
  const existingPct = pole.editableSpidaExistingPct || pole.displaySpidaExistingPct;
  const finalPct = pole.editableSpidaFinalPct || pole.displaySpidaFinalPct;
  
  if (existingPct && finalPct && existingPct !== 'N/A' && finalPct !== 'N/A') {
    const existingNum = parseFloat(existingPct);
    const finalNum = parseFloat(finalPct);
    if (Math.abs(finalNum - existingNum) > 1) {
      loadingChange = `loading changed from ${existingNum.toFixed(1)}% to ${finalNum.toFixed(1)}%`;
    }
  }

  // Check for specification changes
  let specificationChange: string | undefined;
  const spidaSpec = pole.editableSpidaSpec || pole.displaySpidaPoleSpec;
  const katapultSpec = pole.displayKatapultPoleSpec;
  
  if (spidaSpec && katapultSpec && spidaSpec !== katapultSpec && 
      spidaSpec !== 'N/A' && katapultSpec !== 'N/A') {
    specificationChange = `specification updated from ${katapultSpec} to ${spidaSpec}`;
  }

  // Identify special conditions
  const special: string[] = [];
  
  // Check for high loading conditions
  if (finalPct && finalPct !== 'N/A') {
    const finalNum = parseFloat(finalPct);
    if (finalNum > 80) {
      special.push('high loading condition requires monitoring');
    }
  }

  // Check for communication drops
  const hasCommDrop = pole.editableSpidaCommDrop === 'Yes' || pole.displaySpidaCommDrop === 'Yes';
  if (hasCommDrop) {
    special.push('communication service drop present');
  }

  return {
    poleId,
    added,
    removed,
    relocated,
    heightChange,
    loadingChange,
    specificationChange,
    special
  };
}

export const CoverSheetTable: React.FC<CoverSheetTableProps> = ({ data }) => {
  const [coverSheetData, setCoverSheetData] = useState<CoverSheetRow[]>([]);
  const [isGeneratingAllNotes, setIsGeneratingAllNotes] = useState(false);
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null);
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
          isEditingNotes: false,
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

  // Copy row data to clipboard in Excel-compatible format
  const copyRowToClipboard = async (row: CoverSheetRow) => {
    try {
      // Remove leading zeros from SCID
      const cleanScid = row.scid.replace(/^0+/, '') || '0';
      
      // Format data as tab-separated values for Excel
      const rowData = [
        cleanScid,
        row.poleNumber,
        row.existingLoading,
        row.finalLoading,
        row.notes || ''
      ].join('\t');

      await navigator.clipboard.writeText(rowData);
      
      // Show visual feedback
      setCopiedRowId(row.id);
      setTimeout(() => setCopiedRowId(null), 2000);
      
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      const cleanScid = row.scid.replace(/^0+/, '') || '0';
      const rowData = [
        cleanScid,
        row.poleNumber,
        row.existingLoading,
        row.finalLoading,
        row.notes || ''
      ].join('\t');
      
      textArea.value = rowData;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      setCopiedRowId(row.id);
      setTimeout(() => setCopiedRowId(null), 2000);
    }
  };

  // Enhanced AI note generation following the user's roadmap
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
      // Step 1: Extract comprehensive change summary using new function
      const changeSummary: PoleChangeSummary = summarizePoleChanges(pole);
      
      // Step 2: Build bullet-list prompt following the roadmap
      const bullets = [
        `• Pole: ${changeSummary.poleId}`,
        ...changeSummary.added.map(a => `• Added: ${a}`),
        ...changeSummary.removed.map(r => `• Removed: ${r}`),
        ...changeSummary.relocated.map(r => `• Relocated: ${r}`),
        changeSummary.heightChange && `• Height change: ${changeSummary.heightChange}`,
        changeSummary.loadingChange && `• Loading: ${changeSummary.loadingChange}`,
        changeSummary.specificationChange && `• Specification: ${changeSummary.specificationChange}`,
        ...(changeSummary.special || []).map(s => `• ${s}`)
      ].filter(Boolean).join("\n");

      // Step 3: Create enhanced prompt with few-shot examples
      const prompt = `
You are an expert utility pole technician writing brief work notes for make-ready coversheets.
Here are the changes we made:

${bullets}

Examples of good coversheet notes:
• Pole 1054: Added transformer bracket at 14'; removed old street-light arm.
→ "Added a new transformer bracket at 14′ and removed the outdated street-light arm on Pole 1054."

• Pole 6396: Trimmed from 45′ to 42′; installed new guy wire.
→ "Trimmed Pole 6396 from 45′ to 42′ and installed a new guy wire."

• Pole 2847: Loading changed from 89.1% to 68.4%; no physical changes.
→ "Capacity optimization through design analysis reducing loading from 89.1% to 68.4%."

Now, write a concise, single-paragraph note summarizing the work we did on this pole.
Keep it under 30 words and use past tense. Focus on the most significant changes.
      `;

      // Step 4: Call OpenAI with enhanced prompt
      let notes = '';
      try {
        notes = await aiService.generateAnalysis(prompt, 'coversheet-notes');
      } catch (error) {
        console.warn('AI generation failed, using rule-based fallback:', error);
        
        // Enhanced rule-based fallback using change summary
        if (changeSummary.added.length > 0 || changeSummary.removed.length > 0 || changeSummary.relocated.length > 0) {
          const actions = [];
          if (changeSummary.added.length > 0) actions.push(`added ${changeSummary.added.length} attachment${changeSummary.added.length > 1 ? 's' : ''}`);
          if (changeSummary.removed.length > 0) actions.push(`removed ${changeSummary.removed.length} attachment${changeSummary.removed.length > 1 ? 's' : ''}`);
          if (changeSummary.relocated.length > 0) actions.push(`relocated ${changeSummary.relocated.length} attachment${changeSummary.relocated.length > 1 ? 's' : ''}`);
          notes = `Pole modifications: ${actions.join(', ')}.`;
        } else if (changeSummary.heightChange) {
          notes = `Pole replacement: ${changeSummary.heightChange}.`;
        } else if (changeSummary.specificationChange) {
          notes = `Pole upgrade: ${changeSummary.specificationChange}.`;
        } else if (changeSummary.loadingChange) {
          notes = `Capacity optimization: ${changeSummary.loadingChange}.`;
        } else {
          notes = 'Design verification completed with no changes required.';
        }
        
                 // Add special conditions if present
         if (changeSummary.special && changeSummary.special.length > 0) {
           notes += ` Note: ${changeSummary.special.join('; ')}.`;
         }
      }
      
      // Step 5: Update with generated notes
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

  // Regenerate notes for a specific pole with higher temperature for variety
  const regenerateNotesForPole = async (poleId: string) => {
    const poleIndex = coverSheetData.findIndex(row => row.id === poleId);
    if (poleIndex === -1) return;

    const pole = data.find(p => p.id === poleId);
    if (!pole?.spida?.rawData) return;

    // Update state to show loading
    setCoverSheetData(prev => 
      prev.map((row, index) => 
        index === poleIndex 
          ? { ...row, isGeneratingNotes: true, notes: 'Regenerating notes...' }
          : row
      )
    );

    try {
      // Use same logic as generateNotesForPole but with higher temperature
      const changeSummary: PoleChangeSummary = summarizePoleChanges(pole);
      
      const bullets = [
        `• Pole: ${changeSummary.poleId}`,
        ...changeSummary.added.map(a => `• Added: ${a}`),
        ...changeSummary.removed.map(r => `• Removed: ${r}`),
        ...changeSummary.relocated.map(r => `• Relocated: ${r}`),
        changeSummary.heightChange && `• Height change: ${changeSummary.heightChange}`,
        changeSummary.loadingChange && `• Loading: ${changeSummary.loadingChange}`,
        changeSummary.specificationChange && `• Specification: ${changeSummary.specificationChange}`,
        ...(changeSummary.special || []).map(s => `• ${s}`)
      ].filter(Boolean).join("\n");

      const prompt = `
You are an expert utility pole technician writing brief work notes for make-ready coversheets.
Here are the changes we made:

${bullets}

Write a concise, single-paragraph note summarizing the work we did on this pole.
Keep it under 30 words and use past tense. Focus on the most significant changes.
Provide a fresh variation that's different from previous attempts.
      `;

      let notes = '';
      try {
        notes = await aiService.generateAnalysis(prompt, 'coversheet-notes-regen');
      } catch (error) {
        console.warn('AI regeneration failed, using fallback:', error);
        notes = 'Design verification and structural analysis completed.';
      }
      
      setCoverSheetData(prev => 
        prev.map((row, index) => 
          index === poleIndex 
            ? { ...row, isGeneratingNotes: false, notes: notes.trim() }
            : row
        )
      );

    } catch (error) {
      console.error('Error regenerating notes for pole:', poleId, error);
      setCoverSheetData(prev => 
        prev.map((row, index) => 
          index === poleIndex 
            ? { ...row, isGeneratingNotes: false, notes: 'Error regenerating notes' }
            : row
        )
      );
    }
  };

  // Toggle note editing mode
  const toggleNoteEditing = (poleId: string) => {
    setCoverSheetData(prev => 
      prev.map(row => 
        row.id === poleId 
          ? { ...row, isEditingNotes: !row.isEditingNotes }
          : row
      )
    );
  };

  // Update note text
  const updateNoteText = (poleId: string, newText: string) => {
    setCoverSheetData(prev => 
      prev.map(row => 
        row.id === poleId 
          ? { ...row, notes: newText }
          : row
      )
    );
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
    const headers = ['SCID', 'Pole Number', 'Existing Capacity %', 'Final Passing Capacity %', 'Notes'];
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
                Existing Capacity %
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider border-r border-slate-700/30 min-w-[140px]">
                Final Passing Capacity %
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider min-w-[300px]">
                <div className="flex items-center space-x-2">
                  <span>Notes</span>
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider min-w-[140px]">
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
                      <span className="text-emerald-400">
                        {row.notes.includes('Regenerating') ? 'Regenerating notes...' : 'Generating notes...'}
                      </span>
                    </div>
                  ) : row.isEditingNotes ? (
                    <div className="space-y-2">
                      <textarea
                        value={row.notes}
                        onChange={(e) => updateNoteText(row.id, e.target.value)}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        rows={2}
                        placeholder="Enter notes for this pole..."
                      />
                      <div className="flex space-x-2">
                        <button
                          onClick={() => toggleNoteEditing(row.id)}
                          className="px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            updateNoteText(row.id, row.notes); // Reset to original
                            toggleNoteEditing(row.id);
                          }}
                          className="px-2 py-1 text-xs bg-slate-600 text-slate-200 rounded hover:bg-slate-700 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : row.notes ? (
                    <span className="text-slate-200">{row.notes}</span>
                  ) : (
                    <span className="text-slate-500 italic">No notes generated</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex items-center space-x-1 flex-wrap gap-1">
                    <button
                      onClick={() => copyRowToClipboard(row)}
                      className={`inline-flex items-center space-x-1 px-2 py-1 text-xs rounded transition-colors ${
                        copiedRowId === row.id 
                          ? 'bg-green-600/20 text-green-400' 
                          : 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'
                      }`}
                      title="Copy row to clipboard (Excel-ready)"
                    >
                      {copiedRowId === row.id ? (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={() => generateNotesForPole(row.id)}
                      disabled={row.isGeneratingNotes || isGeneratingAllNotes}
                      className="inline-flex items-center space-x-1 px-2 py-1 text-xs bg-emerald-600/20 text-emerald-400 rounded hover:bg-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Generate AI notes for this pole"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      <span>Generate</span>
                    </button>

                    {row.notes && (
                      <button
                        onClick={() => regenerateNotesForPole(row.id)}
                        disabled={row.isGeneratingNotes || isGeneratingAllNotes}
                        className="inline-flex items-center space-x-1 px-2 py-1 text-xs bg-amber-600/20 text-amber-400 rounded hover:bg-amber-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Regenerate AI notes with variation"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>Regen</span>
                      </button>
                    )}

                    <button
                      onClick={() => toggleNoteEditing(row.id)}
                      disabled={row.isGeneratingNotes || isGeneratingAllNotes}
                      className="inline-flex items-center space-x-1 px-2 py-1 text-xs bg-purple-600/20 text-purple-400 rounded hover:bg-purple-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Edit notes manually"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span>{row.isEditingNotes ? 'Cancel' : 'Edit'}</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}; 