# VoxReception — Feature Parity Plan with My AI Front Desk

> **Date:** February 8, 2026
> **Competitor:** [myaifrontdesk.com](https://www.myaifrontdesk.com)
> **Timeline:** 14–16 weeks (5 phases)
> **Telephony Provider:** Twilio

---

## Table of Contents

1. [Competitor Feature List](#1-competitor-feature-list-my-ai-front-desk)
2. [VoxReception Current Feature List](#2-voxreception-current-feature-list)
3. [Missing Features Gap Analysis](#3-missing-features-gap-analysis)
4. [Implementation Plan](#4-implementation-plan)
   - [Phase 1 — Telephony & SMS Foundation (Weeks 1–3)](#phase-1--telephony--sms-foundation-weeks-13)
   - [Phase 2 — Workflows & Notifications (Weeks 4–6)](#phase-2--workflows--notifications-weeks-46)
   - [Phase 3 — CRM, Knowledge Base & Chatbot (Weeks 7–10)](#phase-3--crm-knowledge-base--chatbot-weeks-710)
   - [Phase 4 — Analytics, Polish & Missing Basics (Weeks 11–12)](#phase-4--analytics-polish--missing-basics-weeks-1112)
   - [Phase 5 — Integrations, White-Label & Enterprise (Weeks 13–16)](#phase-5--integrations-white-label--enterprise-weeks-1316)
5. [Database Schema Changes](#5-database-schema-changes)
6. [New Files To Create](#6-new-files-to-create)
7. [Testing & Verification](#7-testing--verification)
8. [Risk & Dependencies](#8-risks--dependencies)

---

## 1. Competitor Feature List (My AI Front Desk)

### 1.1 Workflows

| # | Feature | Description |
|---|---------|-------------|
| C1 | **Texting Workflows** | Rule-based auto-SMS triggered by conversation context — send links, promos, scheduling info mid-call. Described in plain English (no code). |
| C2 | **Call Transferring Workflows** | AI-powered intelligent call routing using context and intent. User writes scenario in plain English (e.g., "If someone sounds frustrated about a charge, transfer to billing"). AI reads emotions + context + subtext in real-time. |
| C3 | **API Workflows** | During calls, AI collects info from callers → sends to external API → receives data → uses it in the ongoing conversation. Supports GET/POST/PUT, custom headers, request body with `{{variable}}` templates, JSON path response mapping. |
| C4 | **Intake Form Workflows** | AI asks dynamic questions, captures structured data per field (text/number/yes-no), validates, then exports via webhooks or Zapier. |

### 1.2 Knowledge & CRM

| # | Feature | Description |
|---|---------|-------------|
| C5 | **Autopilot CRM** | Intelligent group builder (custom groups like "Hot Leads"), automatic lead sorting during calls, comprehensive AI note-taking, drag-and-drop lead management, customized follow-up schedules (email sequences, call reminders). Views: Board (Kanban), List, Individual profile with interaction history. |
| C6 | **Knowledge Base** | Structured content pages (10/20/40 by plan tier) that train the AI. Supports business info, FAQs, service details. |
| C7 | **Auto Website Scraping** | Enter URL → system automatically scrapes and learns business info → auto-customizes colors/branding → live in minutes. |

### 1.3 Analytics & Reporting

| # | Feature | Description |
|---|---------|-------------|
| C8 | **Analytics Tab** | Busiest hour past 7 days (bar graph), busiest hours each day heatmap, overall call logs by month (long-term trends), call duration frequency distribution, text logs (line graph over time), link tracking click data. Date range selection, download as SVG/PNG/CSV. |
| C9 | **Post-Call Notifications** | Instantly alerts the right team with key call details — caller info, summary, intent, urgency. Configurable recipients (1/3/unlimited by tier). |
| C10 | **Smart Notification System** | Auto-prioritizes messages, alerts the right team, ensures nothing falls through the cracks. |

### 1.4 Phone Numbers & Forwarding

| # | Feature | Description |
|---|---------|-------------|
| C11 | **Phone Number Provisioning** | Keep existing business number (call forwarding) OR get a new standalone number. |
| C12 | **Area Code Selection** | Choose a specific area code for local presence and strategic market positioning. |
| C13 | **Link Tracking** | Track every link sent via SMS — click-throughs, individual interactions, campaign performance, CRM integration. |

### 1.5 Communication & Call Handling

| # | Feature | Description |
|---|---------|-------------|
| C14 | **SMS/Texting Engine** | Send & receive SMS/text during calls and independently. AI texts callers with custom links (Calendly, etc.) mid-conversation. |
| C15 | **Shareable Call Links** | Public URLs that let clients reach the AI receptionist directly — simplifies communication, boosts conversions. |
| C16 | **Unlimited Parallel Calls** | Handle unlimited simultaneous calls — no busy signals, no missed opportunities. |
| C17 | **100+ Premium Voices** | Voice library with 100+ voices across genders, accents, tones, speeds. Partners: ElevenLabs, Deepgram, Cartesia. Fine-tune speed, pitch, emphasis. Use different voices for different situations. |
| C18 | **Premium AI Models** | Advanced context-aware LLMs with natural conversation, continuous learning, multilingual capabilities. |
| C19 | **Ultra-Fast Response (<1s)** | Millisecond-level response latency for natural human-like conversation. |
| C20 | **Included Minutes** | Per-plan free minutes: 200 (Starter) / 300 (Growth) / Custom. Overage: $0.12/credit. |
| C21 | **AI-Powered Voicemail** | Intelligent message-taking → auto-transcription to text → organized in separate section → new voicemail notifications. |
| C22 | **Adjustable Max Call Duration** | Customizable call length limits per tenant. |
| C23 | **Call Recordings** | Record, search, share, download AI-handled calls. Quality control and compliance. |
| C24 | **Auto Hangup** | Polite auto-end with closing remarks based on conversation flow detection. |

### 1.6 Advanced Capabilities

| # | Feature | Description |
|---|---------|-------------|
| C25 | **Multi-Language Support** | Fluent in multiple languages including idioms and accents. Global, personalized service. |
| C26 | **Business Hours Control** | Set active times with precision — customize availability, automate scheduling. |
| C27 | **Extension Digits** | Traditional extension number shortcuts mapped to AI routing for specific teams/individuals. DTMF-based. |
| C28 | **Pronunciation Guides** | Custom pronunciation dictionary for names, brand terms, industry jargon. |
| C29 | **Max Receptionist Minutes Cap** | Hard cap on AI minutes per month to control costs. Monitor and alert. |
| C30 | **Post-Call Webhooks** | Secure real-time webhooks after every call — send call data to CRMs, analytics, ticketing. HMAC-signed. |
| C31 | **Phone-as-Booking Interface** | Turn calls into automatic calendar bookings via Google Calendar integration. 24/7 scheduling. |

### 1.7 Multi-Channel

| # | Feature | Description |
|---|---------|-------------|
| C32 | **Voice Channel** | 24/7 human-like voice receptionist via phone. |
| C33 | **Text/SMS Channel** | Outbound + inbound SMS/text conversations. |
| C34 | **Website Embeddable Widget** | Customizable widget (size, color, voice) embedded on any website. |
| C35 | **AI Web Chatbot** | Separate text-based chatbot for websites — lead capture, qualification, booking, support. Instant knowledge base from URL scraping. Multi-channel deploy (web, FB Messenger, Instagram, SMS). Auto-customizes colors. Live human handover with full history. |

### 1.8 White-Label & Reseller

| # | Feature | Description |
|---|---------|-------------|
| C36 | **White-Label Program** | Full rebrand — custom logo, company name, domain. Clients see reseller's brand everywhere. |
| C37 | **Custom Domain Integration** | Connect own domain for login, registration, shared pages. |
| C38 | **Stripe Rebilling** | Resellers connect their Stripe account, create custom plans, offer free trials, set pricing. Platform handles automating payments/subscriptions/renewals. |
| C39 | **Feature Gating** | Toggle features on/off per client. Create different tiers without building different products. |
| C40 | **Reseller Portal** | View all client agents, call transcripts, text history, voicemails. See time/money savings per client. |

### 1.9 Integrations

| # | Feature | Description |
|---|---------|-------------|
| C41 | **Google Calendar** | OAuth2, event CRUD, free/busy availability, auto-booking during calls. |
| C42 | **6000+ Integrations (Zapier)** | Connect to any app via Zapier triggers/actions. |
| C43 | **CRM Sync** | Auto-sync to HubSpot, Salesforce, Pipedrive. |
| C44 | **Outbound Calling** | AI-initiated outbound calls (Enterprise plan). |

### 1.10 Business & Pricing

| # | Feature | Description |
|---|---------|-------------|
| C45 | **Tiered Pricing** | Starter ($99/mo), Growth ($149/mo), Custom/Enterprise. Yearly = 20% discount. |
| C46 | **Free Trial** | 10 credits to test + 7-day cancel-anytime trial. |
| C47 | **Affiliate Program** | Referral-based revenue sharing via Tolt. |
| C48 | **Enterprise SSO (SAML/SCIM/SSO)** | Enterprise-grade authentication. |
| C49 | **Lead Qualification** | Auto-collect name, email, company size, needs before handoff to sales. |
| C50 | **Dedicated Account Rep** | Human support for onboarding and strategic guidance. |

---

## 2. VoxReception Current Feature List

### 2.1 Core AI Voice Receptionist — ✅ COMPLETE

| # | Feature | Status | Files |
|---|---------|--------|-------|
| V1 | **Full AI Voice Pipeline** (Audio → ASR → LLM → TTS → Audio) | ✅ Full | `services/callAgent.js` |
| V2 | **Real-time WebRTC Calls** via LiveKit | ✅ Full | `services/callAgent.js` |
| V3 | **Configurable Greeting Message** | ✅ Full | `services/callAgent.js` → `sayGreeting()` |
| V4 | **Conversation History Tracking** per call | ✅ Full | `services/callAgent.js` |
| V5 | **Natural Language Understanding** | ✅ Full | `services/dialogManager.js` |
| V6 | **Error Recovery** ("please repeat") | ✅ Full | `services/callAgent.js` |

### 2.2 Speech Processing — ✅ COMPLETE

| # | Feature | Status | Files |
|---|---------|--------|-------|
| V7 | **Deepgram ASR** (Nova-2, VAD, streaming) | ✅ Full | `services/asr.js` |
| V8 | **Google Speech-to-Text** (streaming, punctuation) | ✅ Full | `services/asr.js` |
| V9 | **Pluggable ASR Architecture** (event-based adapters) | ✅ Full | `services/asr.js` |
| V10 | **Per-Tenant ASR Provider Selection** | ✅ Full | `prisma/schema.prisma` |

### 2.3 Text-to-Speech — ✅ COMPLETE

| # | Feature | Status | Files |
|---|---------|--------|-------|
| V11 | **ElevenLabs TTS** (Turbo v2.5, PCM, configurable) | ✅ Full | `services/tts.js` |
| V12 | **Google Cloud TTS** (Neural2, SSML, configurable) | ✅ Full | `services/tts.js` |
| V13 | **AWS Polly TTS** (Neural engine) | ✅ Full | `services/tts.js` |
| V14 | **Pluggable TTS Architecture** | ✅ Full | `services/tts.js` |
| V15 | **Per-Tenant TTS Provider Selection** | ✅ Full | `prisma/schema.prisma` |

### 2.4 LLM & Dialog Management — ✅ COMPLETE

| # | Feature | Status | Files |
|---|---------|--------|-------|
| V16 | **OpenAI GPT** (function calling, system prompts) | ✅ Full | `services/dialogManager.js` |
| V17 | **Google Gemini** (Flash 2.0, default provider) | ✅ Full | `services/dialogManager.js` |
| V18 | **6 AI Tool Functions** (book, cancel, availability, transfer, info, message) | ✅ Full | `services/dialogManager.js`, `services/callAgent.js` |
| V19 | **Customizable System Prompt** (business name, personality, hours) | ✅ Full | `services/dialogManager.js` |
| V20 | **Quick Responses** (greeting, goodbye, hold, transfer, unavailable, after_hours) | ✅ Full | `services/dialogManager.js` |
| V21 | **Intent Detection** (booking, cancellation, inquiry, complaint, transfer, other) | ✅ Full | `services/dialogManager.js` |

### 2.5 Call Management — ✅ COMPLETE

| # | Feature | Status | Files |
|---|---------|--------|-------|
| V22 | **Call Lifecycle** (PENDING → ACTIVE → COMPLETED/FAILED/CANCELLED/ESCALATED) | ✅ Full | `routes/calls.js`, `prisma/schema.prisma` |
| V23 | **Active Call Monitoring** (real-time, 5s polling) | ✅ Full | `hooks/queries.js` |
| V24 | **Call Filtering, Search & Pagination** | ✅ Full | `routes/calls.js` |
| V25 | **Call Detail View** (caller info, duration, status, intent, transcript, recording) | ✅ Full | `app/dashboard/calls/[id]/page.js` |
| V26 | **Call Recording Playback** (play/pause, seek, time) | ✅ Full | `app/dashboard/calls/[id]/page.js` |
| V27 | **Call Recording Download** (S3 pre-signed URLs) | ✅ Full | `routes/calls.js` |
| V28 | **Call Deletion** (admin-only, cascading) | ✅ Full | `routes/calls.js` |

### 2.6 Human Escalation — ✅ COMPLETE

| # | Feature | Status | Files |
|---|---------|--------|-------|
| V29 | **AI-to-Human Escalation** via `transfer_to_agent` | ✅ Full | `services/callAgent.js` |
| V30 | **Manual Escalation API** with auto/targeted agent assignment | ✅ Full | `routes/calls.js` |
| V31 | **Agent Dashboard** (escalated calls, urgency, wait time, reason) | ✅ Full | `app/dashboard/agent/page.js` |
| V32 | **Agent Join Call** (LiveKit token, bidirectional audio) | ✅ Full | `routes/calls.js` |
| V33 | **Real-time Escalation Notifications** (WebSocket + Email) | ✅ Full | `services/callAgent.js`, `services/email.js` |

### 2.7 Booking / Appointments — ✅ COMPLETE

| # | Feature | Status | Files |
|---|---------|--------|-------|
| V34 | **CRUD Bookings** with validation | ✅ Full | `routes/bookings.js` |
| V35 | **Booking Status Workflow** (PENDING → CONFIRMED → COMPLETED/CANCELLED/NO_SHOW) | ✅ Full | `prisma/schema.prisma` |
| V36 | **Google Calendar Sync** (OAuth2, event CRUD, attendees, reminders) | ✅ Full | `services/googleCalendar.js` |
| V37 | **Availability Checking** (free/busy API, 30-min slots, 9AM–5PM) | ✅ Full | `services/googleCalendar.js` |
| V38 | **Calendar + List Views** with search/filter | ✅ Full | `app/dashboard/bookings/page.js` |
| V39 | **Booking Confirmation Emails** | ✅ Full | `services/email.js` |
| V40 | **AI-Initiated Bookings** during calls (function calling + natural date parsing) | ✅ Full | `services/callAgent.js` |

### 2.8 Transcripts — ✅ COMPLETE

| # | Feature | Status | Files |
|---|---------|--------|-------|
| V41 | **Real-time Transcript Segments** (speaker, timestamp) | ✅ Full | `routes/transcripts.js` |
| V42 | **Full-text Search** with highlighted context | ✅ Full | `routes/transcripts.js` |
| V43 | **Transcript Editing** | ✅ Full | `routes/transcripts.js` |
| V44 | **Live Transcript Streaming** via WebSocket | ✅ Full | `websocket/index.js` |

### 2.9 Embeddable Widget — ✅ COMPLETE

| # | Feature | Status | Files |
|---|---------|--------|-------|
| V45 | **JavaScript Embed Snippet** (`<script>` tag) | ✅ Full | `public/widget.js` |
| V46 | **Widget Commands API** (init, open, close, toggle, setConfig) | ✅ Full | `public/widget.js` |
| V47 | **Configurable Appearance** (color, position, text, z-index) | ✅ Full | `public/widget.js` |
| V48 | **State-aware Button** (idle, calling, in-call, connected) | ✅ Full | `public/widget.js` |
| V49 | **Widget Customization UI** (live preview + code generator) | ✅ Full | `app/dashboard/settings/embed/page.js` |

### 2.10 Multi-Tenant Architecture — ✅ COMPLETE

| # | Feature | Status | Files |
|---|---------|--------|-------|
| V50 | **Complete Tenant Isolation** (all queries scoped) | ✅ Full | `middleware/auth.js` |
| V51 | **Per-Tenant Configuration** (AI providers, voice, business info, feature flags) | ✅ Full | `prisma/schema.prisma` |
| V52 | **Tenant CRUD + Auto-Tenant on Registration** | ✅ Full | `routes/tenants.js`, `routes/auth.js` |
| V53 | **Per-Tenant Statistics** (calls, bookings, users, minutes) | ✅ Full | `routes/tenants.js` |

### 2.11 Auth & User Management — ✅ COMPLETE

| # | Feature | Status | Files |
|---|---------|--------|-------|
| V54 | **JWT Auth** (access + refresh tokens, auto-refresh) | ✅ Full | `routes/auth.js`, `lib/api.js` |
| V55 | **Registration** (validation, bcrypt, tenant creation) | ✅ Full | `routes/auth.js` |
| V56 | **RBAC** (SUPER_ADMIN, TENANT_ADMIN, AGENT, USER) | ✅ Full | `prisma/schema.prisma` |
| V57 | **User CRUD** (create, list, update, deactivate, delete) | ✅ Full | `routes/users.js` |
| V58 | **Password Change + Admin Reset** | ✅ Full | `routes/auth.js`, `routes/users.js` |

### 2.12 Billing (Stripe) — ✅ COMPLETE

| # | Feature | Status | Files |
|---|---------|--------|-------|
| V59 | **3-Tier Plans** (Basic $49, Professional $149, Enterprise $499) | ✅ Full | `routes/billing.js`, `config/index.js` |
| V60 | **Stripe Checkout + Customer Portal** | ✅ Full | `routes/billing.js` |
| V61 | **Subscription Management** (cancel, upgrade) | ✅ Full | `routes/billing.js` |
| V62 | **Usage Tracking** (minutes, calls, bookings vs limits) | ✅ Full | `routes/billing.js` |
| V63 | **Invoice History** (PDF download) | ✅ Full | `routes/billing.js` |
| V64 | **Webhook Handlers** (checkout, subscription, invoice events) | ✅ Full | `routes/webhooks.js` |

### 2.13 Integrations — ⚠️ PARTIAL

| # | Feature | Status | Files |
|---|---------|--------|-------|
| V65 | **Google Calendar** (full OAuth2, calendar select, event CRUD) | ✅ Full | `routes/integrations.js`, `services/googleCalendar.js` |
| V66 | **Webhook Testing** (test endpoint + custom payloads) | ✅ Full | `routes/integrations.js` |
| V67 | **Outlook Calendar** | ❌ Stub ("Coming Soon" UI badge) | `app/dashboard/integrations/page.js` |
| V68 | **Slack** | ❌ Stub ("Coming Soon" UI badge) | `app/dashboard/integrations/page.js` |
| V69 | **Zapier** | ❌ Stub ("Coming Soon" UI badge) | `app/dashboard/integrations/page.js` |

### 2.14 Super Admin Panel — ✅ COMPLETE

| # | Feature | Status | Files |
|---|---------|--------|-------|
| V70 | **System-Wide Stats** (tenants, users, calls, bookings, active, by plan) | ✅ Full | `routes/admin.js` |
| V71 | **Tenant Management** (list, search, filter by plan) | ✅ Full | `routes/admin.js` |
| V72 | **Audit Log Viewer** | ✅ Full | `routes/admin.js` |
| V73 | **Tenant Impersonation** | ✅ Full | `routes/admin.js` |
| V74 | **System Cleanup** (expired tokens, old logs, orphans) | ✅ Full | `routes/admin.js` |

### 2.15 Settings / Agent Config — ✅ COMPLETE

| # | Feature | Status | Files |
|---|---------|--------|-------|
| V75 | **AI Voice & Personality** (greeting, personality, language, voice) | ✅ Full | `app/dashboard/settings/page.js` |
| V76 | **AI Provider Selection** (ASR/TTS/LLM) | ✅ Full | `app/dashboard/settings/page.js` |
| V77 | **Business Hours** (open/close, timezone, working days) | ✅ Full | `app/dashboard/settings/page.js` |
| V78 | **Call Handling** (max duration, escalation timeout, voicemail, recording toggle) | ✅ Full | `app/dashboard/settings/page.js` |

### 2.16 Infrastructure — ✅ COMPLETE

| # | Feature | Status | Files |
|---|---------|--------|-------|
| V79 | **Prometheus Metrics** (15+ custom metrics) | ✅ Full | `lib/metrics.js` |
| V80 | **Health Checks** (basic, live, ready, detailed) | ✅ Full | `routes/health.js` |
| V81 | **Structured Logging** (Winston) | ✅ Full | `lib/logger.js` |
| V82 | **Data Retention Automation** (daily cleanup, per-tenant policies) | ✅ Full | `jobs/dataRetention.js` |
| V83 | **Docker + Kubernetes** (compose dev/prod, K8s manifests, HPA) | ✅ Full | `docker-compose.*.yml`, `k8s/` |
| V84 | **Rate Limiting** | ✅ Full | `config/index.js` |

### 2.17 Partially Implemented / Stubbed

| # | Feature | Status | Evidence |
|---|---------|--------|----------|
| V85 | **Forgot/Reset Password** | ❌ Stub | API client methods exist, no backend routes |
| V86 | **Email Verification** | ❌ Stub | Schema field + Token model, no flow |
| V87 | **Anthropic Claude LLM** | ❌ Stub | Enum in schema, no adapter code |
| V88 | **OpenAI Whisper ASR** | ❌ Stub | Enum in schema, no adapter class |
| V89 | **Call Export** | ❌ Stub | UI button exists, no backend route |
| V90 | **Transcript Export** | ❌ Stub | Frontend API method, no backend route |
| V91 | **SSO/SAML** | ❌ Stub | Listed in Enterprise plan, not implemented |
| V92 | **API Key Tokens** | ❌ Stub | Token model supports it, no routes |
| V93 | **Booking Confirmation Endpoint** | ❌ Stub | Frontend hook + API, no backend route |
| V94 | **Video Calls** | ❌ Stub | Feature flag exists, no UI/routing |

---

## 3. Missing Features Gap Analysis

### Priority Legend

| Priority | Meaning |
|----------|---------|
| 🔴 **P0** | Must-have — core revenue feature, blocks other work |
| 🟠 **P1** | High value — significant competitive differentiator |
| 🟡 **P2** | Medium value — nice-to-have for feature parity |
| 🟢 **P3** | Low priority — enterprise/niche, can defer |

### 3.1 Complete Missing Features List

| ID | Missing Feature | Competitor Ref | Priority | Complexity | Phase |
|----|----------------|----------------|----------|------------|-------|
| **M1** | SMS/Texting Engine (send/receive, mid-call texting) | C14, C33 | 🔴 P0 | High | 1 |
| **M2** | Phone Number Provisioning (Twilio) | C11 | 🔴 P0 | High | 1 |
| **M3** | Area Code Selection | C12 | 🟡 P2 | Low | 1 |
| **M4** | Unlimited Parallel Calls | C16 | 🟠 P1 | Medium | 1 |
| **M5** | Shareable Call Links | C15 | 🟡 P2 | Low | 1 |
| **M6** | Texting Workflows | C1 | 🔴 P0 | Medium | 2 |
| **M7** | Call Transferring Workflows | C2 | 🔴 P0 | Medium | 2 |
| **M8** | API Workflows | C3 | 🟠 P1 | Medium | 2 |
| **M9** | Intake Form Workflows | C4 | 🟠 P1 | Medium | 2 |
| **M10** | Link Tracking | C13 | 🟡 P2 | Medium | 2 |
| **M11** | Post-Call Notifications (configurable) | C9, C10 | 🔴 P0 | Medium | 2 |
| **M12** | Post-Call Webhooks | C30 | 🟠 P1 | Medium | 2 |
| **M13** | Auto Hangup (conversation-end detection) | C24 | 🟡 P2 | Low | 2 |
| **M14** | CRM Module (leads, groups, notes, follow-ups) | C5 | 🔴 P0 | High | 3 |
| **M15** | Lead Qualification Flows | C49 | 🟠 P1 | Medium | 3 |
| **M16** | Knowledge Base Management | C6 | 🔴 P0 | Medium | 3 |
| **M17** | Auto Website Scraping | C7 | 🟡 P2 | Medium | 3 |
| **M18** | AI Web Chatbot | C35 | 🔴 P0 | High | 3 |
| **M19** | Chatbot Dashboard (manage sessions, respond) | C35 | 🟠 P1 | Medium | 3 |
| **M20** | Advanced Analytics Dashboard | C8 | 🔴 P0 | Medium | 4 |
| **M21** | Call & Lead Export (CSV/JSON) | C8 | 🟡 P2 | Low | 4 |
| **M22** | Voice Library UI (browse, preview 100+ voices) | C17 | 🟡 P2 | Low | 4 |
| **M23** | Pronunciation Guides | C28 | 🟢 P3 | Low | 4 |
| **M24** | Extension Digits (DTMF routing) | C27 | 🟢 P3 | Medium | 4 |
| **M25** | Max Minutes Cap per Tenant | C29 | 🟡 P2 | Low | 4 |
| **M26** | Forgot Password Flow (complete) | — | 🔴 P0 | Low | 4 |
| **M27** | Free Trial System (credits-based) | C46 | 🟠 P1 | Low | 4 |
| **M28** | Zapier Integration | C42 | 🟠 P1 | Medium | 5 |
| **M29** | CRM Integrations (HubSpot, Salesforce, Pipedrive) | C43 | 🟠 P1 | High | 5 |
| **M30** | Outbound Calling | C44 | 🟡 P2 | High | 5 |
| **M31** | Multi-Channel Chatbot (FB Messenger, Instagram) | C35 | 🟢 P3 | High | 5 |
| **M32** | White-Label / Reseller Program | C36, C37 | 🟡 P2 | Very High | 5 |
| **M33** | Stripe Rebilling for Resellers | C38 | 🟡 P2 | High | 5 |
| **M34** | Feature Gating (per-tenant toggles) | C39 | 🟡 P2 | Medium | 5 |
| **M35** | Reseller Portal | C40 | 🟡 P2 | High | 5 |
| **M36** | SSO/SAML (Enterprise) | C48 | 🟢 P3 | High | 5 |
| **M37** | Affiliate Program | C47 | 🟢 P3 | Medium | 5 |

### 3.2 Gap Summary

| Category | Total in Competitor | In VoxReception | Missing | Gap % |
|----------|-------------------|-----------------|---------|-------|
| Workflows | 4 | 0 | 4 | 100% |
| Knowledge & CRM | 3 | 0 | 3 | 100% |
| Analytics & Reporting | 3 | 1 (basic) | 2 | 67% |
| Phone Numbers & SMS | 3 | 0 | 3 | 100% |
| Communication & Call Handling | 11 | 5 | 6 | 55% |
| Advanced Capabilities | 7 | 3 | 4 | 57% |
| Multi-Channel | 4 | 2 | 2 | 50% |
| White-Label & Reseller | 5 | 0 | 5 | 100% |
| Integrations (beyond Google Cal) | 3 | 0 | 3 | 100% |
| Business & Pricing | 5 | 2 | 3 | 60% |
| **TOTAL** | **50** | **13** | **37** | **74%** |

---

## 4. Implementation Plan

### Phase 1 — Telephony & SMS Foundation (Weeks 1–3)

> **Goal:** Establish Twilio infrastructure for phone numbers and SMS. Enable parallel calls and shareable links.
> **Delivers:** M1, M2, M3, M4, M5

#### Step 1.1: Twilio Integration & Phone Number Provisioning (M2, M3)

**New files:**
- `packages/backend/src/services/twilio.js` — Twilio SDK wrapper
- `packages/backend/src/routes/phoneNumbers.js` — Phone number management API
- `packages/frontend/src/app/dashboard/settings/phone/page.js` — Phone number management UI

**Schema changes (`prisma/schema.prisma`):**
```prisma
model PhoneNumber {
  id            String   @id @default(cuid())
  tenantId      String
  tenant        Tenant   @relation(fields: [tenantId], references: [id])
  number        String   @unique
  friendlyName  String?
  areaCode      String?
  twilioSid     String   @unique
  capabilities  Json     // { voice: true, sms: true, mms: false }
  forwardTo     String?  // Forward calls to this number
  isActive      Boolean  @default(true)
  isPrimary     Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

**Backend implementation:**
```
services/twilio.js:
  - initClient()           → Initialize Twilio client from config
  - searchNumbers(areaCode, country, capabilities)
  - provisionNumber(number) → Purchase + configure webhooks
  - releaseNumber(sid)      → Release number back to pool
  - configureForwarding(sid, forwardTo)
  - getCallForwardingUrl()  → Returns URL for Twilio → LiveKit bridge

routes/phoneNumbers.js:
  GET    /api/phone-numbers              → List tenant's numbers
  GET    /api/phone-numbers/available    → Search available (areaCode, country)
  POST   /api/phone-numbers/provision    → Purchase a number
  PUT    /api/phone-numbers/:id          → Update config (forwardTo, friendlyName)
  DELETE /api/phone-numbers/:id          → Release number
  PUT    /api/phone-numbers/:id/primary  → Set as primary
```

**Twilio → LiveKit bridge:**
- Twilio voice webhook → `POST /api/webhooks/twilio/voice`
- Receives inbound call → creates LiveKit room → starts CallAgent
- TwiML response: `<Connect><Stream url="wss://..."/></Connect>` or forward to LiveKit SIP

#### Step 1.2: SMS/Texting Engine (M1)

**New files:**
- `packages/backend/src/routes/messages.js` — SMS API
- `packages/frontend/src/app/dashboard/messages/page.js` — SMS inbox/thread UI

**Schema changes:**
```prisma
model Message {
  id          String        @id @default(cuid())
  tenantId    String
  tenant      Tenant        @relation(fields: [tenantId], references: [id])
  callId      String?       // If sent during a call
  call        Call?         @relation(fields: [callId], references: [id])
  direction   MessageDirection
  from        String
  to          String
  body        String
  status      MessageStatus @default(QUEUED)
  twilioSid   String?
  linksSent   Json?         // URLs included in the message
  errorCode   String?
  createdAt   DateTime      @default(now())
}

enum MessageDirection {
  INBOUND
  OUTBOUND
}

enum MessageStatus {
  QUEUED
  SENT
  DELIVERED
  FAILED
  RECEIVED
}
```

**Backend implementation:**
```
services/twilio.js (extend):
  - sendSMS(from, to, body)   → Send via Twilio + store in DB
  - handleInboundSMS(payload)  → Process incoming webhook

routes/messages.js:
  GET  /api/messages              → List messages (filter by callId, direction, date)
  GET  /api/messages/threads      → Group by phone number (inbox view)
  GET  /api/messages/thread/:phone → Conversation thread with a number
  POST /api/messages/send         → Manual SMS send

webhooks (add to routes/webhooks.js):
  POST /api/webhooks/twilio/sms         → Inbound SMS
  POST /api/webhooks/twilio/sms-status  → Delivery status updates
```

**AI integration — add to `dialogManager.js` tools:**
```javascript
{
  type: "function",
  function: {
    name: "send_text_message",
    description: "Send a text message/SMS to the caller during the call",
    parameters: {
      type: "object",
      properties: {
        message: { type: "string", description: "The text message to send" },
        includeLink: { type: "string", description: "Optional URL to include" }
      },
      required: ["message"]
    }
  }
}
```

Handler in `callAgent.js`:
```javascript
case 'send_text_message':
  const { message, includeLink } = args;
  const body = includeLink ? `${message}\n${includeLink}` : message;
  await twilioService.sendSMS(tenantPhoneNumber, callerNumber, body);
  // Store in Message model with callId reference
  return { success: true, message: "Text message sent to caller" };
```

#### Step 1.3: Unlimited Parallel Calls (M4)

**Changes to existing files:**

`routes/livekit.js`:
- Change room naming from `tenant-${tenantId}` to `call-${callId}` for per-call isolation
- Add concurrency check before creating rooms:
  ```javascript
  const activeCalls = await prisma.call.count({
    where: { tenantId, status: 'ACTIVE' }
  });
  const planLimit = getPlanLimits(tenant.plan).maxConcurrentCalls;
  if (activeCalls >= planLimit) {
    return res.status(429).json({ error: 'Concurrent call limit reached' });
  }
  ```

`services/callAgent.js`:
- Use `Map<callId, CallAgent>` in a module-level registry
- Each CallAgent instance scoped to its own LiveKit room
- Clean up on call end

`config/index.js` — update plan limits:
```javascript
plans: {
  basic: { maxConcurrentCalls: 3 },
  professional: { maxConcurrentCalls: 10 },
  enterprise: { maxConcurrentCalls: -1 } // unlimited
}
```

#### Step 1.4: Shareable Call Links (M5)

**Schema change:**
```prisma
model Tenant {
  // ... existing fields
  slug  String?  @unique  // e.g., "acme-dental"
}
```

**New files:**
- `packages/frontend/src/app/call/[slug]/page.js` — Public branded landing page

**Backend:**
```
routes/calls.js (add):
  GET /api/calls/public/:slug  → Unauthenticated. Returns tenant name, logo,
                                  greeting, and LiveKit widget token.
```

**Frontend page (`/call/[slug]`):**
- Shows business name + logo
- "Call Now" button → opens embedded widget
- Mobile-friendly design
- No auth required

#### Phase 1 Deliverables Checklist

- [ ] Twilio account configured with API keys
- [ ] Phone number search and provisioning working
- [ ] Inbound calls from Twilio routed to LiveKit AI agent
- [ ] AI can send SMS mid-call via function calling
- [ ] SMS inbox UI with threaded conversations
- [ ] Multiple simultaneous calls per tenant working
- [ ] Shareable `/call/:slug` public pages working

---

### Phase 2 — Workflows & Notifications (Weeks 4–6)

> **Goal:** Build the workflow engine and notification system. Enable texting, transfer, API, and intake workflows.
> **Delivers:** M6, M7, M8, M9, M10, M11, M12, M13

#### Step 2.1: Workflow Engine Core

**Schema:**
```prisma
model Workflow {
  id               String        @id @default(cuid())
  tenantId         String
  tenant           Tenant        @relation(fields: [tenantId], references: [id])
  name             String
  type             WorkflowType
  description      String        // Plain English scenario description
  triggerCondition String        // Natural language: "When someone asks about pricing..."
  config           Json          // Type-specific configuration (see below)
  isActive         Boolean       @default(true)
  priority         Int           @default(0)
  executionCount   Int           @default(0)
  lastExecutedAt   DateTime?
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt

  intakeResponses  IntakeResponse[]
  linkClicks       LinkClick[]
}

enum WorkflowType {
  TEXTING
  TRANSFER
  API
  INTAKE
}
```

**New file: `packages/backend/src/services/workflowEngine.js`**
```
WorkflowEngine:
  - evaluateWorkflows(tenantId, conversationContext, lastMessage)
    → Uses LLM to classify which workflow(s) should fire
    → Returns matched workflows with their actions

  - executeWorkflow(workflow, callContext)
    → Dispatches to type-specific executor:
      • TEXTING  → sendSMS() with template variables
      • TRANSFER → initiateTransfer() via Twilio or LiveKit
      • API      → makeAPICall() with variable interpolation
      • INTAKE   → queueIntakeQuestion() for dialog manager

  - buildWorkflowPrompt(workflows[])
    → Injects workflow awareness into AI system prompt
    → "You have these workflows available: [descriptions]"
```

**Integration point in `callAgent.js`:**
```javascript
// After each AI response cycle:
const matchedWorkflows = await workflowEngine.evaluateWorkflows(
  tenantId, conversationHistory, lastCallerMessage
);
for (const wf of matchedWorkflows) {
  await workflowEngine.executeWorkflow(wf, { callId, callerNumber, ... });
}
```

**New file: `packages/backend/src/routes/workflows.js`**
```
GET    /api/workflows              → List all (filter by type, active)
POST   /api/workflows              → Create new workflow
GET    /api/workflows/:id          → Get detail
PUT    /api/workflows/:id          → Update
DELETE /api/workflows/:id          → Delete
PUT    /api/workflows/:id/toggle   → Activate/deactivate
POST   /api/workflows/:id/test     → Test with sample conversation
GET    /api/workflows/usage        → Count by type vs plan limits
```

#### Step 2.2: Texting Workflows (M6)

**Config schema for type `TEXTING`:**
```json
{
  "messageTemplate": "Thanks for calling! Here's our scheduling link: {{link}}",
  "links": [
    { "url": "https://calendly.com/acme", "label": "Schedule" }
  ],
  "trackLinks": true
}
```

**Execution:**
1. Replace `{{variables}}` in template with call context
2. If `trackLinks: true`, wrap URLs with `GET /api/track/:linkId` redirect
3. Send SMS via Twilio service
4. Store Message record with `callId` reference

#### Step 2.3: Link Tracking (M10)

**Schema:**
```prisma
model LinkClick {
  id          String   @id @default(cuid())
  workflowId  String
  workflow    Workflow  @relation(fields: [workflowId], references: [id])
  messageId   String?
  originalUrl String
  trackingId  String   @unique
  clickedAt   DateTime?
  clickCount  Int      @default(0)
  userAgent   String?
  ipAddress   String?
  createdAt   DateTime @default(now())
}
```

**Route:**
```
GET /api/track/:trackingId → Record click, redirect to originalUrl (301)
GET /api/link-tracking     → Analytics: clicks per link, per workflow, over time
```

#### Step 2.4: Call Transferring Workflows (M7)

**Config schema for type `TRANSFER`:**
```json
{
  "targetNumber": "+15551234567",
  "targetName": "Billing Department",
  "warmTransfer": true,
  "announcementMessage": "Transferring you to our billing team now."
}
```

**Execution:**
1. AI speaks announcement message via TTS
2. If `warmTransfer`: Twilio conference bridge — connect caller + target, then drop AI
3. If cold: Twilio redirect call to `targetNumber`
4. Update call status + log transfer event

#### Step 2.5: API Workflows (M8)

**Config schema for type `API`:**
```json
{
  "url": "https://api.example.com/lookup",
  "method": "POST",
  "headers": { "Authorization": "Bearer {{api_key}}" },
  "questionsToCollect": [
    { "variable": "account_number", "type": "text", "question": "What's your account number?" },
    { "variable": "zip_code", "type": "number", "question": "What's your ZIP code?" }
  ],
  "requestBody": {
    "account": "{{account_number}}",
    "zip": "{{zip_code}}"
  },
  "responseMapping": [
    { "variable": "balance", "jsonPath": "$.account.balance", "instruction": "Tell the caller their balance is {{balance}}" },
    { "variable": "due_date", "jsonPath": "$.account.dueDate", "instruction": "Their next payment is due {{due_date}}" }
  ],
  "timeout": 5000,
  "retries": 1
}
```

**Execution:**
1. AI asks each question in `questionsToCollect` sequentially
2. Collected answers interpolated into `requestBody` and `url`
3. HTTP request made with configured method/headers
4. `responseMapping` extracts values via JSON path
5. Instructions injected into AI context for next response

#### Step 2.6: Intake Form Workflows (M9)

**Schema:**
```prisma
model IntakeResponse {
  id          String   @id @default(cuid())
  workflowId  String
  workflow    Workflow  @relation(fields: [workflowId], references: [id])
  callId      String
  call        Call     @relation(fields: [callId], references: [id])
  responses   Json     // { "name": "John", "phone": "555-1234", ... }
  exportedAt  DateTime?
  webhookUrl  String?
  createdAt   DateTime @default(now())
}
```

**Config schema for type `INTAKE`:**
```json
{
  "questions": [
    { "field": "full_name", "type": "text", "question": "May I have your full name?", "required": true },
    { "field": "phone", "type": "text", "question": "What's the best number to reach you?", "required": true },
    { "field": "reason", "type": "text", "question": "What are you calling about today?", "required": true },
    { "field": "urgent", "type": "yes_no", "question": "Is this an urgent matter?", "required": false }
  ],
  "webhookUrl": "https://hooks.zapier.com/hooks/catch/...",
  "webhookHeaders": {},
  "confirmationMessage": "Thank you, I've captured all your information."
}
```

**Execution:**
1. AI asks each question in sequence, validates type
2. Stores completed responses in `IntakeResponse`
3. POSTs to `webhookUrl` if configured
4. AI confirms completion to caller

#### Step 2.7: Workflow Management UI

**New file: `packages/frontend/src/app/dashboard/workflows/page.js`**

Features:
- Tab bar: All | Texting | Transfer | API | Intake
- Workflow cards with: name, type badge, trigger description, active toggle, exec count
- Create/Edit modal with type-specific form:
  - **Texting:** Message template editor, link adder, track toggle
  - **Transfer:** Target number input, warm/cold toggle, announcement text
  - **API:** URL, method, headers, questions builder, body template, response mapping
  - **Intake:** Dynamic question builder, webhook URL, confirmation message
- Plan limit indicator: "2 of 6 texting workflows used"
- Test workflow button (simulates with sample conversation)

#### Step 2.8: Post-Call Notifications (M11)

**Schema:**
```prisma
model NotificationConfig {
  id           String             @id @default(cuid())
  tenantId     String
  tenant       Tenant             @relation(fields: [tenantId], references: [id])
  name         String
  type         NotificationType
  recipients   Json               // ["email@example.com", "+15551234"]
  conditions   Json               // { "callTypes": ["all"], "minDuration": 0, ... }
  template     String?            // Custom message template
  isActive     Boolean            @default(true)
  createdAt    DateTime           @default(now())
  updatedAt    DateTime           @updatedAt
}

enum NotificationType {
  EMAIL
  SMS
  WEBHOOK
  SLACK
}
```

**New file: `packages/backend/src/services/notifications.js`**
```
NotificationService:
  - sendPostCallNotification(call, transcript, intent)
    → Load tenant's notification configs
    → Filter by conditions (call type, duration, intent, etc.)
    → Dispatch to each matching config:
      • EMAIL  → Use existing email.js service
      • SMS    → Use Twilio service
      • WEBHOOK → HTTP POST with call data + HMAC signature
  - formatNotification(config, call)
    → Apply template variables: {{caller_name}}, {{duration}}, {{intent}}, {{summary}}
```

**Integration in `callAgent.js`:**
```javascript
// In endCall():
await notificationService.sendPostCallNotification(call, transcript, detectedIntent);
```

#### Step 2.9: Post-Call Webhooks (M12)

**Schema change (add to TenantConfig):**
```prisma
model TenantConfig {
  // ... existing fields
  webhookUrl    String?
  webhookSecret String?   // HMAC signing secret
  webhookEvents Json?     // ["call.completed", "call.escalated", "booking.created"]
}
```

**Webhook payload:**
```json
{
  "event": "call.completed",
  "timestamp": "2026-02-08T12:00:00Z",
  "data": {
    "callId": "clx...",
    "callerName": "John Doe",
    "callerPhone": "+15551234567",
    "duration": 184,
    "intent": "booking",
    "status": "COMPLETED",
    "summary": "Caller booked a dental cleaning for Tuesday at 2PM.",
    "transcript": [...],
    "recordingUrl": "https://..."
  },
  "signature": "sha256=abc123..."  // HMAC-SHA256
}
```

#### Step 2.10: Auto Hangup (M13)

**Changes to `services/dialogManager.js`:**
- Add goodbye intent detection in `detectIntent()`:
  ```javascript
  if (intent === 'goodbye' || conversationTurns > maxTurns || silenceCount > 3) {
    return { shouldHangup: true, closingMessage: "Thank you for calling! Have a great day." };
  }
  ```

**Changes to `services/callAgent.js`:**
- After each AI response, check `shouldHangup`
- If true: speak closing message → wait 2s → disconnect LiveKit room
- Configurable in `TenantConfig`: `autoHangupEnabled`, `maxSilenceBeforeHangup`, `closingMessage`

#### Phase 2 Deliverables Checklist

- [ ] Workflow CRUD API working with all 4 types
- [ ] Texting workflows sending SMS mid-call
- [ ] Call transfer workflows routing to external numbers
- [ ] API workflows collecting data + calling external APIs + injecting response
- [ ] Intake form workflows capturing structured data + webhook export
- [ ] Link tracking recording clicks + analytics
- [ ] Post-call notifications dispatching via email/SMS/webhook
- [ ] Configurable post-call webhooks with HMAC signing
- [ ] Auto hangup detecting goodbye + silence
- [ ] Workflow management UI with plan limits

---

### Phase 3 — CRM, Knowledge Base & Chatbot (Weeks 7–10)

> **Goal:** Build the CRM, knowledge base, and AI web chatbot — the three biggest missing product areas.
> **Delivers:** M14, M15, M16, M17, M18, M19

#### Step 3.1: CRM Module (M14)

**Schema:**
```prisma
model Lead {
  id              String       @id @default(cuid())
  tenantId        String
  tenant          Tenant       @relation(fields: [tenantId], references: [id])
  name            String?
  email           String?
  phone           String?
  company         String?
  source          LeadSource   @default(CALL)
  status          LeadStatus   @default(NEW)
  groupId         String?
  group           LeadGroup?   @relation(fields: [groupId], references: [id])
  score           Int          @default(0)      // 0-100 qualification score
  tags            Json?        // ["hot", "follow-up"]
  assignedToId    String?
  assignedTo      User?        @relation(fields: [assignedToId], references: [id])
  lastContactedAt DateTime?
  nextFollowUpAt  DateTime?
  metadata        Json?        // Extra custom fields
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  notes           LeadNote[]
  activities      LeadActivity[]
  calls           Call[]       @relation("LeadCalls")
}

model LeadGroup {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  name        String   // "Hot Leads", "Follow-up Required"
  description String?
  color       String?  // Hex color for UI
  sortOrder   Int      @default(0)
  criteria    String?  // Plain English auto-sort criteria
  workflowId  String?  // Auto-sort by workflow trigger
  createdAt   DateTime @default(now())

  leads       Lead[]
}

model LeadNote {
  id        String   @id @default(cuid())
  leadId    String
  lead      Lead     @relation(fields: [leadId], references: [id])
  userId    String?  // null = AI-generated
  user      User?    @relation(fields: [userId], references: [id])
  content   String
  createdAt DateTime @default(now())
}

model LeadActivity {
  id        String   @id @default(cuid())
  leadId    String
  lead      Lead     @relation(fields: [leadId], references: [id])
  type      ActivityType
  metadata  Json     // { callId, messageId, etc. }
  createdAt DateTime @default(now())
}

enum LeadSource {
  CALL
  CHAT
  FORM
  MANUAL
  IMPORT
}

enum LeadStatus {
  NEW
  CONTACTED
  QUALIFIED
  PROPOSAL
  CONVERTED
  LOST
}

enum ActivityType {
  CALL_INBOUND
  CALL_OUTBOUND
  SMS_SENT
  SMS_RECEIVED
  EMAIL_SENT
  NOTE_ADDED
  STATUS_CHANGED
  GROUP_CHANGED
  ASSIGNED
}
```

**New file: `packages/backend/src/routes/leads.js`**
```
GET    /api/leads                  → List (filter: status, group, assignee, date, search)
POST   /api/leads                  → Create lead manually
GET    /api/leads/:id              → Detail with notes + activities
PUT    /api/leads/:id              → Update (status, group, assignment, fields)
DELETE /api/leads/:id              → Delete
POST   /api/leads/:id/notes        → Add note
PUT    /api/leads/:id/group        → Move to group (drag-and-drop)
PUT    /api/leads/:id/assign       → Assign to user
POST   /api/leads/bulk-action      → Bulk status change, assign, delete
GET    /api/leads/export           → CSV/JSON export
GET    /api/leads/stats            → Lead count by status, group, source

GET    /api/lead-groups            → List groups
POST   /api/lead-groups            → Create group
PUT    /api/lead-groups/:id        → Update
DELETE /api/lead-groups/:id        → Delete
PUT    /api/lead-groups/reorder    → Drag-and-drop reorder
```

**Auto-create leads from calls (`callAgent.js`):**
```javascript
// In endCall():
const existingLead = await prisma.lead.findFirst({
  where: { tenantId, phone: callerNumber }
});
if (existingLead) {
  await prisma.lead.update({
    where: { id: existingLead.id },
    data: { lastContactedAt: new Date() }
  });
  await prisma.leadActivity.create({ ... });
  await prisma.leadNote.create({
    data: { leadId: existingLead.id, content: aiGeneratedSummary }
  });
} else {
  await prisma.lead.create({
    data: { tenantId, phone: callerNumber, name: callerName, source: 'CALL', ... }
  });
}
```

**New file: `packages/frontend/src/app/dashboard/crm/page.js`**

Views:
- **Board View (Kanban):** Columns = LeadGroups, cards = Leads, drag-and-drop between columns
- **List View:** Sortable table with status badges, source icons, last contact date
- **Lead Detail Drawer:** Click a lead → side drawer with:
  - Contact info (editable)
  - Status dropdown
  - Group assignment
  - Score indicator
  - Activity timeline (calls, SMS, notes, status changes)
  - Notes section (add/view)
  - Linked calls list (click to open call detail)
  - Follow-up date picker
  - Assign to agent dropdown

#### Step 3.2: Lead Qualification (M15)

- Connect to Intake Form Workflows (Phase 2):
  - When an intake workflow fires during a call, collected data auto-populates Lead fields
  - `company` → `Lead.company`, `reason` → `LeadNote`, etc.
- Add scoring rules in `TenantConfig`:
  ```json
  "leadScoringRules": [
    { "field": "source", "value": "CALL", "points": 10 },
    { "field": "hasEmail", "value": true, "points": 20 },
    { "field": "mentionedCompetitor", "value": true, "points": 30 },
    { "field": "requestedPricing", "value": true, "points": 25 }
  ]
  ```
- AI auto-tags leads: hot (score > 70), warm (40-70), cold (< 40)

#### Step 3.3: Knowledge Base Management (M16)

**Schema:**
```prisma
model KnowledgeArticle {
  id        String   @id @default(cuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  title     String
  content   String   @db.Text
  category  String?
  tags      Json?
  sortOrder Int      @default(0)
  isActive  Boolean  @default(true)
  source    String?  // "manual", "scraped:url"
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**New file: `packages/backend/src/routes/knowledge.js`**
```
GET    /api/knowledge              → List articles (filter: category, active, search)
POST   /api/knowledge              → Create article
GET    /api/knowledge/:id          → Get article
PUT    /api/knowledge/:id          → Update
DELETE /api/knowledge/:id          → Delete
PUT    /api/knowledge/reorder      → Drag-and-drop reorder
GET    /api/knowledge/stats        → Page count vs plan limit
POST   /api/knowledge/import-url   → Scrape URL and create articles (Step 3.4)
POST   /api/knowledge/import-file  → Upload PDF/DOC and extract text
```

**Integration with AI (`dialogManager.js`):**
```javascript
// In buildSystemPrompt():
const articles = await prisma.knowledgeArticle.findMany({
  where: { tenantId, isActive: true },
  orderBy: { sortOrder: 'asc' }
});

const knowledgeSection = articles
  .map(a => `## ${a.title}\n${a.content}`)
  .join('\n\n');

systemPrompt += `\n\nKNOWLEDGE BASE:\n${knowledgeSection}`;
```

**Plan limits:** Basic = 10 pages, Professional = 20 pages, Enterprise = 40 pages

**New file: `packages/frontend/src/app/dashboard/knowledge/page.js`**

Features:
- Article list with title, category, last updated, active toggle
- Rich text editor for content (Markdown or WYSIWYG)
- Category management sidebar
- Page count indicator: "8 of 20 pages used"
- "Import from URL" button
- "Upload PDF" button
- Drag-and-drop reorder

#### Step 3.4: Auto Website Scraping (M17)

**New file: `packages/backend/src/services/scraper.js`**
```
WebScraper:
  - scrapeUrl(url, options)
    → Fetch HTML (cheerio or puppeteer)
    → Extract main content (strip nav, footer, scripts, ads)
    → Split into logical sections by headings
    → Return array of { title, content } objects

  - scrapeWebsite(baseUrl, maxPages, maxDepth)
    → Crawl from base URL following internal links
    → Respect robots.txt
    → Rate limit: 1 request/second
    → Return array of pages scraped

  - importToKnowledgeBase(tenantId, scrapedPages)
    → Create KnowledgeArticle records
    → Set source = "scraped:{url}"
    → Return created articles for review
```

**Dependencies:** `cheerio`, `robots-parser`

#### Step 3.5: AI Web Chatbot (M18)

**Schema:**
```prisma
model ChatSession {
  id            String        @id @default(cuid())
  tenantId      String
  tenant        Tenant        @relation(fields: [tenantId], references: [id])
  visitorId     String        // Anonymous or identified
  visitorName   String?
  visitorEmail  String?
  channel       ChatChannel   @default(WEB)
  status        ChatStatus    @default(ACTIVE)
  metadata      Json?         // Page URL, referrer, user agent
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  closedAt      DateTime?

  messages      ChatMessage[]
}

model ChatMessage {
  id        String       @id @default(cuid())
  sessionId String
  session   ChatSession  @relation(fields: [sessionId], references: [id])
  role      ChatRole
  content   String
  metadata  Json?        // { action: "booking_created", bookingId: "..." }
  createdAt DateTime     @default(now())
}

enum ChatChannel {
  WEB
  FACEBOOK
  INSTAGRAM
  SMS
}

enum ChatStatus {
  ACTIVE
  WAITING_AGENT
  AGENT_JOINED
  CLOSED
}

enum ChatRole {
  VISITOR
  AI
  AGENT
}
```

**New file: `packages/backend/src/services/chatAgent.js`**
```
ChatAgent:
  - constructor(tenantId, sessionId)
  - processMessage(message)
    → Load conversation history from ChatMessage
    → Build system prompt (reuses knowledge base + tenant config from dialogManager)
    → Call LLM with chat-specific tool functions:
      • create_booking (same as voice)
      • check_availability (same as voice)
      • collect_lead_info → creates/updates Lead
      • escalate_to_human → changes ChatStatus to WAITING_AGENT
      • send_link → returns clickable link in chat
    → Store AI response as ChatMessage
    → Return response text

  - escalateToHuman(reason)
    → Set session status to WAITING_AGENT
    → Emit WebSocket event 'chat:escalated'
    → Send notification to agents
```

**New file: `packages/backend/src/routes/chat.js`**
```
// Public (no auth — widget-facing):
POST   /api/chat/sessions              → Start new session (visitorId, tenant slug)
POST   /api/chat/sessions/:id/messages → Send message → get AI response
GET    /api/chat/sessions/:id          → Get session + messages

// Authenticated (dashboard-facing):
GET    /api/chat/sessions              → List sessions (filter: status, channel, date)
POST   /api/chat/sessions/:id/agent-message → Agent sends message
PUT    /api/chat/sessions/:id/close    → Close session
PUT    /api/chat/sessions/:id/assign   → Assign to agent
```

**WebSocket events (add to `websocket/index.js`):**
```javascript
// Chat events:
socket.on('chat:join', (sessionId) => { ... });
socket.on('chat:message', ({ sessionId, content }) => { ... });
socket.on('chat:typing', (sessionId) => { ... });

// Server-emitted:
io.to(`chat:${sessionId}`).emit('chat:newMessage', message);
io.to(`tenant:${tenantId}`).emit('chat:escalated', { sessionId, visitorName });
io.to(`tenant:${tenantId}`).emit('chat:newSession', session);
```

**New file: `packages/frontend/public/chatbot.js`**

Embeddable chatbot widget (separate from voice widget):
```javascript
// Usage:
// <script src="https://app.voxreception.com/chatbot.js"
//         data-tenant="acme-dental"
//         data-color="#4F46E5"
//         data-position="bottom-right"
//         data-welcome="Hi! How can I help?">
// </script>

// Features:
// - Floating chat bubble (configurable icon, position, color)
// - Expandable chat window with:
//   - Message history with AI/visitor avatars
//   - Typing indicator
//   - Visitor info form (name, email) — optional before chat starts
//   - Quick reply buttons (if AI suggests them)
//   - File/image sharing stub
//   - "Powered by VoxReception" footer
// - Mobile responsive
// - Cross-origin postMessage API
// - LocalStorage for session persistence
```

**New file: `packages/frontend/src/app/widget/chat/page.js`**
- Iframe page loaded by chatbot.js
- Full chat UI with message bubbles, input, send button
- WebSocket connection for real-time messages

**Widget customization — extend `settings/embed/page.js`:**
- Add a "Chatbot" tab alongside existing "Voice Widget" tab
- Settings: welcome message, color, position, require email, auto-open delay

#### Step 3.6: Chatbot Dashboard (M19)

**New file: `packages/frontend/src/app/dashboard/chats/page.js`**

Features:
- Left sidebar: Session list with visitor name, last message preview, status badge, channel icon
- Main area: Full conversation thread with message bubbles
- Agent can type and send messages (role: AGENT)
- When agent joins, AI stops responding (session status: AGENT_JOINED)
- "Close session" button
- Session info panel: visitor details, page URL, referring site, duration
- Real-time updates via WebSocket
- Filter: Active | Waiting | Closed | All
- Unread count badges

#### Phase 3 Deliverables Checklist

- [ ] CRM Kanban board and list view working
- [ ] Leads auto-created from calls
- [ ] Lead notes, activities, and follow-up tracking working
- [ ] Lead groups with drag-and-drop management
- [ ] Lead qualification scoring applied automatically
- [ ] Knowledge base CRUD with rich text editor
- [ ] Knowledge base injected into AI prompts
- [ ] URL scraper importing pages into knowledge base
- [ ] Chatbot widget embeddable on external sites
- [ ] Chat sessions with real-time AI responses
- [ ] Agent takeover in chat working
- [ ] Chat dashboard with session management

---

### Phase 4 — Analytics, Polish & Missing Basics (Weeks 11–12)

> **Goal:** Build comprehensive analytics, voice library, and fix all stubbed features.
> **Delivers:** M20, M21, M22, M23, M24, M25, M26, M27

#### Step 4.1: Advanced Analytics Dashboard (M20)

**New file: `packages/backend/src/routes/analytics.js`**
```
GET /api/analytics/calls
  → Params: dateFrom, dateTo, groupBy (hour|day|week|month)
  → Returns: call volume over time, avg duration, by status, by intent

GET /api/analytics/busiest-hours
  → Returns: 7-day heatmap (hour × day) of call volume

GET /api/analytics/duration-distribution
  → Returns: frequency histogram of call durations (0-1m, 1-2m, 2-5m, 5-10m, 10m+)

GET /api/analytics/sms
  → Returns: SMS volume over time, by direction

GET /api/analytics/links
  → Returns: Link click data per workflow, over time

GET /api/analytics/leads
  → Returns: Leads by source, status funnel (NEW → QUALIFIED → CONVERTED), over time

GET /api/analytics/chatbot
  → Returns: Chat sessions over time, avg messages, escalation rate
```

**New file: `packages/frontend/src/app/dashboard/analytics/page.js`**

Charts (use `recharts` library):
1. **Call Volume** — Bar chart (daily/weekly/monthly)
2. **Busiest Hours Heatmap** — 7×24 grid colored by call count
3. **Overall Call Logs** — Bar chart by month (long-term trends)
4. **Call Duration Distribution** — Histogram
5. **SMS/Text Volume** — Line chart over time
6. **Link Click Tracking** — Bar chart per link/workflow
7. **Lead Funnel** — Funnel chart (NEW → CONTACTED → QUALIFIED → CONVERTED)
8. **Conversion Metrics** — Calls → Leads → Bookings

Features:
- Date range picker (7d, 30d, 90d, custom)
- Download each chart as SVG, PNG, or CSV
- "Load More" for detailed drill-down
- Responsive grid layout

**Dependencies:** `recharts` (frontend)

#### Step 4.2: Call & Lead Export (M21)

**Add to `routes/calls.js`:**
```
GET /api/calls/export
  → Params: format (csv|json), dateFrom, dateTo, status, intent
  → Returns: Downloadable file with: callId, callerName, callerPhone,
             callerEmail, date, duration, status, intent, summary
  → Headers: Content-Disposition: attachment; filename="calls-export.csv"
```

**Add to `routes/leads.js`:**
```
GET /api/leads/export
  → Params: format (csv|json), status, group, dateFrom, dateTo
  → Returns: Downloadable file with: name, email, phone, company,
             status, group, score, source, createdAt, lastContactedAt
```

Wire up existing export button stub in `app/dashboard/calls/page.js`.

#### Step 4.3: Voice Library UI (M22)

**Add to `routes/tenants.js` or new `routes/voices.js`:**
```
GET /api/voices
  → Params: provider (elevenlabs|google|polly)
  → Returns: List of { voiceId, name, language, gender, previewUrl, provider }
  → Calls getVoices() on configured TTS adapter

POST /api/voices/preview
  → Params: voiceId, provider, text
  → Returns: Audio stream (short TTS sample)
```

**New file: `packages/frontend/src/app/dashboard/settings/voices/page.js`**

Features:
- Grid of voice cards: name, gender icon, language flag, provider badge
- Play button on each card → plays short preview
- Search/filter by language, gender, provider
- "Select" button → updates tenant voice config
- Currently selected voice highlighted
- Count: "100+ premium voices available"

#### Step 4.4: Pronunciation Guides (M23)

**Schema change (add to TenantConfig):**
```prisma
model TenantConfig {
  // ... existing
  pronunciationGuides  Json?  // [{ word: "Acme", pronunciation: "AK-mee" }, ...]
}
```

**Integration in `dialogManager.js`:**
```javascript
// Add to system prompt:
const guides = tenantConfig.pronunciationGuides || [];
if (guides.length > 0) {
  systemPrompt += '\n\nPRONUNCIATION GUIDE:\n';
  guides.forEach(g => {
    systemPrompt += `- "${g.word}" is pronounced "${g.pronunciation}"\n`;
  });
}
```

**Integration in `tts.js` (Google adapter with SSML):**
```javascript
// Replace words with SSML phoneme tags before synthesis:
guides.forEach(g => {
  text = text.replace(
    new RegExp(g.word, 'gi'),
    `<phoneme alphabet="ipa" ph="${g.phonetic}">${g.word}</phoneme>`
  );
});
```

**UI:** Add "Pronunciation Guide" section in `settings/page.js` — table with add/edit/delete rows.

#### Step 4.5: Extension Digits (M24)

**Schema change (add to TenantConfig):**
```prisma
model TenantConfig {
  // ... existing
  extensions  Json?  // [{ digit: "1", label: "Sales", targetNumber: "+155..." }, ...]
}
```

**Implementation:**
- On call start, AI greeting includes: "Press 1 for Sales, 2 for Support, or stay on the line for general assistance."
- Twilio `<Gather>` captures DTMF input → routes accordingly
- If using LiveKit directly: detect DTMF via audio analysis or add IVR menu before AI takes over

**UI:** Add "Extension Digits" section in `settings/page.js` — digit, label, target mapping table.

#### Step 4.6: Max Minutes Cap (M25)

**Schema change (add to TenantConfig):**
```prisma
model TenantConfig {
  // ... existing
  maxMinutesPerMonth  Int?     // null = plan default
  minuteAlertAt       Int?     // Alert at this percentage (e.g., 80)
}
```

**Implementation:**
- Before starting a call, check current month's usage vs cap:
  ```javascript
  const used = await getMonthlyMinutes(tenantId);
  const cap = tenantConfig.maxMinutesPerMonth || planLimits.maxMinutes;
  if (used >= cap) {
    // Reject call or play "minutes exceeded" message
  }
  ```
- Email alerts at 80% and 100% via scheduled job
- Show in billing dashboard: "180 of 200 minutes used" with progress bar

#### Step 4.7: Forgot Password Flow (M26)

**Add to `routes/auth.js`:**
```
POST /api/auth/forgot-password
  → Input: email
  → Generate reset token (uuid, expires in 1 hour)
  → Store in Token model (type: 'password_reset')
  → Send email with reset link: /reset-password?token=xxx
  → Always return 200 (don't reveal if email exists)

POST /api/auth/reset-password
  → Input: token, newPassword
  → Validate token (exists, not expired, not used)
  → Update user password (bcrypt)
  → Invalidate token
  → Return success
```

**New files:**
- `packages/frontend/src/app/forgot-password/page.js` — Email input form
- `packages/frontend/src/app/reset-password/page.js` — New password form (reads token from URL)

**Email template (add to `services/email.js`):**
- Subject: "Reset your VoxReception password"
- HTML body with reset link button, expiry notice

#### Step 4.8: Free Trial System (M27)

**Schema change:**
```prisma
model Tenant {
  // ... existing
  trialEndsAt    DateTime?
  trialCredits   Int?        @default(10)
  trialUsed      Int?        @default(0)
}
```

**Implementation:**
- On registration: set `trialEndsAt = now + 7 days`, `trialCredits = 10`
- Before each call: check if trial active AND credits remaining
- After each call: increment `trialUsed`
- Trial expired OR credits exhausted → show upgrade banner, block new calls
- Dashboard banner: "Trial: 3 credits remaining | 5 days left | Upgrade now"
- Post-trial: require Stripe subscription to continue

#### Phase 4 Deliverables Checklist

- [ ] Analytics dashboard with 8 chart types
- [ ] Date range filtering on all analytics
- [ ] Chart download (SVG/PNG/CSV)
- [ ] Call export endpoint working + UI wired
- [ ] Lead export endpoint working
- [ ] Voice library browse/preview page
- [ ] Pronunciation guide CRUD + SSML integration
- [ ] Extension digits configuration + DTMF routing
- [ ] Max minutes cap with email alerts
- [ ] Forgot/reset password flow complete (frontend + backend + email)
- [ ] Free trial with credit deduction + upgrade gate

---

### Phase 5 — Integrations, White-Label & Enterprise (Weeks 13–16)

> **Goal:** Expand integrations ecosystem, build white-label platform, add enterprise features.
> **Delivers:** M28, M29, M30, M31, M32, M33, M34, M35, M36, M37

#### Step 5.1: Zapier Integration (M28)

**New file: `packages/backend/src/routes/zapier.js`**

Implement Zapier REST Hooks pattern:
```
// Triggers (Zapier subscribes to):
POST /api/zapier/hooks         → Subscribe to events
DELETE /api/zapier/hooks/:id   → Unsubscribe

// Sample data for Zapier:
GET /api/zapier/samples/call      → Sample call object
GET /api/zapier/samples/booking   → Sample booking object
GET /api/zapier/samples/lead      → Sample lead object

// Actions (Zapier calls):
POST /api/zapier/actions/create-booking  → Create booking
POST /api/zapier/actions/update-lead     → Update lead status
POST /api/zapier/actions/send-sms        → Send SMS
```

**Schema:**
```prisma
model ZapierHook {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  event       String   // "call.completed", "booking.created", "lead.created"
  targetUrl   String   // Zapier's webhook URL
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
}
```

**Event dispatcher (add to relevant services):**
```javascript
// After call completes, booking created, lead created, etc.:
await zapierService.dispatchEvent(tenantId, 'call.completed', callData);
// → POSTs to all active hooks for that event
```

#### Step 5.2: CRM Integrations (M29)

**New file: `packages/backend/src/services/crmSync.js`**
```
CRMSyncService:
  - abstract methods:
    • connect(credentials)
    • syncLead(lead) → create/update in external CRM
    • syncCall(call) → log activity
    • syncBooking(booking) → create event/deal
    • disconnect()

HubSpotAdapter extends CRMSyncService:
  - OAuth2 flow (client_id, client_secret, redirect_uri)
  - Create/update contacts via HubSpot API v3
  - Create deals from qualified leads
  - Log call activities as engagements
  - Store access/refresh tokens in IntegrationConfig

SalesforceAdapter extends CRMSyncService:
  - OAuth2 flow
  - Create/update Leads and Contacts
  - Create Opportunities from qualified leads
  - Log calls as Tasks

PipedriveAdapter extends CRMSyncService:
  - API key or OAuth2
  - Create/update Persons
  - Create Deals
  - Log Activities
```

**Schema:**
```prisma
model IntegrationConfig {
  id            String   @id @default(cuid())
  tenantId      String
  tenant        Tenant   @relation(fields: [tenantId], references: [id])
  provider      String   // "hubspot", "salesforce", "pipedrive", "slack", "outlook"
  accessToken   String?  @db.Text
  refreshToken  String?  @db.Text
  expiresAt     DateTime?
  config        Json?    // Provider-specific settings
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([tenantId, provider])
}
```

**Add to `routes/integrations.js`:**
```
// HubSpot:
GET  /api/integrations/hubspot/auth-url    → Generate OAuth URL
GET  /api/integrations/hubspot/callback    → Handle OAuth callback
POST /api/integrations/hubspot/sync        → Manual sync trigger
DELETE /api/integrations/hubspot/disconnect → Remove connection

// Same pattern for Salesforce, Pipedrive
```

**Auto-sync hooks:** After lead/call/booking created → check if CRM integration active → sync.

**UI:** Replace "Coming Soon" badges in `app/dashboard/integrations/page.js` with connect buttons and status indicators.

#### Step 5.3: Outbound Calling (M30)

**Add to `routes/calls.js`:**
```
POST /api/calls/outbound
  → Input: { toNumber, leadId?, script?, prompt?, scheduledAt? }
  → Creates outbound call via Twilio to toNumber
  → Connects to LiveKit room with AI agent
  → AI uses provided script/prompt for the conversation
  → Call data linked to Lead if leadId provided
```

**Use cases:**
- Appointment reminders ("Your appointment is tomorrow at 2PM. Would you like to confirm or reschedule?")
- Lead follow-up ("Hi, this is VoxReception calling on behalf of Acme Dental. I wanted to follow up on your inquiry.")
- Survey/feedback (post-visit feedback collection)

**UI elements:**
- "Make Call" button on Lead detail page
- Outbound call modal: select number, choose script template, or enter custom prompt
- Outbound calls visible in calls list with "Outbound" badge
- Schedule outbound calls for future (cron job)

#### Step 5.4: Multi-Channel Chatbot (M31)

**New files:**
- `packages/backend/src/services/channels/facebook.js`
- `packages/backend/src/services/channels/instagram.js`

**Facebook Messenger:**
```
services/channels/facebook.js:
  - verifyWebhook(req) → Facebook webhook verification
  - handleMessage(payload) → Extract message → route to ChatAgent
  - sendMessage(recipientId, message) → Facebook Send API
  - setupPageSubscription(pageAccessToken)

routes/webhooks.js (add):
  GET  /api/webhooks/facebook  → Verification challenge
  POST /api/webhooks/facebook  → Incoming messages
```

**Instagram:**
```
services/channels/instagram.js:
  - Same pattern as Facebook (uses same Graph API)
  - handleMessage(payload) → route to ChatAgent with channel: INSTAGRAM
  - sendMessage(recipientId, message) → Instagram Messaging API
```

**Channel router:** All channels funnel through `chatAgent.processMessage()` — same AI brain, same knowledge base, same function calling.

#### Step 5.5: White-Label / Reseller Program (M32, M33, M34, M35)

**Schema:**
```prisma
model Reseller {
  id              String   @id @default(cuid())
  name            String
  email           String   @unique
  domain          String?  @unique  // custom domain
  logo            String?
  primaryColor    String?  @default("#4F46E5")
  secondaryColor  String?
  companyName     String?
  stripeAccountId String?  // Stripe Connect account
  plan            ResellerPlan @default(STANDARD)
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  tenants         Tenant[]
  customPlans     ResellerPlan[]
}

model ResellerCustomPlan {
  id          String   @id @default(cuid())
  resellerId  String
  reseller    Reseller @relation(fields: [resellerId], references: [id])
  name        String
  price       Int      // cents
  interval    String   // "month" or "year"
  features    Json     // Feature flags for this plan
  limits      Json     // { maxMinutes, maxCalls, etc. }
  stripePriceId String?
  createdAt   DateTime @default(now())
}

enum ResellerPlan {
  STANDARD
  PROFESSIONAL
  ENTERPRISE
}

// Add to Tenant:
model Tenant {
  // ... existing
  resellerId  String?
  reseller    Reseller? @relation(fields: [resellerId], references: [id])
}
```

**New file: `packages/backend/src/routes/reseller.js`**
```
// Reseller registration & management:
POST   /api/reseller/register         → Apply as reseller
GET    /api/reseller/me               → Get reseller profile
PUT    /api/reseller/me               → Update branding (logo, colors, domain)

// Client management:
GET    /api/reseller/clients          → List all client tenants
POST   /api/reseller/clients          → Create client tenant
GET    /api/reseller/clients/:id      → Client detail with stats
PUT    /api/reseller/clients/:id      → Update client config
DELETE /api/reseller/clients/:id      → Remove client

// Feature gating (M34):
GET    /api/reseller/clients/:id/features  → Get feature toggles
PUT    /api/reseller/clients/:id/features  → Update feature toggles

// Custom plans:
GET    /api/reseller/plans            → List custom plans
POST   /api/reseller/plans            → Create plan
PUT    /api/reseller/plans/:id        → Update plan
DELETE /api/reseller/plans/:id        → Delete plan

// Billing (M33):
POST   /api/reseller/stripe-connect   → Initiate Stripe Connect onboarding
GET    /api/reseller/billing          → Revenue dashboard
GET    /api/reseller/billing/payouts  → Payout history
```

**Custom domain routing (`next.config.js`):**
```javascript
// Middleware detects domain → loads reseller branding
// Reseller's domain → shows their logo, colors, company name
// Default domain → shows VoxReception branding
```

**Feature Gating middleware (M34):**
```javascript
// middleware/featureGate.js:
function requireFeature(featureName) {
  return (req, res, next) => {
    const features = req.tenant.enabledFeatures || [];
    const planFeatures = getPlanFeatures(req.tenant.plan);
    if (!features.includes(featureName) && !planFeatures.includes(featureName)) {
      return res.status(403).json({ error: `Feature '${featureName}' not available` });
    }
    next();
  };
}

// Usage:
router.post('/api/workflows', requireFeature('workflows'), createWorkflow);
router.get('/api/analytics', requireFeature('advanced_analytics'), getAnalytics);
```

**New files (frontend):**
- `packages/frontend/src/app/reseller/page.js` — Reseller dashboard (client list, stats)
- `packages/frontend/src/app/reseller/clients/[id]/page.js` — Client detail
- `packages/frontend/src/app/reseller/branding/page.js` — Logo/color/domain config
- `packages/frontend/src/app/reseller/billing/page.js` — Revenue dashboard

#### Step 5.6: SSO/SAML (M36)

**Implementation:**
- Add `passport-saml` dependency
- New route: `POST /api/auth/saml/callback` for SAML assertion consumption
- New route: `GET /api/auth/saml/login/:tenantId` for SAML login initiation
- Add to TenantConfig:
  ```prisma
  model TenantConfig {
    // ... existing
    samlEnabled    Boolean @default(false)
    samlEntryPoint String? // IdP SSO URL
    samlCert       String? @db.Text // IdP certificate
    samlIssuer     String? // Service Provider entity ID
  }
  ```
- Enterprise settings UI: SAML configuration form (entry point, certificate, issuer)
- Auto-provision users on first SAML login

#### Step 5.7: Affiliate Program (M37)

**Schema:**
```prisma
model Affiliate {
  id             String   @id @default(cuid())
  userId         String   @unique
  user           User     @relation(fields: [userId], references: [id])
  code           String   @unique // Referral code
  commissionRate Float    @default(0.20) // 20%
  totalEarnings  Float    @default(0)
  pendingPayout  Float    @default(0)
  createdAt      DateTime @default(now())

  referrals      AffiliateReferral[]
}

model AffiliateReferral {
  id          String   @id @default(cuid())
  affiliateId String
  affiliate   Affiliate @relation(fields: [affiliateId], references: [id])
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  status      String   @default("pending") // pending, converted, paid
  commission  Float    @default(0)
  createdAt   DateTime @default(now())
}
```

**Routes:**
```
POST /api/affiliate/register       → Register as affiliate
GET  /api/affiliate/me             → Dashboard (earnings, referrals, code)
GET  /api/affiliate/referrals      → List referrals with status
GET  /api/affiliate/payouts        → Payout history
```

**Registration flow:**
- `?ref=CODE` query parameter on registration page → stored in cookie
- On successful paid subscription, create `AffiliateReferral` + calculate commission
- Monthly payout via Stripe Transfer

**New file: `packages/frontend/src/app/affiliate/page.js`**
- Referral link and code display
- Earnings summary
- Referral list with statuses
- Payout history

#### Phase 5 Deliverables Checklist

- [ ] Zapier REST Hooks working (subscribe, trigger on events)
- [ ] HubSpot OAuth + contact/deal sync
- [ ] Salesforce OAuth + lead/activity sync
- [ ] Pipedrive integration
- [ ] Outbound calling via Twilio + AI agent
- [ ] Facebook Messenger integration
- [ ] Instagram messaging integration
- [ ] Reseller registration + portal
- [ ] White-label branding (logo, colors, domain)
- [ ] Stripe Connect rebilling for resellers
- [ ] Feature gating per tenant
- [ ] SAML SSO for enterprise
- [ ] Affiliate program with referral tracking

---

## 5. Database Schema Changes

### Summary of New Models

| Model | Phase | Description |
|-------|-------|-------------|
| `PhoneNumber` | 1 | Twilio phone numbers per tenant |
| `Message` | 1 | SMS/text messages (in/outbound) |
| `Workflow` | 2 | Texting, transfer, API, intake workflow configs |
| `IntakeResponse` | 2 | Captured intake form data |
| `LinkClick` | 2 | Link tracking data |
| `NotificationConfig` | 2 | Post-call notification rules |
| `Lead` | 3 | CRM leads |
| `LeadGroup` | 3 | Custom lead groups |
| `LeadNote` | 3 | Notes on leads |
| `LeadActivity` | 3 | Lead activity log |
| `KnowledgeArticle` | 3 | Knowledge base articles |
| `ChatSession` | 3 | Web chatbot sessions |
| `ChatMessage` | 3 | Chatbot messages |
| `IntegrationConfig` | 5 | OAuth tokens for CRM integrations |
| `ZapierHook` | 5 | Zapier webhook subscriptions |
| `Reseller` | 5 | White-label resellers |
| `ResellerCustomPlan` | 5 | Reseller-created plans |
| `Affiliate` | 5 | Affiliate program members |
| `AffiliateReferral` | 5 | Affiliate referral tracking |

### Schema Fields Added to Existing Models

| Model | Field(s) | Phase |
|-------|----------|-------|
| `Tenant` | `slug`, `resellerId`, `trialEndsAt`, `trialCredits`, `trialUsed` | 1, 4, 5 |
| `TenantConfig` | `webhookUrl`, `webhookSecret`, `webhookEvents`, `pronunciationGuides`, `extensions`, `maxMinutesPerMonth`, `minuteAlertAt`, `samlEnabled`, `samlEntryPoint`, `samlCert`, `samlIssuer`, `enabledFeatures` | 2, 4, 5 |
| `Call` | `leadId` (FK to Lead) | 3 |

### Enums Added

| Enum | Values | Phase |
|------|--------|-------|
| `MessageDirection` | INBOUND, OUTBOUND | 1 |
| `MessageStatus` | QUEUED, SENT, DELIVERED, FAILED, RECEIVED | 1 |
| `WorkflowType` | TEXTING, TRANSFER, API, INTAKE | 2 |
| `NotificationType` | EMAIL, SMS, WEBHOOK, SLACK | 2 |
| `LeadSource` | CALL, CHAT, FORM, MANUAL, IMPORT | 3 |
| `LeadStatus` | NEW, CONTACTED, QUALIFIED, PROPOSAL, CONVERTED, LOST | 3 |
| `ActivityType` | CALL_INBOUND, CALL_OUTBOUND, SMS_SENT, SMS_RECEIVED, EMAIL_SENT, NOTE_ADDED, STATUS_CHANGED, GROUP_CHANGED, ASSIGNED | 3 |
| `ChatChannel` | WEB, FACEBOOK, INSTAGRAM, SMS | 3 |
| `ChatStatus` | ACTIVE, WAITING_AGENT, AGENT_JOINED, CLOSED | 3 |
| `ChatRole` | VISITOR, AI, AGENT | 3 |
| `ResellerPlan` | STANDARD, PROFESSIONAL, ENTERPRISE | 5 |

---

## 6. New Files To Create

### Backend — Services (10 new files)

| File | Phase | Purpose |
|------|-------|---------|
| `services/twilio.js` | 1 | Twilio SDK wrapper (numbers, SMS, calls) |
| `services/workflowEngine.js` | 2 | Workflow evaluation and execution |
| `services/notifications.js` | 2 | Post-call notification dispatcher |
| `services/scraper.js` | 3 | Website URL scraper |
| `services/chatAgent.js` | 3 | Text-based chatbot AI agent |
| `services/crmSync.js` | 5 | CRM sync adapter (HubSpot, Salesforce, Pipedrive) |
| `services/channels/facebook.js` | 5 | Facebook Messenger integration |
| `services/channels/instagram.js` | 5 | Instagram messaging integration |
| `services/zapier.js` | 5 | Zapier REST Hooks dispatcher |
| `services/affiliate.js` | 5 | Affiliate commission tracking |

### Backend — Routes (8 new files)

| File | Phase | Purpose |
|------|-------|---------|
| `routes/phoneNumbers.js` | 1 | Phone number management API |
| `routes/messages.js` | 1 | SMS/text messaging API |
| `routes/workflows.js` | 2 | Workflow CRUD API |
| `routes/leads.js` | 3 | CRM leads API |
| `routes/knowledge.js` | 3 | Knowledge base API |
| `routes/chat.js` | 3 | Chatbot sessions API |
| `routes/analytics.js` | 4 | Analytics data API |
| `routes/reseller.js` | 5 | Reseller portal API |
| `routes/zapier.js` | 5 | Zapier integration API |
| `routes/affiliate.js` | 5 | Affiliate program API |

### Backend — Middleware (1 new file)

| File | Phase | Purpose |
|------|-------|---------|
| `middleware/featureGate.js` | 5 | Feature gating per tenant/plan |

### Frontend — Pages (14 new pages)

| File | Phase | Purpose |
|------|-------|---------|
| `app/dashboard/settings/phone/page.js` | 1 | Phone number management |
| `app/dashboard/messages/page.js` | 1 | SMS inbox/threads |
| `app/call/[slug]/page.js` | 1 | Public shareable call page |
| `app/dashboard/workflows/page.js` | 2 | Workflow management |
| `app/dashboard/crm/page.js` | 3 | CRM Kanban + list |
| `app/dashboard/knowledge/page.js` | 3 | Knowledge base editor |
| `app/dashboard/chats/page.js` | 3 | Chatbot session management |
| `app/widget/chat/page.js` | 3 | Chatbot iframe page |
| `app/dashboard/analytics/page.js` | 4 | Analytics dashboard |
| `app/dashboard/settings/voices/page.js` | 4 | Voice library browser |
| `app/forgot-password/page.js` | 4 | Forgot password form |
| `app/reset-password/page.js` | 4 | Reset password form |
| `app/reseller/page.js` | 5 | Reseller portal |
| `app/affiliate/page.js` | 5 | Affiliate dashboard |

### Frontend — Public Assets (1 new file)

| File | Phase | Purpose |
|------|-------|---------|
| `public/chatbot.js` | 3 | Embeddable chatbot widget script |

---

## 7. Testing & Verification

### Per-Phase Testing

#### Phase 1 Tests
- [ ] Provision a Twilio number via API → number appears in dashboard
- [ ] Make inbound call to provisioned number → routed to LiveKit AI agent
- [ ] AI sends SMS mid-call via function calling → SMS received on caller's phone
- [ ] View SMS thread in dashboard → shows both directions
- [ ] Start 3 simultaneous calls on Basic plan → all connect
- [ ] Start 4th call on Basic plan → rejected with limit message
- [ ] Open `/call/acme-dental` → public branded call page loads → widget works

#### Phase 2 Tests
- [ ] Create a texting workflow → make call that triggers it → SMS sent with tracked link
- [ ] Click tracked link → redirect works → click recorded in analytics
- [ ] Create a transfer workflow → trigger scenario → call transferred to external number
- [ ] Create an API workflow → questions asked → API called → response used in conversation
- [ ] Create an intake workflow → questions asked → responses stored → webhook fires
- [ ] Configure post-call email notification → make call → email received
- [ ] Configure post-call webhook → make call → webhook receives signed payload
- [ ] Test auto hangup → AI detects goodbye → politely hangs up after closing

#### Phase 3 Tests
- [ ] Make a call → Lead auto-created in CRM → visible in Kanban board
- [ ] Drag lead between groups → lead status updates
- [ ] Add note to lead → appears in activity timeline
- [ ] Create knowledge article → make call → AI uses knowledge in responses
- [ ] Import from URL → articles created from scraped content
- [ ] Embed chatbot on test page → chat with AI → leads captured
- [ ] Chat escalation → agent notified → agent joins → agent sends messages
- [ ] Chat dashboard shows all sessions with real-time updates

#### Phase 4 Tests
- [ ] Analytics page loads with all 8 chart types populated
- [ ] Date range filter changes all chart data accordingly
- [ ] Download chart as CSV → valid data
- [ ] Export calls as CSV → file downloads with correct data
- [ ] Voice library → browse voices → play preview → select voice → saved
- [ ] Add pronunciation guide → make call → AI pronounces correctly
- [ ] Configure extension digits → caller presses 1 → routed to sales number
- [ ] Set max minutes to 5 → use 5 minutes → next call blocked → alert email sent
- [ ] Forgot password → enter email → receive reset email → click link → set new password
- [ ] New registration → trial active → use 10 credits → trial exceeded → upgrade required

#### Phase 5 Tests
- [ ] Create Zapier trigger subscription → make call → Zapier receives webhook
- [ ] Connect HubSpot → make call → contact created in HubSpot
- [ ] Connect Salesforce → create booking → task logged in Salesforce
- [ ] Initiate outbound call → AI calls number → conversation using provided script
- [ ] Connect Facebook page → receive Messenger message → AI responds
- [ ] Register as reseller → create client → client sees reseller branding
- [ ] Reseller Stripe Connect → bill client → reseller receives payout
- [ ] Toggle feature off for client → client gets 403 on that feature
- [ ] Configure SAML SSO → login via IdP → user provisioned in VoxReception
- [ ] Register as affiliate → share referral link → referral signs up + pays → commission tracked

### Automated Testing Strategy

| Test Type | Scope | Tool |
|-----------|-------|------|
| Unit tests | Services (workflowEngine, chatAgent, scraper, notifications) | Jest |
| API tests | All new routes | Supertest + Jest |
| Integration tests | Twilio ↔ LiveKit ↔ AI pipeline | Jest + Twilio test credentials |
| E2E tests | Critical flows (call→SMS→lead→notification) | Playwright |
| Load tests | Parallel calls, concurrent chat sessions | k6 or Artillery |

---

## 8. Risks & Dependencies

### External Dependencies

| Dependency | Phase | Risk | Mitigation |
|------------|-------|------|------------|
| **Twilio** | 1 | API changes, pricing, outages | Abstract behind service layer, error handling |
| **Stripe Connect** | 5 | Complex onboarding flow | Thorough testing, manual fallback |
| **Facebook/Instagram Graph API** | 5 | Strict review process, API versioning | Apply early for app review, version lock |
| **HubSpot/Salesforce APIs** | 5 | OAuth complexity, rate limits | Token refresh, queue sync operations |
| **LLM costs** | All | Increased LLM calls for workflow evaluation | Cache workflow evaluations, batch where possible |

### Technical Risks

| Risk | Phase | Impact | Mitigation |
|------|-------|--------|------------|
| Twilio-LiveKit bridge latency | 1 | Call quality degradation | Use Twilio SIP trunking to LiveKit, not media proxying |
| Workflow evaluation adds latency to calls | 2 | Slower AI response time | Evaluate workflows in parallel with TTS, cache results |
| Knowledge base too large for LLM context | 3 | Token limit exceeded | Chunk articles, use embedding similarity to select relevant articles only |
| Website scraper blocked by target sites | 3 | Scraping fails | Fallback to manual content entry, use headless browser for JS-rendered sites |
| Chat + Voice concurrent load | 3 | Server resource exhaustion | Separate chat and voice processing, horizontal scaling |
| White-label domain routing | 5 | DNS/SSL complexity | Use wildcard SSL + CNAME instructions for resellers |

### NPM Packages to Add

| Package | Phase | Purpose |
|---------|-------|---------|
| `twilio` | 1 | Twilio SDK for SMS/voice/numbers |
| `cheerio` | 3 | HTML parsing for web scraping |
| `jsonpath-plus` | 2 | JSON path extraction for API workflows |
| `recharts` | 4 | Chart library for analytics dashboard |
| `passport-saml` | 5 | SAML SSO authentication |
| `stripe` (Stripe Connect additions) | 5 | Reseller billing |

---

## Appendix: Feature Mapping (Competitor → VoxReception)

Quick reference for which competitor feature maps to which implementation task.

| Competitor Feature | Status | VoxReception Implementation |
|-------------------|--------|----------------------------|
| C1 Texting Workflows | ❌ Missing | M6 → Phase 2 |
| C2 Call Transferring | ❌ Missing | M7 → Phase 2 |
| C3 API Workflows | ❌ Missing | M8 → Phase 2 |
| C4 Intake Forms | ❌ Missing | M9 → Phase 2 |
| C5 Autopilot CRM | ❌ Missing | M14 → Phase 3 |
| C6 Knowledge Base | ❌ Missing | M16 → Phase 3 |
| C7 Auto Scraping | ❌ Missing | M17 → Phase 3 |
| C8 Analytics Tab | ⚠️ Basic | M20 → Phase 4 |
| C9 Post-Call Notifications | ❌ Missing | M11 → Phase 2 |
| C10 Smart Notifications | ❌ Missing | M11 → Phase 2 |
| C11 Phone Provisioning | ❌ Missing | M2 → Phase 1 |
| C12 Area Code Selection | ❌ Missing | M3 → Phase 1 |
| C13 Link Tracking | ❌ Missing | M10 → Phase 2 |
| C14 SMS Engine | ❌ Missing | M1 → Phase 1 |
| C15 Shareable Links | ❌ Missing | M5 → Phase 1 |
| C16 Parallel Calls | ❌ Missing | M4 → Phase 1 |
| C17 100+ Voices | ⚠️ Has providers, no browse UI | M22 → Phase 4 |
| C18 Premium AI Models | ✅ Have (GPT + Gemini) | — |
| C19 Ultra-Fast Response | ✅ Have (real-time pipeline) | — |
| C20 Included Minutes | ✅ Have (plan limits) | — |
| C21 AI Voicemail | ⚠️ Partial (leave_message) | Enhance in Phase 2 |
| C22 Max Call Duration | ✅ Have | — |
| C23 Call Recordings | ✅ Have | — |
| C24 Auto Hangup | ❌ Missing | M13 → Phase 2 |
| C25 Multi-Language | ⚠️ Partial (5 languages) | Expand with knowledge base |
| C26 Business Hours | ✅ Have | — |
| C27 Extension Digits | ❌ Missing | M24 → Phase 4 |
| C28 Pronunciation Guides | ❌ Missing | M23 → Phase 4 |
| C29 Max Minutes Cap | ❌ Missing | M25 → Phase 4 |
| C30 Post-Call Webhooks | ❌ Missing | M12 → Phase 2 |
| C31 Phone Booking | ✅ Have (Google Calendar) | — |
| C32 Voice Channel | ✅ Have | — |
| C33 Text/SMS Channel | ❌ Missing | M1 → Phase 1 |
| C34 Website Widget | ✅ Have | — |
| C35 AI Web Chatbot | ❌ Missing | M18 → Phase 3 |
| C36 White-Label | ❌ Missing | M32 → Phase 5 |
| C37 Custom Domain | ❌ Missing | M32 → Phase 5 |
| C38 Stripe Rebilling | ❌ Missing | M33 → Phase 5 |
| C39 Feature Gating | ❌ Missing | M34 → Phase 5 |
| C40 Reseller Portal | ❌ Missing | M35 → Phase 5 |
| C41 Google Calendar | ✅ Have | — |
| C42 Zapier (6000+) | ❌ Missing | M28 → Phase 5 |
| C43 CRM Sync | ❌ Missing | M29 → Phase 5 |
| C44 Outbound Calling | ❌ Missing | M30 → Phase 5 |
| C45 Tiered Pricing | ✅ Have | — |
| C46 Free Trial | ❌ Missing | M27 → Phase 4 |
| C47 Affiliate Program | ❌ Missing | M37 → Phase 5 |
| C48 SSO/SAML | ❌ Missing | M36 → Phase 5 |
| C49 Lead Qualification | ❌ Missing | M15 → Phase 3 |
| C50 Dedicated Account Rep | N/A (operational) | — |

---

> **Last updated:** February 8, 2026
> **Next review:** End of Phase 1 (Week 3)
