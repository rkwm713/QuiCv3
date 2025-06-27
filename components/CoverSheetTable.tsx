import React, { useState, useMemo, useEffect } from 'react';
import { ProcessedPole } from '../types';
import { OpenAIService } from '../services/openaiService';
import { workDescriptionService } from '../services/workDescriptionService';
import { geocodingService } from '../services/geocodingService';

// New bucketised change summary interfaces
interface ClearanceResolve {
  type: 'power' | 'ground' | 'spacing';
  action: 'lower' | 'raise' | 'adjust';
}

interface AnchorResolve {
  type: 'comm-power' | 'comm-anchor';
  action: 'rearrange' | 'adjust';
}

interface PoleChangeSummary {
  poleId: string;
  installations: string[];      // e.g. "Charter Fiber", "Charter Fiber and riser"
  clearanceResolves: ClearanceResolve[];
  anchorResolves: AnchorResolve[];
  proposedGuys: number;         // count of down guys
  excavations: string[];        // e.g. "underground to Southeast service location"
  removals: string[];           // e.g. "expired transformer bracket"
  transfers: string[];          // e.g. "comms from stub pole"
}

// Utility to capitalise the first letter of a string
function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
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
  spidaFileName?: string | null;
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

// Enhanced function to summarize all pole changes using the work description service
function summarizePoleChanges(pole: any): PoleChangeSummary {
  const poleId = pole.displaySpidaScid || pole.displayKatapultScid || pole.id;

  // Extract SPIDA designs for analysis
  let measuredDesign: any = null;
  let recommendedDesign: any = null;

  if (pole.spida?.rawData) {
    // Try to find designs from various SPIDA structures
    const spidaData = pole.spida.rawData;
    
    if (spidaData.designs) {
      measuredDesign = spidaData.designs.find((d: any) => d.layerType === 'Measured');
      recommendedDesign = spidaData.designs.find((d: any) => d.layerType === 'Recommended');
    } else if (spidaData.leads?.[0]?.locations?.[0]?.designs) {
      const designs = spidaData.leads[0].locations[0].designs;
      measuredDesign = designs.find((d: any) => d.layerType === 'Measured');
      recommendedDesign = designs.find((d: any) => d.layerType === 'Recommended');
    } else {
      measuredDesign = spidaData.measuredDesign;
      recommendedDesign = spidaData.recommendedDesign;
    }
  }

  // If we have both designs, use the enhanced work description service
  if (measuredDesign && recommendedDesign) {
    try {
      const detailedAnalysis = workDescriptionService.generateDetailedWorkDescription({
        measured: measuredDesign,
        recommended: recommendedDesign,
        poleScid: poleId
      });

      const analysis = detailedAnalysis.analysis;
      
      // Convert the analysis back to the expected format
      const installations: string[] = [];
      if (analysis.fiberInstallation) {
        installations.push(analysis.fiberInstallation);
      }
      installations.push(...analysis.risers);

      const clearanceResolves: ClearanceResolve[] = [];
      // Convert vertical relocations to clearance resolves
      analysis.verticalRelocations.forEach(relocation => {
        if (relocation.includes('ground clearance')) {
          clearanceResolves.push({ type: 'ground', action: 'raise' });
        } else if (relocation.includes('allow room')) {
          clearanceResolves.push({ type: 'spacing', action: 'lower' });
        }
      });

      const anchorResolves: AnchorResolve[] = [];
      analysis.guying.forEach(guyChange => {
        if (guyChange.includes('anchor violation')) {
          anchorResolves.push({ type: 'comm-power', action: 'rearrange' });
        }
      });

      // Count proposed guys from guying analysis
      const proposedGuys = analysis.guying
        .filter(change => change.includes('guy added'))
        .reduce((count, change) => {
          const match = change.match(/(\w+) proposed down guys?/i);
          if (match) {
            const numberWords = ['one', 'two', 'three', 'four', 'five'];
            const index = numberWords.indexOf(match[1].toLowerCase());
            return count + (index >= 0 ? index + 1 : 1);
          }
          return count + 1;
        }, 0);

      return {
        poleId,
        installations,
        clearanceResolves,
        anchorResolves,
        proposedGuys,
        excavations: [], // Will be extracted from risers if underground bore is mentioned
        removals: [], // Could be extracted from stub pole transfers
        transfers: analysis.stubPoleTransfers,
      };
    } catch (error) {
      console.warn('Failed to use enhanced work description service, falling back to simple analysis:', error);
    }
  }

  // Fallback to simple analysis if enhanced service fails
  const installations: string[] = [];
  const removals: string[] = [];
  const transfers: string[] = [];
  const excavations: string[] = [];

  // Use existing attachment diff util to approximate installations/removals/transfers
  const { added, removed, relocated } = extractAttachmentChanges(pole.spida?.rawData);
  installations.push(...added);
  removals.push(...removed);
  transfers.push(...relocated);

  // Rough heuristic: count how many of the added attachments mention 'guy'
  const proposedGuys = added.filter((desc: string) => /guy/i.test(desc)).length;

  const clearanceResolves: ClearanceResolve[] = [];
  const anchorResolves: AnchorResolve[] = [];

  return {
    poleId,
    installations,
    clearanceResolves,
    anchorResolves,
    proposedGuys,
    excavations,
    removals,
    transfers,
  };
}

