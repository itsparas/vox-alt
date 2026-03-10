'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTenant, useTenantConfig, useUpdateTenantConfig } from '@/hooks/queries';
import { Card, Button, Input, Textarea, Select, Label, Spinner } from '@/components/ui';
import { toast } from '@/components/ui/Toaster';
import {
  Cog6ToothIcon,
  MicrophoneIcon,
  SpeakerWaveIcon,
  ChatBubbleLeftIcon,
  ClockIcon,
  PhoneIcon,
} from '@heroicons/react/24/outline';

function SettingsSection({ icon: Icon, title, description, children }) {
  return (
    <Card>
      <div className="flex items-start gap-4 mb-6">
        <div className="p-3 rounded-lg bg-primary-50 dark:bg-primary-900/20">
          <Icon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-secondary-900 dark:text-white">
            {title}
          </h3>
          <p className="text-sm text-secondary-500">{description}</p>
        </div>
      </div>
      {children}
    </Card>
  );
}

export default function SettingsPage() {
  const { data: tenant, isLoading: tenantLoading } = useTenant();
  const { data: config, isLoading: configLoading } = useTenantConfig();
  const updateConfig = useUpdateTenantConfig();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm();

  useEffect(() => {
    if (config) {
      reset({
        // General
        businessName: tenant?.name || '',
        timezone: config.timezone || 'America/New_York',
        
        // AI Voice
        greeting: config.greeting || '',
        voicePersonality: config.voicePersonality || 'professional',
        language: config.language || 'en-US',
        
        // Providers
        asrProvider: config.asrProvider || 'DEEPGRAM',
        ttsProvider: config.ttsProvider || 'GOOGLE',
        llmProvider: config.llmProvider || 'OPENAI',
        ttsVoice: config.ttsVoice || '',
        
        // Business Hours
        businessHoursStart: config.businessHoursStart || '09:00',
        businessHoursEnd: config.businessHoursEnd || '17:00',
        workDays: config.workDays || [1, 2, 3, 4, 5],
        
        // Call Handling
        maxCallDuration: config.maxCallDuration || 600,
        escalationTimeout: config.escalationTimeout || 30,
        voicemailEnabled: config.voicemailEnabled ?? true,
        recordCalls: config.recordCalls ?? true,
        
        // Custom prompts
        systemPrompt: config.systemPrompt || '',
        transferInstructions: config.transferInstructions || '',
      });
    }
  }, [config, tenant, reset]);

  const onSubmit = async (data) => {
    try {
      await updateConfig.mutateAsync(data);
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    }
  };

  if (tenantLoading || configLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">
            Settings
          </h1>
          <p className="text-secondary-600 dark:text-secondary-400">
            Configure your AI receptionist behavior and preferences
          </p>
        </div>
        <Button
          onClick={handleSubmit(onSubmit)}
          loading={updateConfig.isPending}
          disabled={!isDirty}
        >
          Save Changes
        </Button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* AI Voice Settings */}
        <SettingsSection
          icon={MicrophoneIcon}
          title="AI Voice & Personality"
          description="Configure how your AI receptionist sounds and communicates"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="greeting">Greeting Message</Label>
              <Textarea
                id="greeting"
                rows={3}
                placeholder="Hello! Thank you for calling. How can I help you today?"
                {...register('greeting')}
              />
              <p className="mt-1 text-xs text-secondary-500">
                The first message callers will hear
              </p>
            </div>

            <div>
              <Label htmlFor="voicePersonality">Voice Personality</Label>
              <Select id="voicePersonality" {...register('voicePersonality')}>
                <option value="professional">Professional</option>
                <option value="friendly">Friendly</option>
                <option value="formal">Formal</option>
                <option value="casual">Casual</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="language">Language</Label>
              <Select id="language" {...register('language')}>
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (UK)</option>
                <option value="es-ES">Spanish</option>
                <option value="fr-FR">French</option>
                <option value="de-DE">German</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="ttsVoice">Voice Selection</Label>
              <Select id="ttsVoice" {...register('ttsVoice')}>
                <option value="">Default</option>
                <option value="en-US-Neural2-A">Female 1</option>
                <option value="en-US-Neural2-C">Female 2</option>
                <option value="en-US-Neural2-D">Male 1</option>
                <option value="en-US-Neural2-J">Male 2</option>
              </Select>
            </div>
          </div>
        </SettingsSection>

        {/* Provider Settings */}
        <SettingsSection
          icon={SpeakerWaveIcon}
          title="AI Providers"
          description="Choose your speech recognition and text-to-speech providers"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <Label htmlFor="asrProvider">Speech Recognition (ASR)</Label>
              <Select id="asrProvider" {...register('asrProvider')}>
                <option value="DEEPGRAM">Deepgram</option>
                <option value="GOOGLE">Google Speech-to-Text</option>
                <option value="WHISPER">OpenAI Whisper</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="ttsProvider">Text-to-Speech (TTS)</Label>
              <Select id="ttsProvider" {...register('ttsProvider')}>
                <option value="GOOGLE">Google TTS</option>
                <option value="ELEVENLABS">ElevenLabs</option>
                <option value="AWS_POLLY">AWS Polly</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="llmProvider">Language Model (LLM)</Label>
              <Select id="llmProvider" {...register('llmProvider')}>
                <option value="OPENAI">OpenAI GPT-4</option>
                <option value="ANTHROPIC">Anthropic Claude</option>
              </Select>
            </div>
          </div>
        </SettingsSection>

        {/* Business Hours */}
        <SettingsSection
          icon={ClockIcon}
          title="Business Hours"
          description="Set when your AI receptionist is available"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="businessHoursStart">Opening Time</Label>
              <Input
                id="businessHoursStart"
                type="time"
                {...register('businessHoursStart')}
              />
            </div>

            <div>
              <Label htmlFor="businessHoursEnd">Closing Time</Label>
              <Input
                id="businessHoursEnd"
                type="time"
                {...register('businessHoursEnd')}
              />
            </div>

            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <Select id="timezone" {...register('timezone')}>
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="Europe/London">London (GMT)</option>
                <option value="Europe/Paris">Paris (CET)</option>
              </Select>
            </div>

            <div>
              <Label>Working Days</Label>
              <div className="flex gap-2 mt-2">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                  <label
                    key={index}
                    className="flex items-center justify-center w-10 h-10 rounded-full border cursor-pointer transition-colors hover:bg-secondary-50 dark:hover:bg-secondary-800"
                  >
                    <input
                      type="checkbox"
                      value={index}
                      className="sr-only"
                      {...register('workDays')}
                    />
                    <span className="text-sm font-medium">{day}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </SettingsSection>

        {/* Call Handling */}
        <SettingsSection
          icon={PhoneIcon}
          title="Call Handling"
          description="Configure how calls are managed and recorded"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="maxCallDuration">Max Call Duration (seconds)</Label>
              <Input
                id="maxCallDuration"
                type="number"
                min="60"
                max="3600"
                {...register('maxCallDuration', { valueAsNumber: true })}
              />
            </div>

            <div>
              <Label htmlFor="escalationTimeout">Escalation Timeout (seconds)</Label>
              <Input
                id="escalationTimeout"
                type="number"
                min="10"
                max="120"
                {...register('escalationTimeout', { valueAsNumber: true })}
              />
              <p className="mt-1 text-xs text-secondary-500">
                Time to wait before escalating to a human
              </p>
            </div>

            <div className="flex items-center gap-3">
              <input
                id="voicemailEnabled"
                type="checkbox"
                className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                {...register('voicemailEnabled')}
              />
              <Label htmlFor="voicemailEnabled" className="mb-0">
                Enable Voicemail
              </Label>
            </div>

            <div className="flex items-center gap-3">
              <input
                id="recordCalls"
                type="checkbox"
                className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                {...register('recordCalls')}
              />
              <Label htmlFor="recordCalls" className="mb-0">
                Record Calls
              </Label>
            </div>
          </div>
        </SettingsSection>

        {/* Custom Prompts */}
        <SettingsSection
          icon={ChatBubbleLeftIcon}
          title="Custom Instructions"
          description="Provide specific instructions for your AI receptionist"
        >
          <div className="space-y-6">
            <div>
              <Label htmlFor="systemPrompt">System Prompt</Label>
              <Textarea
                id="systemPrompt"
                rows={5}
                placeholder="You are a helpful AI receptionist for a medical clinic. Always be polite and professional. When booking appointments, ask for the patient's name, preferred date/time, and reason for visit..."
                {...register('systemPrompt')}
              />
              <p className="mt-1 text-xs text-secondary-500">
                Detailed instructions for how the AI should behave
              </p>
            </div>

            <div>
              <Label htmlFor="transferInstructions">Transfer Instructions</Label>
              <Textarea
                id="transferInstructions"
                rows={3}
                placeholder="If the caller asks for billing, transfer to extension 200. For emergencies, transfer to the on-call doctor..."
                {...register('transferInstructions')}
              />
              <p className="mt-1 text-xs text-secondary-500">
                Instructions for when and how to transfer calls
              </p>
            </div>
          </div>
        </SettingsSection>

        {/* Save button (mobile) */}
        <div className="sm:hidden">
          <Button
            type="submit"
            className="w-full"
            loading={updateConfig.isPending}
            disabled={!isDirty}
          >
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
