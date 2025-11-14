# PrintShot Backend

Backend API for the PrintShot document printing service.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env`:
- MongoDB connection string
- Razorpay credentials
- Pusher credentials

3. Start the server:
```bash
npm run dev  # Development
npm start    # Production
```

## API Endpoints

### Printers
- `POST /api/printers/register` - Register new printer
- `GET /api/printers/details` - Get printer details by fake IDs
- `POST /api/printers/verify-owner` - Verify printer owner by phone

### Queue Management
- `POST /api/queue/add` - Add user to queue
- `POST /api/queue/release` - Release user from queue
- `GET /api/queue/status` - Get queue status

### Payments
- `POST /api/payments/create-razorpay-order` - Create Razorpay order
- `POST /api/payments/verify` - Verify payment

### Admin
- `GET /api/admin/queue` - Get all queues status
- `POST /api/admin/kick-user` - Remove user from queue
- `GET /api/admin/printers-by-owner` - Get printers by owner phone

## Health Check
- `GET /health` - Server health status