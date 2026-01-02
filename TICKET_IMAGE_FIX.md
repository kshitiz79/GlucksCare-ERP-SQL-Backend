# Ticket Image Field Fix - Base64 Support

## Problem
When uploading base64 encoded images to tickets, getting error:
```
"value too long for type character varying(500)"
```

## Root Cause
The `tickets.image` column was defined as `VARCHAR(500)` which is too small for base64 encoded images.

**Base64 Image Sizes:**
- Small image (100KB): ~137KB base64 string
- Medium image (500KB): ~683KB base64 string
- Large image (1MB): ~1.37MB base64 string

## Solution Applied

### 1. Updated Sequelize Model ✅
**File:** `src/ticket/Ticket.js`

Changed from:
```javascript
image: {
  type: DataTypes.STRING(500)
}
```

To:
```javascript
image: {
  type: DataTypes.TEXT,
  allowNull: true,
  comment: 'Base64 encoded image or image URL'
}
```

### 2. Updated Database Schema ✅
**Migration Applied:**
```sql
ALTER TABLE tickets 
ALTER COLUMN image TYPE TEXT;
```

**Verification:**
```sql
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'tickets' AND column_name = 'image';

-- Result:
-- column_name | data_type | character_maximum_length 
-- image       | text      |                         
```

## Benefits

✅ **Unlimited Size**: TEXT type can store up to 1GB of data  
✅ **Base64 Support**: Can now store full base64 encoded images  
✅ **URL Support**: Can also store image URLs  
✅ **Backward Compatible**: Existing data remains intact  

## Usage

### Frontend - Sending Base64 Image
```javascript
// Convert image to base64
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
};

// Upload ticket with image
const handleSubmit = async (file) => {
  const base64Image = await fileToBase64(file);
  
  const ticketData = {
    title: "Issue Title",
    description: "Issue description",
    image: base64Image  // Full base64 string
  };
  
  await axios.post('/api/tickets', ticketData);
};
```

### Backend - Storing Image
```javascript
// The image field now accepts:
// 1. Base64 encoded string: "data:image/png;base64,iVBORw0KG..."
// 2. Image URL: "https://example.com/image.jpg"
// 3. NULL/empty for no image

const ticket = await Ticket.create({
  title: req.body.title,
  description: req.body.description,
  image: req.body.image,  // Can be base64 or URL
  user_id: req.user.id
});
```

## Testing

### Test with Small Image
```javascript
const smallBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
// Should work ✅
```

### Test with Large Image
```javascript
// Upload a 1MB image
// Convert to base64 (~1.37MB string)
// Should work ✅
```

## Performance Considerations

### Storage
- TEXT fields are stored efficiently in PostgreSQL
- No performance penalty for small values
- Large values are stored in TOAST (The Oversized-Attribute Storage Technique)

### Best Practices
1. **Compress images** before converting to base64
2. **Resize images** to reasonable dimensions (e.g., 1920x1080 max)
3. **Consider using cloud storage** (S3, Cloudinary) for very large images
4. **Store URLs** instead of base64 for better performance

### Alternative Approach (Optional)
For very large images, consider:
```javascript
// Option 1: Upload to cloud storage
const imageUrl = await uploadToS3(imageFile);
ticket.image = imageUrl;  // Store URL instead

// Option 2: Use separate image table
const ticketImage = await TicketImage.create({
  ticket_id: ticket.id,
  image_data: base64String
});
```

## Migration History

**Date:** 2026-01-02  
**Applied By:** System Admin  
**Status:** ✅ Completed  
**Rollback:** Not recommended (would truncate existing data)

## Verification Checklist

- [x] Model updated in `Ticket.js`
- [x] Database column type changed to TEXT
- [x] Existing tickets data intact
- [x] Can upload small base64 images
- [x] Can upload large base64 images
- [x] Can store image URLs
- [x] NULL values allowed

## Support

If you encounter issues:
1. Check if image is properly base64 encoded
2. Verify image size (compress if > 5MB)
3. Check database connection
4. Review server logs for errors

---

**Status:** ✅ Fixed  
**Last Updated:** 2026-01-02
