/**
 * ASR (Automatic Speech Recognition) Adapters
 * Pluggable speech-to-text providers
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import config from '../config/index.js';
import { logger, createLogger } from '../lib/logger.js';
import { asrRequestsTotal, asrLatency } from '../lib/metrics.js';

const log = createLogger('asr');

/**
 * Base ASR Adapter Interface
 */
class BaseASRAdapter extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = options;
    this.isConnected = false;
  }

  async connect() {
    throw new Error('Not implemented');
  }

  async disconnect() {
    throw new Error('Not implemented');
  }

  sendAudio(audioData) {
    throw new Error('Not implemented');
  }

  // Events: 'transcript', 'partial', 'error', 'connected', 'disconnected'
}

/**
 * Deepgram ASR Adapter
 * Real-time streaming speech-to-text
 */
export class DeepgramAdapter extends BaseASRAdapter {
  constructor(options = {}) {
    super(options);
    this.ws = null;
    this.apiKey = options.apiKey || config.asr.deepgram.apiKey;
    this.language = options.language || 'en-US';
    this.model = options.model || 'nova-2';
  }

  async connect() {
    if (!this.apiKey) {
      throw new Error('Deepgram API key not configured');
    }

    const url = new URL('wss://api.deepgram.com/v1/listen');
    url.searchParams.set('model', this.model);
    url.searchParams.set('language', this.language);
    url.searchParams.set('encoding', 'linear16');
    url.searchParams.set('sample_rate', '16000');
    url.searchParams.set('channels', '1');
    url.searchParams.set('punctuate', 'true');
    url.searchParams.set('interim_results', 'true');
    url.searchParams.set('endpointing', '300');
    url.searchParams.set('vad_events', 'true');

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url.toString(), {
        headers: {
          Authorization: `Token ${this.apiKey}`,
        },
      });

      this.ws.on('open', () => {
        this.isConnected = true;
        log.info('Deepgram connected');
        this.emit('connected');
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const response = JSON.parse(data);
          this.handleResponse(response);
        } catch (error) {
          log.error('Failed to parse Deepgram response', { error: error.message });
        }
      });

      this.ws.on('error', (error) => {
        log.error('Deepgram WebSocket error', { error: error.message });
        asrRequestsTotal.inc({ provider: 'deepgram', status: 'error' });
        this.emit('error', error);
        reject(error);
      });

      this.ws.on('close', () => {
        this.isConnected = false;
        log.info('Deepgram disconnected');
        this.emit('disconnected');
      });

      // Timeout for connection
      setTimeout(() => {
        if (!this.isConnected) {
          reject(new Error('Deepgram connection timeout'));
        }
      }, 10000);
    });
  }

  handleResponse(response) {
    if (response.type === 'Results') {
      const channel = response.channel;
      const alternatives = channel?.alternatives || [];

      if (alternatives.length > 0) {
        const result = {
          text: alternatives[0].transcript,
          confidence: alternatives[0].confidence,
          words: alternatives[0].words,
          isFinal: response.is_final,
          start: response.start,
          duration: response.duration,
        };

        if (response.is_final && result.text.trim()) {
          asrRequestsTotal.inc({ provider: 'deepgram', status: 'success' });
          asrLatency.observe({ provider: 'deepgram' }, response.duration || 0);
          this.emit('transcript', result);
        } else if (result.text.trim()) {
          this.emit('partial', result);
        }
      }
    } else if (response.type === 'SpeechStarted') {
      this.emit('speech_started');
    } else if (response.type === 'UtteranceEnd') {
      this.emit('utterance_end');
    }
  }

  sendAudio(audioData) {
    if (this.ws && this.isConnected) {
      this.ws.send(audioData);
    }
  }

  async disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }
}

/**
 * Google Speech-to-Text Adapter
 */
export class GoogleSTTAdapter extends BaseASRAdapter {
  constructor(options = {}) {
    super(options);
    this.client = null;
    this.stream = null;
    this.language = options.language || 'en-US';
  }

  async connect() {
    // Dynamic import for Google Speech
    const speech = await import('@google-cloud/speech');
    
    this.client = new speech.SpeechClient({
      keyFilename: config.asr.google.credentials,
    });

    const request = {
      config: {
        encoding: 'LINEAR16',
        sampleRateHertz: 16000,
        languageCode: this.language,
        enableAutomaticPunctuation: true,
        model: 'latest_long',
      },
      interimResults: true,
    };

    this.stream = this.client
      .streamingRecognize(request)
      .on('data', (data) => {
        this.handleResponse(data);
      })
      .on('error', (error) => {
        log.error('Google STT error', { error: error.message });
        asrRequestsTotal.inc({ provider: 'google', status: 'error' });
        this.emit('error', error);
      })
      .on('end', () => {
        this.isConnected = false;
        this.emit('disconnected');
      });

    this.isConnected = true;
    this.emit('connected');
    log.info('Google STT connected');
  }

  handleResponse(data) {
    const result = data.results[0];
    if (result) {
      const transcript = result.alternatives[0];
      const output = {
        text: transcript.transcript,
        confidence: transcript.confidence,
        isFinal: result.isFinal,
      };

      if (result.isFinal && output.text.trim()) {
        asrRequestsTotal.inc({ provider: 'google', status: 'success' });
        this.emit('transcript', output);
      } else if (output.text.trim()) {
        this.emit('partial', output);
      }
    }
  }

  sendAudio(audioData) {
    if (this.stream && this.isConnected) {
      this.stream.write(audioData);
    }
  }

  async disconnect() {
    if (this.stream) {
      this.stream.end();
      this.stream = null;
    }
    this.isConnected = false;
  }
}

/**
 * Mock ASR Adapter for testing
 */
export class MockASRAdapter extends BaseASRAdapter {
  constructor(options = {}) {
    super(options);
    this.mockResponses = options.mockResponses || [
      'Hello, how can I help you today?',
      'I would like to book an appointment.',
      'Tomorrow at 10 AM please.',
      'Thank you, goodbye.',
    ];
    this.responseIndex = 0;
  }

  async connect() {
    this.isConnected = true;
    this.emit('connected');
    log.info('Mock ASR connected');
  }

  sendAudio(audioData) {
    // Simulate transcript after receiving audio
    if (this.isConnected && audioData.length > 1000) {
      setTimeout(() => {
        const text = this.mockResponses[this.responseIndex % this.mockResponses.length];
        this.responseIndex++;

        this.emit('transcript', {
          text,
          confidence: 0.95,
          isFinal: true,
        });
      }, 500);
    }
  }

  async disconnect() {
    this.isConnected = false;
    this.emit('disconnected');
  }
}

/**
 * ASR Factory - Create adapter based on provider
 */
export function createASRAdapter(provider, options = {}) {
  switch (provider.toLowerCase()) {
    case 'deepgram':
      return new DeepgramAdapter(options);
    case 'google':
      return new GoogleSTTAdapter(options);
    case 'mock':
      return new MockASRAdapter(options);
    default:
      throw new Error(`Unknown ASR provider: ${provider}`);
  }
}

export default {
  DeepgramAdapter,
  GoogleSTTAdapter,
  MockASRAdapter,
  createASRAdapter,
};
