// Cross-arm aware sorting helper
// Places cross-arms immediately before their first insulator in height-sorted order

import { Attachment } from './types';

/**
 * Sort attachments with cross-arm hierarchy awareness
 * Cross-arms appear immediately before their first insulator in height order
 */
export const sortWithCrossArmHierarchy = (attachments: Attachment[]): Attachment[] => {
  // Step 1: Separate cross-arms from other attachments
  const crossArms = attachments.filter(att => att.type.toLowerCase().includes('cross-arm'));
  const nonCrossArms = attachments.filter(att => !att.type.toLowerCase().includes('cross-arm'));
  
  // Step 2: Build mapping of cross-arm ID to cross-arm attachment
  const crossArmMap = new Map<string, Attachment>();
  crossArms.forEach(arm => {
    if (arm.id) {
      crossArmMap.set(arm.id, arm);
    }
  });
  
  // Step 3: Sort non-cross-arm attachments by height (highest first)
  const sortedNonCrossArms = [...nonCrossArms].sort((a, b) => b.height - a.height);
  
  // Step 4: Insert cross-arms before their first insulator
  const result: Attachment[] = [];
  const processedCrossArms = new Set<string>();
  
  for (const attachment of sortedNonCrossArms) {
    // Check if this attachment is an insulator on a cross-arm
    if (attachment.type.toLowerCase().includes('insulator') && 
        attachment.parentCrossArmId && 
        !processedCrossArms.has(attachment.parentCrossArmId)) {
      
      // Insert the cross-arm before this insulator
      const crossArm = crossArmMap.get(attachment.parentCrossArmId);
      if (crossArm) {
        result.push(crossArm);
        processedCrossArms.add(attachment.parentCrossArmId);
        
        console.log(`🔧 Placed cross-arm ${crossArm.id} before insulator ${attachment.id} at height ${attachment.height.toFixed(2)}m`);
      }
    }
    
    // Add the current attachment
    result.push(attachment);
  }
  
  // Step 5: Add any unprocessed cross-arms at the end (shouldn't happen normally)
  crossArms.forEach(arm => {
    if (arm.id && !processedCrossArms.has(arm.id)) {
      result.push(arm);
      console.warn(`🔧 Unprocessed cross-arm ${arm.id} added at end - no insulators found`);
    }
  });
  
  console.log(`🔧 Cross-arm hierarchy sorting complete:`, {
    totalAttachments: attachments.length,
    crossArms: crossArms.length,
    processedCrossArms: processedCrossArms.size,
    resultLength: result.length
  });
  
  return result;
};

/**
 * Check if an attachment is the first insulator on its cross-arm in a sorted list
 * Used for visual indicators in the UI
 */
export const isFirstInsulatorOnCrossArm = (
  attachment: Attachment, 
  index: number, 
  sortedAttachments: Attachment[]
): boolean => {
  if (!attachment.type.toLowerCase().includes('insulator') || !attachment.parentCrossArmId) {
    return false;
  }
  
  // Check if this is the first occurrence of an insulator with this cross-arm ID
  for (let i = 0; i < index; i++) {
    const prevAttachment = sortedAttachments[i];
    if (prevAttachment.type.toLowerCase().includes('insulator') && 
        prevAttachment.parentCrossArmId === attachment.parentCrossArmId) {
      return false; // Not the first insulator on this cross-arm
    }
  }
  
  return true; // This is the first insulator on this cross-arm
};

/**
 * Get the cross-arm that should appear before a given insulator
 * Returns null if the insulator is not on a cross-arm or cross-arm not found
 */
export const getCrossArmForInsulator = (
  insulator: Attachment, 
  allAttachments: Attachment[]
): Attachment | null => {
  if (!insulator.type.toLowerCase().includes('insulator') || !insulator.parentCrossArmId) {
    return null;
  }
  
  return allAttachments.find(att => 
    att.type.toLowerCase().includes('cross-arm') && 
    att.id === insulator.parentCrossArmId
  ) || null;
}; 