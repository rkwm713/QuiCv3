// Excel Export Utility for SPIDA vs Katapult QC Tool
// Creates a workbook with one tab per pole including comparison data and movement information

import * as XLSX from 'xlsx';
import { ComparisonResult, Attachment } from './types';

// Helper to format height as feet and inches
const formatHeightFtIn = (heightMeters: number): string => {
  const totalFeet = heightMeters * 3.28084;
  const feet = Math.floor(totalFeet);
  const inches = Math.round((totalFeet - feet) * 12);
  
  if (inches >= 12) {
    return `${feet + 1}' 0"`;
  }
  
  return inches > 0 ? `${feet}' ${inches}"` : `${feet}' 0"`;
};

// Helper to calculate height difference
const calculateHeightDifference = (spidaHeight: number, katapultHeight: number): string => {
  const difference = spidaHeight - katapultHeight;
  if (Math.abs(difference) < 0.01) return '—';
  
  const isHigher = difference > 0;
  const symbol = isHigher ? '▲' : '▼';
  return `${symbol} ${formatHeightFtIn(Math.abs(difference))}`;
};

// Create measured vs existing comparison sheet
const createMeasuredVsExistingSheet = (result: ComparisonResult): any[][] => {
  const headers = [
    'SPIDA Attachment Type',
    'SPIDA Owner', 
    'SPIDA Description',
    'SPIDA Height',
    'Katapult Attachment Type',
    'Katapult Owner',
    'Katapult Description', 
    'Katapult Height',
    'Height Difference',
    'Notes'
  ];

  const rows: any[][] = [headers];
  
  // Simple matching for measured vs existing
  const findBestMatch = (spidaAtt: Attachment): Attachment | null => {
    return result.katapultExisting.find(katAtt => {
      const sameOwner = spidaAtt.owner.toLowerCase() === katAtt.owner.toLowerCase();
      const sameType = spidaAtt.type.toLowerCase().includes(katAtt.type.toLowerCase()) ||
                      katAtt.type.toLowerCase().includes(spidaAtt.type.toLowerCase());
      const sameHeight = Math.abs(spidaAtt.height - katAtt.height) < 0.5; // 0.5m tolerance
      
      return sameOwner && sameType && sameHeight;
    }) || null;
  };

  // Add matched pairs
  const processedKatapult = new Set<Attachment>();
  
  result.spidaMeasured.forEach(spidaAtt => {
    const katMatch = findBestMatch(spidaAtt);
    if (katMatch) processedKatapult.add(katMatch);
    
    rows.push([
      spidaAtt.type,
      spidaAtt.owner,
      spidaAtt.description,
      formatHeightFtIn(spidaAtt.height),
      katMatch?.type || '',
      katMatch?.owner || '',
      katMatch?.description || '',
      katMatch ? formatHeightFtIn(katMatch.height) : '',
      katMatch ? calculateHeightDifference(spidaAtt.height, katMatch.height) : 'No Match',
      katMatch ? '' : 'SPIDA only - no Katapult match found'
    ]);
  });

  // Add unmatched Katapult items
  result.katapultExisting.forEach(katAtt => {
    if (!processedKatapult.has(katAtt)) {
      rows.push([
        '',
        '',
        '',
        '',
        katAtt.type,
        katAtt.owner,
        katAtt.description,
        formatHeightFtIn(katAtt.height),
        'No Match',
        'Katapult only - no SPIDA match found'
      ]);
    }
  });

  return rows;
};

