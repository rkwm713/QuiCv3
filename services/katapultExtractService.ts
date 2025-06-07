import { Attachment, KatapultJsonFormat } from '../types';
import { _to_feet_ts } from './dataProcessingService';

/**
 * Calculate bearing between two coordinates in degrees
 */
function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): { degrees: number; cardinal: string } {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  
  const bearingRad = Math.atan2(y, x);
  const bearingDeg = (bearingRad * 180 / Math.PI + 360) % 360;
  
  // Convert to cardinal direction
  const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const cardinalIndex = Math.round(bearingDeg / 45) % 8;
  
  return {
    degrees: bearingDeg,
    cardinal: cardinals[cardinalIndex]
  };
}

/**
 * Calculate distance between two coordinates using Haversine formula (returns meters)
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Extract SCID from Katapult node
 */
function extractScidFromNode(node: any): string {
  // Try various SCID sources
  if (node.attributes?.scid?.['.-Imported']) {
    return String(node.attributes.scid['.-Imported']).trim();
  }
  if (node.attributes?.PL_number?.['.-Imported']) {
    return String(node.attributes.PL_number['.-Imported']).trim();
  }
  if (node.attributes?.PoleNumber?.['.-Imported']) {
    return String(node.attributes.PoleNumber['.-Imported']).trim();
  }
  if (node.attributes?.DLOC_number) {
    return String(node.attributes.DLOC_number).trim();
  }
  if (node.PoleNumber) {
    return String(node.PoleNumber).trim();
  }
  return node._nodeKey || 'unknown';
}

/**
 * Extract attachments from Katapult JSON format
 */
