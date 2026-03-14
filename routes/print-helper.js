const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const fetch = require('node-fetch');
const FormData = require('form-data');
const AbortController = require('abort-controller');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const uploadsDir = path.join(__dirname, '../uploads');
fs.mkdir(uploadsDir, { recursive: true }).catch(console.error);
const maxUploadSize = Number(process.env.MAX_UPLOAD_SIZE_BYTES || 50 * 1024 * 1024);

function buildTempFilename(originalName = '') {
  const ext = path.extname(originalName || '').toLowerCase();
  const safeExt = ext && ext.length <= 10 ? ext : '.bin';
  return `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${safeExt}`;
}

function createUploadMiddleware() {
  return multer({
    storage: multer.diskStorage({
      destination: uploadsDir,
      filename: (req, file, cb) => {
        cb(null, buildTempFilename(file.originalname));
      }
    }),
    limits: { fileSize: maxUploadSize }
  });
}

function cleanupFile(filePath) {
  if (!filePath) {
    return;
  }

  fsSync.unlink(filePath, () => {});
}

function getBackendBaseUrl(req) {
  if (process.env.BACKEND_PUBLIC_URL) {
    return process.env.BACKEND_PUBLIC_URL.replace(/\/$/, '');
  }

  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = forwardedProto || req.protocol || 'http';
  return `${protocol}://${req.get('host')}`;
}

async function dispatchPrintJob(req, payload = {}) {
  const file = payload.file || req.file;
  const body = payload.body || req.body || {};
  const { piId, printerId, paymentId, orderId, userId } = body;

  if (!file || !piId || !printerId || !paymentId || !orderId || !userId) {
    const error = new Error('Missing required parameters for printing.');
    error.statusCode = 400;
    throw error;
  }

  if (!req.db) {
    const error = new Error('Database not connected.');
    error.statusCode = 503;
    throw error;
  }

  const printerDetails = await req.db.collection('printers').findOne({
    fakePiId: piId,
    fakePrinterId: printerId
  });

  if (!printerDetails) {
    const error = new Error('Printer configuration not found. Cannot trigger print.');
    error.statusCode = 404;
    throw error;
  }

  const realPrinterName = printerDetails.printerName;
  const realPiId = printerDetails.piId;

  if (!realPiId) {
    const error = new Error('Printer configuration is missing the required Pi ID (subdomain).');
    error.statusCode = 500;
    throw error;
  }

  const piToken = process.env.PI_BEARER_TOKEN;
  if (!piToken) {
    throw new Error('Pi authentication token not configured. Please set PI_BEARER_TOKEN environment variable.');
  }

  const trackingId = uuidv4();
  const callbackUrl = `${getBackendBaseUrl(req)}/api/pi/job-status`;
  const printEndpoint = `http://${realPiId}.printshot.in/print`;

  const forwardFormData = new FormData();
  forwardFormData.append('file', fsSync.createReadStream(file.path), buildTempFilename(file.originalname));
  forwardFormData.append('orderId', orderId);
  forwardFormData.append('paymentId', paymentId);
  forwardFormData.append('printer', realPrinterName);
  forwardFormData.append('realPiId', realPiId);
  forwardFormData.append('trackingId', trackingId);
  forwardFormData.append('userId', userId);
  forwardFormData.append('callbackUrl', callbackUrl);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 480000);

  let response;
  let responseData;
  let usedEndpoint = '/print';

  try {
    response = await fetch(printEndpoint, {
      method: 'POST',
      body: forwardFormData,
      headers: {
        Authorization: `Bearer ${piToken}`,
        ...forwardFormData.getHeaders()
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Print API] Error from Raspberry Pi /print:', errorText);
      throw new Error(`Failed to send file to the device. Status: ${response.status}`);
    }

    responseData = await response.json();
  } catch (printError) {
    clearTimeout(timeoutId);

    const uploadEndpoint = `http://${realPiId}.printshot.in/upload`;
    const uploadFormData = new FormData();
    uploadFormData.append('file', fsSync.createReadStream(file.path), buildTempFilename(file.originalname));
    uploadFormData.append('printer', realPrinterName);
    uploadFormData.append('realPiId', realPiId);
    uploadFormData.append('trackingId', trackingId);
    uploadFormData.append('userId', userId);
    uploadFormData.append('callbackUrl', callbackUrl);

    const uploadController = new AbortController();
    const uploadTimeoutId = setTimeout(() => uploadController.abort(), 480000);

    response = await fetch(uploadEndpoint, {
      method: 'POST',
      body: uploadFormData,
      headers: {
        Authorization: `Bearer ${piToken}`,
        ...uploadFormData.getHeaders()
      },
      signal: uploadController.signal
    });

    clearTimeout(uploadTimeoutId);
    usedEndpoint = '/upload';

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Print API] Error from Raspberry Pi /upload:', errorText);
      throw new Error(`Failed to send file to the device. Status: ${response.status}`);
    }

    responseData = await response.json();
  }

  if (!responseData.success && !responseData.message) {
    console.error('[Print API] Pi reported print failure:', responseData);
    throw new Error(`Print failed: ${responseData.error || 'Unknown error from printer'}`);
  }

  const printJob = {
    piId,
    printerId,
    realPiId,
    realPrinterName,
    paymentId,
    orderId,
    userId,
    fileName: path.basename(file.originalname || 'document.pdf'),
    fileSize: file.size,
    trackingId,
    status: 'queued',
    piResponse: responseData,
    usedEndpoint,
    sentToPiAt: new Date(),
    createdAt: new Date()
  };

  const dbResult = await req.db.collection('printJobs').insertOne(printJob);
  const jobId = dbResult.insertedId;

  if (userId) {
    const wsManager = require('../websocket');
    wsManager.notifyUser(userId, {
      type: 'printQueued',
      trackingId,
      jobId: jobId.toString(),
      status: 'queued',
      message: 'Your document has been queued for printing!'
    });
  }

  return {
    success: true,
    message: 'Print job submitted successfully',
    realPrinterName,
    jobId: jobId.toString(),
    trackingId,
    status: 'queued',
    endpointUsed: usedEndpoint,
    estimatedTime: '2-5 minutes'
  };
}

module.exports = {
  buildTempFilename,
  cleanupFile,
  createUploadMiddleware,
  dispatchPrintJob,
  maxUploadSize
};
