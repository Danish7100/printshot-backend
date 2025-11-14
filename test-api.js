// Test the API endpoints
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testAPI() {
  try {
    console.log('Testing API endpoints...\n');
    
    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    const healthRes = await fetch('http://localhost:4000/health');
    const healthData = await healthRes.json();
    console.log('Health:', healthData);
    
    // Test 2: Printers by owner
    console.log('\n2. Testing printers-by-owner endpoint...');
    const printersRes = await fetch('http://localhost:4000/api/admin/printers-by-owner?phone=1234567890');
    const printersData = await printersRes.json();
    console.log('Printers response:', printersData);
    console.log('Number of printers:', Array.isArray(printersData) ? printersData.length : printersData.printers?.length || 0);
    
    // Test 3: Printer status (if we have printers)
    const printers = Array.isArray(printersData) ? printersData : printersData.printers || [];
    if (printers.length > 0) {
      console.log('\n3. Testing printer status endpoint...');
      const statusRes = await fetch(`http://localhost:4000/api/printers/status?printerName=${printers[0].printerName}`);
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        console.log('Status response:', statusData);
      } else {
        console.log('Status endpoint not available (404)');
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testAPI();