export function extractKatapultAttachments(katapultJson: KatapultJsonFormat | null): Attachment[] {
  console.log('=== KATAPULT EXTRACTION DEBUG ===');
  console.log('Katapult JSON provided:', !!katapultJson);
  
  if (!katapultJson) {
    console.warn('Katapult JSON is null or undefined');
    return [];
  }

  console.log('Has nodes:', !!katapultJson.nodes, 'Count:', katapultJson.nodes ? Object.keys(katapultJson.nodes).length : 0);
  console.log('Has connections:', !!katapultJson.connections, 'Count:', katapultJson.connections ? Object.keys(katapultJson.connections).length : 0);
  console.log('Has traces:', !!katapultJson.traces, 'Count:', katapultJson.traces ? Object.keys(katapultJson.traces || {}).length : 0);

  // Check the structure of traces
  if (katapultJson.traces) {
    console.log('Traces structure keys:', Object.keys(katapultJson.traces));
    if (katapultJson.traces.trace_data) {
      console.log('trace_data count:', Object.keys(katapultJson.traces.trace_data).length);
    }
  }

  if (!katapultJson?.nodes || !katapultJson?.connections || !katapultJson?.traces) {
    console.warn('Katapult JSON missing required nodes, connections, or traces data');
    return [];
  }

  const attachments: Attachment[] = [];
  const { nodes, connections, traces } = katapultJson;

  // Build node lookup for coordinates and SCID mapping
  const nodeToCoords: Record<string, { lat: number; lon: number; scid: string }> = {};
  Object.entries(nodes).forEach(([nodeId, node]) => {
    const scid = extractScidFromNode(node);
    let lat: number | null = null;
    let lon: number | null = null;

    // Extract coordinates from node
    if (node.geometry?.coordinates && Array.isArray(node.geometry.coordinates)) {
      [lon, lat] = node.geometry.coordinates;
    } else if (node.Latitude !== undefined && node.Longitude !== undefined) {
      lat = typeof node.Latitude === 'number' ? node.Latitude : parseFloat(String(node.Latitude));
      lon = typeof node.Longitude === 'number' ? node.Longitude : parseFloat(String(node.Longitude));
    }

    if (lat !== null && lon !== null) {
      nodeToCoords[nodeId] = { lat, lon, scid };
    }
  });

  // Extract span-based attachments from connections
  Object.entries(connections).forEach(([_, conn]) => {
    const { node_id_1, node_id_2, sections } = conn;
    
    if (!node_id_1 || !node_id_2 || !sections) return;

    const node1Coords = nodeToCoords[node_id_1];
    const node2Coords = nodeToCoords[node_id_2];
    
    if (!node1Coords || !node2Coords) return;

    Object.entries(sections).forEach(([_, section]: [string, any]) => {
      if (!section.photos) return;

      // Process each photo in the section
      Object.entries(section.photos).forEach(([_, photo]: [string, any]) => {
        if (!photo.photofirst_data) return;

        const photoData = photo.photofirst_data;

        // Process wire attachments
        if (photoData.wire && Array.isArray(photoData.wire)) {
          photoData.wire.forEach((item: any, i: number) => {
            try {
              const traceId = item._trace;
              if (!traceId || !traces.trace_data[traceId]) return;

              const trace = traces.trace_data[traceId];
              const heightInches = parseFloat(item._measured_height || '0');
              const heightFt = _to_feet_ts(heightInches);

              if (heightFt !== null && heightFt > 0) {
                const id = `wire-${traceId}-${i}`;
                const poleScid = node1Coords.scid;

                // Calculate span distance and direction
                const distanceMeters = haversineDistance(
                  node1Coords.lat, node1Coords.lon,
                  node2Coords.lat, node2Coords.lon
                );
                const distanceFeet = distanceMeters * 3.28084;
                const bearing = calculateBearing(
                  node1Coords.lat, node1Coords.lon,
                  node2Coords.lat, node2Coords.lon
                );

                attachments.push({
                  poleScid,
                  id,
                  owner: trace.company || 'Unknown',
                  type: 'wire',
                  size: trace.cable_type || 'Unknown',
                  height: heightFt,
                  direction: bearing.degrees,
                  offsetLead: distanceFeet,
                  source: 'katapult',
                  rawData: { item, trace, connection: conn, section, photo }
                });
              }
            } catch (error) {
              console.warn('Failed to extract wire attachment:', error);
            }
          });
        }

        // Process equipment attachments
        if (photoData.equipment && Array.isArray(photoData.equipment)) {
          photoData.equipment.forEach((item: any, i: number) => {
            try {
              const traceId = item._trace;
              if (!traceId || !traces.trace_data[traceId]) return;

              const trace = traces.trace_data[traceId];
              const heightInches = parseFloat(item._measured_height || '0');
              const heightFt = _to_feet_ts(heightInches);

              if (heightFt !== null && heightFt > 0) {
                const id = `equipment-${traceId}-${i}`;
                const poleScid = node1Coords.scid;

                attachments.push({
                  poleScid,
                  id,
                  owner: trace.company || 'Unknown',
                  type: 'equipment',
                  size: trace.equipment_type || item.equipment_type || 'Unknown',
                  height: heightFt,
                  source: 'katapult',
                  rawData: { item, trace, connection: conn, section, photo }
                });
              }
            } catch (error) {
              console.warn('Failed to extract equipment attachment:', error);
            }
          });
        }

        // Process guying attachments
        if (photoData.guying && Array.isArray(photoData.guying)) {
          photoData.guying.forEach((item: any, i: number) => {
            try {
              const traceId = item._trace;
              if (!traceId || !traces.trace_data[traceId]) return;

              const trace = traces.trace_data[traceId];
              const heightInches = parseFloat(item._measured_height || '0');
              const heightFt = _to_feet_ts(heightInches);

              if (heightFt !== null && heightFt > 0) {
                const id = `guying-${traceId}-${i}`;
                const poleScid = node1Coords.scid;

                // Calculate guy direction if available
                const distanceMeters = haversineDistance(
                  node1Coords.lat, node1Coords.lon,
                  node2Coords.lat, node2Coords.lon
                );
                const distanceFeet = distanceMeters * 3.28084;
                const bearing = calculateBearing(
                  node1Coords.lat, node1Coords.lon,
                  node2Coords.lat, node2Coords.lon
                );

                attachments.push({
                  poleScid,
                  id,
                  owner: trace.company || 'Unknown',
                  type: 'guying',
                  size: trace.cable_type || 'Guy Wire',
                  height: heightFt,
                  direction: bearing.degrees,
                  offsetLead: distanceFeet,
                  source: 'katapult',
                  rawData: { item, trace, connection: conn, section, photo }
                });
              }
            } catch (error) {
              console.warn('Failed to extract guying attachment:', error);
            }
          });
        }
      });
    });
  });

  // Also check for node-based attachments (pole-mounted equipment)
  Object.entries(nodes).forEach(([nodeId, node]) => {
    const nodeCoords = nodeToCoords[nodeId];
    if (!nodeCoords) return;

    // Check if node has photos with attachments
    if (node.photos) {
      Object.entries(node.photos).forEach(([_, photo]: [string, any]) => {
        if (photo.association === 'main' && photo.photofirst_data) {
          const photoData = photo.photofirst_data;

          // Process pole-mounted equipment
          if (photoData.equipment && Array.isArray(photoData.equipment)) {
            photoData.equipment.forEach((item: any, i: number) => {
              try {
                const traceId = item._trace;
                if (!traceId || !traces.trace_data[traceId]) return;

                const trace = traces.trace_data[traceId];
                const heightInches = parseFloat(item._measured_height || '0');
                const heightFt = _to_feet_ts(heightInches);

                if (heightFt !== null && heightFt > 0) {
                  const id = `node-equipment-${traceId}-${i}`;
                  const poleScid = nodeCoords.scid;

                  attachments.push({
                    poleScid,
                    id,
                    owner: trace.company || 'Unknown',
                    type: 'equipment',
                    size: trace.equipment_type || item.equipment_type || 'Unknown',
                    height: heightFt,
                    source: 'katapult',
                    rawData: { item, trace, node, photo }
                  });
                }
              } catch (error) {
                console.warn('Failed to extract node equipment attachment:', error);
              }
            });
          }
        }
      });
    }
  });

  console.log(`=== KATAPULT EXTRACTION RESULTS ===`);
  console.log(`Extracted ${attachments.length} attachments from Katapult JSON`);
  
  if (attachments.length > 0) {
    console.log('Sample attachment:', attachments[0]);
    console.log('All SCIDs found:', [...new Set(attachments.map(a => a.poleScid))]);
  } else {
    console.log('No attachments found - debugging needed');
    console.log('Node count:', Object.keys(nodes).length);
    console.log('Connection count:', Object.keys(connections).length);
    console.log('Sample connection:', Object.values(connections)[0]);
    
    // Check if any connections have sections with photos
    let connectionsWithPhotos = 0;
    Object.values(connections).forEach((conn: any) => {
      if (conn.sections) {
        Object.values(conn.sections).forEach((section: any) => {
          if (section.photos) {
            connectionsWithPhotos++;
          }
        });
      }
    });
    console.log('Connections with photo sections:', connectionsWithPhotos);
  }
  
  return attachments;
} 