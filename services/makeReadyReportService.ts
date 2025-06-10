// @ts-ignore - type declarations provided by the exceljs package once installed
// eslint-disable-next-line import/no-extraneous-dependencies
import ExcelJS from 'exceljs';

/**
 * Generate a Make-Ready Excel file from Katapult Job JSON (and optional GeoJSON).
 * Implements domain logic ported from the original Python implementation.
 *
 * @param jobJson  Raw Katapult Job JSON that was already uploaded in the app.
 * @param geoJson  Optional GeoJSON file.
 *
 * @returns A Blob containing an .xlsx workbook.
 */
export async function generateMakeReadyReport(
  jobJson: any,
  _geoJson: any | null = null
): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Make-Ready');

  // Header row
  ws.addRow([
    'Connection ID',
    'From Node',
    'From SCID',
    'From DLOC',
    'From Tag',
    'To Node',
    'To SCID',
    'To DLOC',
    'To Tag',
    'Operation',
    'Work Type',
    'Responsible Party',
    'Height Lowest Comm',
    'Height Lowest CPS Electrical',
    'Attacher',
    'Existing Height',
    'Proposed Height',
    'Movement Summary',
    'Bearing'
  ]);
  ws.getRow(1).font = { bold: true };

  // Get node properties for quick lookup
  const nodeProperties = getNodeProperties(jobJson);
  
  // Prepare connection data for processing
  const connectionDataList = prepareConnectionData(jobJson, nodeProperties);
  
  // Sort connection data
  connectionDataList.sort((a, b) => {
    // First compare by fromSCID
    const scidCompare = compareScids(a.fromSCID, b.fromSCID);
    if (scidCompare !== 0) return scidCompare;
    
    // If SCIDs are equal, compare by toSCID
    return compareScids(a.toSCID, b.toSCID);
  });

  // Iterate connections to build report rows
  let currentRow = 2;
  let operationNumber = 1;
  
  for (const connData of connectionDataList) {
    const fromNode = connData.fromNode;
    const toNode = connData.toNode;
    
    // Skip if fromNode or toNode don't exist
    if (!fromNode || !toNode) continue;
    
    // Get attacher data for from node
    const attacherData = getAttachersForNode(jobJson, fromNode);
    
    // Get lowest heights for connection
    const [lowCom, lowCps] = getLowestHeightsForConnection(jobJson, connData.connectionId);
    
    // Get work type and responsible party
    const workType = getWorkType(jobJson, fromNode);
    const responsibleParty = getResponsibleParty(jobJson, fromNode);
    
    // Get bearing
    const bearing = calculateBearing(connData, jobJson);
    
    // Generate movement summary
    const movementSummary = buildMovementSummary(attacherData);
    
    const groupStart = currentRow;
    
    // Write attacher rows (at least one)
    const rowsToWrite = attacherData.length > 0 
      ? attacherData 
      : [{ name: '', existingHeight: '', proposedHeight: '', rawHeight: 0 } as Attacher];
      
    rowsToWrite.forEach((att) => {
      ws.addRow([
        connData.connectionId,
        fromNode,
        nodeProperties[fromNode]?.scid || 'N/A',
        nodeProperties[fromNode]?.dloc || 'N/A',
        nodeProperties[fromNode]?.poleTag || 'N/A',
        toNode,
        nodeProperties[toNode]?.scid || 'N/A',
        nodeProperties[toNode]?.dloc || 'N/A',
        nodeProperties[toNode]?.poleTag || 'N/A',
        operationNumber,
        workType,
        responsibleParty,
        lowCom,
        lowCps,
        att.name,
        att.existingHeight,
        att.proposedHeight,
        movementSummary,
        bearing
      ]);
      currentRow += 1;
    });

    const groupEnd = currentRow - 1;

    // Merge connection-level columns across group (columns except attacher details)
    const columnsToMerge = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 17, 18];
    columnsToMerge.forEach((c) => {
      if (groupEnd > groupStart) {
        ws.mergeCells(groupStart, c + 1, groupEnd, c + 1);
      }
    });
    
    // Increment operation number
    operationNumber++;
  }

  // Apply styles
  styleWorksheet(ws);

  // Generate blob
  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/****************************
 * Utility helpers (ported from Python)
 ****************************/

