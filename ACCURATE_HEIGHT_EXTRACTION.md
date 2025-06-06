# Accurate Pole Height Extraction

## 🎯 **Overview**

The accurate pole height extraction system replaces the old spec-string parsing approach with direct extraction from raw JSON data structures. This provides much more reliable and precise height measurements.

## 🔧 **Implementation**

### **Main Function**
```typescript
extractPoleHeights(poles: ProcessedPole[]): Map<string, { kHeightFt: number | null, sHeightFt: number | null }>
```

### **Export Constant**
```typescript
export const HEIGHT_TOLERANCE_FT = 0.5;
```

## 📊 **Extraction Logic**

### **🍃 Katapult Data Sources (in order of precedence)**

1. **Direct Height Attributes** (returned as feet):
   - `nodes[id].attributes.measured_pole_height` (feet)
   - `nodes[id].attributes.total_pole_height_ft` (feet)  
   - `nodes[id].attributes.pole_height_inches` (inches ÷ 12)

2. **Derived from Attachments**:
   - Find highest `_measured_height` of wires/equipment/guys/anchors
   - Add 2 ft buffer: `max(attachment_heights) + 2`

3. **🚨 Legacy Fallback**:
   - Parse `pole.displayKatapultPoleSpec` with regex
   - Assume feet for bare numbers

### **⚡ SPIDA Data Sources (in order of precedence)**

1. **Structure Height Properties**:
   - `structures[i].pole.length.value`
   - `structures[i].pole.height.value`
   - `structures[i].design.pole.height.value`

2. **Unit Conversion**:
   - `unit === "METRE"` → metres × 3.28084
   - `unit === "FOOT"` → use as-is
   - No unit + `value < 60` → treat as metres
   - No unit + `value >= 60` → treat as feet

3. **🚨 Legacy Fallback**:
   - Parse `pole.displaySpidaPoleSpec` with regex
   - Assume metres for bare numbers < 60

## 🛠 **Helper Functions**

### **Validation**
```typescript
isCredibleFeet(value: number): boolean
// Returns true if 15 < value < 150 (reasonable pole heights)
```

### **Normalization**
```typescript
normalizeHeight(heightFt: number): number
// Rounds to single decimal place: Math.round(ft * 10) / 10
```

### **Legacy Parser**
```typescript
parseHeightFromString(spec: string, source: 'katapult' | 'spida'): number | null
// 🚨 Legacy only – avoid when possible
// Patterns: "45ft", "13.7m", "45/3", "45-3", bare numbers
```

## 📋 **Example Usage**

```typescript
import { HeightComparisonService, HEIGHT_TOLERANCE_FT } from './heightComparisonService';

// Extract heights from processed pole data
const poleHeightMap = HeightComparisonService.extractPoleHeights(poles);

// Access individual pole heights
poleHeightMap.forEach((heights, poleTag) => {
  const { kHeightFt, sHeightFt } = heights;
  const delta = Math.abs((kHeightFt || 0) - (sHeightFt || 0));
  
  if (delta > HEIGHT_TOLERANCE_FT) {
    console.log(`Height discrepancy on ${poleTag}: K=${kHeightFt}ft, S=${sHeightFt}ft, Δ=${delta}ft`);
  }
});
```

## 🔍 **Data Structure Examples**

### **Katapult Raw Data**
```json
{
  "attributes": {
    "measured_pole_height": 45.0,           // ✅ Priority 1 (feet)
    "total_pole_height_ft": 45.0,          // ✅ Priority 1 (feet)  
    "pole_height_inches": 540,             // ✅ Priority 1 (inches ÷ 12)
    "conductor_height_1": 35.0,            // Used for derivation if needed
    "anchor_height": 8.0                   // Used for derivation if needed
  }
}
```

### **SPIDA Raw Data**
```json
{
  "pole": {
    "length": { "value": 13.716, "unit": "METRE" },     // ✅ Priority 1 → 45.0 ft
    "height": { "value": 45.0, "unit": "FOOT" }         // ✅ Priority 2 → 45.0 ft
  },
  "designs": [{
    "structure": {
      "pole": {
        "height": { "value": 13.716, "unit": "METRE" }  // ✅ Priority 3 → 45.0 ft
      }
    }
  }]
}
```

## ✅ **Integration**

The new extraction is automatically integrated into the Height Comparison table:

1. **Height Comparison calls** `extractPoleHeights()` first
2. **Creates pole-level comparison items** from the height map  
3. **Merges with wire/attachment comparisons** for complete view
4. **Applies threshold logic** using `HEIGHT_TOLERANCE_FT`

## 🎯 **Benefits**

- ✅ **More Accurate**: Direct from measurement data vs. parsed specs
- ✅ **Unit Aware**: Proper METRE/FOOT conversion handling  
- ✅ **Fallback Safe**: Legacy regex parsing when raw data missing
- ✅ **Validated**: Credibility checks for reasonable pole heights
- ✅ **Normalized**: Consistent single decimal place formatting

## 🚨 **Migration Notes**

- **Old Method**: Relied on `displayKatapultPoleSpec` and `displaySpidaPoleSpec` strings
- **New Method**: Extracts from raw JSON with spec strings as fallback only
- **Legacy Support**: `parseHeightFromString()` maintains compatibility
- **Backward Compatible**: No breaking changes to existing interface

---

**Result**: Much more reliable pole height comparisons with proper unit handling and comprehensive data source coverage. 