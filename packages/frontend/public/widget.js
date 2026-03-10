/**
 * VoxReception Embeddable Widget
 * 
 * Usage:
 * <script>
 *   (function(w, d, s, o, f, js, fjs) {
 *     w['VoxReception'] = o;
 *     w[o] = w[o] || function() { (w[o].q = w[o].q || []).push(arguments) };
 *     js = d.createElement(s); fjs = d.getElementsByTagName(s)[0];
 *     js.id = o; js.src = f; js.async = 1; fjs.parentNode.insertBefore(js, fjs);
 *   }(window, document, 'script', 'vox', 'https://api.voxreception.com/widget.js'));
 *   
 *   vox('init', 'YOUR_WIDGET_ID', { primaryColor: '#3B82F6' });
 *   // OR use tenant slug:
 *   vox('init', 'your-business-slug', { primaryColor: '#3B82F6', useSlug: true });
 * </script>
 */

(function() {
  'use strict';

  // Configuration defaults
  const DEFAULTS = {
    primaryColor: '#3B82F6',
    position: 'bottom-right',
    buttonText: 'Talk to us',
    zIndex: 9999,
    animationDuration: 300,
  };

  // State
  let config = { ...DEFAULTS };
  let widgetId = null;
  let tenantSlug = null;
  let isOpen = false;
  let isConnected = false;
  let iframe = null;
  let button = null;
  let container = null;

  // API URL from widget script src
  const API_URL = (() => {
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      if (scripts[i].src && scripts[i].src.includes('widget.js')) {
        return scripts[i].src.replace('/widget.js', '');
      }
    }
    return 'https://api.voxreception.com';
  })();

  // Process queued commands
  function processQueue() {
    const queue = window.vox.q || [];
    queue.forEach(args => {
      const [command, ...params] = args;
      if (commands[command]) {
        commands[command](...params);
      }
    });
    window.vox.q = [];
  }

  // Commands
  const commands = {
    init: (id, options = {}) => {
      if (options.useSlug) {
        tenantSlug = id;
        widgetId = null;
      } else {
        widgetId = id;
        tenantSlug = null;
      }
      config = { ...DEFAULTS, ...options };
      createWidget();
    },

    open: () => {
      if (!isOpen) {
        openWidget();
      }
    },

    close: () => {
      if (isOpen) {
        closeWidget();
      }
    },

    toggle: () => {
      if (isOpen) {
        closeWidget();
      } else {
        openWidget();
      }
    },

    setConfig: (newConfig) => {
      config = { ...config, ...newConfig };
      updateStyles();
    },
  };

  // Create widget elements
  function createWidget() {
    // Container
    container = document.createElement('div');
    container.id = 'vox-widget-container';
    container.style.cssText = `
      position: fixed;
      ${getPositionStyles()}
      z-index: ${config.zIndex};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Button
    button = document.createElement('button');
    button.id = 'vox-widget-button';
    button.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 24px; height: 24px;">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
      </svg>
      <span style="margin-left: 8px;">${config.buttonText}</span>
    `;
    button.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 12px 20px;
      background-color: ${config.primaryColor};
      color: white;
      border: none;
      border-radius: 50px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 14px 0 rgba(0, 0, 0, 0.25);
      transition: all 0.2s ease;
    `;
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.05)';
      button.style.boxShadow = '0 6px 20px 0 rgba(0, 0, 0, 0.3)';
    });
    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
      button.style.boxShadow = '0 4px 14px 0 rgba(0, 0, 0, 0.25)';
    });
    button.addEventListener('click', () => commands.toggle());

    // Iframe (hidden initially)
    iframe = document.createElement('iframe');
    iframe.id = 'vox-widget-frame';
    iframe.src = tenantSlug
      ? `${API_URL}/widget/embed?tenantSlug=${tenantSlug}`
      : `${API_URL}/widget/embed?id=${widgetId}`;
    iframe.style.cssText = `
      position: absolute;
      ${config.position.includes('bottom') ? 'bottom' : 'top'}: 70px;
      ${config.position.includes('right') ? 'right' : 'left'}: 0;
      width: 380px;
      height: 600px;
      max-height: calc(100vh - 100px);
      border: none;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
      background: white;
      transform: scale(0.8) translateY(20px);
      opacity: 0;
      visibility: hidden;
      transition: all ${config.animationDuration}ms ease;
      transform-origin: ${config.position.includes('bottom') ? 'bottom' : 'top'} ${config.position.includes('right') ? 'right' : 'left'};
    `;
    iframe.allow = 'microphone; camera; autoplay';

    container.appendChild(iframe);
    container.appendChild(button);
    document.body.appendChild(container);

    // Listen for messages from iframe
    window.addEventListener('message', handleMessage);
  }

  // Handle messages from iframe
  function handleMessage(event) {
    if (event.origin !== API_URL) return;

    const { type, data } = event.data;

    switch (type) {
      case 'vox:connected':
        isConnected = true;
        updateButtonState('connected');
        break;
      case 'vox:disconnected':
        isConnected = false;
        updateButtonState('idle');
        break;
      case 'vox:close':
        closeWidget();
        break;
      case 'vox:calling':
        updateButtonState('calling');
        break;
      case 'vox:queued':
        updateButtonState('queued');
        break;
      case 'vox:incall':
        updateButtonState('incall');
        break;
      case 'vox:ready':
        // Widget iframe is ready
        break;
    }
  }

  // Update button state
  function updateButtonState(state) {
    const states = {
      idle: {
        icon: `<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>`,
        text: config.buttonText,
        color: config.primaryColor,
      },
      calling: {
        icon: `<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>`,
        text: 'Connecting...',
        color: '#F59E0B',
      },
      incall: {
        icon: `<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>`,
        text: 'End Call',
        color: '#EF4444',
      },
      connected: {
        icon: `<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>`,
        text: config.buttonText,
        color: '#22C55E',
      },
      queued: {
        icon: `<circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path>`,
        text: 'In Queue...',
        color: '#F59E0B',
      },
    };

    const s = states[state] || states.idle;
    button.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 24px; height: 24px;">
        ${s.icon}
      </svg>
      <span style="margin-left: 8px;">${s.text}</span>
    `;
    button.style.backgroundColor = s.color;
  }

  // Get position styles
  function getPositionStyles() {
    const positions = {
      'bottom-right': 'bottom: 20px; right: 20px;',
      'bottom-left': 'bottom: 20px; left: 20px;',
      'top-right': 'top: 20px; right: 20px;',
      'top-left': 'top: 20px; left: 20px;',
    };
    return positions[config.position] || positions['bottom-right'];
  }

  // Update styles
  function updateStyles() {
    if (container) {
      container.style.cssText = `
        position: fixed;
        ${getPositionStyles()}
        z-index: ${config.zIndex};
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `;
    }
    if (button) {
      button.style.backgroundColor = config.primaryColor;
      button.querySelector('span').textContent = config.buttonText;
    }
  }

  // Open widget
  function openWidget() {
    isOpen = true;
    iframe.style.transform = 'scale(1) translateY(0)';
    iframe.style.opacity = '1';
    iframe.style.visibility = 'visible';
    
    // Notify iframe
    iframe.contentWindow?.postMessage({ type: 'vox:open' }, '*');
  }

  // Close widget
  function closeWidget() {
    isOpen = false;
    iframe.style.transform = 'scale(0.8) translateY(20px)';
    iframe.style.opacity = '0';
    iframe.style.visibility = 'hidden';
    
    // Notify iframe
    iframe.contentWindow?.postMessage({ type: 'vox:close' }, '*');
  }

  // Override vox function
  window.vox = function() {
    const [command, ...params] = arguments;
    if (commands[command]) {
      commands[command](...params);
    }
  };
  window.vox.q = window.vox.q || [];

  // Process any queued commands
  if (document.readyState === 'complete') {
    processQueue();
  } else {
    window.addEventListener('load', processQueue);
  }
})();