function compareScids(a: string, b: string): number {
  // Handle undefined or null values
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  
  // Convert to strings
  a = String(a);
  b = String(b);
  
  // Handle N/A values
  if (a === 'N/A' && b === 'N/A') return 0;
  if (a === 'N/A') return 1;
  if (b === 'N/A') return -1;
  
  // Split on dots to separate base number from suffixes
  const aParts = a.split('.');
  const bParts = b.split('.');
  
  // Compare base numbers first
  try {
    // Remove leading zeros and convert to integers
    const aBase = parseInt(aParts[0].replace(/^0+/, '') || '0', 10);
    const bBase = parseInt(bParts[0].replace(/^0+/, '') || '0', 10);
    if (aBase !== bBase) {
      return aBase - bBase;
    }
  } catch (e) {
    // If base numbers can't be compared as integers, compare as strings
    if (aParts[0] !== bParts[0]) {
      return aParts[0] < bParts[0] ? -1 : 1;
    }
  }
  
  // If base numbers are equal, the one without suffixes comes first
  if (aParts.length === 1 && bParts.length > 1) {
    return -1;
  }
  if (aParts.length > 1 && bParts.length === 1) {
    return 1;
  }
  
  // If both have suffixes, compare them
  return a < b ? -1 : 1;
}

/** Convert inches to feet-inches string like 24 -> 2'-0" */
function formatHeightFeetInches(heightInches: number | null | undefined): string {
  if (heightInches == null || !isFinite(heightInches)) return '';
  const total = Math.round(heightInches);
  const feet = Math.floor(total / 12);
  const inches = total % 12;
  return `${feet}'-${inches}"`;
}


/****************************
 * Domain helpers (partial port)
 ****************************/

/** Find the neutral wire height for a given node (in inches) */
function getNeutralWireHeight(jobData: any, nodeId: string): number | null {
  const node = jobData?.nodes?.[nodeId];
  if (!node) return null;
  const photoIds = node.photos || {};
  const mainPhotoId = Object.keys(photoIds).find((pid) => photoIds[pid]?.association === 'main');
  if (!mainPhotoId) return null;
  const photoData = jobData.photos?.[mainPhotoId];
  const pfData = photoData?.photofirst_data?.wire || {};
  const traceData = jobData.traces?.trace_data || {};
  let lowest = Infinity;
  for (const item of Object.values<any>(pfData)) {
    const traceId = item._trace;
    if (!traceId || !traceData[traceId]) continue;
    const info = traceData[traceId];
    if (info.company?.toLowerCase() === 'cps energy' && info.cable_type?.toLowerCase() === 'neutral') {
      const h = parseFloat(item._measured_height);
      if (isFinite(h) && h < lowest) lowest = h;
    }
  }
  return lowest === Infinity ? null : lowest;
}

/** Return [lowestCommHeight, lowestCpsHeight] (formatted strings) for a connection */
function getLowestHeightsForConnection(jobData: any, connectionId: string): [string, string] {
  const conn = jobData.connections?.[connectionId];
  if (!conn) return ['', ''];
  const sections = conn.sections || {};
  const traceData = jobData.traces?.trace_data || {};
  let lowestCom = Infinity;
  let lowestCps = Infinity;
  for (const section of Object.values<any>(sections)) {
    const photos = section.photos || {};
    const mainPhotoId = Object.keys(photos).find((pid) => photos[pid]?.association === 'main');
    if (!mainPhotoId) continue;
    const photoData = jobData.photos?.[mainPhotoId];
    const wires = photoData?.photofirst_data?.wire || {};
    for (const item of Object.values<any>(wires)) {
      const traceId = item._trace;
      if (!traceId || !traceData[traceId]) continue;
      const info = traceData[traceId];
      const company = String(info.company || '').trim().toLowerCase();
      const cable = String(info.cable_type || '').trim().toLowerCase();
      const h = parseFloat(item._measured_height);
      if (!isFinite(h)) continue;
      if (company === 'cps energy' && (cable === 'neutral' || cable === 'street light')) {
        if (h < lowestCps) lowestCps = h;
      } else if (company !== 'cps energy') {
        if (h < lowestCom) lowestCom = h;
      }
    }
  }
  return [
    lowestCom !== Infinity ? formatHeightFeetInches(lowestCom) : '',
    lowestCps !== Infinity ? formatHeightFeetInches(lowestCps) : '',
  ];
}

