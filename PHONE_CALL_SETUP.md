# Testing Phone Calls with VoxReception

This guide walks you through setting up **real PSTN phone calls** to your AI receptionist.

## Architecture

```
Phone Call → Twilio → Voice Webhook (HTTP POST) → TwiML <Connect><Stream>
                ↓
    Twilio Media Stream (WebSocket, µ-law 8kHz)
                ↓
    TwilioStreamHandler (/api/webhooks/twilio/stream)
                ↓
    Audio Pipeline: µ-law 8kHz → PCM 16kHz → Deepgram ASR
                                                    ↓
                                              Gemini LLM
                                                    ↓
                                        ElevenLabs TTS (PCM 24kHz)
                                                    ↓
                                        PCM 8kHz → µ-law → Twilio WS
                                                    ↓
                                                Phone Call ← Speaker
```

## Prerequisites

1. **Docker running** with all containers up (`docker compose -f docker-compose.dev.yml up -d`)
2. **Twilio account** — [Sign up here](https://www.twilio.com/try-twilio) (free trial available)
3. **ngrok** — [Download here](https://ngrok.com/download) (free tier works)
4. **AI API keys** already set in `.env`:
   - `DEEPGRAM_API_KEY` — for speech-to-text
   - `GEMINI_API_KEY` — for AI responses
   - `ELEVENLABS_API_KEY` — for text-to-speech

## Step 1: Set Up ngrok Tunnel

Twilio needs to reach your local backend over the internet.

```bash
# Install ngrok (if not already installed)
# Windows: choco install ngrok
# Mac: brew install ngrok

# Start the tunnel to your backend port
ngrok http 3001
```

You'll see output like:
```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:3001
```

Copy the **https URL** (e.g., `https://abc123.ngrok-free.app`).

## Step 2: Configure Environment

Add your Twilio credentials and ngrok URL to `packages/backend/.env`:

```env
# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WEBHOOK_BASE_URL=https://abc123.ngrok-free.app
```

If running with Docker, also update these in `docker-compose.dev.yml` or set them as environment variables before starting:

```bash
# Option A: Set env vars before docker compose
export TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export TWILIO_AUTH_TOKEN=your_auth_token_here
export TWILIO_WEBHOOK_BASE_URL=https://abc123.ngrok-free.app

docker compose -f docker-compose.dev.yml up -d --build backend
```

```bash
# Option B: Running backend outside Docker
cd packages/backend
# Edit .env with your values, then:
npm run dev
```

## Step 3: Get a Twilio Phone Number

### Option A: Via Twilio Console (Easiest)

1. Go to [Twilio Console → Phone Numbers](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming)
2. Click **Buy a Number** → search for a local number → purchase ($1.15/month)
3. Click the purchased number to configure it:
   - **Voice & Fax → A CALL COMES IN**: Set to **Webhook**
   - **URL**: `https://abc123.ngrok-free.app/api/webhooks/twilio/voice`
   - **HTTP Method**: `POST`
   - Save

### Option B: Via VoxReception API

```bash
# 1. Register/login to get a JWT token
TOKEN=$(curl -s http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"yourpassword"}' | jq -r '.token')

# 2. Search for available numbers
curl http://localhost:3001/api/phone-numbers/available?country=US \
  -H "Authorization: Bearer $TOKEN"

# 3. Provision a number (this buys it and auto-configures webhooks)
curl -X POST http://localhost:3001/api/phone-numbers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+1555xxxxxxx"}'
```

## Step 4: Create a Tenant (if not already done)

Make sure you have a registered account and the phone number is associated with a tenant:

1. Open **Prisma Studio**: http://localhost:5555
2. Check the `PhoneNumber` table — your Twilio number should be there with a `tenantId`
3. Check the `TenantConfig` table — make sure there's a config for your tenant with:
   - `welcomeMessage`: e.g., "Thank you for calling Acme Corp. How can I help you?"
   - `businessName`: e.g., "Acme Corp"
   - `receptionistName`: e.g., "Alex"

If no config exists, create one via Prisma Studio or API.

## Step 5: Make a Test Call

1. **Call the Twilio number** from your phone
2. You should hear the AI greeting
3. Speak naturally — the AI receptionist will respond
4. Try asking things like:
   - "What are your business hours?"
   - "I'd like to book an appointment for tomorrow at 2pm"
   - "Can you transfer me to someone?"
   - "I'd like to leave a message"

### What to Watch

- **Backend logs**: `docker logs -f vox-backend` — shows the full pipeline in action
- **ngrok dashboard**: http://localhost:4040 — shows Twilio's HTTP requests
- **Prisma Studio**: http://localhost:5555 — check Call, Transcript, Booking records

## Troubleshooting

### "Thank you for calling. Please hold while we connect you."
This is the **fallback generic response** — it means:
- The phone number is NOT found in the `PhoneNumber` table, OR
- The phone number's status is not `ACTIVE`

**Fix**: Make sure the number exists in the DB with status `ACTIVE` and a valid `tenantId`.

### No audio / silence after greeting
- Check that `DEEPGRAM_API_KEY` and `ELEVENLABS_API_KEY` are valid
- Check backend logs for ASR connection errors
- Make sure the ngrok tunnel is still active

### "Invalid signature" error
- In development mode, signature validation is skipped automatically
- If running in production mode, make sure `TWILIO_AUTH_TOKEN` matches your Twilio account

### WebSocket connection fails
- Check that ngrok is forwarding to port 3001
- Ensure the WebSocket path `/api/webhooks/twilio/stream` is accessible
- Look at ngrok dashboard (http://localhost:4040) for failed requests

### Call connects but AI doesn't respond
- Check `GEMINI_API_KEY` is valid
- Look at backend logs for LLM errors
- Verify the tenant has a `TenantConfig` record

## Testing Without a Phone (Browser + Twilio)

If you don't want to use your actual phone:

1. Use [Twilio Dev Phone](https://www.twilio.com/docs/labs/dev-phone) (browser-based SIP phone)
2. Or use the **VoxReception browser widget**: visit `http://localhost:3000/call/{tenant-slug}`

## Architecture Notes

- **µ-law 8kHz**: Twilio sends phone audio in G.711 µ-law encoding at 8kHz sample rate
- **PCM 16kHz**: Deepgram ASR expects linear16 PCM at 16kHz
- **PCM 24kHz**: ElevenLabs TTS returns PCM at 24kHz
- The `TwilioStreamHandler` handles all audio format conversions automatically
- Each phone call gets its own handler instance with separate ASR/LLM/TTS pipelines
- Conversation transcripts are saved to the database when the call ends
