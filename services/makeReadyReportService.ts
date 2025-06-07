// @ts-ignore - type declarations provided by the exceljs package once installed
// eslint-disable-next-line import/no-extraneous-dependencies
import ExcelJS from 'exceljs';

/**
 * Generate a Make-Ready Excel file from Katapult Job JSON (and optional GeoJSON).
 * This is a *placeholder* implementation that only demonstrates the end-to-end
 * flow.  The heavy domain logic from ONLYFORCONTEXT.txt will be ported here in
 * future commits.
 *
 * @param jobJson  Raw Katapult Job JSON that was already uploaded in the app.
 * @param geoJson  Optional GeoJSON file (currently unused).
 *
 * @returns A Blob containing an .xlsx workbook.
 */
export async function generateMakeReadyReport(
  jobJson: any,
  geoJson: any | null = null
): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Make-Ready');

  // Header row
  ws.addRow([
    'Connection ID',
    'From Node',
    'To Node',
    'Height Lowest Comm',
    'Height Lowest CPS Electrical',
    'Attacher',
    'Existing Height',
    'Proposed Height',
    'Movement Summary',
  ]);
  ws.getRow(1).font = { bold: true };

  // Iterate connections (skip underground for now)
  let currentRow = 2;
  for (const [connId, conn] of Object.entries<any>(jobJson.connections || {})) {
    const connType = conn.attributes?.connection_type?.button_added;
    if (connType === 'underground cable') continue;

    const fromNode = conn.node_id_1;
    const toNode = conn.node_id_2;

    const attachers = getAttachersForNode(jobJson, fromNode);
    const [lowCom, lowCps] = getLowestHeightsForConnection(jobJson, connId);

    const movementSummary = buildMovementSummary(attachers);

    const groupStart = currentRow;

    // Write attacher rows (at least one)
    const rowsToWrite = attachers.length > 0 ? attachers : [{ name: '', existingHeight: '', proposedHeight: '', rawHeight: 0 } as Attacher];
    rowsToWrite.forEach((att) => {
      ws.addRow([
        connId,
        fromNode,
        toNode,
        lowCom,
        lowCps,
        att.name,
        att.existingHeight,
        att.proposedHeight,
        movementSummary,
      ]);
      currentRow += 1;
    });

    const groupEnd = currentRow - 1;

    // Merge connection-level columns across group (A-E and I)
    const columnsToMerge = [0, 1, 2, 3, 4, 8];
    columnsToMerge.forEach((c) => {
      if (groupEnd > groupStart) {
        ws.mergeCells(groupStart, c + 1, groupEnd, c + 1);
      }
    });
  }

  // Adjust column widths based on content length
  (ws.columns as ExcelJS.Column[]).forEach((col) => {
    let max = 10;
    col.eachCell({ includeEmpty: true }, (cell: ExcelJS.Cell) => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len + 2 > max) max = len + 2;
    });
    col.width = max;
  });

  // Generate blob
  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/****************************
 * Utility helpers (ported from Python)
 ****************************/

/** Convert inches to feet-inches string like 24 -> 2'-0" */
function formatHeightFeetInches(heightInches: number | null | undefined): string {
  if (heightInches == null || !isFinite(heightInches)) return '';
  const total = Math.round(heightInches);
  const feet = Math.floor(total / 12);
  const inches = total % 12;
  return `${feet}'-${inches}"`;
}

/** Calculate bearing between two WGS-84 coords. Returns tuple [deg, "N|NE|E|…"] */
function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): [number, string] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
  let brng = (Math.atan2(y, x) * 180) / Math.PI; // in deg
  brng = (brng + 360) % 360; // 0-360
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(brng / 45) % 8;
  return [brng, dirs[idx]];
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
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