/** Get node properties for quick lookup (SCID, DLOC, Tag) */
function getNodeProperties(jobData: any): { [nodeId: string]: NodeProperty } {
  const properties: { [nodeId: string]: NodeProperty } = {};
  
  for (const [nodeId, nodeData] of Object.entries<any>(jobData.nodes || {})) {
    const attributes = nodeData.attributes || {};
    
    // Get SCID - could be under different keys
    let scidValue = 'N/A';
    const scidData = attributes.scid || {};
    for (const key of ['auto_button', '-Imported']) {
      if (key in scidData) {
        scidValue = scidData[key];
        break;
      }
    }
    if (scidValue === 'N/A' && Object.keys(scidData).length > 0) {
      scidValue = Object.values(scidData)[0] as string;
    }
    
    // Get DLOC number
    let dlocValue = 'N/A';
    const dlocData = attributes.DLOC_number || {};
    if (Object.keys(dlocData).length > 0) {
      dlocValue = Object.values(dlocData)[0] as string;
      if (dlocValue !== 'N/A' && !dlocValue.toUpperCase().startsWith('NT') && !dlocValue.toUpperCase().includes('PL')) {
        dlocValue = `PL${dlocValue}`;
      }
    }
    
    // Get pole tag
    let poleTagValue = 'N/A';
    const poleTagData = attributes.pole_tag || {};
    if (Object.keys(poleTagData).length > 0) {
      const firstValue = Object.values(poleTagData)[0] as any;
      poleTagValue = firstValue?.tagtext || 'N/A';
      if (poleTagValue !== 'N/A' && !poleTagValue.toUpperCase().startsWith('NT') && !poleTagValue.toUpperCase().includes('PL')) {
        poleTagValue = `PL${poleTagValue}`;
      }
    }
    
    // Get node type
    let nodeTypeValue = '';
    const nodeTypeData = attributes.node_type || {};
    for (const key of ['-Imported']) {
      if (key in nodeTypeData) {
        nodeTypeValue = nodeTypeData[key];
        break;
      }
    }
    if (!nodeTypeValue && Object.keys(nodeTypeData).length > 0) {
      nodeTypeValue = Object.values(nodeTypeData)[0] as string;
    }
    
    properties[nodeId] = {
      scid: scidValue,
      dloc: dlocValue,
      poleTag: poleTagValue,
      nodeType: nodeTypeValue
    };
  }
  
  return properties;
}

