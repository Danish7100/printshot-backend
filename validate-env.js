#!/usr/bin/env node

/**
 * Environment Variables Validation Script
 * Run this before deploying to ensure all required variables are set
 */

require('dotenv').config();

const requiredVars = [
  'MONGODB_URI',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'PI_BEARER_TOKEN'
];

const optionalVars = [
  'PORT'
];

console.log('🔍 Validating Environment Variables...\n');

let hasErrors = false;

// Check required variables
console.log('Required Variables:');
requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (!value || value === 'your_secure_pi_token_here') {
    console.log(`❌ ${varName}: Missing or using placeholder value`);
    hasErrors = true;
  } else {
    // Mask sensitive values
    const maskedValue = value.substring(0, 10) + '...';
    console.log(`✅ ${varName}: ${maskedValue}`);
  }
});

// Check optional variables
console.log('\nOptional Variables:');
optionalVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: ${value}`);
  } else {
    console.log(`⚠️  ${varName}: Not set (will use default)`);
  }
});

// Validate MongoDB URI format
if (process.env.MONGODB_URI) {
  if (!process.env.MONGODB_URI.startsWith('mongodb://') && 
      !process.env.MONGODB_URI.startsWith('mongodb+srv://')) {
    console.log('\n❌ MONGODB_URI format appears invalid');
    hasErrors = true;
  }
}

// Validate Razorpay keys format
if (process.env.RAZORPAY_KEY_ID) {
  if (!process.env.RAZORPAY_KEY_ID.startsWith('rzp_')) {
    console.log('\n❌ RAZORPAY_KEY_ID format appears invalid (should start with rzp_)');
    hasErrors = true;
  }
  
  if (process.env.RAZORPAY_KEY_ID.includes('test')) {
    console.log('\n⚠️  WARNING: Using Razorpay TEST keys (use live keys for production)');
  }
}

console.log('\n' + '='.repeat(50));

if (hasErrors) {
  console.log('❌ Validation FAILED - Please fix the errors above');
  process.exit(1);
} else {
  console.log('✅ All required environment variables are configured!');
  console.log('✅ Ready for deployment');
  process.exit(0);
}
