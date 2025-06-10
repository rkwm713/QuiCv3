import React, { useState, useCallback, useEffect } from 'react';
import { DashboardLayout } from './components/DashboardLayout';
import { FileLoader } from './components/FileLoader';
import { DataTable } from './components/DataTable';
import { MapWithSelector } from './components/MapWithSelector';
import { StatusDisplay } from './components/StatusDisplay';
import { PoleDetailModal } from './components/PoleDetailModal';
import { 
  IntermediateSpidaPole,
  ProcessedPole, 
  NormalizedPole, 
  ComparisonStats, 
  KatapultJsonFormat, 
  KatapultJsonNode,
  KatapultBirthmarkData,
  Coordinate,
  SpidaLocation,
  SpidaDesign,
  SpidaJsonFullFormat, // Updated type
  SpidaProjectStructure,
  SpidaDesignPoleStructure,
  MatchTier
} from './types';
import { 
  normalizeSpidaData, 
  normalizeKatapultData, 
  performComparison, 
  recalculateMismatchFlags,
  buildSpidaAliasTable,
  getAnalysisLoadPercent, 
  getSpidaCommDrop, 
  _to_feet_ts, 
  getFirstValueFromKatapultAttribute, 
  commonNormalizePoleNum 
} from './services/dataProcessingService';
import { generateSpidaJsonWithUpdates, exportToCsv, exportKatapultAttributeUpdateExcel } from './services/exportService';
import { INITIAL_STATS, ALLOWED_KATAPULT_NODE_TYPES }  from './constants';

// Helper function to extract the pole number string for normalization
function getPoleNumDisplayString(
  id: string | number | undefined | null,
  externalId: string | number | undefined | null,
  label: string | undefined | null
): string | null {
  if (id !== null && id !== undefined && String(id).trim() !== '') return String(id).trim();
  if (externalId !== null && externalId !== undefined && String(externalId).trim() !== '') return String(externalId).trim();
  if (label !== null && label !== undefined && String(label).trim() !== '') {
    const L = String(label).trim();
    // Try to remove a "number-" prefix from the label.
    // E.g., "1-PL28462" -> "PL28462"; "001-POLE123" -> "POLE123"
    const prefixMatch = L.match(/^\d+-(.*)/i);
    if (prefixMatch && prefixMatch[1]) {
      return prefixMatch[1]; // Return the part after "n-"
    }
    return L; // Otherwise, use the label as is, normalizePoleNum will attempt to clean it
  }
  return null;
}

function getCoordsFromSpidaSource(source: SpidaProjectStructure | SpidaLocation): Coordinate | null {
    const geoCoord = source.geographicCoordinate?.coordinates;
    if (geoCoord && geoCoord.length === 2) return { lon: geoCoord[0], lat: geoCoord[1] };

    const mapLocCoord = source.mapLocation?.coordinates;
    if (mapLocCoord && mapLocCoord.length === 2) return { lon: mapLocCoord[0], lat: mapLocCoord[1] };
    
    if (typeof source.latitude === 'number' && typeof source.longitude === 'number') {
        return { lat: source.latitude, lon: source.longitude };
    }
    // Check designs within the source if top-level coords are missing
    if (source.designs && source.designs.length > 0) {
        const designWithCoords = source.designs.find(d => 
            (d.structure?.pole as any)?.geographicCoordinate?.coordinates || 
            (d.structure?.pole as any)?.mapLocation?.coordinates
        );
        if (designWithCoords) {
            const poleGeoCoord = (designWithCoords.structure.pole as any).geographicCoordinate?.coordinates;
            if (poleGeoCoord && poleGeoCoord.length === 2) return { lon: poleGeoCoord[0], lat: poleGeoCoord[1] };
            const poleMapLocCoord = (designWithCoords.structure.pole as any).mapLocation?.coordinates;
            if (poleMapLocCoord && poleMapLocCoord.length === 2) return { lon: poleMapLocCoord[0], lat: poleMapLocCoord[1] };
        }
    }
     // Check recommendedDesign/measuredDesign directly on structure as per user's JSON structure
    const recDesignPole = (source as SpidaProjectStructure).recommendedDesign?.pole as any;
    if (recDesignPole?.geographicCoordinate?.coordinates) return { lon: recDesignPole.geographicCoordinate.coordinates[0], lat: recDesignPole.geographicCoordinate.coordinates[1]};
    if (recDesignPole?.mapLocation?.coordinates) return { lon: recDesignPole.mapLocation.coordinates[0], lat: recDesignPole.mapLocation.coordinates[1]};
    
    const measDesignPole = (source as SpidaProjectStructure).measuredDesign?.pole as any;
    if (measDesignPole?.geographicCoordinate?.coordinates) return { lon: measDesignPole.geographicCoordinate.coordinates[0], lat: measDesignPole.geographicCoordinate.coordinates[1]};
    if (measDesignPole?.mapLocation?.coordinates) return { lon: measDesignPole.mapLocation.coordinates[0], lat: measDesignPole.mapLocation.coordinates[1]};

    return null;
}