/** Prepare connection data for report generation */
function prepareConnectionData(jobData: any, nodeProperties: { [nodeId: string]: NodeProperty }): ConnectionData[] {
  const connectionDataList: ConnectionData[] = [];
  
  for (const [connectionId, connData] of Object.entries<any>(jobData.connections || {})) {
    // Check connection type
    const connType = connData.attributes?.connection_type?.button_added;
    if (connType === 'underground cable') continue;
    
    const fromNode = connData.node_id_1;
    const toNode = connData.node_id_2;
    
    // Skip if missing node IDs
    if (!fromNode || !toNode) continue;
    
    // Get node types
    const fromNodeType = nodeProperties[fromNode]?.nodeType || '';
    const toNodeType = nodeProperties[toNode]?.nodeType || '';
    
    // Skip if either end is a Reference
    if (fromNodeType === 'Reference' || toNodeType === 'Reference') continue;
    
    // Skip if both ends are Ped
    if (fromNodeType === 'Ped' && toNodeType === 'Ped') continue;
    
    connectionDataList.push({
      connectionId,
      fromNode,
      toNode,
      fromSCID: nodeProperties[fromNode]?.scid || 'N/A',
      toSCID: nodeProperties[toNode]?.scid || 'N/A',
      fromDLOC: nodeProperties[fromNode]?.dloc || 'N/A',
      toDLOC: nodeProperties[toNode]?.dloc || 'N/A',
      fromTag: nodeProperties[fromNode]?.poleTag || 'N/A',
      toTag: nodeProperties[toNode]?.poleTag || 'N/A',
      connType: connType || ''
    });
  }
  
  return connectionDataList;
}

/** Get work type based on job data (simplified logic) */
function getWorkType(jobData: any, nodeId: string): string {
  const node = jobData.nodes?.[nodeId];
  if (!node) return '';
  const workType = node.work_type;
  return workType ? workType : '';
}

/** Get responsible party based on job data (simplified logic) */
function getResponsibleParty(jobData: any, nodeId: string): string {
  const node = jobData.nodes?.[nodeId];
  if (!node) return '';
  const responsibleParty = node.responsible_party;
  return responsibleParty ? responsibleParty : '';
}

/** Calculate bearing between two nodes (simplified logic) */
function calculateBearing(connData: any, jobData: any): string {
  const fromNode = connData.fromNode;
  const toNode = connData.toNode;
  const fromProps = jobData.nodes?.[fromNode];
  const toProps = jobData.nodes?.[toNode];
  if (!fromProps || !toProps) return '';
  const fromLat = fromProps.latitude;
  const fromLon = fromProps.longitude;
  const toLat = toProps.latitude;
  const toLon = toProps.longitude;
  if (fromLat == null || fromLon == null || toLat == null || toLon == null) return '';

  // Calculate bearing using simple formula (not accounting for curvature of the earth)
  const y = Math.sin(toLon - fromLon) * Math.cos(toLat);
  const x = Math.cos(fromLat) * Math.sin(toLat) - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(toLon - fromLon);
  let bearing = Math.atan2(y, x) * (180 / Math.PI);
  if (bearing < 0) bearing += 360;
  return bearing.toFixed(2) + '°';
}

/****************************
 * Attacher modelling
 ****************************/

export interface Attacher {
  name: string;
  existingHeight: string;
  proposedHeight: string;
  rawHeight: number;
  isProposed?: boolean;
}

/** Collect attachers for a given node (simplified subset of the original logic) */
function getAttachersForNode(jobData: any, nodeId: string): Attacher[] {
  const attachers: Attacher[] = [];
  const node = jobData.nodes?.[nodeId];
  if (!node) return attachers;

  const neutralHeight = getNeutralWireHeight(jobData, nodeId);

  const photoIds = node.photos || {};
  const mainPhotoId = Object.keys(photoIds).find((pid) => photoIds[pid]?.association === 'main');
  if (!mainPhotoId) return attachers;

  const pf = jobData.photos?.[mainPhotoId]?.photofirst_data || {};
  const traceData = jobData.traces?.trace_data || {};

  const categories: Array<keyof typeof pf> = ['wire', 'equipment', 'guying'];

  for (const cat of categories) {
    const items = pf[cat] || {};
    for (const item of Object.values<any>(items)) {
      const traceId = item._trace;
      const traceInfo = traceData[traceId] || {};

      let company = (traceInfo.company || '').trim();
      let typeLabel = '';

      if (cat === 'wire') typeLabel = (traceInfo.cable_type || '').trim();
      else if (cat === 'equipment') typeLabel = (traceInfo.equipment_type || item.equipment_type || '').trim();
      else if (cat === 'guying') typeLabel = (traceInfo.cable_type || item.guying_type || '').trim();

      if (!typeLabel) continue;
      if (typeLabel.toLowerCase() === 'primary') continue;

      const measuredHeight = parseFloat(item._measured_height);
      if (!isFinite(measuredHeight)) continue;

      // Skip equipment/guying above neutral
      if (cat !== 'wire' && neutralHeight != null && measuredHeight > neutralHeight) continue;

      const attacherName = company ? `${company} ${typeLabel}` : typeLabel;
      const existingHeightStr = formatHeightFeetInches(measuredHeight);
      let proposedHeightStr = '';
      const mrMove = parseFloat(item.mr_move ?? 0);
      if (isFinite(mrMove) && Math.abs(mrMove) > 0.01) {
        proposedHeightStr = formatHeightFeetInches(measuredHeight + mrMove);
      }

      const isProposed = !!traceInfo.proposed;

      attachers.push({
        name: attacherName,
        existingHeight: isProposed ? '' : existingHeightStr,
        proposedHeight: isProposed ? existingHeightStr : proposedHeightStr,
        rawHeight: measuredHeight,
        isProposed,
      });
    }
  }

  attachers.sort((a, b) => b.rawHeight - a.rawHeight);
  return attachers;
}