// Enhanced work description generation using the work description service
function generateEnhancedWorkDescription(pole: any): string {
  // Extract SPIDA designs for analysis
  let measuredDesign: any = null;
  let recommendedDesign: any = null;

  if (pole.spida?.rawData) {
    const spidaData = pole.spida.rawData;
    
    if (spidaData.designs) {
      measuredDesign = spidaData.designs.find((d: any) => d.layerType === 'Measured');
      recommendedDesign = spidaData.designs.find((d: any) => d.layerType === 'Recommended');
    } else if (spidaData.leads?.[0]?.locations?.[0]?.designs) {
      const designs = spidaData.leads[0].locations[0].designs;
      measuredDesign = designs.find((d: any) => d.layerType === 'Measured');
      recommendedDesign = designs.find((d: any) => d.layerType === 'Recommended');
    } else {
      measuredDesign = spidaData.measuredDesign;
      recommendedDesign = spidaData.recommendedDesign;
    }
  }

  // If we have both designs, use the enhanced work description service
  if (measuredDesign && recommendedDesign) {
    try {
      const poleId = pole.displaySpidaScid || pole.displayKatapultScid || pole.id;
      return workDescriptionService.generateWorkDescription({
        measured: measuredDesign,
        recommended: recommendedDesign,
        poleScid: poleId
      });
    } catch (error) {
      console.warn('Failed to generate enhanced work description:', error);
    }
  }

  // Fallback to sentence-based approach
  const changeSummary = summarizePoleChanges(pole);
  const actionSentences = buildSentences(changeSummary);
  return actionSentences.join(' ') || 'Install Charter Fiber.';
}

// Build domain-aware sentence fragments as per enhanced roadmap
function buildSentences(change: PoleChangeSummary): string[] {
  const sents: string[] = [];

  // 1. Clearance / anchor fixes
  change.clearanceResolves.forEach(cr => {
    const what = cr.type === 'power' ? 'comm' :
                 cr.type === 'ground' ? 'comms' : 'clearances';
    sents.push(`${capitalize(cr.action)} ${what} to resolve ${cr.type} clearance violation`);
  });

  change.anchorResolves.forEach(ar => {
    const why = ar.type === 'comm-power' ? 'comm to power anchor violation' : 'comm anchor violation';
    sents.push(`${capitalize(ar.action)} comm anchor to resolve ${why}`);
  });

  // 2. Installations
  if (change.installations.length) {
    sents.push(`Install ${change.installations.join(' and ')}`);
  }

  // 3. Down guys
  if (change.proposedGuys > 0) {
    const qty = change.proposedGuys > 1 ? `${change.proposedGuys} proposed down guys` : 'proposed down guy';
    sents.push(`${capitalize(qty)} added`);
  }

  // 4. Excavations
  change.excavations.forEach(ex => {
    sents.push(`Bore underground to ${ex}`);
  });

  // 5. Removals / transfers
  change.removals.forEach((r: string) => {
    sents.push(`${capitalize(r)} removed`);
  });
  change.transfers.forEach((t: string) => {
    sents.push(`Transfer ${t}`);
  });

  // Ensure all sentences end with a period.
  return sents.map(s => (s.endsWith('.') ? s : s + '.'));
}

