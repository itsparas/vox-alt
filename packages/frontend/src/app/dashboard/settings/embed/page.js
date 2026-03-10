'use client';

import { useState } from 'react';
import { useTenant } from '@/hooks/queries';
import { Card, Button, Input, Label, Spinner } from '@/components/ui';
import { toast } from '@/components/ui/Toaster';
import {
  CodeBracketIcon,
  ClipboardDocumentIcon,
  EyeIcon,
  PaintBrushIcon,
  ShareIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';

export default function EmbedSettingsPage() {
  const { data: tenant, isLoading } = useTenant();
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  
  const [customization, setCustomization] = useState({
    primaryColor: '#3B82F6',
    position: 'bottom-right',
    buttonText: 'Talk to us',
    buttonIcon: 'phone',
  });

  const widgetId = tenant?.widgetId || 'your-widget-id';
  const tenantSlug = tenant?.slug || 'your-slug';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.voxreception.com';
  const frontendUrl = typeof window !== 'undefined' ? window.location.origin : 'https://app.voxreception.com';
  const shareableLink = `${frontendUrl}/call/${tenantSlug}`;

  const embedCode = `<!-- VoxReception Widget -->
<script>
  (function(w, d, s, o, f, js, fjs) {
    w['VoxReception'] = o;
    w[o] = w[o] || function() { (w[o].q = w[o].q || []).push(arguments) };
    js = d.createElement(s); fjs = d.getElementsByTagName(s)[0];
    js.id = o; js.src = f; js.async = 1; fjs.parentNode.insertBefore(js, fjs);
  }(window, document, 'script', 'vox', '${apiUrl}/widget.js'));
  
  vox('init', '${widgetId}', {
    primaryColor: '${customization.primaryColor}',
    position: '${customization.position}',
    buttonText: '${customization.buttonText}'
  });
</script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    toast.success('Embed code copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">
          Embed Widget
        </h1>
        <p className="text-secondary-600 dark:text-secondary-400">
          Add the VoxReception widget to your website
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customization */}
        <Card>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-900/20">
              <PaintBrushIcon className="h-5 w-5 text-primary-600" />
            </div>
            <h2 className="text-lg font-semibold text-secondary-900 dark:text-white">
              Customize Widget
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="primaryColor">Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="primaryColor"
                  type="color"
                  value={customization.primaryColor}
                  onChange={(e) =>
                    setCustomization({ ...customization, primaryColor: e.target.value })
                  }
                  className="w-14 h-10 p-1 cursor-pointer"
                />
                <Input
                  type="text"
                  value={customization.primaryColor}
                  onChange={(e) =>
                    setCustomization({ ...customization, primaryColor: e.target.value })
                  }
                  className="flex-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="position">Widget Position</Label>
              <select
                id="position"
                value={customization.position}
                onChange={(e) =>
                  setCustomization({ ...customization, position: e.target.value })
                }
                className="block w-full rounded-lg border border-secondary-300 dark:border-secondary-700 dark:bg-secondary-800 py-2 px-3"
              >
                <option value="bottom-right">Bottom Right</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="top-right">Top Right</option>
                <option value="top-left">Top Left</option>
              </select>
            </div>

            <div>
              <Label htmlFor="buttonText">Button Text</Label>
              <Input
                id="buttonText"
                type="text"
                value={customization.buttonText}
                onChange={(e) =>
                  setCustomization({ ...customization, buttonText: e.target.value })
                }
              />
            </div>

            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setPreviewOpen(true)}
            >
              <EyeIcon className="h-4 w-4 mr-2" />
              Preview Widget
            </Button>
          </div>
        </Card>

        {/* Embed Code */}
        <Card>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-900/20">
              <CodeBracketIcon className="h-5 w-5 text-primary-600" />
            </div>
            <h2 className="text-lg font-semibold text-secondary-900 dark:text-white">
              Embed Code
            </h2>
          </div>

          <div className="relative">
            <pre className="bg-secondary-900 text-secondary-100 p-4 rounded-lg overflow-x-auto text-sm font-mono">
              <code>{embedCode}</code>
            </pre>
            <Button
              variant="secondary"
              size="sm"
              className="absolute top-2 right-2"
              onClick={handleCopy}
            >
              <ClipboardDocumentIcon className="h-4 w-4 mr-1" />
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>

          <div className="mt-4 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
            <h4 className="font-medium text-primary-800 dark:text-primary-200 mb-2">
              Installation Instructions
            </h4>
            <ol className="text-sm text-primary-700 dark:text-primary-300 space-y-2 list-decimal list-inside">
              <li>Copy the embed code above</li>
              <li>
                Paste it just before the closing{' '}
                <code className="bg-primary-100 dark:bg-primary-800 px-1 rounded">
                  &lt;/body&gt;
                </code>{' '}
                tag on your website
              </li>
              <li>Save and publish your changes</li>
              <li>The widget will appear on your website</li>
            </ol>
          </div>
        </Card>
      </div>

      {/* Widget ID */}
      <Card>
        <h3 className="font-semibold text-secondary-900 dark:text-white mb-4">
          Widget Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Widget ID</Label>
            <Input type="text" value={widgetId} readOnly />
          </div>
          <div>
            <Label>API Endpoint</Label>
            <Input type="text" value={`${apiUrl}/api`} readOnly />
          </div>
        </div>
      </Card>

      {/* Shareable Call Link */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
            <ShareIcon className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-secondary-900 dark:text-white">
              Shareable Call Link
            </h2>
            <p className="text-sm text-secondary-500 dark:text-secondary-400">
              Share this link to let anyone call your AI receptionist directly
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Input
            type="text"
            value={shareableLink}
            readOnly
            className="flex-1 font-mono text-sm"
          />
          <Button
            variant="secondary"
            onClick={() => {
              navigator.clipboard.writeText(shareableLink);
              setLinkCopied(true);
              toast.success('Shareable link copied!');
              setTimeout(() => setLinkCopied(false), 2000);
            }}
          >
            <ClipboardDocumentIcon className="h-4 w-4 mr-1" />
            {linkCopied ? 'Copied!' : 'Copy'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => window.open(shareableLink, '_blank')}
          >
            <LinkIcon className="h-4 w-4 mr-1" />
            Open
          </Button>
        </div>

        <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">
            Use Cases
          </h4>
          <ul className="text-sm text-green-700 dark:text-green-300 space-y-1 list-disc list-inside">
            <li>Share via email, SMS, or social media</li>
            <li>Add to your Google Business profile or directory listings</li>
            <li>Include in QR codes for physical marketing</li>
            <li>Use in email signatures for instant customer support</li>
          </ul>
        </div>
      </Card>

      {/* Preview Modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-secondary-800 rounded-xl shadow-hard max-w-2xl w-full mx-4 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-secondary-200 dark:border-secondary-700">
              <h3 className="font-semibold">Widget Preview</h3>
              <Button variant="ghost" size="sm" onClick={() => setPreviewOpen(false)}>
                Close
              </Button>
            </div>
            <div className="relative h-96 bg-gradient-to-br from-secondary-100 to-secondary-200 dark:from-secondary-900 dark:to-secondary-950">
              {/* Simulated website content */}
              <div className="p-8">
                <div className="h-4 bg-secondary-300 dark:bg-secondary-700 rounded w-3/4 mb-4" />
                <div className="h-4 bg-secondary-300 dark:bg-secondary-700 rounded w-1/2 mb-4" />
                <div className="h-4 bg-secondary-300 dark:bg-secondary-700 rounded w-2/3" />
              </div>

              {/* Widget button preview */}
              <div
                className={`absolute ${
                  customization.position.includes('bottom') ? 'bottom-4' : 'top-4'
                } ${customization.position.includes('right') ? 'right-4' : 'left-4'}`}
              >
                <button
                  className="flex items-center gap-2 px-4 py-3 rounded-full shadow-lg text-white font-medium"
                  style={{ backgroundColor: customization.primaryColor }}
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                    />
                  </svg>
                  {customization.buttonText}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
