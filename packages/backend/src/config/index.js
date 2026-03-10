/**
 * Application Configuration
 * Centralized configuration management
 */

const config = {
  // Server
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3001,
  apiUrl: process.env.API_URL || 'http://localhost:3001',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  // Database
  database: {
    url: process.env.DATABASE_URL || 'postgresql://voxreception:voxreception@localhost:5432/voxreception',
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'development-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // LiveKit
  livekit: {
    url: process.env.LIVEKIT_URL || 'ws://localhost:7880',
    apiKey: process.env.LIVEKIT_API_KEY || 'devkey',
    apiSecret: process.env.LIVEKIT_API_SECRET || 'secret',
    tokenTtl: 3600, // 1 hour
  },

  // Stripe
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    prices: {
      basic: process.env.STRIPE_PRICE_BASIC,
      pro: process.env.STRIPE_PRICE_PRO,
      enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
    },
  },

  // ASR Providers
  asr: {
    deepgram: {
      apiKey: process.env.DEEPGRAM_API_KEY,
    },
    google: {
      credentials: process.env.GOOGLE_SPEECH_CREDENTIALS,
    },
  },

  // TTS Providers
  tts: {
    google: {
      credentials: process.env.GOOGLE_TTS_CREDENTIALS,
    },
    elevenlabs: {
      apiKey: process.env.ELEVENLABS_API_KEY,
    },
    aws: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1',
    },
  },

  // LLM
  llm: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
    },
  },

  // S3 Storage
  s3: {
    endpoint: process.env.S3_ENDPOINT,
    bucket: process.env.S3_BUCKET || 'voxreception-recordings',
    accessKey: process.env.S3_ACCESS_KEY,
    secretKey: process.env.S3_SECRET_KEY,
    region: process.env.S3_REGION || 'us-east-1',
  },

  // Encryption
  encryption: {
    key: process.env.ENCRYPTION_KEY,
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },

  // Google Calendar
  googleCalendar: {
    clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_CALENDAR_REDIRECT_URI,
  },

  // Email
  email: {
    provider: process.env.EMAIL_PROVIDER || 'smtp', // smtp, sendgrid
    from: process.env.EMAIL_FROM || 'noreply@voxreception.com',
    fromName: process.env.EMAIL_FROM_NAME || 'VoxReception',
    smtp: {
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER,
      password: process.env.SMTP_PASSWORD,
    },
    sendgrid: {
      apiKey: process.env.SENDGRID_API_KEY,
    },
  },

  // Twilio (Telephony & SMS)
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
    webhookBaseUrl: process.env.TWILIO_WEBHOOK_BASE_URL || process.env.API_URL || 'http://localhost:3001',
  },

  // Feature flags
  features: {
    recording: true,
    transcription: true,
    videoSupport: true,
    multiLanguage: true,
  },

  // Rate limits
  rateLimits: {
    api: {
      windowMs: 15 * 60 * 1000,
      max: 1000,
    },
    auth: {
      windowMs: 15 * 60 * 1000,
      max: 20,
    },
  },

  // Plan limits
  plans: {
    basic: {
      maxMinutesPerMonth: 500,
      maxConcurrentCalls: 2,
      videoEnabled: false,
      recordingEnabled: true,
      maxAgents: 3,
    },
    pro: {
      maxMinutesPerMonth: 2000,
      maxConcurrentCalls: 10,
      videoEnabled: true,
      recordingEnabled: true,
      maxAgents: 10,
    },
    enterprise: {
      maxMinutesPerMonth: -1, // unlimited
      maxConcurrentCalls: -1, // unlimited
      videoEnabled: true,
      recordingEnabled: true,
      maxAgents: -1, // unlimited
    },
  },
};

// Validate required configuration
function validateConfig() {
  const requiredInProduction = [
    'jwt.secret',
    'stripe.secretKey',
    'livekit.apiKey',
    'livekit.apiSecret',
  ];

  if (config.env === 'production') {
    for (const path of requiredInProduction) {
      const value = path.split('.').reduce((obj, key) => obj?.[key], config);
      if (!value) {
        throw new Error(`Missing required configuration: ${path}`);
      }
    }
  }
}

validateConfig();

export default config;
