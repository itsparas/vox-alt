/**
 * TTS (Text-to-Speech) Adapters
 * Pluggable text-to-speech providers
 */

import axios from 'axios';
import config from '../config/index.js';
import { logger, createLogger } from '../lib/logger.js';
import { ttsRequestsTotal, ttsLatency } from '../lib/metrics.js';

const log = createLogger('tts');

/**
 * Base TTS Adapter Interface
 */
class BaseTTSAdapter {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Synthesize text to speech
   * @param {string} text - Text to synthesize
   * @param {object} options - Voice options
   * @returns {Promise<Buffer>} - Audio buffer
   */
  async synthesize(text, options = {}) {
    throw new Error('Not implemented');
  }

  /**
   * Get available voices
   * @returns {Promise<Array>} - List of available voices
   */
  async getVoices() {
    throw new Error('Not implemented');
  }
}

/**
 * Google Cloud TTS Adapter
 */
export class GoogleTTSAdapter extends BaseTTSAdapter {
  constructor(options = {}) {
    super(options);
    this.client = null;
    this.language = options.language || 'en-US';
    this.voice = options.voice || 'en-US-Neural2-C';
  }

  async initialize() {
    const textToSpeech = await import('@google-cloud/text-to-speech');
    this.client = new textToSpeech.TextToSpeechClient({
      keyFilename: config.tts.google.credentials,
    });
  }

  async synthesize(text, options = {}) {
    if (!this.client) {
      await this.initialize();
    }

    const startTime = Date.now();

    const request = {
      input: options.ssml
        ? { ssml: text }
        : { text },
      voice: {
        languageCode: options.language || this.language,
        name: options.voice || this.voice,
      },
      audioConfig: {
        audioEncoding: options.encoding || 'MP3',
        speakingRate: options.speakingRate || 1.0,
        pitch: options.pitch || 0,
        volumeGainDb: options.volumeGainDb || 0,
      },
    };

    try {
      const [response] = await this.client.synthesizeSpeech(request);
      
      ttsRequestsTotal.inc({ provider: 'google', status: 'success' });
      ttsLatency.observe({ provider: 'google' }, (Date.now() - startTime) / 1000);

      log.debug('Google TTS synthesis complete', {
        textLength: text.length,
        audioSize: response.audioContent.length,
      });

      return response.audioContent;
    } catch (error) {
      ttsRequestsTotal.inc({ provider: 'google', status: 'error' });
      log.error('Google TTS error', { error: error.message });
      throw error;
    }
  }

  async getVoices() {
    if (!this.client) {
      await this.initialize();
    }

    const [response] = await this.client.listVoices({});
    
    return response.voices.map(voice => ({
      name: voice.name,
      languageCodes: voice.languageCodes,
      gender: voice.ssmlGender,
      naturalSampleRateHertz: voice.naturalSampleRateHertz,
    }));
  }
}

/**
 * ElevenLabs TTS Adapter
 */
export class ElevenLabsAdapter extends BaseTTSAdapter {
  constructor(options = {}) {
    super(options);
    this.apiKey = options.apiKey || config.tts.elevenlabs.apiKey;
    this.voiceId = options.voiceId || 'EXAVITQu4vr4xnSDxMaL'; // Default voice
    this.baseUrl = 'https://api.elevenlabs.io/v1';
  }