function collectKatapultBirthmarks(jsonData: KatapultJsonFormat): Record<string, KatapultBirthmarkData> {
  const birthmarks: Record<string, KatapultBirthmarkData> = {};
  if (!jsonData.nodes) return birthmarks;

  for (const nodeId in jsonData.nodes) {
    const node: KatapultJsonNode = jsonData.nodes[nodeId];
    const birthmarkBrandContainer = node.attributes?.birthmark_brand;
    
    if (birthmarkBrandContainer && typeof birthmarkBrandContainer === 'object' && !Array.isArray(birthmarkBrandContainer)) {
        // The actual birthmark data is nested one level deeper under a dynamic key
        const birthmarkAttr = getFirstValueFromKatapultAttribute(birthmarkBrandContainer) as any; 
        
        if (birthmarkAttr && typeof birthmarkAttr === 'object') {
            const heightFt = _to_feet_ts(birthmarkAttr.pole_height || birthmarkAttr.height || null);
            const rawPoleClass = birthmarkAttr.pole_class || birthmarkAttr.class || null;
            const poleClass = commonNormalizePoleNum(rawPoleClass); 
            
            const rawSpecies = birthmarkAttr["pole_species*"] || birthmarkAttr.pole_species || birthmarkAttr.species || null; // Handle "pole_species*"
            const species = typeof rawSpecies === 'string' ? rawSpecies.replace('*', '').trim() : null; // Clean asterisk if present
            
            const refIdFromAttr = getFirstValueFromKatapultAttribute(node.attributes?.birthmark_reference_id);
            const refId = refIdFromAttr ? String(refIdFromAttr) : (node.StructureRID ? String(node.StructureRID) : nodeId);

            birthmarks[refId] = {
                heightFt: heightFt,
                poleClass: typeof poleClass === 'string' ? poleClass : null,
                species: species,
                originalDataSource: birthmarkAttr
            };
        }
    }
  }
  return birthmarks;
}

