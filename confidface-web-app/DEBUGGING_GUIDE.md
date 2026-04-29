# Debugging "Failed to Start Conversation" Error

## How to Debug

### 1. Open Browser Console
- Press `F12` in your browser
- Go to **Console** tab
- Look for error messages with detailed logs

### 2. Check Network Tab
- Go to **Network** tab
- Try to connect again
- Look for failed requests (red colored)
- Click on each request to see:
  - Status code (should be 200-299 for success)
  - Response body (contains error details)

### 3. Common Errors & Solutions

#### Error: "Gemini API Key Invalid"
```
SOLUTION:
1. Get correct Gemini key from: https://makersuite.google.com/app/apikey
2. Update .env.local:
   GEMINI_API_KEY=your_actual_key
   NEXT_PUBLIC_GEMINI_API_KEY=your_actual_key
3. Restart dev server
```

#### Error: "D-ID Authentication Failed"
```
SOLUTION:
1. Your D-ID API key format might be wrong
2. Go to: https://studio.d-id.com/ (Account Settings)
3. Copy the API Key exactly as shown (no extra spaces)
4. Update .env.local:
   D_ID_API_KEY=your_actual_key
   NEXT_PUBLIC_D_ID_API_KEY=your_actual_key
5. Restart dev server
```

#### Error: "Invalid D-ID response: missing id or offer"
```
SOLUTION:
1. D-ID API returned unexpected format
2. Check Network tab for D-ID API response
3. Verify D-ID API key has proper permissions
4. Check D-ID account has active balance/credits
```

#### Error: "WebRTC Connection Failed"
```
SOLUTION:
1. Browser might not support WebRTC
2. Try Chrome or Firefox (not Safari on some versions)
3. Check if browser allows microphone access
4. Clear browser cache and try again
```

---

## Step-by-Step Testing

### Test 1: Verify Gemini API
Add this to browser console and run:
```javascript
fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=YOUR_GEMINI_KEY', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{ parts: [{ text: 'Hello' }] }]
  })
}).then(r => r.json()).then(d => console.log(d))
```

### Test 2: Check D-ID Authentication
Look in Network tab for `/api/d-id-session` request:
- Status should be **200**
- Response should have: `id`, `offer`, `ice_servers`

### Test 3: Monitor Logs
Refresh page and check console logs in this order:
1. "Generating content with Gemini..." ✓
2. "Gemini response: ..." ✓ (should see text)
3. "Creating D-ID session..." ✓
4. "D-ID Session Response: ..." ✓ (check structure)
5. "Initializing WebRTC..." ✓
6. "Sending answer to D-ID..." ✓
7. "Starting audio capture..." ✓

---

## API Key Format

### D-ID API Key
- Length: Usually 40+ characters
- Format: Mix of letters/numbers/symbols
- Where to find: https://studio.d-id.com/ → Account Settings → API Keys

Example (FAKE): `chamindupathotum111@gmail.com:_ZDAToniBF_QbpGF9tSHp`

### Gemini API Key  
- Length: Usually 40+ characters
- Format: `AIza...` prefix
- Where to find: https://makersuite.google.com/app/apikey

Example (FAKE): `AIzaSyB0p6mCNtVvTuls08DB6AsrgIlEqcbX5ec`

---

## Port & Environment

Make sure your app is running:
```bash
npm run dev
```

And you're accessing: `http://localhost:3000`

---

## Last Resort: Check Server Logs

In terminal where you ran `npm run dev`, look for error messages like:
```
Error: Failed to create D-ID session
Error details: ...
```

Copy these errors and we can debug further!

---

## Quick Checklist

- [ ] `npm install` completed successfully
- [ ] `.env.local` has real API keys (not placeholders)
- [ ] Dev server running with `npm run dev`
- [ ] Accessing `http://localhost:3000`
- [ ] Browser Console open while testing
- [ ] Network tab open to see API calls
- [ ] Microphone permission granted to browser

