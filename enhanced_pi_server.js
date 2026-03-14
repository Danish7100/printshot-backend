// Improved Raspberry Pi server with actual printing status monitoring
const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const fs = require('fs').promises;
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const upload = multer({ dest: '/tmp/' });

// authenticate socket connections
io.use((socket, next) => {
  const token = socket.handshake.headers.authorization?.replace('Bearer ', '');
  if (token === PI_TOKEN) return next();
  return next(new Error('Unauthorized'));
});

io.on('connection', (socket) => {
  console.log('[WS] client connected:', socket.id);
  socket.emit('connected', { message: 'Welcome to Pi WebSocket' });

  socket.on('request_printer_status', async () => {
    // respond with current statuses
    const printers = await getAllPrinterStatus();
    socket.emit('printer_status_response', { printers, timestamp: Date.now() / 1000 });
  });

  socket.on('disconnect', () => {
    console.log('[WS] client disconnected:', socket.id);
  });
});
const PI_TOKEN = process.env.PI_BEARER_TOKEN;

// Store active print jobs
const activePrintJobs = new Map();

app.post('/upload', upload.single('file'), async (req, res) => {
  // Verify token
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token !== PI_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const printer = req.body.printer;
  const filePath = req.file.path;
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  console.log(`[Pi] Received print job ${jobId} for printer: ${printer}`);

  // Check printer status first
  try {
    const printerStatus = await checkPrinterStatus(printer);
    if (!printerStatus.online) {
      await fs.unlink(filePath);
      return res.status(503).json({
        success: false,
        error: 'Printer is offline or unavailable',
        printerStatus: printerStatus
      });
    }
  } catch (error) {
    console.error('[Pi] Printer status check failed:', error);
  }

  // Submit print job to CUPS
  exec(`lp -d ${printer} -t "${jobId}" ${filePath}`, async (error, stdout, stderr) => {
    console.log(`[Pi] lp command output for job ${jobId}:`);
    console.log(`[Pi] stdout: ${stdout}`);
    console.log(`[Pi] stderr: ${stderr}`);
    console.log(`[Pi] error: ${error}`);

    if (error) {
      console.error(`[Pi] Print job ${jobId} failed:`, error);
      await fs.unlink(filePath);
      return res.status(500).json({
        success: false,
        error: 'Failed to queue print job',
        details: error.message,
        stdout: stdout,
        stderr: stderr
      });
    }

    // Extract CUPS job ID from output
    const cupsJobId = stdout.match(/job (\d+)/)?.[1] || jobId;

    // Store job info
    activePrintJobs.set(jobId, {
      cupsJobId,
      printer,
      filePath,
      status: 'queued',
      submittedAt: new Date(),
      lastChecked: new Date()
    });

    console.log(`[Pi] Print job ${jobId} queued successfully (CUPS ID: ${cupsJobId})`);

    res.json({
      success: true,
      message: 'Print job queued successfully',
      printJobId: jobId,
      cupsJobId: cupsJobId,
      status: 'queued',
      estimatedTime: '2-5 minutes'
    });

    // Start monitoring this job
    monitorPrintJob(jobId);
  });
});

// Check printer status
async function checkPrinterStatus(printerName) {
  return new Promise((resolve) => {
    exec(`lpstat -p ${printerName}`, (error, stdout, stderr) => {
      const online = !error && stdout.includes('enabled');
      const statusObj = {
        online,
        name: printerName,
        status: online ? 'online' : 'offline',
        details: stdout || stderr
      };
      // broadcast every check
      broadcastStatus(printerName, statusObj.status);
      resolve(statusObj);
    });
  });
}

// Monitor print job status
async function monitorPrintJob(jobId) {
  const jobInfo = activePrintJobs.get(jobId);
  if (!jobInfo) return;

  // Check CUPS job status
  exec(`lpstat -W completed ${jobInfo.cupsJobId}`, async (error, stdout) => {
    const now = new Date();

    if (!error && stdout.trim()) {
      // Job completed
      console.log(`[Pi] Print job ${jobId} completed successfully`);
      jobInfo.status = 'completed';
      jobInfo.completedAt = now;

      // job done -> printer idle
      broadcastStatus(jobInfo.printer, 'idle');

      // Cleanup
      await fs.unlink(jobInfo.filePath).catch(() => {});
      activePrintJobs.delete(jobId);

    } else {
      // Check if still active
      exec(`lpstat ${jobInfo.cupsJobId}`, (error2, stdout2) => {
        if (error2 || !stdout2.trim()) {
          // Job might have failed or completed
          console.log(`[Pi] Print job ${jobId} may have failed or completed`);
          jobInfo.status = 'unknown';
          jobInfo.lastChecked = now;

          // Clean up after some time
          setTimeout(async () => {
            await fs.unlink(jobInfo.filePath).catch(() => {});
            activePrintJobs.delete(jobId);
          }, 300000); // 5 minutes
        } else {
          // Still processing
          jobInfo.lastChecked = now;
          // Check again in 30 seconds
          setTimeout(() => monitorPrintJob(jobId), 30000);
        }
      });
    }
  });
}

// Get print job status
app.get('/status/:jobId', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token !== PI_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const jobId = req.params.jobId;
  const jobInfo = activePrintJobs.get(jobId);

  if (!jobInfo) {
    return res.status(404).json({ error: 'Print job not found' });
  }

  res.json({
    jobId,
    status: jobInfo.status,
    submittedAt: jobInfo.submittedAt,
    lastChecked: jobInfo.lastChecked,
    completedAt: jobInfo.completedAt,
    printer: jobInfo.printer
  });
});

// Get list of available printers
app.get('/printers', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token !== PI_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  exec('lpstat -p', (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ error: 'Failed to get printer list', details: error.message });
    }

    // Parse the output to get printer names
    const printers = [];
    const lines = stdout.split('\n');
    for (const line of lines) {
      if (line.startsWith('printer ')) {
        const parts = line.split(' ');
        if (parts.length >= 2) {
          const printerName = parts[1];
          printers.push({ name: printerName, status: 'unknown' });
        }
      }
    }

    res.json({ printers });
  });
});

// Single-printer status endpoint
app.get('/printer/status/:name', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token !== PI_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const printerName = req.params.name;
  try {
    const statusInfo = await checkPrinterStatus(printerName);
    return res.json(statusInfo);
  } catch (err) {
    console.error('[Pi] Error fetching printer status:', err);
    return res.status(500).json({ error: 'Failed to get printer status' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    message: 'Pi is healthy and ready to print',
    status: 'online',
    timestamp: Date.now() / 1000
  });
});

// helper to broadcast status change
function broadcastStatus(printer, status) {
  io.emit('printer_status_update', { printer, status, timestamp: Date.now() / 1000 });
}

// wrap original listen call
server.listen(80, () => console.log('Enhanced Pi print server running on port 80 with WebSocket support'));