/****************************
 * Movement summaries
 ****************************/

function parseFeetInches(str: string): number | null {
  const match = str.match(/(\d+)'-(\d+)"/);
  if (!match) return null;
  return parseInt(match[1], 10) * 12 + parseInt(match[2], 10);
}

/** Build detailed movement summary. If cpsOnly is true, include only CPS Energy attachers */
function buildMovementSummary(attachers: Attacher[], cpsOnly = false): string {
  const lines: string[] = [];
  attachers.forEach((att) => {
    if (cpsOnly && !att.name.toLowerCase().startsWith('cps energy')) return;
    if (att.isProposed) return; // proposed wires handled separately
    if (!att.existingHeight || !att.proposedHeight) return;

    const existingIn = parseFeetInches(att.existingHeight);
    const proposedIn = parseFeetInches(att.proposedHeight);
    if (existingIn === null || proposedIn === null || existingIn === proposedIn) return;

    const delta = proposedIn - existingIn;
    const action = delta > 0 ? 'Raise' : 'Lower';
    lines.push(`${action} ${att.name} ${Math.abs(delta)}" from ${att.existingHeight} to ${att.proposedHeight}`);
  });
  return lines.join('\n');
}

/** Apply worksheet styles */
function styleWorksheet(ws: ExcelJS.Worksheet) {
  // Set column widths
  ws.columns.forEach((col) => {
    col.width = 15;
  });

  // Set header row style
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: 'center' };

  // Set number formatting for specific columns
  const numberColumns = [13, 14]; // Lowest Comm and CPS Electrical Height
  numberColumns.forEach((colIndex) => {
    ws.getColumn(colIndex).numFmt = '0.00';
  });

  // Set date formatting for specific columns
  const dateColumns: number[] = []; // Add any date columns here if needed
  dateColumns.forEach((colIndex) => {
    ws.getColumn(colIndex).numFmt = 'mm/dd/yyyy';
  });

  // Auto-fit columns based on content
  ws.columns.forEach((col) => {
    let maxWidth = 0;
    col?.eachCell?.({ includeEmpty: true }, (cell: ExcelJS.Cell) => {
      const cellValue = cell.value?.toString() || '';
      maxWidth = Math.max(maxWidth, cellValue.length);
    });
    col.width = Math.min(maxWidth + 2, 50); // Max width 50
  });
}

/****************************
 * Type interfaces
 ****************************/

interface NodeProperty {
  scid: string;
  dloc: string;
  poleTag: string;
  nodeType: string;
}

interface ConnectionData {
  connectionId: string;
  fromNode: string;
  toNode: string;
  fromSCID: string;
  toSCID: string;
  fromDLOC: string;
  toDLOC: string;
  fromTag: string;
  toTag: string;
  connType: string;
}