// Helper function to get location information for the first pole
async function getLocationInfoAsync(data: ProcessedPole[]): Promise<{ address: string; city: string; coordinates?: { lat: number; lng: number } }> {
  if (!data.length) {
    return { address: 'N/A', city: 'N/A' };
  }

  const firstPole = data[0];
  let coordinates: { lat: number; lng: number } | undefined;

  // First try to extract coordinates from SPIDA file structure
  if (firstPole.spida?.rawData) {
    try {
      const spidaData = firstPole.spida.rawData;
      
      // Check for coordinates in leads[0].locations[0].geographicCoordinate.coordinates
      if (spidaData.leads && spidaData.leads[0] && spidaData.leads[0].locations && spidaData.leads[0].locations[0]) {
        const geoCoord = spidaData.leads[0].locations[0].geographicCoordinate;
        if (geoCoord && geoCoord.coordinates && Array.isArray(geoCoord.coordinates) && geoCoord.coordinates.length >= 2) {
          // SPIDA format is [longitude, latitude] - need to swap for our format
          const [lng, lat] = geoCoord.coordinates;
          if (typeof lng === 'number' && typeof lat === 'number') {
            coordinates = { lat, lng };
          }
        }
      }
      
      // Fallback: check for coordinates in project structure
      if (!coordinates && spidaData.project && spidaData.project.structures) {
        for (const structure of spidaData.project.structures) {
          if (structure.geographicCoordinate && structure.geographicCoordinate.coordinates) {
            const coords = structure.geographicCoordinate.coordinates;
            if (Array.isArray(coords) && coords.length >= 2) {
              const [lng, lat] = coords;
              if (typeof lng === 'number' && typeof lat === 'number') {
                coordinates = { lat, lng };
                break;
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn('Error extracting coordinates from SPIDA data:', error);
    }
  }

  // Fallback to existing coordinate sources if SPIDA extraction failed
  if (!coordinates) {
    if (firstPole.mapCoords) {
      coordinates = { lat: firstPole.mapCoords.lat, lng: firstPole.mapCoords.lon };
    } else if (firstPole.spidaMapCoords) {
      coordinates = { lat: firstPole.spidaMapCoords.lat, lng: firstPole.spidaMapCoords.lon };
    } else if (firstPole.katapultMapCoords) {
      coordinates = { lat: firstPole.katapultMapCoords.lat, lng: firstPole.katapultMapCoords.lon };
    } else if (firstPole.spida?.coords) {
      coordinates = { lat: firstPole.spida.coords.lat, lng: firstPole.spida.coords.lon };
    } else if (firstPole.katapult?.coords) {
      coordinates = { lat: firstPole.katapult.coords.lat, lng: firstPole.katapult.coords.lon };
    }
  }

  if (coordinates && geocodingService.isValidCoordinates(coordinates)) {
    try {
      const geocodeResult = await geocodingService.reverseGeocode(coordinates);
      return {
        address: geocodeResult.address,
        city: `${geocodeResult.city}, ${geocodeResult.state}`,
        coordinates
      };
    } catch (error) {
      console.warn('Geocoding failed, using coordinates:', error);
    }
  }

  // Fallback to coordinates or placeholder
  const address = coordinates ? 
    `Location: ${coordinates.lat.toFixed(6)}, ${coordinates.lng.toFixed(6)}` : 
    'Address not available';
  
  const city = 'City, State'; // Placeholder fallback

  return { address, city, coordinates };
}

// Results card component
interface ResultsCardProps {
  spidaFileName: string | null | undefined;
  poleCount: number;
  locationInfo: { address: string; city: string };
}

const ResultsCard: React.FC<ResultsCardProps> = ({ spidaFileName, poleCount, locationInfo }) => {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  // Extract just the filename without extension for the job name
  const cleanFileName = spidaFileName ? 
    spidaFileName.replace(/\.[^/.]+$/, '') : // Remove file extension
    'Unknown';

  const jobName = `2-2025-TSCPS-${cleanFileName}`;
  const comments = `${poleCount} PLAs on ${poleCount} poles`;

  // Check if location info appears to be coordinates vs real address
  const isCoordinateAddress = locationInfo.address.includes('Location:') || locationInfo.address.includes('Lat:');

  return (
    <div className="bg-slate-800/90 border border-slate-700/50 rounded-lg p-6 mb-6">
      <h3 className="text-lg font-semibold text-slate-200 mb-4">Project Information</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Job:</label>
            <p className="text-slate-100 bg-slate-700/50 px-3 py-2 rounded border">{jobName}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Date:</label>
            <p className="text-slate-100 bg-slate-700/50 px-3 py-2 rounded border">{currentDate}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Location of Poles:
              {isCoordinateAddress && (
                <span className="text-xs text-amber-400 ml-1">(Coordinates - geocoding failed)</span>
              )}
            </label>
            <p className="text-slate-100 bg-slate-700/50 px-3 py-2 rounded border">{locationInfo.address}</p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">City:</label>
            <p className="text-slate-100 bg-slate-700/50 px-3 py-2 rounded border">{locationInfo.city}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Project Engineer:</label>
            <p className="text-slate-100 bg-slate-700/50 px-3 py-2 rounded border">Andrea Sfondrini</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Comments:</label>
            <p className="text-slate-100 bg-slate-700/50 px-3 py-2 rounded border">{comments}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export const CoverSheetTable: React.FC<CoverSheetTableProps> = ({ data, spidaFileName }) => {
  const [coverSheetData, setCoverSheetData] = useState<CoverSheetRow[]>([]);
  const [isGeneratingAllNotes, setIsGeneratingAllNotes] = useState(false);
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null);
  const [locationInfo, setLocationInfo] = useState<{ address: string; city: string }>({ 
    address: 'Loading...', 
    city: 'Loading...' 
  });
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

        // Generate initial rule-based notes using workDescriptionService
        let initialNotes = '';
        try {
          if (pole.spida?.rawData) {
            initialNotes = generateEnhancedWorkDescription(pole) || 'Install Charter Fiber.';
          }
        } catch (error) {
          console.warn('Error generating initial notes for pole:', pole.id, error);
          initialNotes = 'Install Charter Fiber.';
        }

        return {
          id: pole.id,
          scid,
          poleNumber,
          existingLoading,
          finalLoading,
          notes: initialNotes,
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

  // Load location info asynchronously
  useEffect(() => {
    if (data.length > 0) {
      getLocationInfoAsync(data).then(info => {
        setLocationInfo({ address: info.address, city: info.city });
      }).catch(error => {
        console.error('Failed to load location info:', error);
        setLocationInfo({ address: 'Address unavailable', city: 'City, State' });
      });
    }
  }, [data]);

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
  const enhanceNotesWithAI = async (poleId: string) => {
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
      // Step 1: Generate enhanced work description directly
      const enhancedDescription = generateEnhancedWorkDescription(pole);

      // Step 2: If we have a good enhanced description, use it directly
      if (enhancedDescription && enhancedDescription !== 'Install Charter Fiber.') {
        setCoverSheetData(prev => 
          prev.map((row, index) => 
            index === poleIndex 
              ? { ...row, isGeneratingNotes: false, notes: enhancedDescription }
              : row
          )
        );
        return;
      }

      // Step 3: Fallback to AI-assisted generation with change summary
      const changeSummary: PoleChangeSummary = summarizePoleChanges(pole);
      const actionSentences = buildSentences(changeSummary);

      // Step 4: Construct system and user prompts per new roadmap
      const systemPrompt = `You are an AI coversheet-note writer for utility pole work descriptions.  
Follow these examples exactly:  
- "Lower comm to resolve power clearance violation. Install Charter Fiber. Proposed down guy added."  
- "Install Charter Fiber and riser. Bore underground to Southeast service location. Stub pole removal needed."
- "Replace pole to resolve structural/clearance violations. Install Charter Fiber."
- "Raise comms to resolve ground clearance violations. Install Charter Fiber and splice onto existing attachment."  
Write 1–4 short sentences, present tense imperative, one action per sentence. Focus on technical accuracy.`;

      const userPrompt = `Pole: ${changeSummary.poleId}\nRequired Actions:\n${actionSentences.join('\n')}`;

      const finalPrompt = `${systemPrompt}\n\n${userPrompt}`;

      let notes = '';
      try {
        notes = await aiService.generateAnalysis(finalPrompt, 'coversheet-notes');
      } catch (error) {
        console.warn('AI generation failed, using rule-based fallback:', error);
        // Use the enhanced description as fallback
        notes = enhancedDescription;
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
      // Final fallback to enhanced description
      const enhancedDescription = generateEnhancedWorkDescription(pole);
      setCoverSheetData(prev => 
        prev.map((row, index) => 
          index === poleIndex 
            ? { ...row, isGeneratingNotes: false, notes: enhancedDescription || 'Error generating notes' }
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
      const changeSummary: PoleChangeSummary = summarizePoleChanges(pole);
      const actionSentences = buildSentences(changeSummary);

      const systemPrompt = `You are an AI coversheet-note writer for utility pole work descriptions.  
Follow these examples exactly but provide slight variations in wording:  
- "Lower comm to resolve power clearance violation. Install Charter Fiber. Proposed down guy added."  
- "Install Charter Fiber and riser. Bore underground to Southeast service location. Stub pole removal needed."
- "Replace pole to resolve structural/clearance violations. Install Charter Fiber."
- "Raise comms to resolve ground clearance violations. Install Charter Fiber and splice onto existing attachment."  
Write 1–4 short sentences, present tense imperative, one action per sentence. Provide variation while maintaining technical accuracy.`;

      const userPrompt = `Pole: ${changeSummary.poleId}\nRequired Actions:\n${actionSentences.join('\n')}`;

      const finalPrompt = `${systemPrompt}\n\n${userPrompt}`;

      let notes = '';
      try {
        notes = await aiService.generateAnalysis(finalPrompt, 'coversheet-notes-regen');
      } catch (error) {
        console.warn('AI regeneration failed, using enhanced fallback:', error);
        // Use enhanced description as fallback
        notes = generateEnhancedWorkDescription(pole);
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
      // Final fallback to enhanced description
      const enhancedDescription = generateEnhancedWorkDescription(pole);
      setCoverSheetData(prev => 
        prev.map((row, index) => 
          index === poleIndex 
            ? { ...row, isGeneratingNotes: false, notes: enhancedDescription || 'Error regenerating notes' }
            : row
        )
      );
    }
  };

  // Reset notes to rule-based (non-AI) version
  const resetToRuleBasedNotes = (poleId: string) => {
    const pole = data.find(p => p.id === poleId);
    if (!pole?.spida?.rawData) return;

    const poleIndex = coverSheetData.findIndex(row => row.id === poleId);
    if (poleIndex === -1) return;

    try {
      const ruleBasedNotes = generateEnhancedWorkDescription(pole) || 'Install Charter Fiber.';
      
      setCoverSheetData(prev => 
        prev.map((row, index) => 
          index === poleIndex 
            ? { ...row, notes: ruleBasedNotes }
            : row
        )
      );
    } catch (error) {
      console.error('Error generating rule-based notes for pole:', poleId, error);
      setCoverSheetData(prev => 
        prev.map((row, index) => 
          index === poleIndex 
            ? { ...row, notes: 'Install Charter Fiber.' }
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

  // Enhance AI notes for all poles (rule-based notes are already generated)
  const generateAllNotes = async () => {
    setIsGeneratingAllNotes(true);
    
    try {
      for (let i = 0; i < coverSheetData.length; i++) {
        await enhanceNotesWithAI(coverSheetData[i].id);
        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error('Error enhancing all notes with AI:', error);
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

  // Helper functions for percentage color coding and row highlighting
  function getPercentageColorClasses(percentage: string): string {
    if (percentage === 'N/A') {
      return 'bg-slate-700/50 text-slate-300';
    }
    
    const numValue = parseFloat(percentage);
    if (isNaN(numValue)) {
      return 'bg-slate-700/50 text-slate-300';
    }
    
    if (numValue < 80) {
      return 'bg-green-500/20 text-green-400 border border-green-500/30';
    } else if (numValue >= 80 && numValue < 90) {
      return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
    } else {
      return 'bg-red-500/20 text-red-400 border border-red-500/30';
    }
  }

  function shouldHighlightRow(existingLoading: string, finalLoading: string): boolean {
    if (existingLoading === 'N/A' || finalLoading === 'N/A') {
      return false;
    }
    
    const existing = parseFloat(existingLoading);
    const final = parseFloat(finalLoading);
    
    if (isNaN(existing) || isNaN(final)) {
      return false;
    }
    
    return Math.abs(final - existing) > 29;
  }

  function getRowClasses(index: number, existingLoading: string, finalLoading: string): string {
    const baseClasses = `
      transition-all duration-200 hover:bg-slate-700/20
      ${index % 2 === 0 ? 'bg-slate-800/20' : 'bg-slate-800/10'}
    `;
    
    const shouldHighlight = shouldHighlightRow(existingLoading, finalLoading);
    const highlightClasses = shouldHighlight ? 'border-2 border-red-500 bg-red-500/10' : '';
    
    return `${baseClasses} ${highlightClasses}`.trim();
  }

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
              Showing {coverSheetData.length} pole{coverSheetData.length !== 1 ? 's' : ''} with rule-based notes. Use AI enhancement for additional refinement.
            </p>
            {/* Color Legend */}
            <div className="flex items-center space-x-4 mt-2 text-xs">
              <span className="text-slate-400">Loading:</span>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-green-500/20 border border-green-500/30 rounded"></div>
                <span className="text-green-400">&lt;80%</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-yellow-500/20 border border-yellow-500/30 rounded"></div>
                <span className="text-yellow-400">80-89%</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-red-500/20 border border-red-500/30 rounded"></div>
                <span className="text-red-400">≥90%</span>
              </div>
              <span className="text-slate-500">|</span>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 border-2 border-red-500 rounded"></div>
                <span className="text-red-400">&gt;29% change</span>
              </div>
            </div>
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
                  <span>Enhancing with AI...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span>Enhance All with AI</span>
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

      {/* Results Card */}
      <ResultsCard 
        spidaFileName={spidaFileName}
        poleCount={data.length}
        locationInfo={locationInfo}
      />

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
                className={getRowClasses(index, row.existingLoading, row.finalLoading)}
              >
                <td className="px-4 py-3 text-sm text-slate-300 border-r border-slate-700/20">
                  {row.scid}
                </td>
                <td className="px-4 py-3 text-sm text-slate-300 border-r border-slate-700/20 font-mono">
                  {row.poleNumber}
                </td>
                <td className="px-4 py-3 text-sm text-slate-300 border-r border-slate-700/20 text-center">
                  <span className={`px-2 py-1 rounded-md text-xs font-medium ${getPercentageColorClasses(row.existingLoading)}`}>
                    {row.existingLoading}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-300 border-r border-slate-700/20 text-center">
                  <span className={`px-2 py-1 rounded-md text-xs font-medium ${getPercentageColorClasses(row.finalLoading)}`}>
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
                      onClick={() => enhanceNotesWithAI(row.id)}
                      disabled={row.isGeneratingNotes || isGeneratingAllNotes}
                      className="inline-flex items-center space-x-1 px-2 py-1 text-xs bg-emerald-600/20 text-emerald-400 rounded hover:bg-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Enhance notes with AI for this pole"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      <span>AI Enhance</span>
                    </button>

                    <button
                      onClick={() => resetToRuleBasedNotes(row.id)}
                      disabled={row.isGeneratingNotes || isGeneratingAllNotes}
                      className="inline-flex items-center space-x-1 px-2 py-1 text-xs bg-blue-600/20 text-blue-400 rounded hover:bg-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Reset to rule-based notes"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                      <span>Reset</span>
                    </button>

                    {row.notes && (
                      <button
                        onClick={() => regenerateNotesForPole(row.id)}
                        disabled={row.isGeneratingNotes || isGeneratingAllNotes}
                        className="inline-flex items-center space-x-1 px-2 py-1 text-xs bg-amber-600/20 text-amber-400 rounded hover:bg-amber-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Regenerate AI enhancement with variation"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>AI Regen</span>
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