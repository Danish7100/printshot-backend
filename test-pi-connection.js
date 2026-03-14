const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');

// Test configuration
const PI_URL = 'http://91626.printshot.in';
const BEARER_TOKEN = process.env.PI_BEARER_TOKEN || '609ffe15ac7e0d1732b5e632f598a7a48687e74d44acf94ef53c0068121cd6fa';

async function testPiConnection() {
  console.log('🧪 Testing Raspberry Pi Connection\n');
  console.log('Pi URL:', PI_URL);
  console.log('Bearer Token:', BEARER_TOKEN.substring(0, 20) + '...\n');

  // Test 1: Health check
  console.log('1️⃣ Testing /health endpoint...');
  try {
    const healthResponse = await fetch(`${PI_URL}/health`);
    console.log('   Status:', healthResponse.status);
    const healthData = await healthResponse.text();
    console.log('   Response:', healthData);
    console.log('   ✅ Health check passed\n');
  } catch (error) {
    console.log('   ❌ Health check failed:', error.message, '\n');
    return;
  }

  // Test 2: Upload with token
  console.log('2️⃣ Testing /upload endpoint with bearer token...');
  try {
    // Create a simple PDF-like file (just for testing)
    const testContent = '%PDF-1.4\nTest PDF content';
    fs.writeFileSync('test-upload.pdf', testContent);

    const formData = new FormData();
    formData.append('file', fs.createReadStream('test-upload.pdf'), 'test-upload.pdf');
    formData.append('printer', 'Brother_HL_L2440DW_USB');

    const uploadResponse = await fetch(`${PI_URL}/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${BEARER_TOKEN}`,
        ...formData.getHeaders()
      }
    });

    console.log('   Status:', uploadResponse.status);
    const uploadData = await uploadResponse.text();
    console.log('   Response:', uploadData);

    // Cleanup
    fs.unlinkSync('test-upload.pdf');

    if (uploadResponse.status === 401) {
      console.log('   ❌ Token is INVALID or EXPIRED');
      console.log('   📝 Action needed: Update PI_BEARER_TOKEN in your Pi configuration\n');
    } else if (uploadResponse.ok) {
      console.log('   ✅ Upload test passed\n');
    } else {
      console.log('   ⚠️  Upload failed with status:', uploadResponse.status, '\n');
    }
  } catch (error) {
    console.log('   ❌ Upload test failed:', error.message, '\n');
  }

  // Test 3: Try without token
  console.log('3️⃣ Testing /upload without token (to see error message)...');
  try {
    const testContent = 'Test file';
    fs.writeFileSync('test-upload2.txt', testContent);

    const formData = new FormData();
    formData.append('file', fs.createReadStream('test-upload2.txt'), 'test-upload2.txt');
    formData.append('printer', 'Brother_HL_L2440DW_USB');

    const uploadResponse = await fetch(`${PI_URL}/upload`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });

    console.log('   Status:', uploadResponse.status);
    const uploadData = await uploadResponse.text();
    console.log('   Response:', uploadData);

    fs.unlinkSync('test-upload2.txt');
  } catch (error) {
    console.log('   Error:', error.message);
  }

  console.log('\n📋 Summary:');
  console.log('If you see "Invalid or expired token", you need to:');
  console.log('1. Check your Pi\'s configuration file for the expected token');
  console.log('2. Update either:');
  console.log('   - Pi config to use: ' + BEARER_TOKEN);
  console.log('   - Backend .env PI_BEARER_TOKEN to match Pi\'s token');
}

testPiConnection().catch(console.error);
