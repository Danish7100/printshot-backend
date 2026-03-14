# Raspberry Pi Server Code Updates

## Overview
The `controllercode.txt` has been enhanced with advanced print job monitoring and WebSocket authentication to support the complete payment-to-print workflow.

## Key Changes Made

### 1. **Additional Imports**
Added necessary imports at the top of the file:
```python
import os, json, time, threading, secrets, subprocess, cups
from datetime import datetime, timedelta
from collections import defaultdict
from functools import wraps
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from werkzeug.utils import secure_filename
from PyPDF2 import PdfReader
from PIL import Image
```

### 2. **Active Print Jobs Tracking**
Added a dictionary to track active print jobs:
```python
active_print_jobs = {}
```
Each job stores:
- `cups_id`: CUPS job ID for monitoring
- `printer`: Printer name
- `filepath`: Path to the uploaded file
- `status`: Current job status (queued/printing/completed)
- `submittedAt`: Timestamp when submitted
- `orderId` & `paymentId`: Payment info (for /print endpoint)

### 3. **WebSocket Authentication**
The SocketIO `connect` event now validates Bearer tokens:
```python
@socketio.on('connect')
def handle_connect(auth):
    token = auth.get('token') or auth.get('Authorization', '').replace('Bearer ', '')
    if not token or token not in VALID_TOKENS:
        return False
    print(f"[WEBSOCKET] Authenticated client connected: {request.sid}")
    return True
```

**Token Configuration:**
- Supports `PI_BEARER_TOKEN` (single token) environment variable
- Supports `PI_VALID_TOKENS` (multiple comma-separated tokens) environment variable
- Falls back to `valid_tokens.txt` file
- Generates initial token on first run if none configured

### 4. **Print Job Monitoring Function**
New `monitor_print_job(job_id)` function that:
1. Checks CUPS job status using `lpstat`
2. Detects when a print job completes
3. **Broadcasts idle status** via WebSocket when job finishes:
   ```python
   socketio.emit('printer_status_update', {
       'printer': printer_name,
       'status': 'idle',
       'timestamp': time.time()
   }, broadcast=True)
   ```
4. **Deletes the uploaded file** from disk after printing
5. Retries every 30 seconds if job is still processing
6. Falls back to timeout-based cleanup if job status becomes unknown

### 5. **Enhanced /upload Endpoint**
Now captures the CUPS job ID and starts background monitoring:
```python
# Extract CUPS job ID from output
cups_id = None
if 'request id' in result.stdout:
    parts = result.stdout.split('-')
    if len(parts) >= 2:
        cups_id = parts[-1].split()[0]

# Track job and start monitoring
active_print_jobs[job_id] = {...}
threading.Thread(target=monitor_print_job, args=(job_id,), daemon=True).start()
```

### 6. **Enhanced /print Endpoint** (Payment Integration)
Similarly updated to track jobs and monitor them:
- Stores `orderId` and `paymentId` in job info
- Returns `jobId` in response
- Starts background monitoring immediately after submission

### 7. **Printer Status Updater Improvements**
The background status monitoring thread now:
- Uses `broadcast=True` when emitting status changes
- Runs every 2 seconds to detect printer state changes
- Maintains previous status map to detect transitions
- Emits events when printers go offline

## Deployment Instructions

### 1. **Copy the Code to Pi**
```bash
# From your development machine
scp controllercode.txt pi@your-pi-ip:/home/pi/printshot/controllercode.py

# SSH into Pi
ssh pi@your-pi-ip
```

### 2. **Install Python Dependencies**
```bash
# Make sure you have pip and required packages
pip install flask flask-cors flask-socketio python-socketio python-socketio[client] PyPDF2 pillow pycups requests

# Or use requirements.txt if available
pip install -r requirements.txt
```

### 3. **Set Environment Variables**
```bash
# Set the bearer token - must match backend's PI_BEARER_TOKEN
export PI_BEARER_TOKEN="609ffe15ac7e0d1732b5e632f598a7a48687e74d44acf94ef53c0068121cd6fa"

# Optional: Other configurations
export ALLOWED_ORIGINS="*"

# Verify token is set
echo $PI_BEARER_TOKEN
```

### 4. **Run the Server**
```bash
# Make code executable (rename .txt to .py)
mv controllercode.txt controllercode.py

# Run the server
python controllercode.py

# Or run in background with nohup
nohup python controllercode.py > pi_server.log 2>&1 &
```

### 5. **Verify the Server**
```bash
# Test health check
curl http://localhost:5000/health

# Test status check (with token)
curl -H "Authorization: Bearer 609ffe..." http://localhost:5000/busyapi

# Check if socket.io is responding
curl http://localhost:5000/socket.io/
```

