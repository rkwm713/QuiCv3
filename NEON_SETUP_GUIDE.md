# Neon PostgreSQL Setup Guide for QuiC

This guide explains how to set up **Neon PostgreSQL database** for storing your Google API keys instead of using Netlify Blobs.

## 🎯 **Why Use Neon?**

### **Neon Advantages:**
- ✅ Full PostgreSQL database with powerful querying
- ✅ Automatic scaling and serverless architecture  
- ✅ Built-in connection pooling
- ✅ Great for storing structured data beyond just API keys
- ✅ Seamless Netlify integration
- ✅ Free tier available

### **Netlify Blobs vs. Neon Comparison:**

| Feature | Netlify Blobs | Neon PostgreSQL |
|---------|---------------|-----------------|
| **Setup Complexity** | ⭐ Simple | ⭐⭐ Moderate |
| **Query Capabilities** | Key-value only | ⭐⭐⭐ Full SQL |
| **Scalability** | ⭐⭐ Good | ⭐⭐⭐ Excellent |
| **Cost** | Free (included) | Free tier + usage |
| **Best for** | Simple storage | Complex data needs |

## 🚀 **Step-by-Step Setup**

### **1. Create Neon Database**

1. **Sign up for Neon**: Go to [neon.tech](https://neon.tech)
2. **Create a new project**: 
   - Name: `quic-api-storage`
   - Region: Choose closest to your users
3. **Get connection string**: Copy the connection URL

### **2. Install Neon Extension in Netlify**

1. Go to your Netlify dashboard
2. Navigate to **Site settings** > **Integrations**
3. Search for "Neon" and install the extension
4. Connect your Neon database
5. This automatically sets `NEON_DATABASE_URL` environment variable

### **3. Update Environment Variables**

In your **Netlify dashboard** > **Site settings** > **Environment variables**, add:

```bash
# Required for Neon setup
NEON_DATABASE_URL=postgresql://username:password@host/database
ADMIN_TOKEN=your_secure_32_character_admin_token
ENCRYPTION_KEY=your_32_character_encryption_key

# Optional fallback
GEMINI_API_KEY=your_gemini_api_key_here
```

### **4. Switch to Neon Functions**

Replace your current functions with the Neon versions:

```bash
# Rename current functions (backup)
mv netlify/functions/api-key-manager.js netlify/functions/api-key-manager-blobs.js.backup
mv netlify/functions/gemini-analysis.js netlify/functions/gemini-analysis-blobs.js.backup

# Use Neon versions
mv netlify/functions/api-key-manager-neon.js netlify/functions/api-key-manager.js
mv netlify/functions/gemini-analysis-neon.js netlify/functions/gemini-analysis.js
```

### **5. Install Dependencies**

```bash
npm install @neondatabase/serverless
```

### **6. Deploy and Test**

```bash
npm run build
# Deploy to Netlify

# Test the setup
curl -X GET https://your-site.netlify.app/.netlify/functions/api-key-manager \
  -H "x-admin-token: your_admin_token"
```

## 📊 **Database Schema**

The setup automatically creates these tables:

### API Keys Table
```sql
CREATE TABLE api_keys (
  id SERIAL PRIMARY KEY,
  key_name VARCHAR(255) UNIQUE NOT NULL,
  encrypted_value TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_keys_name ON api_keys(key_name);
```



## 🔑 **Managing API Keys**

### **Store Your Gemini API Key:**
```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/api-key-manager \
  -H "Content-Type: application/json" \
  -H "x-admin-token: your_admin_token" \
  -d '{"apiKey": "your_gemini_api_key_here"}'
```

### **Retrieve API Key:**
```bash
curl -X GET https://your-site.netlify.app/.netlify/functions/api-key-manager \
  -H "x-admin-token: your_admin_token"
```

### **Delete API Key:**
```bash
curl -X DELETE https://your-site.netlify.app/.netlify/functions/api-key-manager \
  -H "x-admin-token: your_admin_token"
```

## 🔒 **Security Features**

- ✅ **Encryption**: API keys encrypted before storage
- ✅ **Admin Protection**: Admin token required for all operations
- ✅ **Connection Security**: Neon uses SSL by default
- ✅ **Environment Isolation**: Production vs development separation
- ✅ **Fallback Support**: Environment variable fallback if DB fails

## 🛠 **Advanced Configuration**

### **Connection Pooling**
```javascript
// For high-traffic applications, configure connection pooling
const sql = neon(process.env.NEON_DATABASE_URL, {
  pooled: true,
  ssl: 'require'
});
```

### **Multiple API Keys**
The schema supports multiple API keys. To store additional keys:

```javascript
// In your function, change the keyName
const keyName = 'openai-api-key'; // or any other service
```

### **Key Rotation**
```bash
# Rotate your API key
curl -X POST https://your-site.netlify.app/.netlify/functions/api-key-manager \
  -H "Content-Type: application/json" \
  -H "x-admin-token: your_admin_token" \
  -d '{"apiKey": "your_new_api_key_here"}'
```

## 🚨 **Troubleshooting**

### **Common Issues:**

1. **"Database not configured" error**
   - Check `NEON_DATABASE_URL` environment variable
   - Ensure Neon extension is properly connected

2. **"Connection failed" error**
   - Verify your Neon database is active
   - Check connection string format

3. **"Unauthorized" error**
   - Verify `ADMIN_TOKEN` environment variable
   - Check the `x-admin-token` header in requests

4. **"Encryption key not configured" error**
   - Set `ENCRYPTION_KEY` environment variable
   - Must be exactly 32 characters

### **Testing Connection:**
```javascript
// Test your Neon connection
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.NEON_DATABASE_URL);

const testConnection = async () => {
  try {
    const result = await sql`SELECT NOW() as current_time`;
    console.log('✅ Connected to Neon:', result[0].current_time);
  } catch (error) {
    console.error('❌ Neon connection failed:', error);
  }
};
```

## 🔄 **Migration from Netlify Blobs**

If you're switching from Netlify Blobs:

1. **Export existing key** (if you have one stored in Blobs)
2. **Set up Neon** following this guide
3. **Import key** to Neon using the API
4. **Switch functions** to Neon versions
5. **Test thoroughly** before removing Blobs functions

## 📈 **Performance Considerations**

- **Connection reuse**: Neon serverless client reuses connections automatically
- **Query optimization**: Use prepared statements for repeated queries
- **Monitoring**: Monitor query performance in Neon dashboard
- **Scaling**: Neon automatically scales based on usage

## 💰 **Cost Considerations**

- **Free Tier**: 512MB storage, 1 GB data transfer/month
- **Paid Plans**: Start at $19/month for production use
- **Monitor Usage**: Set up billing alerts in Neon dashboard

---

## ✅ **Verification Checklist**

- [ ] Neon database created and connected to Netlify
- [ ] Environment variables configured
- [ ] Dependencies installed (`@neondatabase/serverless`)
- [ ] Functions switched to Neon versions
- [ ] API key stored successfully
- [ ] AI analysis working with stored key
- [ ] Error handling tested

## 🎯 **Height Comparison Features**

The Height Comparison system validates data consistency between Katapult and SPIDA:

### **What it does:**
- ✅ Compares pole heights, wire heights, and attachment heights between systems
- ✅ Automatically converts SPIDA meters to feet (1m = 3.28084 ft)  
- ✅ Calculates height differences (Δ) for each item
- ✅ Applies configurable tolerance threshold (default: 0.5 ft)
- ✅ Identifies items that exist in only one system

### **Status Categories:**
- **OK**: Heights within tolerance threshold
- **HEIGHT DIFF**: Height gap exceeds threshold  
- **ONLY IN KAT**: Item exists only in Katapult
- **ONLY IN SPIDA**: Item exists only in SPIDA

### **Dashboard Features:**
- ✅ Real-time height comparison table
- ✅ Sortable/filterable by status and item type
- ✅ Adjustable tolerance threshold setting
- ✅ Statistics bar showing counts for each status
- ✅ Color-coded status indicators for quick identification
- ✅ No database required - works with in-memory data

## 🎯 **Next Steps**

After setup:
1. Store your Gemini API key securely
2. Test AI analysis functionality
3. Use Height Comparison to validate data consistency
4. Set up monitoring and alerts
5. Plan for key rotation schedule
6. Consider expanding database for other application data

---

**Need Help?** Check the [Neon documentation](https://neon.tech/docs) or [contact support](https://neon.tech/support). 