// Create recommended vs proposed comparison sheet with movement data
const createRecommendedVsProposedSheet = (result: ComparisonResult): any[][] => {
  const headers = [
    'Attachment Type',
    'Owner',
    'Description',
    'Change Type',
    'SPIDA Measured Height',
    'SPIDA Recommended Height', 
    'Katapult Original Height',
    'Katapult Final Height (after movement)',
    'Movement Direction',
    'Movement Amount (inches)',
    'Movement Description',
    'Height Difference (Recommended vs Final)',
    'Status'
  ];

  const rows: any[][] = [headers];

  if (!result.enhancedProposedComparison) {
    rows.push(['No changes or proposals found for this pole']);
    return rows;
  }

  result.enhancedProposedComparison.forEach(comparison => {
    const { spida, katapult, changeType, measuredHeight } = comparison;
    
    // Calculate adjusted Katapult height if movement exists
    let katapultFinalHeight = katapult?.height || 0;
    let movementInfo = {
      direction: 'None',
      amountInches: '',
      description: 'No movement'
    };
    
    if (katapult?.mrMove !== undefined && katapult.moveDirection !== 'none') {
      // Convert mr_move from inches to meters and add to original height
      const movementInMeters = katapult.mrMove * 0.0254;
      katapultFinalHeight = katapult.height + movementInMeters;
      
      movementInfo = {
        direction: katapult.moveDirection === 'up' ? 'Raised' : 'Lowered',
        amountInches: Math.abs(katapult.mrMove).toString(),
        description: katapult.moveDescription || 'Movement data available'
      };
    }
    
    // Calculate final difference (SPIDA recommended vs Katapult final position)
    const heightDifference = spida && katapult ? 
      calculateHeightDifference(spida.height, katapultFinalHeight) : 'N/A';
    
    // Determine status
    let status = '';
    if (changeType === 'brand-new') {
      status = spida ? 'New SPIDA recommendation' : 'New Katapult proposal';
    } else if (changeType === 'height-change') {
      status = 'Height modification';
    }
    
    if (spida && katapult && Math.abs(spida.height - katapultFinalHeight) < 0.01) {
      status += ' - Heights match after movement';
    } else if (spida && katapult) {
      status += ' - Height difference remains';
    }

    rows.push([
      spida?.type || katapult?.type || '',
      spida?.owner || katapult?.owner || '',
      spida?.description || katapult?.description || '',
      changeType === 'brand-new' ? 'New' : 'Modified',
      measuredHeight !== undefined ? formatHeightFtIn(measuredHeight) : '',
      spida ? formatHeightFtIn(spida.height) : '',
      katapult ? formatHeightFtIn(katapult.height) : '',
      katapult ? formatHeightFtIn(katapultFinalHeight) : '',
      movementInfo.direction,
      movementInfo.amountInches,
      movementInfo.description,
      heightDifference,
      status
    ]);
  });

  return rows;
};

// Create pole summary sheet
const createPoleSummarySheet = (result: ComparisonResult): any[][] => {
  const headers = ['Property', 'Value'];
  const rows: any[][] = [headers];

  // Basic pole information
  rows.push(['Pole Label', result.poleLabel]);
  rows.push(['Species', result.poleInfo.species || 'N/A']);
  rows.push(['Class', result.poleInfo.classOfPole || 'N/A']);
  rows.push(['Height', result.poleInfo.height ? formatHeightFtIn(result.poleInfo.height) : 'N/A']);
  rows.push(['', '']); // Empty row

  // Attachment counts
  rows.push(['SPIDA Measured Attachments', result.spidaMeasured.length.toString()]);
  rows.push(['Katapult Existing Attachments', result.katapultExisting.length.toString()]);
  rows.push(['SPIDA Recommended Attachments', result.spidaRecommended.length.toString()]);
  rows.push(['Katapult Proposed Attachments', result.katapultProposed.length.toString()]);
  rows.push(['', '']); // Empty row

  // Change summary
  const enhancedChanges = result.enhancedProposedComparison || [];
  const newItems = enhancedChanges.filter(c => c.changeType === 'brand-new').length;
  const modifiedItems = enhancedChanges.filter(c => c.changeType === 'height-change').length;
  
  rows.push(['Total Changes', enhancedChanges.length.toString()]);
  rows.push(['New Items', newItems.toString()]);
  rows.push(['Modified Items', modifiedItems.toString()]);
  rows.push(['', '']); // Empty row

  // Movement summary
  const allAttachments = [...result.katapultExisting, ...result.katapultProposed];
  const movedAttachments = allAttachments.filter(att => 
    att.mrMove !== undefined && att.moveDirection !== 'none'
  );
  
  if (movedAttachments.length > 0) {
    const raisedCount = movedAttachments.filter(att => att.moveDirection === 'up').length;
    const loweredCount = movedAttachments.filter(att => att.moveDirection === 'down').length;
    const avgMovement = movedAttachments.reduce((sum, att) => 
      sum + Math.abs(att.mrMove!), 0) / movedAttachments.length;
    
    rows.push(['Movement Summary', '']);
    rows.push(['Total Moved Attachments', movedAttachments.length.toString()]);
    rows.push(['Raised', raisedCount.toString()]);
    rows.push(['Lowered', loweredCount.toString()]);
    rows.push(['Average Movement (inches)', avgMovement.toFixed(1)]);
  } else {
    rows.push(['Movement Summary', 'No proposed movements']);
  }

  return rows;
};