/** Shorthand CPS-only movement summary */
function buildShortCpsMovement(attachers: Attacher[]): string {
  const lines: string[] = [];
  attachers.forEach((att) => {
    if (!att.name.toLowerCase().startsWith('cps energy')) return;
    if (!att.existingHeight || !att.proposedHeight) return;
    const existingIn = parseFeetInches(att.existingHeight);
    const proposedIn = parseFeetInches(att.proposedHeight);
    if (existingIn === null || proposedIn === null || existingIn === proposedIn) return;
    const delta = proposedIn - existingIn;
    const action = delta > 0 ? 'Raise' : 'Lower';
    lines.push(`${action} ${att.name.replace(/cps energy/i, '').trim()}`);
  });
  return lines.join('\n');
}

/****************************
 * Reference span helpers
 ****************************/

interface ReferenceSpan {
  bearing: string;
  attachers: Attacher[];
}

function getReferenceSpans(jobData: any, currentNodeId: string): ReferenceSpan[] {
  const results: ReferenceSpan[] = [];
  const traceData = jobData.traces?.trace_data || {};

  for (const [connId, conn] of Object.entries<any>(jobData.connections || {})) {
    // Identify reference connection by attribute value containing "reference"
    const connTypeAttr = conn.attributes?.connection_type;
    const connTypeVal = typeof connTypeAttr === 'string' ? connTypeAttr : connTypeAttr?.button_added || Object.values(connTypeAttr || {})[0];
    if (!connTypeVal || !String(connTypeVal).toLowerCase().includes('reference')) continue;

    // Check if this connection attaches to current node
    const nodeIds = [conn.node_id_1, conn.node_id_2];
    if (!nodeIds.includes(currentNodeId)) continue;

    // Calculate bearing using midpoint section similar to python logic
    let bearingStr = '';
    const sections = conn.sections || {};
    const keys = Object.keys(sections);
    const midSection: any = keys.length ? (sections as any)[keys[Math.floor(keys.length / 2)]] : undefined;
    if (midSection) {
      const lat = midSection.latitude;
      const lon = midSection.longitude;
      const fromNode = jobData.nodes?.[currentNodeId];
      const mainPhotoId = Object.keys(fromNode?.photos || {}).find((pid) => fromNode.photos[pid]?.association === 'main');
      const fromPhoto = jobData.photos?.[mainPhotoId];
      const fromLat = fromPhoto?.latitude;
      const fromLon = fromPhoto?.longitude;
      if (isNumber(lat) && isNumber(lon) && isNumber(fromLat) && isNumber(fromLon)) {
        const [deg, card] = calculateBearing(fromLat, fromLon, lat, lon);
        bearingStr = `${card} (${Math.round(deg)}°)`;
      }
    }

    // Use midpoint main photo to collect attachers
    const photos = midSection?.photos || {};
    const midMainPhotoId = Object.keys(photos).find((pid) => photos[pid]?.association === 'main');
    if (!midMainPhotoId) continue;
    const pf = jobData.photos?.[midMainPhotoId]?.photofirst_data || {};

    const attacherList: Attacher[] = [];
    const categories: Array<keyof typeof pf> = ['wire', 'guying'];

    for (const cat of categories) {
      const items = pf[cat] || {};
      for (const item of Object.values<any>(items)) {
        const traceId = item._trace;
        if (!traceId || !traceData[traceId]) continue;
        const info = traceData[traceId];
        const company = (info.company || '').trim();
        const cableType = (info.cable_type || '').trim();
        if (cableType.toLowerCase() === 'primary') continue;
        const h = parseFloat(item._measured_height);
        if (!isFinite(h)) continue;
        const name = `${company} ${cableType}`.trim();
        attacherList.push({
          name,
          existingHeight: formatHeightFeetInches(h),
          proposedHeight: '',
          rawHeight: h,
        });
      }
    }
    attacherList.sort((a, b) => b.rawHeight - a.rawHeight);
    if (attacherList.length) {
      results.push({ bearing: bearingStr, attachers: attacherList });
    }
  }

  return results;
} 