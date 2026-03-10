# VoxReception - AI Receptionist SaaS Platform

A multi-tenant AI receptionist SaaS platform with voice handling, appointment booking, and human escalation capabilities.

## Features

- **24/7 AI Voice Reception**: Powered by LiveKit for real-time WebRTC communications
- **Multi-tenant Architecture**: Complete tenant isolation with configurable settings per tenant
- **Smart Scheduling**: Google Calendar integration for real-time availability and booking
- **Speech Processing**: Pluggable ASR/TTS providers (Deepgram, Google, ElevenLabs, AWS Polly)
- **Intelligent Dialogs**: LLM-powered conversation with function calling for actions
- **Human Escalation**: Seamless handoff to human agents when needed
- **Embeddable Widget**: Easy-to-integrate JavaScript widget for any website
- **Billing Integration**: Stripe-based subscription and usage-based billing

## Tech Stack

- **Backend**: Node.js 18.x, Express, Prisma ORM, PostgreSQL, Redis
- **Frontend**: Next.js 14, React 18, TailwindCSS, React Query
- **Real-time**: LiveKit (WebRTC), Socket.IO
- **AI/ML**: OpenAI GPT-4, Deepgram, Google Speech, ElevenLabs
- **Infrastructure**: Docker, Kubernetes, Prometheus/Grafana

## Quick Start

### Prerequisites

- Node.js 18.x or higher
- Docker and Docker Compose
- PostgreSQL 15+ (or use Docker)
- Redis 7+ (or use Docker)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/voxreception.git
   cd voxreception
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp packages/backend/.env.example packages/backend/.env
   # Edit .env with your configuration
   ```

4. **Start with Docker Compose (recommended)**
   ```bash
   docker-compose -f docker-compose.dev.yml up
   ```

   This starts:
   - PostgreSQL on port 5432
   - Redis on port 6379
   - LiveKit on port 7880
   - Backend API on port 3001
   - Frontend on port 3000
   - Prisma Studio on port 5555

5. **Or start services individually**
   ```bash
   # Start database and cache
   docker-compose -f docker-compose.dev.yml up postgres redis livekit -d
   
   # Run migrations
   cd packages/backend
   npx prisma migrate dev
   
   # Start backend
   npm run dev --workspace=packages/backend
   
   # Start frontend (in another terminal)
   npm run dev --workspace=packages/frontend
   ```

6. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - Prisma Studio: http://localhost:5555

## Project Structure

```
voxreception/
├── packages/
│   ├── backend/                 # Node.js/Express API server
│   │   ├── src/
│   │   │   ├── config/          # Configuration management
│   │   │   ├── db/              # Database initialization
│   │   │   ├── lib/             # Shared libraries (logger, redis, metrics)
│   │   │   ├── middleware/      # Express middleware (auth, errors)
│   │   │   ├── routes/          # API route handlers
│   │   │   ├── services/        # Business logic (ASR, TTS, LLM, Calendar)
│   │   │   ├── websocket/       # Socket.IO real-time server
│   │   │   └── index.js         # Application entry point
│   │   ├── prisma/
│   │   │   └── schema.prisma    # Database schema
│   │   └── Dockerfile
│   │
│   └── frontend/                # Next.js web application
│       ├── src/
│       │   ├── app/             # Next.js App Router pages
│       │   ├── components/      # React components
│       │   ├── contexts/        # React contexts (Auth, Socket)
│       │   ├── hooks/           # Custom hooks and React Query
│       │   ├── lib/             # API client
│       │   ├── store/           # Zustand state management
│       │   └── styles/          # Global CSS/Tailwind
│       ├── public/
│       │   └── widget.js        # Embeddable widget script
│       └── Dockerfile
│
├── k8s/                         # Kubernetes manifests
│   └── base/
│       ├── namespace.yaml
│       ├── backend.yaml
│       ├── frontend.yaml
│       ├── ingress.yaml
│       └── kustomization.yaml
│
├── docker-compose.dev.yml       # Development Docker Compose
├── docker-compose.prod.yml      # Production Docker Compose
├── livekit.yaml                 # LiveKit server configuration
└── package.json                 # Root package.json (workspaces)
```

## Configuration

### Environment Variables

#### Backend (.env)

```env
# Server
NODE_ENV=development
PORT=3001

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/voxreception

# Redis
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-jwt-secret-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# LiveKit
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret
LIVEKIT_URL=ws://localhost:7880

# Stripe (Billing)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# OpenAI (LLM)
OPENAI_API_KEY=sk-...

# Deepgram (ASR)
DEEPGRAM_API_KEY=...

# Google (Calendar, TTS, ASR)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3001/api/integrations/google/callback

# ElevenLabs (TTS)
ELEVENLABS_API_KEY=...

