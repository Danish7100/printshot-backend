# Render Deployment Guide

## Environment Variables to Add on Render

Go to your backend service on Render → Environment tab and add these variables:

### Required Environment Variables

| Variable Name | Description | Example/Notes |
|--------------|-------------|---------------|
| `PORT` | Server port | `5000` (Render auto-assigns, but you can set default) |
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://username:password@cluster.mongodb.net/...` |
| `RAZORPAY_KEY_ID` | Razorpay API Key ID | `rzp_live_XXXXXXXXXX` or `rzp_test_XXXXXXXXXX` |
| `RAZORPAY_KEY_SECRET` | Razorpay API Secret | Your Razorpay secret key |
| `PI_BEARER_TOKEN` | Raspberry Pi authentication token | Generate a secure random token |

## Deployment Steps

1. **Connect Repository**
   - Link your GitHub repository to Render
   - Select the `printshot-backend` directory if it's in a monorepo

2. **Configure Build Settings**
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment: `Node`

3. **Add Environment Variables**
   - Add all variables listed above in the Environment tab
   - Make sure to use production credentials (not test)

4. **Deploy**
   - Click "Manual Deploy" or push to your main branch
   - Monitor the deployment logs for any errors

## Verification Checklist

After deployment, verify:

- [ ] Health check endpoint works: `https://your-app.onrender.com/health`
- [ ] MongoDB connection is successful (check logs)
- [ ] Razorpay credentials are valid (test payment creation)
- [ ] WebSocket connections work properly
- [ ] CORS is configured for your frontend URL

## Important Notes

- **WebSocket Support**: Render supports WebSocket connections by default
- **No Pusher Required**: This backend uses native WebSocket (ws), not Pusher
- **CORS Configuration**: Update `server.js` if you need to add more frontend URLs
- **Logs**: Monitor Render logs for any runtime errors

## Current CORS Allowed Origins

```javascript
[
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://printshot-webapp.vercel.app',
  '*'
]
```

Update these in `server.js` if your frontend URL changes.

## Troubleshooting

### MongoDB Connection Issues
- Verify MongoDB Atlas allows connections from Render's IP (0.0.0.0/0)
- Check if connection string is properly URL-encoded

### Payment Gateway Issues
- Ensure you're using live keys for production
- Test with Razorpay test mode first

### WebSocket Connection Issues
- Render supports WebSocket on all plans
- Check if frontend is connecting to correct WebSocket URL
- Verify CORS settings allow WebSocket upgrade

## Security Recommendations

1. **Generate Strong PI_BEARER_TOKEN**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Use Environment Variables**
   - Never commit `.env` file to repository
   - Keep production credentials secure

3. **MongoDB Security**
   - Use strong database passwords
   - Enable IP whitelisting in MongoDB Atlas
   - Use separate databases for dev/prod

4. **Razorpay Security**
   - Use live keys only in production
   - Implement proper payment verification
   - Log all payment transactions
