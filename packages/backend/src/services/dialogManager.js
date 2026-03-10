/**
 * LLM/Dialog Manager Service
 * AI-powered conversation management with function calling
 */

import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../config/index.js';
import { logger, createLogger } from '../lib/logger.js';
import { llmRequestsTotal, llmLatency } from '../lib/metrics.js';
import { getFAQsForPrompt, buildKnowledgeContext } from './knowledgeBase.js';

const log = createLogger('llm');

/**
 * Function definitions for the AI receptionist
 */
const RECEPTIONIST_FUNCTIONS = [
  {
    name: 'create_booking',
    description: 'Create a new appointment booking for the caller',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title or reason for the appointment',
        },
        date: {
          type: 'string',
          description: 'Date of the appointment (ISO format or natural language like "tomorrow", "next Monday")',
        },
        time: {
          type: 'string',
          description: 'Time of the appointment (e.g., "10:00 AM", "14:30")',
        },
        duration: {
          type: 'integer',
          description: 'Duration in minutes (default 30)',
          default: 30,
        },
        contactName: {
          type: 'string',
          description: "Caller's name",
        },
        contactEmail: {
          type: 'string',
          description: "Caller's email address (optional)",
        },
        contactPhone: {
          type: 'string',
          description: "Caller's phone number (optional)",
        },
      },
      required: ['title', 'date', 'time', 'contactName'],
    },
  },
  {
    name: 'cancel_booking',
    description: 'Cancel an existing booking',
    parameters: {
      type: 'object',
      properties: {
        bookingReference: {
          type: 'string',
          description: 'Booking reference number or identifier',
        },
        reason: {
          type: 'string',
          description: 'Reason for cancellation',
        },
      },
      required: ['bookingReference'],
    },
  },
  {
    name: 'check_availability',
    description: 'Check available appointment slots',
    parameters: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Date to check availability for',
        },
        preferredTime: {
          type: 'string',
          description: 'Preferred time range (e.g., "morning", "afternoon", "2pm")',
        },
      },
      required: ['date'],
    },
  },
  {
    name: 'transfer_to_agent',
    description: 'Transfer the call to a human agent',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Reason for transfer',
        },
        department: {
          type: 'string',
          description: 'Department to transfer to (e.g., "sales", "support", "billing")',
        },
        urgency: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Urgency level',
        },
      },
      required: ['reason'],
    },
  },
  {
    name: 'get_business_info',
    description: 'Get information about the business (hours, location, services)',
    parameters: {
      type: 'object',
      properties: {
        infoType: {
          type: 'string',
          enum: ['hours', 'location', 'services', 'contact', 'general'],
          description: 'Type of information requested',
        },
      },
      required: ['infoType'],
    },
  },
  {
    name: 'leave_message',
    description: 'Take a message for the business',
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The message content',
        },
        callerName: {
          type: 'string',
          description: "Caller's name",
        },
        callbackNumber: {
          type: 'string',
          description: 'Phone number for callback',
        },
        urgency: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
        },
      },
      required: ['message', 'callerName'],
    },
  },
  {
    name: 'send_text_message',
    description: 'Send a text message (SMS) to the caller or a specified phone number. Use this when the caller asks for information to be texted to them, such as directions, links, confirmation details, or any written information.',
    parameters: {
      type: 'object',
      properties: {
        phoneNumber: {
          type: 'string',
          description: "Recipient's phone number in E.164 format (e.g., +15551234567). Use the caller's phone number if available.",
        },
        message: {
          type: 'string',
          description: 'The text message content to send',
        },
        context: {
          type: 'string',
          enum: ['confirmation', 'directions', 'link', 'info', 'followup'],
          description: 'The context/purpose of the text message',
        },
      },
      required: ['phoneNumber', 'message'],
    },
  },
];

/**
 * Dialog Manager using OpenAI or Gemini
 */
export class DialogManager {
  constructor(options = {}) {
    this.client = null;
    this.chat = null; // For Gemini chat session
    this.provider = options.provider || 'gemini'; // Default to Gemini
    this.model = options.model || (this.provider === 'gemini' ? 'gemini-2.0-flash' : 'gpt-3.5-turbo');
    this.systemPrompt = options.systemPrompt || null;
    this.tenantConfig = options.tenantConfig || {};
    this.tenantId = options.tenantId || null;
    this.faqContext = ''; // Cached FAQ context for system prompt
    this.conversationHistory = [];
    this.functions = [...RECEPTIONIST_FUNCTIONS, ...(options.customFunctions || [])];
  }

