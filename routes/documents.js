const express = require('express');
const fs = require('fs').promises;
const router = express.Router();
const {
  cleanupFile,
  createUploadMiddleware,
  dispatchPrintJob,
  maxUploadSize
} = require('./print-helper');

const upload = createUploadMiddleware();

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

// Print document - uses the same dispatch path as payment verification
router.post('/print', upload.single('file'), async (req, res) => {
  try {
    const result = await dispatchPrintJob(req);
    res.json(result);

    try {
      await fs.unlink(req.file.path);
    } catch (cleanupError) {
      console.error('[Print API] Failed to cleanup local file:', cleanupError);
    }
  } catch (error) {
    console.error('[Print API] ERROR:', error.message);
    console.error('[Print API] Full error:', error);
    
    // Cleanup file on error
    if (req.file) {
      cleanupFile(req.file.path);
    }
    
    let errorMessage = 'An unknown error occurred.';
    if (error.name === 'AbortError') {
      errorMessage = 'Upload timed out. The printer may be offline or busy.';
    } else if (error.code === 'LIMIT_FILE_SIZE') {
      errorMessage = `File too large. Maximum allowed size is ${Math.floor(maxUploadSize / (1024 * 1024))}MB.`;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    res.status(error.statusCode || 500).json({ error: `Failed to send print job: ${errorMessage}` });
  }
});

module.exports = router;
