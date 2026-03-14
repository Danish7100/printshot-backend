# ✅ Render Deployment - Quick Reference

## ✅ ALL ISSUES RESOLVED

**Fixed:** `TypeError: fetch is not a function`
- Downgraded node-fetch from v3 → v2.7.0 for CommonJS compatibility
- Removed duplicate require() statements
- All modules loading correctly

## Environment Variables for Render

Copy these exact values to your Render dashboard:

```
PORT=5000
MONGODB_URI=mongodb+srv://Printshot:Danish%409826@printshot.ftzaemi.mongodb.net/?retryWrites=true&w=majority&tls=true&appName=Printshot
RAZORPAY_KEY_ID=rzp_live_SOhcVC1qiRkMTZ
RAZORPAY_KEY_SECRET=6ZzlZ4E4GXQ7uwetjcFvjM4c
PI_BEARER_TOKEN=609ffe15ac7e0d1732b5e632f598a7a48687e74d44acf94ef53c0068121cd6fa
```

## ⚠️ IMPORTANT: Update Your Raspberry Pi

Your Raspberry Pi needs to use this new bearer token when making requests:

```javascript
headers: {
  'Authorization': 'Bearer 609ffe15ac7e0d1732b5e632f598a7a48687e74d44acf94ef53c0068121cd6fa'
}
```

## Deployment Steps

1. **Go to Render Dashboard** → Your Backend Service → Environment

2. **Add each variable** (click "Add Environment Variable"):
   - Variable: `PORT` → Value: `5000`
   - Variable: `MONGODB_URI` → Value: `mongodb+srv://...`
   - Variable: `RAZORPAY_KEY_ID` → Value: `rzp_live_...`
   - Variable: `RAZORPAY_KEY_SECRET` → Value: `6ZzlZ4E4GXQ7uwetjcFvjM4c`
   - Variable: `PI_BEARER_TOKEN` → Value: `609ffe15ac7e0d1732b5e632f598a7a48687e74d44acf94ef53c0068121cd6fa`

3. **Save Changes** → Render will automatically redeploy

4. **Verify Deployment**:
   - Check logs for: "✓ Configured" messages
   - Test health endpoint: `https://your-app.onrender.com/health`
   - Should return: `{"status":"OK","timestamp":"..."}`

## What Changed?

✅ **Fixed**: Removed incorrect Pusher requirement (not used in your app)
✅ **Added**: Secure PI_BEARER_TOKEN for Raspberry Pi authentication
✅ **Added**: Environment validation script
✅ **Added**: Startup checks for missing variables
✅ **Improved**: CORS configuration (removed wildcard)
✅ **Updated**: Documentation with correct requirements

## Testing Locally

Before deploying, test locally:

```bash
npm run validate-env  # Check all env vars
npm run dev           # Start development server
```

You should see:
```
✅ All required environment variables are configured!
PrintShot backend running on port 5000 with WebSocket support
Environment check:
- MongoDB: ✓ Configured
- Razorpay: ✓ Configured
- PI Token: ✓ Configured
```

## No Additional Variables Needed! ✅

Your backend uses:
- ✅ **WebSocket (ws)** for real-time updates (built-in, no config needed)
- ✅ **MongoDB** for database (already configured)
- ✅ **Razorpay** for payments (already configured)
- ✅ **Express** for API (no config needed)

**You do NOT need:**
- ❌ Pusher credentials (not used)
- ❌ AWS credentials (not used)
- ❌ Redis (not used)
- ❌ Any other services

## Support

If you encounter issues:
1. Check Render logs for error messages
2. Verify MongoDB Atlas allows Render's IP (0.0.0.0/0)
3. Test each endpoint individually
4. Check WebSocket connection from frontend