  async initialize(apiKey = null) {
    if (this.provider === 'gemini') {
      const key = apiKey || config.llm.gemini?.apiKey || process.env.GEMINI_API_KEY;
      if (!key) {
        throw new Error('Gemini API key not configured');
      }
      this.client = new GoogleGenerativeAI(key);
      const model = this.client.getGenerativeModel({ model: this.model });
      this.chat = model.startChat({
        history: [],
        generationConfig: {
          maxOutputTokens: 500,
          temperature: 0.7,
        },
      });
      log.info('Dialog manager initialized with Gemini');
    } else {
      const key = apiKey || config.llm.openai?.apiKey;
      if (!key) {
        throw new Error('OpenAI API key not configured');
      }
      this.client = new OpenAI({ apiKey: key });
      log.info('Dialog manager initialized with OpenAI');
    }

    // Pre-load FAQ context for this tenant
    if (this.tenantId) {
      try {
        this.faqContext = await getFAQsForPrompt(this.tenantId);
        log.info('FAQ context loaded for dialog manager', { tenantId: this.tenantId, contextLength: this.faqContext.length });
      } catch (err) {
        log.warn('Failed to load FAQ context', { error: err.message });
        this.faqContext = '';
      }
    }
  }

  /**
   * Build the system prompt based on tenant configuration
   */
  buildSystemPrompt() {
    if (this.systemPrompt) {
      return this.systemPrompt;
    }

    const tc = this.tenantConfig;
    const receptionistName = tc.receptionistName || 'Alex';
    const businessName = tc.businessName || 'our business';
    const personality = tc.receptionistPersonality || 'professional, friendly, and helpful';

    return `You are ${receptionistName}, an AI receptionist for ${businessName}.

Your personality is: ${personality}

Your responsibilities:
1. Greet callers warmly and professionally
2. Understand caller needs through natural conversation
3. Help schedule, modify, or cancel appointments
4. Answer frequently asked questions about the business
5. Transfer calls to human agents when necessary
6. Take messages when requested

Guidelines:
- Be concise - keep responses under 2-3 sentences when possible
- Ask clarifying questions naturally
- Confirm important details before taking action
- Be empathetic and patient with callers
- If you're unsure about something, offer to transfer to a human agent
- Always maintain a professional but warm tone

${tc.businessDescription ? `About the business: ${tc.businessDescription}` : ''}

Current date and time: ${new Date().toLocaleString()}
${tc.timezone ? `Business timezone: ${tc.timezone}` : ''}

${tc.businessHours ? `Business hours: ${JSON.stringify(tc.businessHours)}` : ''}
${this.faqContext}`;
  }

  /**
   * Process user input and generate response
   */
  async processMessage(userMessage, context = {}) {
    if (!this.client) {
      await this.initialize();
    }

    const startTime = Date.now();

    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    // Enrich with dynamic knowledge base context if tenant is set
    let kbContext = '';
    if (this.tenantId) {
      try {
        kbContext = await buildKnowledgeContext(this.tenantId, userMessage);
      } catch (err) {
        log.warn('Failed to fetch KB context', { error: err.message });
      }
    }

    try {
      if (this.provider === 'gemini') {
        this._lastKbContext = kbContext;
        return await this.processWithGemini(userMessage, startTime);
      } else {
        return await this.processWithOpenAI(userMessage, startTime, kbContext);
      }
    } catch (error) {
      llmRequestsTotal.inc({ provider: this.provider, status: 'error' });
      log.error('LLM error', { error: error.message });
      throw error;
    }
  }

  /**
   * Process message with Gemini
   */
  async processWithGemini(userMessage, startTime) {
    // Build prompt with system context
    const systemPrompt = this.buildSystemPrompt();
    let prompt;
    if (this.conversationHistory.length === 1) {
      prompt = `${systemPrompt}\n\nUser: ${userMessage}`;
    } else {
      // Include any dynamic KB context found for this message
      const kbContext = this._lastKbContext || '';
      prompt = kbContext ? `[Context: ${kbContext}]\n\nUser: ${userMessage}` : userMessage;
    }

    const result = await this.chat.sendMessage(prompt);
    const response = await result.response;
    const text = response.text();

    llmRequestsTotal.inc({ provider: 'gemini', status: 'success' });
    llmLatency.observe({ provider: 'gemini' }, (Date.now() - startTime) / 1000);

    // Add to history
    this.conversationHistory.push({
      role: 'assistant',
      content: text,
    });

    return {
      type: 'response',
      content: text,
      finishReason: 'stop',
    };
  }

