# Cross-Arm Fix Verification Test

## Test Case: Double Cross-Arm with Three Phase Wires

### Expected Behavior After Fixes:

1. **Cross-arms should appear as attachments**
   - Look for "Cross-arm" entries in the attachment list
   - Should show correct height (e.g., "28' 0"")

2. **Insulators should show correct heights**
   - Arm-mounted insulators should include vertical offset from arm
   - Should see insulator heights like "27' 6"" (arm height minus drop)

3. **Wires should group under correct insulators**
   - Each phase wire should appear under its specific insulator
   - No duplicate grouping on crowded cross-arms
   - Should see cross-arm indicator (🔧) on connected wires

4. **Height comparisons should be accurate**
   - SPIDA insulator height (27' 6") should compare to Katapult wire height (27' 6")
   - NOT to cross-arm height (28' 0")

### UI Structure Example:
```
📍 Pole PL123456

Cross-arm                    28' 0"
CPS ‒ Insulator (Phase)      27' 6"  🔧
  ▻ Primary #1 🔧
  ▻ Primary #2 🔧  
  ▻ Primary #3 🔧

CPS ‒ Insulator (Neutral)    27' 3"  🔧
  ▻ Neutral Wire 🔧
```

### Performance Improvements:
- No more O(n²) scans when finding wire-insulator connections
- Tighter height tolerance (3mm vs 3/8") prevents mis-grouping
- Enhanced communication service detection

### Warnings Display:
- Any parsing issues now appear in yellow warning box
- Examples: "Cross-arm XA1 on pole PL123 has no height data" 