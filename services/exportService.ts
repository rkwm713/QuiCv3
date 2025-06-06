import { ProcessedPole, SpidaPoleTypeDefinition } from '../types';
import { TABLE_COLUMNS } from '../constants';
import * as XLSX from 'xlsx';

interface SpidaJsonFormat {
  clientData?: {
    poles?: SpidaPoleTypeDefinition[]; // Changed from RawSpidaPole[]
    [key: string]: any;
  };
  [key: string]: any;
}

function normalizeForSpida(value: string, type: 'text' | 'number' | 'boolean' | 'select'): string | number | boolean | null {
    if (value === '' || value === 'N/A') return null;
    switch (type) {
        case 'number':
            const num = parseFloat(value);
            return isNaN(num) ? null : num;
        case 'boolean': // Assuming 'Yes'/'No' for boolean-like select
             return value.toLowerCase() === 'yes';
        case 'select': // Specific for ComDrop
            if (value.toLowerCase() === 'yes') return true;
            if (value.toLowerCase() === 'no') return false;
            return null; // For empty string or other values
        default:
            return value;
    }
}


export function generateSpidaJsonWithUpdates(
  originalSpidaJson: SpidaJsonFormat, // Accept the full original object
  processedPoles: ProcessedPole[]
): string {
  // Create a deep copy to avoid modifying the original state directly
  const updatedSpidaJson: SpidaJsonFormat = JSON.parse(JSON.stringify(originalSpidaJson));

  if (!updatedSpidaJson.clientData || !Array.isArray(updatedSpidaJson.clientData.poles)) {
    console.error("Cannot update SPIDA JSON: 'clientData.poles' is missing or not an array.");
    return JSON.stringify(originalSpidaJson, null, 2); // Return original if structure is wrong
  }
  
  const targetPolesArray = updatedSpidaJson.clientData.poles;

  processedPoles.forEach(pp => {
    if (pp.isEdited && pp.spida) {
      const originalIndex = pp.spida.originalIndex;
      // Ensure the index is valid for the targetPolesArray
      // Note: This logic assumes originalIndex maps correctly to clientData.poles.
      // If clientData.poles are definitions and originalIndex refers to instances from 'leads',
      // this update logic might target the wrong part of the JSON.
      // However, this change only fixes the immediate type error.
      if (originalIndex >= 0 && originalIndex < targetPolesArray.length) {
        const targetPoleInJson = targetPolesArray[originalIndex];
        
        if (targetPoleInJson) {
          // These properties are dynamically added if they don't exist, due to [key: string]: any in SpidaPoleTypeDefinition
          targetPoleInJson.Specification = pp.editableSpidaSpec;
          targetPoleInJson.Existing_Condition_Percent = normalizeForSpida(pp.editableSpidaExistingPct, 'number') as number | null;
          targetPoleInJson.Final_Condition_Percent = normalizeForSpida(pp.editableSpidaFinalPct, 'number') as number | null;
          targetPoleInJson.Comm_Drop_Required = normalizeForSpida(pp.editableSpidaCommDrop, 'select') as boolean | null;
        }
      } else {
        console.warn(`Skipping update for pole ID ${pp.id}: originalIndex ${originalIndex} is out of bounds for SPIDA data array (clientData.poles).`);
      }
    }
  });
  return JSON.stringify(updatedSpidaJson, null, 2); // Pretty print JSON
}

export function exportToCsv(processedPoles: ProcessedPole[], fileName: string = 'comparison_export.csv'): void {
  if (!processedPoles || processedPoles.length === 0) {
    alert("No data to export.");
    return;
  }

  const csvColumns = TABLE_COLUMNS.filter(col => 
    !col.key.startsWith('internal') && 
    col.key !== 'matchTierColor' 
  );
  
  const header = csvColumns.map(col => col.label).join(',') + '\n';
  
  const rows = processedPoles.map(pole => {
    return csvColumns.map(col => {
      let value = pole[col.key as keyof ProcessedPole] as string | number | boolean | undefined | null;
      if (value === null || value === undefined) {
        value = 'N/A';
      }
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(',');
  }).join('\n');

  const csvContent = header + rows;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } else {
    alert("CSV export is not supported in this browser.");
  }
}

export function exportKatapultAttributeUpdateExcel(
  processedPoles: ProcessedPole[],
  spidaFileName: string | null
): void {
  if (!processedPoles || processedPoles.length === 0) {
    alert("No SPIDA data processed to export for Katapult attribute update.");
    return;
  }

  const spidaPolesForExport = processedPoles.filter(p => p.spida);

  if (spidaPolesForExport.length === 0) {
    alert("No SPIDA pole data found in the processed results to export.");
    return;
  }

  const dataForExcel = spidaPolesForExport.map(p => {
    const spidaPoleData = p.spida!; // Already filtered, so spida is non-null
    return {
      'Latitude': spidaPoleData.coords?.lat?.toFixed(6) ?? 'N/A',
      'Longitude': spidaPoleData.coords?.lon?.toFixed(6) ?? 'N/A',
      'Existing Loading %': p.editableSpidaExistingPct || 'N/A',
      'Final Loading %': p.editableSpidaFinalPct || 'N/A',
      'Pole Spec': p.editableSpidaSpec || 'N/A',
      'Stress MR Notes': '', // Empty as requested
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "SPIDA_Attributes");

  let excelFileName = "SPIDA_Katapult_Attribute_Update_USEWITHCAUTION.xlsx";
  if (spidaFileName) {
    const nameWithoutExtension = spidaFileName.split('.').slice(0, -1).join('.') || spidaFileName;
    excelFileName = `${nameWithoutExtension}_USEWITHCAUTION.xlsx`;
  }
  
  try {
    XLSX.writeFile(workbook, excelFileName);
  } catch (error) {
    console.error("Error writing Excel file:", error);
    alert("Error generating Excel file. See console for details.");
  }
}