# CORS
CORS_ORIGIN=http://localhost:3000
```

#### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
NEXT_PUBLIC_LIVEKIT_URL=ws://localhost:7880
```

## API Documentation

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | User login |
| `/api/auth/register` | POST | User registration with tenant creation |
| `/api/auth/refresh` | POST | Refresh access token |
| `/api/auth/logout` | POST | User logout |
| `/api/auth/me` | GET | Get current user |

### Tenants

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/tenants/me` | GET | Get current tenant |
| `/api/tenants/me` | PUT | Update tenant |
| `/api/tenants/me/config` | GET | Get tenant configuration |
| `/api/tenants/me/config` | PUT | Update tenant configuration |
| `/api/tenants/me/stats` | GET | Get tenant statistics |

### Calls

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/calls` | GET | List calls |
| `/api/calls/:id` | GET | Get call details |
| `/api/calls/active` | GET | Get active calls |
| `/api/calls/:id/escalate` | POST | Escalate call to human |
| `/api/calls/:id/end` | POST | End a call |
| `/api/calls/:id/transcript` | GET | Get call transcript |

### Bookings

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/bookings` | GET | List bookings |
| `/api/bookings` | POST | Create booking |
| `/api/bookings/:id` | GET | Get booking details |
| `/api/bookings/:id` | PUT | Update booking |
| `/api/bookings/:id/cancel` | POST | Cancel booking |
| `/api/bookings/availability` | GET | Get available slots |

### Billing

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/billing/subscription` | GET | Get subscription status |
| `/api/billing/usage` | GET | Get usage statistics |
| `/api/billing/invoices` | GET | List invoices |
| `/api/billing/checkout` | POST | Create checkout session |
| `/api/billing/portal` | POST | Create customer portal session |

## Widget Integration

Add the VoxReception widget to your website:

```html
<script>
  (function(w, d, s, o, f, js, fjs) {
    w['VoxReception'] = o;
    w[o] = w[o] || function() { (w[o].q = w[o].q || []).push(arguments) };
    js = d.createElement(s); fjs = d.getElementsByTagName(s)[0];
    js.id = o; js.src = f; js.async = 1; fjs.parentNode.insertBefore(js, fjs);
  }(window, document, 'script', 'vox', 'https://api.voxreception.com/widget.js'));
  
  vox('init', 'YOUR_WIDGET_ID', {
    primaryColor: '#3B82F6',
    position: 'bottom-right',
    buttonText: 'Talk to us'
  });
</script>
```

### Widget API

```javascript
// Open widget
vox('open');

// Close widget
vox('close');

// Toggle widget
vox('toggle');

// Update configuration
vox('setConfig', { primaryColor: '#10B981' });
```

## Deployment

### Docker

```bash
# Build images
docker build -t voxreception/backend:latest -f packages/backend/Dockerfile .
docker build -t voxreception/frontend:latest -f packages/frontend/Dockerfile .

# Run with production compose
docker-compose -f docker-compose.prod.yml up -d
```

### Kubernetes

```bash
# Apply base configuration
kubectl apply -k k8s/base/

# Or with kustomize overlays
kubectl apply -k k8s/overlays/production/
```

### LiveKit Notes

For Kubernetes deployments, LiveKit requires `hostNetwork: true` for proper WebRTC connectivity. See the [LiveKit Kubernetes documentation](https://docs.livekit.io/oss/deploy/kubernetes/) for detailed setup instructions.

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run backend tests
npm test --workspace=packages/backend

# Run frontend tests
npm test --workspace=packages/frontend
```

### Database Migrations

```bash
# Create a migration
cd packages/backend
npx prisma migrate dev --name migration_name

# Apply migrations in production
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset
```

### Code Style

```bash
# Lint
npm run lint

# Format
npm run format
```

## Architecture

### Multi-Tenant Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Widget    │────▶│   LiveKit   │────▶│   Backend   │
│   (WebRTC)  │◀────│   Server    │◀────│   (Node.js) │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                           ┌───────────────────┼───────────────────┐
                           ▼                   ▼                   ▼
                    ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
                    │     ASR     │     │     LLM     │     │     TTS     │
                    │  (Deepgram) │     │  (OpenAI)   │     │ (ElevenLabs)│
                    └─────────────┘     └─────────────┘     └─────────────┘
```

### Speech Pipeline

1. **Audio In** → LiveKit captures audio stream
2. **ASR** → Deepgram/Google transcribes to text
3. **LLM** → OpenAI processes intent and generates response
4. **Function Calling** → Execute actions (booking, escalation, info lookup)
5. **TTS** → Convert response to speech
6. **Audio Out** → LiveKit streams audio back to caller

## License

MIT License - see LICENSE file for details.

## Support

- Documentation: https://docs.voxreception.com
- Issues: https://github.com/your-org/voxreception/issues
- Email: support@voxreception.com
