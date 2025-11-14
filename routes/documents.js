const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
fs.mkdir(uploadsDir, { recursive: true }).catch(console.error);

// Configure multer for temporary file storage
const upload = multer({ 
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => {
      // Create unique filename with timestamp
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${file.originalname}`;
      cb(null, uniqueName);
    }
  }),
  limits: { fileSize: Infinity }
});

// Count pages in PDF
router.post('/count-pages', upload.single('file'), async (req, res) => {
  let filePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    filePath = req.file.path;
    console.log(`Processing PDF: ${req.file.originalname}, Size: ${(req.file.size / 1024 / 1024).toFixed(2)}MB`);
    
    // Read file and count pages
    const fileBuffer = await fs.readFile(filePath);
    const pageCount = await countPDFPages(fileBuffer);
    
    console.log(`Page count result: ${pageCount} pages`);
    res.json({ pages: pageCount });
  } catch (error) {
    console.error('PDF processing error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    // Always cleanup the temporary file
    if (filePath) {
      try {
        await fs.unlink(filePath);
        console.log(`Cleaned up temporary file: ${filePath}`);
      } catch (cleanupError) {
        console.error('Error cleaning up file:', cleanupError);
      }
    }
  }
});

// Fast PDF page counting function
async function countPDFPages(buffer) {
  try {
    // Convert buffer to string for pattern matching
    const pdfText = buffer.toString('binary');
    
    // Method 1: Count /Type /Page objects (fastest)
    const pageMatches = pdfText.match(/\/Type\s*\/Page[^s]/g);
    if (pageMatches && pageMatches.length > 0) {
      return pageMatches.length;
    }
    
    // Method 2: Count /Count entries in page tree
    const countMatch = pdfText.match(/\/Count\s+(\d+)/);
    if (countMatch) {
      return parseInt(countMatch[1]);
    }
    
    // Method 3: Count page breaks (fallback)
    const pageBreaks = pdfText.match(/%%Page:/g);
    if (pageBreaks) {
      return pageBreaks.length;
    }
    
    // Default fallback
    return 1;
  } catch (error) {
    console.error('Fast counting failed, using fallback:', error);
    return 1;
  }
}

// Print document
router.post('/print', upload.single('file'), async (req, res) => {
  try {
    const { piId, printerId, paymentId, orderId, userId } = req.body;

    if (!req.file || !piId || !printerId || !paymentId || !orderId || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Store print job in database
    const printJob = {
      piId,
      printerId,
      paymentId,
      orderId,
      userId,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      status: 'submitted',
      createdAt: new Date()
    };

    await req.db.collection('printJobs').insertOne(printJob);

    // In production, you would:
    // 1. Send file to the actual printer via Pi
    // 2. Update printer status
    // 3. Handle print queue management

    res.json({ 
      success: true, 
      message: 'Print job submitted successfully',
      realPrinterName: printerId // Mock response
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;