## Environment Variables Reference

| Variable | Purpose | Example |
|----------|---------|---------|
| `PI_BEARER_TOKEN` | Authentication token (backend uses this) | `609ffe15ac7e0d...` |
| `PI_VALID_TOKENS` | Alternative: comma-separated token list | `token1,token2` |
| `ALLOWED_ORIGINS` | CORS origins (default: `*`) | `http://localhost:3000,http://printshot.in` |

## Workflow: How It Works End-to-End

1. **Frontend User Scans QR Code**
   - Scans printer QR to get `piId` and `printerId`
   - Frontend calls `/api/printers/busy?piId=...` to check if printer is idle

2. **Backend Checks Printer Status**
   - Backend proxy endpoint calls Pi's `/printer/status/{printer_name}` via HTTP
   - Returns `status: 'idle'` or `'printing'`

3. **User Uploads File & Pays** (Razorpay)
   - Confirms payment
   - Submits file to `/api/print` endpoint (backend)

4. **Backend Forwards to Pi**
   - Backend POSTs file to `http://{piId}.printshot.in/upload`
   - Or to `/print` endpoint if using payment integration flow

5. **Pi Submits to CUPS**
   - Pi receives file and submits to CUPS via `lp` command
   - Extracts CUPS job ID
   - Creates entry in `active_print_jobs` dict

6. **Pi Monitors Job** (NEW!)
   - Background thread monitors CUPS status every 30 seconds
   - When job completes, emits `printer_status_update` with `status: 'idle'` via WebSocket

7. **Backend Receives Idle Signal** (WebSocket)
   - Backend's Socket.io client listening on Pi's socket
   - Receives idle broadcast
   - Deletes the uploaded file from `uploads/` folder
   - Closes socket connection

8. **Cycle Complete**
   - File is automatically cleaned up
   - Printer ready for next job

## Testing the Pi Code

### Test Printer Status Endpoint
```bash
# Get status for a specific printer
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/printer/status/Brother_HL_L2440DW_USB
```

### Test /upload Endpoint
```bash
# Create a test PDF
echo "%PDF-1.4" > test.pdf

# Upload it
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test.pdf" \
  -F "printer=Brother_HL_L2440DW_USB" \
  http://localhost:5000/upload
```

### Test WebSocket Connection
```python
# Python test script
import socketio
import time

sio = socketio.Client(auth={'token': 'YOUR_TOKEN'})

@sio.event
def printer_status_update(data):
    print(f"Printer {data['printer']} status: {data['status']}")

sio.connect('http://localhost:5000')
sio.emit('request_printer_status')
time.sleep(2)
sio.disconnect()
```

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 5000
lsof -i :5000
kill -9 <PID>
```

### Token Validation Fails
- Verify `PI_BEARER_TOKEN` exactly matches between backend and Pi
- Check: `echo $PI_BEARER_TOKEN` on Pi
- Check backend `.env` or `process.env.PI_BEARER_TOKEN`

### CUPS Commands Fail
```bash
# Check CUPS is running
sudo systemctl start cups

# List available printers
lpstat -p

# Check printer status
lpstat -p Brother_HL_L2440DW_USB
```

### WebSocket Connection Refused
- Verify Python packages are installed: `pip list | grep socketio`
- Check firewall allows port 5000: `sudo ufw allow 5000`
- Verify token in WebSocket auth matches

### Files Not Deleting
- Check file permissions: `ls -la uploads/`
- Check disk space: `df -h`
- Check logs for errors: `tail -f pi_server.log`

## Key Files Modified

- `controllercode.txt` → Rename to `controllercode.py` and deploy to Pi
- Uses CUPS for printing: `lpstat`, `lp` commands
- Stores uploads in `./uploads/` folder
- Broadcasts status via Socket.io port 5000

## Summary of Architecture

```
Frontend (QR Scan)
    ↓
Backend (/api/printers/busy) → Pi (/printer/status/:name)
    ↓
User Uploads + Pays
    ↓
Backend (/api/print) → Pi (/upload)
    ↓
Pi (CUPS) → Send to Printer
    ↓
Pi (monitor_print_job) → Broadcasts idle via WebSocket
    ↓
Backend (Socket.io client) → Receives idle → Delete file
    ↓
Cycle Complete
```

## Next Steps

1. **SSH into Pi and deploy the code**
2. **Set PI_BEARER_TOKEN environment variable**
3. **Run the server: `python controllercode.py`**
4. **Test endpoints with curl**
5. **Verify WebSocket connection works**
6. **Test end-to-end workflow from frontend**