  async synthesize(text, options = {}) {
    if (!this.apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    const startTime = Date.now();
    const voiceId = options.voiceId || this.voiceId;

    try {
      const response = await axios.post(
        `${this.baseUrl}/text-to-speech/${voiceId}?output_format=pcm_24000`,
        {
          text,
          model_id: options.model || 'eleven_turbo_v2_5',
          voice_settings: {
            stability: options.stability || 0.5,
            similarity_boost: options.similarityBoost || 0.75,
          },
        },
        {
          headers: {
            'Accept': 'audio/pcm',
            'Content-Type': 'application/json',
            'xi-api-key': this.apiKey,
          },
          responseType: 'arraybuffer',
        }
      );

      ttsRequestsTotal.inc({ provider: 'elevenlabs', status: 'success' });
      ttsLatency.observe({ provider: 'elevenlabs' }, (Date.now() - startTime) / 1000);

      log.debug('ElevenLabs TTS synthesis complete', {
        textLength: text.length,
        audioSize: response.data.byteLength,
      });

      return Buffer.from(response.data);
    } catch (error) {
      ttsRequestsTotal.inc({ provider: 'elevenlabs', status: 'error' });
      log.error('ElevenLabs TTS error', { error: error.message });
      throw error;
    }
  }

  async getVoices() {
    if (!this.apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    const response = await axios.get(`${this.baseUrl}/voices`, {
      headers: {
        'xi-api-key': this.apiKey,
      },
    });

    return response.data.voices.map(voice => ({
      id: voice.voice_id,
      name: voice.name,
      category: voice.category,
      labels: voice.labels,
      previewUrl: voice.preview_url,
    }));
  }
}

/**
 * AWS Polly TTS Adapter
 */
export class AWSPollyAdapter extends BaseTTSAdapter {
  constructor(options = {}) {
    super(options);
    this.client = null;
    this.voice = options.voice || 'Joanna';
    this.engine = options.engine || 'neural';
  }

  async initialize() {
    const { PollyClient, SynthesizeSpeechCommand, DescribeVoicesCommand } = await import('@aws-sdk/client-polly');
    
    this.client = new PollyClient({
      region: config.tts.aws.region,
      credentials: {
        accessKeyId: config.tts.aws.accessKeyId,
        secretAccessKey: config.tts.aws.secretAccessKey,
      },
    });
    this.SynthesizeSpeechCommand = SynthesizeSpeechCommand;
    this.DescribeVoicesCommand = DescribeVoicesCommand;
  }

  async synthesize(text, options = {}) {
    if (!this.client) {
      await this.initialize();
    }

    const startTime = Date.now();

    const command = new this.SynthesizeSpeechCommand({
      Text: text,
      TextType: options.ssml ? 'ssml' : 'text',
      OutputFormat: options.format || 'mp3',
      VoiceId: options.voice || this.voice,
      Engine: options.engine || this.engine,
      LanguageCode: options.language || 'en-US',
    });

    try {
      const response = await this.client.send(command);
      
      // Convert stream to buffer
      const chunks = [];
      for await (const chunk of response.AudioStream) {
        chunks.push(chunk);
      }
      const audioBuffer = Buffer.concat(chunks);

      ttsRequestsTotal.inc({ provider: 'aws_polly', status: 'success' });
      ttsLatency.observe({ provider: 'aws_polly' }, (Date.now() - startTime) / 1000);

      log.debug('AWS Polly TTS synthesis complete', {
        textLength: text.length,
        audioSize: audioBuffer.length,
      });

      return audioBuffer;
    } catch (error) {
      ttsRequestsTotal.inc({ provider: 'aws_polly', status: 'error' });
      log.error('AWS Polly TTS error', { error: error.message });
      throw error;
    }
  }

  async getVoices() {
    if (!this.client) {
      await this.initialize();
    }

    const command = new this.DescribeVoicesCommand({});
    const response = await this.client.send(command);

    return response.Voices.map(voice => ({
      id: voice.Id,
      name: voice.Name,
      languageCode: voice.LanguageCode,
      languageName: voice.LanguageName,
      gender: voice.Gender,
      engine: voice.SupportedEngines,
    }));
  }
}

/**
 * Mock TTS Adapter for testing
 */
export class MockTTSAdapter extends BaseTTSAdapter {
  async synthesize(text, options = {}) {
    log.debug('Mock TTS synthesis', { text });
    
    // Return a small valid MP3 header (for testing)
    const mockAudio = Buffer.alloc(1024);
    mockAudio.write('ID3', 0); // MP3 header
    
    return mockAudio;
  }

  async getVoices() {
    return [
      { id: 'mock-voice-1', name: 'Mock Voice 1', language: 'en-US' },
      { id: 'mock-voice-2', name: 'Mock Voice 2', language: 'en-GB' },
    ];
  }
}

/**
 * TTS Factory - Create adapter based on provider
 */
export function createTTSAdapter(provider, options = {}) {
  switch (provider.toLowerCase()) {
    case 'google':
      return new GoogleTTSAdapter(options);
    case 'elevenlabs':
      return new ElevenLabsAdapter(options);
    case 'aws_polly':
    case 'polly':
      return new AWSPollyAdapter(options);
    case 'mock':
      return new MockTTSAdapter(options);
    default:
      throw new Error(`Unknown TTS provider: ${provider}`);
  }
}

export default {
  GoogleTTSAdapter,
  ElevenLabsAdapter,
  AWSPollyAdapter,
  MockTTSAdapter,
  createTTSAdapter,
};
