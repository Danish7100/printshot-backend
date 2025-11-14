// Simple test script to add test data
const { MongoClient } = require('mongodb');
require('dotenv').config();

async function testQueue() {
  const client = await MongoClient.connect(process.env.MONGODB_URI);
  const db = client.db('print_platform');
  
  // Add a test printer
  const testPrinter = {
    ownerName: 'Test Owner',
    piId: 'test-pi-123',
    printerName: 'Test-Printer',
    address: 'Test Address',
    phone: '1234567890',
    costPerPage: 1.0,
    fakePiId: 'fake-pi-123',
    fakePrinterId: 'fake-printer-123',
    createdAt: new Date(),
  };
  
  await db.collection('printers').updateOne(
    { fakePiId: testPrinter.fakePiId },
    { $set: testPrinter },
    { upsert: true }
  );
  
  // Add a test queue
  const testQueue = {
    piId: 'test-pi-123',
    printerId: 'Test-Printer',
    queue: [
      {
        userId: 'test@example.com',
        status: 'active',
        joinedAt: new Date(),
        locked_at: new Date().toISOString()
      },
      {
        userId: 'test2@example.com',
        status: 'waiting',
        joinedAt: new Date(),
        locked_at: null
      }
    ]
  };
  
  await db.collection('queues').updateOne(
    { piId: testQueue.piId, printerId: testQueue.printerId },
    { $set: testQueue },
    { upsert: true }
  );
  
  console.log('Test data added successfully!');
  console.log('Use these IDs to test:');
  console.log('fakePiId:', testPrinter.fakePiId);
  console.log('fakePrinterId:', testPrinter.fakePrinterId);
  
  await client.close();
}

testQueue().catch(console.error);