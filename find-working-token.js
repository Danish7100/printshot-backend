const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');

const PI_URL = 'http://91626.printshot.in';

// Common token patterns to try
const tokensToTry = [
  'your_secure_pi_token_here',
  'printshot_token',
  'pi_token_123',
  'test_token',
  'admin_token',
  '609ffe15ac7e0d1732b5e632f598a7a48687e74d44acf94ef53c0068121cd6fa',
  'Bearer 609ffe15ac7e0d1732b5e632f598a7a48687e74d44acf94ef53c0068121cd6fa',
  // Add any tokens you might have used before
];

async function testToken(token) {
  try {
    const testContent = 'Test';
    fs.writeFileSync('test.txt', testContent);

    const formData = new FormData();
    formData.append('file', fs.createReadStream('test.txt'), 'test.txt');
    formData.append('printer', 'Brother_HL_L2440DW_USB');

    const response = await fetch(`${PI_URL}/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${token}`,
        ...formData.getHeaders()
      }
    });

    fs.unlinkSync('test.txt');
    
    return {
      token: token.substring(0, 30) + '...',
      status: response.status,
      success: response.ok,
      response: await response.text()
    };
  } catch (error) {
    return {
      token: token.substring(0, 30) + '...',
      error: error.message
    };
  }
}

async function findWorkingToken() {
  console.log('🔍 Testing common bearer tokens...\n');
  
  for (const token of tokensToTry) {
    console.log(`Testing: ${token.substring(0, 30)}...`);
    const result = await testToken(token);
    
    if (result.success) {
      console.log('✅ FOUND WORKING TOKEN!');
      console.log('Token:', token);
      console.log('\nUpdate your backend .env with:');
      console.log(`PI_BEARER_TOKEN=${token}`);
      return;
    } else {
      console.log(`   ❌ Status: ${result.status || 'Error'}`);
    }
  }
  
  console.log('\n❌ No working token found.');
  console.log('You need to check your Raspberry Pi configuration.');
}

findWorkingToken();
