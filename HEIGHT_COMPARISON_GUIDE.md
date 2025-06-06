# Height Comparison User Guide

## 🎯 **Purpose**

The Height Comparison feature allows designers to **confirm—at a glance—that pole heights, wires, and other attachments in Katapult match those in SPIDAcalc**. This eliminates time-consuming manual comparisons and ensures data consistency before make-ready calculations.

## 🚀 **How to Use**

### **Accessing Height Comparison**
1. Load your SPIDA and Katapult data files
2. Run the comparison analysis
3. Click on the **"Height Comparison"** tab in the main navigation
4. The table will automatically display all pole, wire, and attachment comparisons

### **Understanding the Table**

The table shows one row per item that the two systems should agree on:

| Column | Description |
|--------|-------------|
| **Pole Tag** | Identifier for the pole (SCID or pole number) |
| **Item Type** | Type of item: Pole, Wire, or Other Attachment |
| **Description** | Specific description of the item being compared |
| **Katapult Height (ft)** | Height measurement from Katapult data |
| **SPIDA Height (ft)** | Height measurement from SPIDA data |
| **Δ (Delta)** | Absolute difference between the two heights |
| **Status** | Comparison result based on threshold |

## 🎨 **Status Logic**

### **Status Indicators:**
- 🟢 **OK**: Heights are within the threshold (default: 0.5 ft)
- 🔴 **HEIGHT DIFF**: Height gap exceeds the threshold
- 🟣 **ONLY IN KAT**: Item exists only in Katapult data
- 🔵 **ONLY IN SPIDA**: Item exists only in SPIDA data

### **Item Types:**
- 🔵 **Pole**: Main pole structure height
- 🟠 **Wire**: Conductor/wire attachment heights
- 🟣 **Other Attachment**: Anchors, guys, equipment, transformers

## ⚙️ **Behind the Scenes**

The system automatically:

1. **Parses Data**: Extracts height information from both Katapult and SPIDA datasets
2. **Converts Units**: Converts SPIDA meter values to feet (1m = 3.28084 ft)
3. **Matches Items**: Pairs poles by tag and items by description
4. **Calculates Differences**: Computes absolute height differences (Δ)
5. **Applies Status Logic**: Determines status based on your threshold setting

## 🔧 **Controls & Filtering**

### **Threshold Setting**
- Located in the top-right header
- Default: 0.5 feet
- Adjustable from 0 to 10 feet
- Changes apply immediately to all comparisons

### **Status Filter**
- Filter by: All Statuses, OK, HEIGHT DIFF, ONLY IN KAT, ONLY IN SPIDA
- Quickly focus on problem items by selecting "HEIGHT DIFF"

### **Item Type Filter**
- Filter by: All Types, Pole, Wire, Other Attachment
- Isolate specific types of items for focused review

### **Sorting**
- Click any column header to sort
- Click again to reverse sort order
- Visual indicators show current sort field and direction

## 📊 **Statistics Bar**

The statistics bar shows real-time counts:
- **Total**: Total number of comparison items
- **OK**: Items within threshold
- **HEIGHT DIFF**: Items exceeding threshold
- **ONLY IN KAT**: Items found only in Katapult
- **ONLY IN SPIDA**: Items found only in SPIDA

## 🎯 **Why This Matters**

### **Time Savings**
- Eliminates manual Excel comparisons
- Instantly identifies discrepancies
- Streamlines design validation process

### **Error Prevention**
- Catches height inconsistencies before calculations
- Prevents downstream clearance errors
- Ensures accurate loading analysis

### **Quality Assurance**
- Validates data consistency between systems
- Provides audit trail for design decisions
- Improves overall design reliability

## 🔄 **Typical Workflow**

1. **Initial Review**: Check overall statistics to gauge data quality
2. **Focus on Problems**: Filter to "HEIGHT DIFF" to see discrepancies
3. **Investigate Issues**: Sort by Δ (delta) to see largest differences first
4. **Correct Data**: Update source data in Katapult or SPIDA as needed
5. **Re-verify**: Reload data and confirm corrections

## 💡 **Best Practices**

### **Threshold Settings**
- **0.5 ft (default)**: Good for most utility applications
- **0.25 ft**: Stricter tolerance for critical infrastructure
- **1.0 ft**: More lenient for preliminary designs

### **Prioritizing Issues**
1. Focus on "HEIGHT DIFF" items first
2. Review "ONLY IN" items to ensure nothing is missing
3. Sort by delta to tackle largest discrepancies first

### **Data Quality**
- Ensure consistent pole naming between systems
- Verify unit consistency in source data
- Check for missing height information

## 🆘 **Troubleshooting**

### **No Data Showing**
- Verify both SPIDA and Katapult files are loaded
- Check that comparison analysis has been run
- Ensure files contain height information

### **Unexpected Results**
- Check unit consistency in source data
- Verify pole identification matches between systems
- Review threshold setting

### **Performance Issues**
- Use filters to reduce displayed items
- Consider processing smaller datasets for initial validation

## 📋 **Example Interpretations**

### **Good Results**
- High percentage of "OK" status items
- Few "HEIGHT DIFF" items with small deltas
- Minimal "ONLY IN" items

### **Needs Attention**
- Many "HEIGHT DIFF" items
- Large delta values (>2 ft typically)
- Significant "ONLY IN" counts suggesting missing data

---

**Remember**: This tool helps validate data consistency—it doesn't modify your source files. Always make corrections in the original SPIDA or Katapult data and reload for verification.

**Last Updated**: March 2024  
**Version**: 1.0  
**Compatible with**: QuiC v3.0+ 