  /**
   * Process message with OpenAI
   */
  async processWithOpenAI(userMessage, startTime, kbContext = '') {
    const systemContent = this.buildSystemPrompt() + (kbContext ? `\n\nAdditional context for this query:\n${kbContext}` : '');
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemContent },
        ...this.conversationHistory,
      ],
      functions: this.functions,
      function_call: 'auto',
      temperature: 0.7,
      max_tokens: 500,
    });

    const message = response.choices[0].message;
    
    llmRequestsTotal.inc({ provider: 'openai', status: 'success' });
    llmLatency.observe({ provider: 'openai' }, (Date.now() - startTime) / 1000);

    // Check if function was called
    if (message.function_call) {
      const functionResult = {
        type: 'function_call',
        functionName: message.function_call.name,
        arguments: JSON.parse(message.function_call.arguments),
        assistantMessage: message.content,
      };

      log.info('Function call detected', {
        function: functionResult.functionName,
        args: functionResult.arguments,
      });

      return functionResult;
    }

    // Regular response
    this.conversationHistory.push({
      role: 'assistant',
      content: message.content,
    });

    return {
      type: 'response',
      content: message.content,
      finishReason: response.choices[0].finish_reason,
    };
  }

  /**
   * Add function result to conversation and get follow-up response
   */
  async addFunctionResult(functionName, result) {
    if (!this.client) {
      await this.initialize();
    }

    // Add function result to history
    this.conversationHistory.push({
      role: 'function',
      name: functionName,
      content: JSON.stringify(result),
    });

    const startTime = Date.now();

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: this.buildSystemPrompt() },
          ...this.conversationHistory,
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const message = response.choices[0].message;

      llmRequestsTotal.inc({ provider: 'openai', status: 'success' });
      llmLatency.observe({ provider: 'openai' }, (Date.now() - startTime) / 1000);

      this.conversationHistory.push({
        role: 'assistant',
        content: message.content,
      });

      return {
        type: 'response',
        content: message.content,
      };
    } catch (error) {
      llmRequestsTotal.inc({ provider: 'openai', status: 'error' });
      log.error('LLM error', { error: error.message });
      throw error;
    }
  }

  /**
   * Extract intent from conversation
   */
  async detectIntent(message) {
    if (!this.client) {
      await this.initialize();
    }

    const response = await this.client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `Classify the user's intent into one of these categories:
- booking: User wants to schedule an appointment
- cancellation: User wants to cancel an appointment
- inquiry: User has a question about the business
- complaint: User has a complaint or issue
- transfer: User specifically wants to talk to a human
- other: None of the above

Respond with only the category name.`,
        },
        { role: 'user', content: message },
      ],
      temperature: 0,
      max_tokens: 20,
    });

    return response.choices[0].message.content.trim().toLowerCase();
  }

  /**
   * Generate a quick response for common scenarios
   */
  async quickResponse(scenario, context = {}) {
    const responses = {
      greeting: `Hello! This is ${this.tenantConfig.receptionistName || 'Alex'}, the AI receptionist for ${this.tenantConfig.businessName || 'our business'}. How can I help you today?`,
      
      goodbye: `Thank you for calling ${this.tenantConfig.businessName || 'us'}. Have a great day!`,
      
      hold: "I'll just need a moment to look that up for you. Please hold.",
      
      transfer: "I'll transfer you to one of our team members right away. Please hold.",
      
      unavailable: "I apologize, but all our agents are currently busy. Would you like to leave a message or schedule a callback?",
      
      after_hours: `Thank you for calling ${this.tenantConfig.businessName || 'us'}. We're currently closed. Our business hours are Monday to Friday, 9 AM to 5 PM. Would you like to leave a message or schedule an appointment?`,
    };

    return responses[scenario] || responses.greeting;
  }

  /**
   * Reset conversation history
   */
  resetConversation() {
    this.conversationHistory = [];
    log.debug('Conversation history reset');
  }

  /**
   * Get conversation summary
   */
  getConversationSummary() {
    return {
      messageCount: this.conversationHistory.length,
      messages: this.conversationHistory,
    };
  }
}

/**
 * Create a new dialog manager instance
 */
export function createDialogManager(options = {}) {
  return new DialogManager(options);
}

export default {
  DialogManager,
  createDialogManager,
  RECEPTIONIST_FUNCTIONS,
};