const App: React.FC = () => {
  const [rawSpidaJson, setRawSpidaJson] = useState<SpidaJsonFullFormat | null>(null);
  const [_spidaAliasTable, setSpidaAliasTable] = useState<Record<string, string>>({});
  const [normalizedSpidaData, setNormalizedSpidaData] = useState<NormalizedPole[] | null>(null);
  const [spidaFileName, setSpidaFileName] = useState<string | null>(null);
  
  const [_rawKatapultJsonFull, setRawKatapultJsonFull] = useState<KatapultJsonFormat | null>(null);
  const [_katapultBirthmarks, setKatapultBirthmarks] = useState<Record<string, KatapultBirthmarkData>>({});
  const [normalizedKatapultData, setNormalizedKatapultData] = useState<NormalizedPole[] | null>(null);
  const [katapultFileName, setKatapultFileName] = useState<string | null>(null);

  const [processedPoles, setProcessedPoles] = useState<ProcessedPole[]>([]);
  const [comparisonStats, setComparisonStats] = useState<ComparisonStats>(INITIAL_STATS);
  
  const [isLoadingSpida, setIsLoadingSpida] = useState(false);
  const [isLoadingKatapult, setIsLoadingKatapult] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  
  const [statusMessage, setStatusMessage] = useState<string>('Load SPIDA and Katapult JSON files to begin.');
  const [selectedPoleForModal, setSelectedPoleForModal] = useState<ProcessedPole | null>(null);
  const [resetKey, setResetKey] = useState<number>(0);
  


  const handleSpidaFileLoad = useCallback((fileName: string, content: string) => {
    setIsLoadingSpida(true);
    setStatusMessage(`Loading SPIDA file: ${fileName}...`);
    try {
      const jsonData = JSON.parse(content) as SpidaJsonFullFormat;
      if (typeof jsonData !== 'object' || jsonData === null) {
        throw new Error("SPIDA JSON is not a valid object.");
      }
      setRawSpidaJson(jsonData); 
      
      const poleDefinitions = jsonData.clientData?.poles || [];
      const aliasTable = buildSpidaAliasTable(poleDefinitions);
      setSpidaAliasTable(aliasTable);

      const intermediatePoles: IntermediateSpidaPole[] = [];
      
      let structuresSource: SpidaProjectStructure[] | null = null;
      if (jsonData.project?.structures && Array.isArray(jsonData.project.structures)) {
        structuresSource = jsonData.project.structures;
      } else if (jsonData.spidadevices?.structures && Array.isArray(jsonData.spidadevices.structures)) {
        structuresSource = jsonData.spidadevices.structures;
      }

      if (structuresSource) {
        structuresSource.forEach((structure, index) => {
          const idSpidaDisplay = (index + 1).toString().padStart(3, '0');
          const poleNumDisplay = getPoleNumDisplayString(structure.id, structure.externalId, structure.label);

          const actualRecommendedDesignObj = structure.designs?.find(d => d.layerType === "Recommended") || structure.recommendedDesign;
          const actualMeasuredDesignObj = structure.designs?.find(d => d.layerType === "Measured") || structure.measuredDesign;
          
          let poleStructureForSpec: SpidaDesignPoleStructure | null = null;

          if (actualRecommendedDesignObj) {
            if ('layerType' in actualRecommendedDesignObj && actualRecommendedDesignObj.structure) { 
                poleStructureForSpec = actualRecommendedDesignObj.structure.pole || actualRecommendedDesignObj.pole || null;
            } else if ('pole' in actualRecommendedDesignObj) { 
                poleStructureForSpec = actualRecommendedDesignObj.pole || null;
            }
          }

          if (!poleStructureForSpec && actualMeasuredDesignObj) { 
            if ('layerType' in actualMeasuredDesignObj && actualMeasuredDesignObj.structure) { 
                poleStructureForSpec = actualMeasuredDesignObj.structure.pole || actualMeasuredDesignObj.pole || null;
            } else if ('pole' in actualMeasuredDesignObj) { 
                poleStructureForSpec = actualMeasuredDesignObj.pole || null;
            }
          }
          
          if (!poleStructureForSpec && structure.designs && structure.designs[0]?.structure) { 
            const firstDesign = structure.designs[0]; 
            poleStructureForSpec = firstDesign.structure.pole || firstDesign.pole || null;
          }
          
          const spidaRecommendedDesignForCalcs: SpidaDesign | undefined = 
            actualRecommendedDesignObj && 'layerType' in actualRecommendedDesignObj && 'structure' in actualRecommendedDesignObj ? actualRecommendedDesignObj as SpidaDesign : undefined;
          const spidaMeasuredDesignForCalcs: SpidaDesign | undefined = 
            actualMeasuredDesignObj && 'layerType' in actualMeasuredDesignObj && 'structure' in actualMeasuredDesignObj ? actualMeasuredDesignObj as SpidaDesign : undefined;
            
          const existingPctStr = getAnalysisLoadPercent(spidaMeasuredDesignForCalcs);
          const finalPctStr = getAnalysisLoadPercent(spidaRecommendedDesignForCalcs);
          const commDropFlag = getSpidaCommDrop(spidaRecommendedDesignForCalcs || (structure.recommendedDesign as SpidaDesign));


          intermediatePoles.push({
            originalIndexInFeed: index, 
            idSpidaDisplay,
            originalStructureId: structure.id || null,
            poleNumDisplay,
            coords: getCoordsFromSpidaSource(structure),
            poleStructureForSpec,
            existingPctStr,
            finalPctStr,
            commDropFlag,
            rawSpidaData: structure,
          });
        });
      } else { 
        console.warn("Primary SPIDA structures (project.structures or spidadevices.structures) not found. Falling back to leads[*].locations.");
        let poleInstanceCounter = 0;
        (jsonData.leads || []).forEach(lead => {
          (lead.locations || []).forEach((location) => {
            poleInstanceCounter++;
            const recommendedDesignInLead = location.designs?.find(d => d.layerType === "Recommended"); 
            const measuredDesignInLead = location.designs?.find(d => d.layerType === "Measured"); 
            const chosenDesign = recommendedDesignInLead || location.designs?.[0]; 

            if (!chosenDesign || !chosenDesign.structure) { 
              console.warn(`Location ${location.label || poleInstanceCounter} in leads has no designs or structure in design.`);
              return; 
            }
            
            const idSpidaDisplay = String(poleInstanceCounter).padStart(3, '0');
            const poleNumDisplay = getPoleNumDisplayString(location.id, location.externalId, location.label);
            
            const poleStructForSpecFromLeads: SpidaDesignPoleStructure | null = chosenDesign.structure.pole || chosenDesign.pole || null;

            const existingPctStr = getAnalysisLoadPercent(measuredDesignInLead || (chosenDesign.layerType === "Measured" ? chosenDesign : undefined));
            const finalPctStr = getAnalysisLoadPercent(recommendedDesignInLead || (chosenDesign.layerType === "Recommended" ? chosenDesign : undefined));
            const commDropFlag = getSpidaCommDrop(recommendedDesignInLead); 

            intermediatePoles.push({
              originalIndexInFeed: poleInstanceCounter -1, 
              idSpidaDisplay,
              originalStructureId: location.id || null,
              poleNumDisplay,
              coords: getCoordsFromSpidaSource(location),
              poleStructureForSpec: poleStructForSpecFromLeads,
              existingPctStr,
              finalPctStr,
              commDropFlag,
              rawSpidaData: location,
            });
          });
        });
      }
      
      if (intermediatePoles.length === 0) {
         console.warn("No pole instances found in SPIDA JSON. Comparison might be limited.");
      }

      const normalized = normalizeSpidaData(intermediatePoles, aliasTable);
      setNormalizedSpidaData(normalized);
      setSpidaFileName(fileName);
      setStatusMessage(`SPIDA file "${fileName}" loaded. ${normalized.length} poles processed for normalization.`);

    } catch (error) {
      console.error("Error loading SPIDA JSON:", error);
      setStatusMessage(`Error loading SPIDA file: ${(error as Error).message}. Please check file format.`);
      setRawSpidaJson(null);
      setSpidaAliasTable({});
      setNormalizedSpidaData(null);
      setSpidaFileName(null);
    } finally {
      setIsLoadingSpida(false);
    }
  }, []);

  const handleKatapultFileLoad = useCallback((fileName: string, content: string) => {
    setIsLoadingKatapult(true);
    setStatusMessage(`Loading Katapult file: ${fileName}...`);
    try {
      const jsonData = JSON.parse(content) as KatapultJsonFormat;
      if (typeof jsonData !== 'object' || jsonData === null) {
        throw new Error("Katapult JSON is not a valid object.");
      }
      if (!jsonData.nodes || typeof jsonData.nodes !== 'object') {
         throw new Error("Katapult JSON must have a 'nodes' object map.");
      }
      setRawKatapultJsonFull(jsonData); 

      const birthmarks = collectKatapultBirthmarks(jsonData);
      setKatapultBirthmarks(birthmarks);

      const allNodesWithKeys: KatapultJsonNode[] = [];
      if (jsonData.nodes) {
        for (const [nodeKey, nodeObject] of Object.entries(jsonData.nodes)) {
          const nodeWithKey = nodeObject as KatapultJsonNode;
          nodeWithKey._nodeKey = nodeKey; // Attach the key
          allNodesWithKeys.push(nodeWithKey);
        }
      }
      
      const katapultPolesArray: KatapultJsonNode[] = allNodesWithKeys.filter(node => {
        let rawNodeTypeValue: string | number | null | object = null;

        if (node.node_type && (typeof node.node_type === 'string' || typeof node.node_type === 'number')) {
          rawNodeTypeValue = String(node.node_type);
        } 
        else if (node.attributes?.node_type) {
          const nodeTypeAttribute = node.attributes.node_type;
          if (typeof nodeTypeAttribute === 'string') {
            rawNodeTypeValue = nodeTypeAttribute;
          } else if (typeof nodeTypeAttribute === 'object' && nodeTypeAttribute !== null) {
            rawNodeTypeValue = getFirstValueFromKatapultAttribute(nodeTypeAttribute);
          }
        }
        
        if (typeof rawNodeTypeValue === 'string' || typeof rawNodeTypeValue === 'number') {
          const nodeType = String(rawNodeTypeValue).trim();
          return ALLOWED_KATAPULT_NODE_TYPES.has(nodeType);
        }
        return false; 
      });
      
      const normalized = normalizeKatapultData(katapultPolesArray, fileName, birthmarks, jsonData);
      setNormalizedKatapultData(normalized);
      setKatapultFileName(fileName);
      setStatusMessage(`Katapult file "${fileName}" loaded. ${katapultPolesArray.length} relevant nodes found, ${normalized.length} poles processed for normalization.`);

    } catch (error) {
      console.error("Error loading Katapult JSON:", error);
      setStatusMessage(`Error loading Katapult file: ${(error as Error).message}. Please check file format.`);
      setRawKatapultJsonFull(null);
      setNormalizedKatapultData(null);
      setKatapultFileName(null);
      setKatapultBirthmarks({});
    } finally {
      setIsLoadingKatapult(false);
    }
  }, []);

  const handleCompare = useCallback(() => {
    if (!normalizedSpidaData || !normalizedKatapultData) {
      setStatusMessage('Error: Both SPIDA and Katapult data must be loaded before comparing.');
      return;
    }
    setIsComparing(true);
    setStatusMessage('Comparing datasets...');
    
    // Simulate async operation
    setTimeout(() => {
      try {
        const { processedPoles: comparedPoles, stats } = performComparison(normalizedSpidaData, normalizedKatapultData);
        setProcessedPoles(comparedPoles);
        setComparisonStats(stats);
        setStatusMessage(`Comparison complete. ${stats.totalMatches} matches found.`);
      } catch (error) {
        console.error("Error during comparison:", error);
        setStatusMessage(`Error during comparison: ${(error as Error).message}`);
        setProcessedPoles([]);
        setComparisonStats(INITIAL_STATS);
      } finally {
        setIsComparing(false);
      }
    }, 50); 
  }, [normalizedSpidaData, normalizedKatapultData]);

  const handleEditPole = useCallback((poleId: string, field: keyof ProcessedPole, value: string | number | boolean) => {
    setProcessedPoles(prevPoles =>
      prevPoles.map(pole => {
        if (pole.id === poleId) {
          let updatedPole = { ...pole, [field]: value, isEdited: true };
          updatedPole = recalculateMismatchFlags(updatedPole);
          return updatedPole;
        }
        return pole;
      })
    );
  }, []);

  const handleReset = useCallback(() => {
    // Confirm with user before resetting
    const confirmReset = window.confirm('Are you sure you want to reset all uploads and results? This action cannot be undone.');
    if (!confirmReset) return;

    // Reset all file-related state
    setRawSpidaJson(null);
    setSpidaAliasTable({});
    setNormalizedSpidaData(null);
    setSpidaFileName(null);
    setRawKatapultJsonFull(null);
    setKatapultBirthmarks({});
    setNormalizedKatapultData(null);
    setKatapultFileName(null);

    // Reset comparison results
    setProcessedPoles([]);
    setComparisonStats(INITIAL_STATS);

    // Reset loading states
    setIsLoadingSpida(false);
    setIsLoadingKatapult(false);
    setIsComparing(false);

    // Reset UI state
    setSelectedPoleForModal(null);
    setStatusMessage('All data cleared. Load SPIDA and Katapult JSON files to begin.');
    
    // Force FileLoader components to remount by changing the key
    setResetKey(prev => prev + 1);
  }, []);

  const handleExportCsv = useCallback(() => {
    if (processedPoles.length === 0) {
      setStatusMessage('No data to export.');
      return;
    }
    exportToCsv(processedPoles);
    setStatusMessage('Data exported to CSV.');
  }, [processedPoles]);
  
  const handleExportSpidaJson = useCallback(() => {
    if (!rawSpidaJson) {
       setStatusMessage('Original SPIDA JSON not loaded. Cannot export.');
       return;
    }
    if (processedPoles.filter(p => p.isEdited).length === 0) {
        setStatusMessage('No edits made to SPIDA data. Exporting original.');
        const jsonString = JSON.stringify(rawSpidaJson, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const exportFileName = spidaFileName ? `${spidaFileName.replace(/\.json$/i, '')}_reconciled.json` : 'spida_reconciled.json';
        link.download = exportFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        return;
    }

    const updatedJsonString = generateSpidaJsonWithUpdates(rawSpidaJson, processedPoles);
    const blob = new Blob([updatedJsonString], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const exportFileName = spidaFileName ? `${spidaFileName.replace(/\.json$/i, '')}_reconciled.json` : 'spida_reconciled.json';
    link.download = exportFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    setStatusMessage('SPIDA JSON with updates exported.');
  }, [rawSpidaJson, processedPoles, spidaFileName]);

  const handleExportKatapultAttributeUpdate = useCallback(() => {
    if (processedPoles.length === 0) {
      setStatusMessage('No processed data to generate Katapult attribute update file.');
      return;
    }
    exportKatapultAttributeUpdateExcel(processedPoles, spidaFileName);
    setStatusMessage('Katapult attribute update Excel file generated.');
  }, [processedPoles, spidaFileName]);


  
  const handleViewDetails = useCallback((pole: ProcessedPole) => {
    setSelectedPoleForModal(pole);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedPoleForModal(null);
  }, []);
  
  useEffect(() => {
    if(normalizedSpidaData === null || normalizedKatapultData === null) {
        setProcessedPoles([]);
        setComparisonStats(INITIAL_STATS);
        if (normalizedSpidaData === null && spidaFileName) setStatusMessage(`SPIDA file "${spidaFileName}" was cleared or failed to load. Please reload.`);
        else if (normalizedKatapultData === null && katapultFileName) setStatusMessage(`Katapult file "${katapultFileName}" was cleared or failed to load. Please reload.`);
    }
  }, [normalizedSpidaData, normalizedKatapultData, spidaFileName, katapultFileName]);

  const dataSourceSection = (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <FileLoader 
        key={`spida-${resetKey}`}
        label="SPIDA" 
        onFileLoad={handleSpidaFileLoad} 
        isLoading={isLoadingSpida} 
        loadedFileName={spidaFileName}
        idPrefix="spida"
      />
      <FileLoader 
        key={`katapult-${resetKey}`}
        label="Katapult" 
        onFileLoad={handleKatapultFileLoad} 
        isLoading={isLoadingKatapult}
        loadedFileName={katapultFileName}
        idPrefix="katapult"
      />
    </div>
  );

  const analysisSection = (
    <button 
      onClick={handleCompare} 
      disabled={isLoadingSpida || isLoadingKatapult || isComparing || !normalizedSpidaData || !normalizedKatapultData}
      className="btn btn-primary w-full"
    >
      {isComparing ? 'Comparing...' : 'Run Comparison'}
    </button>
  );

  const exportSection = (
     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <button 
        onClick={handleExportCsv} 
        disabled={processedPoles.length === 0 || isComparing}
        className="btn btn-secondary w-full"
      >
        Export CSV
      </button>
      <button 
        onClick={handleExportSpidaJson} 
        disabled={!rawSpidaJson || isComparing || processedPoles.length === 0}
        className="btn btn-secondary w-full"
      >
        Save SPIDA JSON
      </button>
       <button 
        onClick={handleExportKatapultAttributeUpdate} 
        disabled={processedPoles.length === 0 || isComparing}
        className="btn btn-secondary w-full"
      >
        Export Katapult Attributes (XLSX)
      </button>
      <button 
        onClick={handleReset} 
        disabled={isLoadingSpida || isLoadingKatapult || isComparing}
        className="btn btn-danger w-full"
      >
        Reset All Data
      </button>
    </div>
  );

  const statusContentSection = (
    <StatusDisplay stats={comparisonStats} statusMessage={statusMessage} isComparing={isComparing} />
  );

  const dataTableSection = (
    <DataTable 
      data={processedPoles} 
      onEdit={handleEditPole} 
      onViewDetails={handleViewDetails}
      onExportKatapultAttributes={handleExportKatapultAttributeUpdate}
    />
  );
  
  const mapSection = (
    <MapWithSelector processedPoles={processedPoles} onPoleClick={handleViewDetails} />
  );

  return (
    <>
      <DashboardLayout
        dataSourceSection={dataSourceSection}
        analysisSection={analysisSection}
        exportSection={exportSection}
        statusSection={statusContentSection}
        dataTableSection={dataTableSection}
        mapSection={mapSection}
        hasSpidaFile={spidaFileName !== null}
        hasKatapultFile={katapultFileName !== null}
        hasComparisonRun={processedPoles.length > 0}
        hasDataToExport={processedPoles.length > 0}
        comparisonData={{
          totalPoles: comparisonStats.totalSpidaPoles + comparisonStats.totalKatapultPoles,
          matchedPoles: comparisonStats.totalMatches,
          matchRate: (comparisonStats.totalSpidaPoles + comparisonStats.totalKatapultPoles) > 0 ? Math.round((comparisonStats.totalMatches / (comparisonStats.totalSpidaPoles + comparisonStats.totalKatapultPoles)) * 100) : 0,
          tier1Matches: comparisonStats.matchesByTier[MatchTier.SCID_EXACT_MATCH] || 0,
          tier2Matches: comparisonStats.matchesByTier[MatchTier.POLE_NUMBER_MATCH] || 0,
          tier3Matches: (comparisonStats.matchesByTier[MatchTier.COORDINATE_DIRECT_MATCH] || 0) + (comparisonStats.matchesByTier[MatchTier.COORDINATE_SPEC_VERIFIED] || 0),
          tier4Matches: 0, // Add fuzzy matching tier if needed
          unmatchedPoles: (comparisonStats.matchesByTier[MatchTier.UNMATCHED_SPIDA] || 0) + (comparisonStats.matchesByTier[MatchTier.UNMATCHED_KATAPULT] || 0),
          sampleMismatches: processedPoles
            .filter(pole => pole.isSpecMismatch || pole.isExistingPctMismatch || pole.isFinalPctMismatch || pole.isCommDropMismatch)
            .slice(0, 10)
            .map(pole => ({
              id: pole.id,
              scid: pole.displaySpidaScid || pole.displayKatapultScid,
              poleNumber: pole.displaySpidaPoleNum || pole.displayKatapultPoleNum,
              specMismatch: pole.isSpecMismatch,
              capacityMismatch: pole.isExistingPctMismatch || pole.isFinalPctMismatch,
              commDropMismatch: pole.isCommDropMismatch,
              spidaSpec: pole.displaySpidaPoleSpec,
              katapultSpec: pole.displayKatapultPoleSpec,
              spidaExistingPct: pole.displaySpidaExistingPct,
              katapultExistingPct: pole.displayKatapultExistingPct,
              spidaFinalPct: pole.displaySpidaFinalPct,
              katapultFinalPct: pole.displayKatapultFinalPct
            })),
          mismatches: {
            specificationMismatches: processedPoles.filter(pole => pole.isSpecMismatch),
            capacityMismatches: processedPoles.filter(pole => pole.isExistingPctMismatch || pole.isFinalPctMismatch),
            commDropMismatches: processedPoles.filter(pole => pole.isCommDropMismatch)
          }
        }}
        poleData={processedPoles}
        spidaJson={rawSpidaJson}
        katapultJson={_rawKatapultJsonFull}
        spidaFileName={spidaFileName}
        katapultFileName={katapultFileName}
      />
      <PoleDetailModal pole={selectedPoleForModal} onClose={handleCloseModal} />
    </>
  );
};

export default App;