// Main export function
export const exportToExcel = (comparisonResults: ComparisonResult[]): void => {
  if (comparisonResults.length === 0) {
    alert('No comparison data available to export');
    return;
  }

  // Create new workbook
  const workbook = XLSX.utils.book_new();

  // Add a summary sheet first
  const overviewData = [
    ['SPIDA vs Katapult QC Report'],
    ['Generated on:', new Date().toLocaleString()],
    ['Total Poles:', comparisonResults.length.toString()],
    [''],
    ['Pole', 'SPIDA Measured', 'Katapult Existing', 'Changes', 'Movements'],
  ];

  comparisonResults.forEach(result => {
    const enhancedChanges = result.enhancedProposedComparison || [];
    const allAttachments = [...result.katapultExisting, ...result.katapultProposed];
    const movements = allAttachments.filter(att => 
      att.mrMove !== undefined && att.moveDirection !== 'none'
    ).length;

    overviewData.push([
      result.poleLabel,
      result.spidaMeasured.length.toString(),
      result.katapultExisting.length.toString(),
      enhancedChanges.length.toString(),
      movements.toString()
    ]);
  });

  const overviewSheet = XLSX.utils.aoa_to_sheet(overviewData);
  XLSX.utils.book_append_sheet(workbook, overviewSheet, 'Overview');

  // Add individual pole sheets
  comparisonResults.forEach(result => {
    // Sanitize and truncate sheet name to allow for suffixes (Excel has 31 char limit)
    // Reserve space for longest suffix " - REC vs PROP" (15 chars) = 16 chars max for pole name
    const baseName = result.poleLabel
      .replace(/[\\\/\?\*\[\]]/g, '_') // Replace invalid characters
      .substring(0, 16); // Leave room for suffixes

    // Create pole summary sheet - "Summary" (7 chars) + " - " (3 chars) = 10 chars total suffix
    const summaryData = createPoleSummarySheet(result);
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, `${baseName} - Summary`);

    // Create measured vs existing comparison - "MEA vs EXI" (11 chars) + " - " (3 chars) = 14 chars total suffix
    const measuredData = createMeasuredVsExistingSheet(result);
    const measuredSheet = XLSX.utils.aoa_to_sheet(measuredData);
    XLSX.utils.book_append_sheet(workbook, measuredSheet, `${baseName} - MEA vs EXI`);

    // Create recommended vs proposed comparison - "REC vs PROP" (12 chars) + " - " (3 chars) = 15 chars total suffix
    const proposedData = createRecommendedVsProposedSheet(result);
    const proposedSheet = XLSX.utils.aoa_to_sheet(proposedData);
    XLSX.utils.book_append_sheet(workbook, proposedSheet, `${baseName} - REC vs PROP`);
  });

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
  const filename = `SPIDA_Katapult_QC_Report_${timestamp}.xlsx`;

  // Write and download the file
  try {
    XLSX.writeFile(workbook, filename);
    console.log(`Excel report exported successfully: ${filename}`);
  } catch (error) {
    console.error('Error exporting Excel file:', error);
    alert('Error exporting Excel file. Please try again.');
  }
};

// Export function specifically for browser download
export const downloadExcelReport = (comparisonResults: ComparisonResult[]): void => {
  exportToExcel(comparisonResults);
}; 