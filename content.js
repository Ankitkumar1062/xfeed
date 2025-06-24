/**
 * Mail Tracker Pro - Multi-platform content script
 * Supports Gmail and Yahoo Mail with invisible tracking
 */

// Configuration
const TRACKING_SERVER = 'https://mail-931k.onrender.com';
const CHECK_INTERVAL = 2000; // How often to check for compose windows
const TOOLTIP_REFRESH_INTERVAL = 4000; // How often to update sent items status

// Browser API compatibility wrapper
const browserAPI = {
  storage: {
    local: {
      get: (keys) => {
        return new Promise((resolve, reject) => {
          if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.get(keys, (result) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(result);
              }
            });
          } else if (typeof browser !== 'undefined' && browser.storage) {
            browser.storage.local.get(keys).then(resolve).catch(reject);
          } else {
            // Fallback for development/testing
            console.warn('No storage API available, using mock storage');
            resolve({});
          }
        });
      },
      set: (data) => {
        return new Promise((resolve, reject) => {
          if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.set(data, () => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve();
              }
            });
          } else if (typeof browser !== 'undefined' && browser.storage) {
            browser.storage.local.set(data).then(resolve).catch(reject);
          } else {
            // Fallback for development/testing
            console.warn('No storage API available, mock save successful');
            resolve();
          }
        });
      }
    }
  },
  runtime: {
    sendMessage: (message) => {
      return new Promise((resolve, reject) => {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(response);
            }
          });
        } else if (typeof browser !== 'undefined' && browser.runtime) {
          browser.runtime.sendMessage(message).then(resolve).catch(reject);
        } else {
          // Fallback for development/testing
          console.warn('No runtime API available, message not sent:', message);
          resolve({ success: false, error: 'No runtime API available' });
        }
      });
    },
    onMessage: {
      addListener: (callback) => {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            const result = callback(message, sender);
            if (result && result instanceof Promise) {
              result.then(sendResponse);
              return true; // Keep the message channel open for async response
            }
            return false;
          });
        } else if (typeof browser !== 'undefined' && browser.runtime) {
          browser.runtime.onMessage.addListener(callback);
        } else {
          console.warn('No runtime API available, listener not added');
        }
      }
    }
  },
  notifications: {
    create: (options) => {
      if (typeof chrome !== 'undefined' && chrome.notifications) {
        chrome.notifications.create(options);
      } else if (typeof browser !== 'undefined' && browser.notifications) {
        browser.notifications.create(options);
      } else {
        console.warn('No notifications API available, notification not shown:', options);
      }
    }
  }
};

// Detect email platform
const isGmail = window.location.hostname.includes('mail.google.com');
const isYahoo = window.location.hostname.includes('yahoo.com');
const emailPlatform = isGmail ? 'Gmail' : isYahoo ? 'Yahoo Mail' : 'Unknown';

console.log(`Mail Tracker Pro: Initializing on ${emailPlatform}`);

/**
 * Main initialization
 */
function init() {
  console.log('Mail Tracker Pro: Content script loaded and initialized');
  
  // Start checking for compose windows
  setInterval(checkForComposeWindows, CHECK_INTERVAL);
  
  // Start checking for sent items to add tooltips
  setInterval(injectStatusTooltipIntoSentItems, TOOLTIP_REFRESH_INTERVAL);
  
  // Listen for messages from background script
  browserAPI.runtime.onMessage.addListener((message) => {
    if (message.type === 'EMAIL_OPENED') {
      console.log('Received email opened notification:', message.data);
      markEmailAsOpened(message.data.trackingId, message.data.timestamp);
      return Promise.resolve({ success: true });
    }
    return Promise.resolve({ success: false, error: 'Unknown message type' });
  });
}

/**
 * Check for compose windows and add tracking functionality
 */
function checkForComposeWindows() {
  const composeWindows = findComposeWindows();
  
  if (composeWindows.length === 0) return;
  
  composeWindows.forEach(window => {
    if (isComposeWindow(window) && !window.dataset.trackerAdded) {
      console.log('Mail Tracker Pro: Found new compose window, adding tracking functionality');
      addTrackingButton(window);
      window.dataset.trackerAdded = 'true';
    }
  });
}

/**
 * Find compose windows based on the email platform
 */
function findComposeWindows() {
  if (isGmail) {
    return document.querySelectorAll('[role="dialog"]');
  } else if (isYahoo) {
    // Enhanced Yahoo Mail compose window detection
    const selectors = [
      '[data-test-id="compose-dialog"]',
      '.compose-container',
      '[aria-label*="Compose"]',
      '.compose-window',
      '[data-test-id="rte-container"]',
      '.D_F', // Yahoo's compose class
      '[role="dialog"]',
      '.compose-popup',
      '.compose-view'
    ];
    
    for (let selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        return Array.from(elements);
      }
    }
    
    // Fallback: look for any container with compose elements
    const allElements = document.querySelectorAll('body *');
    const possibleComposeWindows = [];
    
    for (let element of allElements) {
      if (element.querySelector && 
          (element.querySelector('input[placeholder*="To"]') || 
           element.querySelector('[data-test-id="to-field"]') ||
           element.querySelector('button[aria-label*="Send"]'))) {
        possibleComposeWindows.push(element);
      }
    }
    
    return possibleComposeWindows;
  }
  
  return [];
}

/**
 * Check if an element is actually a compose window
 */
function isComposeWindow(window) {
  if (isGmail) {
    return window.querySelector('input[name="to"]') || 
           window.querySelector('[aria-label*="To"]') ||
           window.querySelector('[data-tooltip="Send"]');
  } else if (isYahoo) {
    // Enhanced Yahoo Mail detection
    const indicators = [
      () => window.querySelector('[data-test-id="to-field"]'),
      () => window.querySelector('input[placeholder*="To"]'),
      () => window.querySelector('[data-test-id="compose-send-button"]'),
      () => window.querySelector('button[aria-label*="Send"]'),
      () => window.querySelector('[aria-label*="To"]'),
      () => window.querySelector('[aria-label*="Subject"]'),
      () => window.querySelector('input[name="to"]'),
      () => window.querySelector('input[name="subject"]'),
      () => window.querySelector('.btn-send'),
      () => window.querySelector('[data-test-id="rte"]')
    ];
    
    return indicators.some(check => {
      try {
        return check();
      } catch (e) {
        return false;
      }
    });
  }
  return false;
}

/**
 * Add tracking button to compose window
 */
function addTrackingButton(composeWindow) {
  const sendButton = findSendButton(composeWindow);
  
  if (!sendButton) {
    console.log('Mail Tracker Pro: Could not find send button, trying alternative placement');
    tryAlternativeButtonPlacement(composeWindow);
    return;
  }
  
  // Create tracking button
  const trackButton = createTrackingButton(composeWindow);
  
  // Try to insert the button next to the send button
  try {
    if (sendButton.parentElement) {
      sendButton.parentElement.insertBefore(trackButton, sendButton.nextSibling);
    } else {
      sendButton.insertAdjacentElement('afterend', trackButton);
    }
    console.log('Mail Tracker Pro: Tracking button added successfully');
  } catch (error) {
    console.log('Mail Tracker Pro: Error inserting button:', error);
    tryAlternativeButtonPlacement(composeWindow, trackButton);
  }
}

/**
 * Create tracking button with all event handlers
 */
function createTrackingButton(composeWindow) {
  const trackButton = document.createElement('button');
  trackButton.textContent = 'Track';
  trackButton.type = 'button'; // Prevent form submission
  trackButton.className = 'mail-tracker-btn';
  trackButton.style.cssText = `
    margin-left: 10px;
    padding: 8px 12px;
    background: #6c757d;
    color: white;
    border: 1px solid #6c757d;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    font-family: inherit;
    z-index: 9999;
    position: relative;
  `;
  
  let isTracking = false;
  let trackingId = null;
  
  trackButton.onclick = function(e) {
    e.preventDefault();
    e.stopPropagation();
    isTracking = !isTracking;
    
    if (isTracking) {
      trackButton.textContent = 'Tracking Enabled';
      trackButton.style.background = '#28a745'; // Green for enabled
      trackButton.style.borderColor = '#28a745';
      composeWindow.dataset.tracking = 'true';
      
      trackingId = 'track_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
      composeWindow.dataset.trackingId = trackingId;
      
      injectTrackingPixel(composeWindow, trackingId);
      setupSendTracking(composeWindow);
    } else {
      trackButton.textContent = 'Track';
      trackButton.style.background = '#6c757d';
      trackButton.style.borderColor = '#6c757d';
      composeWindow.dataset.tracking = 'false';
      
      removeTrackingContent(composeWindow);
    }
  };
  
  return trackButton;
}

/**
 * Try alternative button placement methods
 */
function tryAlternativeButtonPlacement(composeWindow, trackButton = null) {
  console.log('Mail Tracker Pro: Trying alternative button placement...');
  
  // Create button if not provided
  if (!trackButton) {
    trackButton = createTrackingButton(composeWindow);
    // Override styles for fixed positioning
    trackButton.style.cssText += `
      position: fixed;
      top: 10px;
      right: 10px;
      margin: 10px;
      z-index: 99999;
    `;
  }
  
  // Try to place button in various locations
  const placements = [
    () => composeWindow.appendChild(trackButton),
    () => composeWindow.prepend(trackButton),
    () => document.body.appendChild(trackButton)
  ];
  
  for (let placement of placements) {
    try {
      placement();
      console.log('Mail Tracker Pro: Alternative button placement successful');
      return;
    } catch (error) {
      continue;
    }
  }
  
  console.log('Mail Tracker Pro: All button placement methods failed');
}

/**
 * Find send button in compose window
 */
function findSendButton(composeWindow) {
  if (isGmail) {
    return composeWindow.querySelector('[data-tooltip="Send"]') ||
           composeWindow.querySelector('[aria-label*="Send"]');
  } else if (isYahoo) {
    // Enhanced Yahoo Mail send button detection
    const selectors = [
      '[data-test-id="compose-send-button"]',
      'button[aria-label*="Send"]',
      'button[title*="Send"]',
      '.btn-send',
      '[data-action="send"]',
      'button[type="submit"]',
      '.compose-send-button',
      'button.primary'
    ];
    
    for (let selector of selectors) {
      const button = composeWindow.querySelector(selector);
      if (button) return button;
    }
    
    // Fallback: look for any button containing "Send" text
    const buttons = composeWindow.querySelectorAll('button');
    for (let button of buttons) {
      if (button.textContent?.toLowerCase().includes('send')) {
        return button;
      }
    }
  }
  return null;
}

/**
 * Find email body element in compose window
 */
function findEmailBody(composeWindow) {
  if (isGmail) {
    return composeWindow.querySelector('[contenteditable="true"]');
  } else if (isYahoo) {
    // Enhanced Yahoo Mail email body detection
    const selectors = [
      '[data-test-id="rte"]',
      '[contenteditable="true"]',
      '.rte-content',
      '[role="textbox"]',
      '.compose-body',
      'textarea[name="body"]',
      '.message-body',
      '.compose-message'
    ];
    
    for (let selector of selectors) {
      const body = composeWindow.querySelector(selector);
      if (body) return body;
    }
  }
  return null;
}

/**
 * Inject invisible tracking pixel into email body
 */
function injectTrackingPixel(composeWindow, trackingId) {
  console.log('Mail Tracker Pro: Injecting tracking pixel...');
  
  const emailBody = findEmailBody(composeWindow);
  
  if (!emailBody) {
    console.error('Mail Tracker Pro: Could not find email body element');
    return;
  }
  
  // Create completely invisible tracking container
  const trackingContainer = document.createElement('div');
  trackingContainer.className = 'tracking-container';
  trackingContainer.style.cssText = `
    position: absolute;
    width: 0;
    height: 0;
    overflow: hidden;
    visibility: hidden;
    opacity: 0;
    pointer-events: none;
    line-height: 0;
    font-size: 0;
    margin: 0;
    padding: 0;
    border: none;
    outline: none;
    left: -9999px;
    top: -9999px;
  `;
  
  // Create multiple tracking methods for maximum compatibility
  
  // Method 1: Standard invisible img tag with enhanced hiding
  const pixelImg1 = document.createElement('img');
  pixelImg1.src = `${TRACKING_SERVER}/track/${trackingId}`;
  pixelImg1.alt = '';
  pixelImg1.style.cssText = `
    width: 1px;
    height: 1px;
    position: absolute;
    visibility: hidden;
    opacity: 0;
    display: block;
    border: none;
    outline: none;
    margin: 0;
    padding: 0;
    max-width: 1px;
    max-height: 1px;
    min-width: 0;
    min-height: 0;
    left: -9999px;
    top: -9999px;
  `;
  pixelImg1.id = `tracking-pixel-${trackingId}`;
  
  // Method 2: Zero-dimension approach for maximum compatibility
  const pixelImg2 = document.createElement('img');
  pixelImg2.src = `${TRACKING_SERVER}/track/${trackingId}`;
  pixelImg2.alt = '';
  pixelImg2.width = 0;
  pixelImg2.height = 0;
  pixelImg2.style.cssText = `
    border: none;
    outline: none;
    margin: 0;
    padding: 0;
    display: none;
    position: absolute;
    left: -9999px;
    top: -9999px;
  `;
  
  // Method 3: Background image approach (stealth fallback)
  const pixelDiv = document.createElement('div');
  pixelDiv.style.cssText = `
    width: 1px;
    height: 1px;
    background-image: url('${TRACKING_SERVER}/track/${trackingId}');
    background-size: 1px 1px;
    background-repeat: no-repeat;
    position: absolute;
    visibility: hidden;
    opacity: 0;
    overflow: hidden;
    left: -9999px;
    top: -9999px;
    margin: 0;
    padding: 0;
    border: none;
    outline: none;
  `;
  
  // Method 4: CSS-based invisible pixel (most stealth)
  const stealthPixel = document.createElement('span');
  stealthPixel.style.cssText = `
    display: inline-block;
    width: 0;
    height: 0;
    background: url('${TRACKING_SERVER}/track/${trackingId}') no-repeat;
    background-size: 0 0;
    position: absolute;
    visibility: hidden;
    opacity: 0;
    overflow: hidden;
    margin: 0;
    padding: 0;
    border: none;
    outline: none;
    font-size: 0;
    line-height: 0;
    left: -9999px;
    top: -9999px;
  `;
  
  // Add all tracking methods to container for maximum compatibility
  trackingContainer.appendChild(pixelImg1);
  trackingContainer.appendChild(pixelImg2);
  trackingContainer.appendChild(pixelDiv);
  trackingContainer.appendChild(stealthPixel);
  
  // Insert at the very end of email body to avoid Gmail clipping
  emailBody.appendChild(trackingContainer);
  
  console.log('Mail Tracker Pro: Tracking pixel injected');
}

/**
 * Remove tracking content from compose window
 */
function removeTrackingContent(composeWindow) {
  const emailBody = findEmailBody(composeWindow);
  if (emailBody) {
    const trackingElements = emailBody.querySelectorAll('.tracking-container, [id^="tracking-pixel-"]');
    trackingElements.forEach(el => el.remove());
    console.log('Mail Tracker Pro: Tracking content removed');
  }
}

/**
 * Set up tracking for when email is sent
 */
function setupSendTracking(composeWindow) {
  const sendButton = findSendButton(composeWindow);
  
  if (!sendButton || sendButton.dataset.trackerSetup) return;
  
  sendButton.dataset.trackerSetup = 'true';
  
  sendButton.addEventListener('click', function() {
    if (composeWindow.dataset.tracking === 'true') {
      const trackingId = composeWindow.dataset.trackingId;
      setTimeout(() => handleEmailSent(composeWindow, trackingId), 500);
    }
  });
}

/**
 * Handle when an email with tracking is sent
 */
function handleEmailSent(composeWindow, trackingId) {
  console.log('Mail Tracker Pro: Email sent with tracking ID:', trackingId);
  
  const emailData = extractEmailData(composeWindow);
  emailData.id = trackingId;
  emailData.trackingId = trackingId;
  emailData.sentAt = Date.now();
  emailData.opened = false;
  emailData.status = 'sent';
  emailData.platform = isGmail ? 'Gmail' : 'Yahoo Mail';
  
  // Store tracking data
  browserAPI.storage.local.set({
    [trackingId]: emailData
  }).then(() => {
    console.log('Mail Tracker Pro: Email tracking data saved');
    
    // Notify background script to start polling
    browserAPI.runtime.sendMessage({
      type: 'START_POLLING',
      trackingId: trackingId
    }).then(response => {
      console.log('Mail Tracker Pro: Background polling started:', response);
    }).catch(error => {
      console.error('Mail Tracker Pro: Failed to start background polling:', error);
    });
  }).catch(error => {
    console.error('Mail Tracker Pro: Error saving tracking data:', error);
  });
}

/**
 * Extract email data from compose window
 */
function extractEmailData(composeWindow) {
  const recipient = extractRecipient(composeWindow);
  const subject = extractSubject(composeWindow);
  
  return {
    to: recipient,
    subject: subject || 'No Subject',
    preview: extractPreview(composeWindow)
  };
}

/**
 * Extract recipient from compose window
 */
function extractRecipient(composeWindow) {
  if (isGmail) {
    return extractGmailRecipients(composeWindow);
  } else if (isYahoo) {
    return extractYahooRecipients(composeWindow);
  }
  return 'Unknown Recipient';
}

/**
 * Extract recipient from Gmail compose window
 */
function extractGmailRecipients(composeWindow) {
  const recipients = new Set();

  // 1. Gmail chips — check both name (text) and email attributes
  const chipSpans = composeWindow.querySelectorAll('.vN[role="presentation"], [data-hovercard-id]');
  chipSpans.forEach(span => {
    const name = span.textContent.trim();
    const email = span.getAttribute('email') || span.getAttribute('data-hovercard-id');

    if (name && email && email.includes('@')) {
      // If both name and email are visible (but name ≠ email), prefer name
      if (name !== email) {
        recipients.add(name);
      } else {
        recipients.add(email);
      }
    } else if (name) {
      recipients.add(name);
    }
  });

  // 2. Fallback: raw email in input field
  if (recipients.size === 0) {
    const toInputs = composeWindow.querySelectorAll('textarea[name="to"], input[name="to"]');
    toInputs.forEach(input => {
      if (input && input.value) {
        const value = input.value.trim();
        if (value) recipients.add(value);
      }
    });
  }

  // 3. Fallback: if nothing found, use current user email
  if (recipients.size === 0) {
    // Try to get user email from the Gmail interface
    const profileEmailNode = document.querySelector('a[href^="https://myaccount.google.com"]');
    if (profileEmailNode && profileEmailNode.textContent.includes('@')) {
      recipients.add(profileEmailNode.textContent.trim());
    } else {
      recipients.add('Unknown Recipient');
    }
  }

  return recipients.size > 0 ? Array.from(recipients).join(', ') : 'Unknown Recipient';
}

/**
 * Extract recipient from Yahoo Mail compose window
 */
function extractYahooRecipients(composeWindow) {
  const recipients = new Set();
  
  // Try various selectors for Yahoo Mail
  const toSelectors = [
    '[data-test-id="to-field"]',
    'input[placeholder*="To"]',
    '[aria-label*="To"]',
    'input[name="to"]'
  ];
  
  for (let selector of toSelectors) {
    const toField = composeWindow.querySelector(selector);
    if (toField && toField.value) {
      recipients.add(toField.value.trim());
      break;
    }
  }
  
  // If nothing found, check for recipient chips
  if (recipients.size === 0) {
    const chips = composeWindow.querySelectorAll('.pill, .recipient-chip');
    chips.forEach(chip => {
      if (chip.textContent) {
        recipients.add(chip.textContent.trim());
      }
    });
  }
  
  return recipients.size > 0 ? Array.from(recipients).join(', ') : 'Unknown Recipient';
}

/**
 * Extract subject from compose window
 */
function extractSubject(composeWindow) {
  let subjectField;
  
  if (isGmail) {
    const subjectSelectors = ['input[name="subjectbox"]', '[aria-label*="Subject"]'];
    for (let selector of subjectSelectors) {
      subjectField = composeWindow.querySelector(selector);
      if (subjectField && subjectField.value) break;
    }
  } else if (isYahoo) {
    const subjectSelectors = [
      '[data-test-id="subject-field"]',
      'input[placeholder*="Subject"]',
      '[aria-label*="Subject"]',
      'input[name="subject"]'
    ];
    
    for (let selector of subjectSelectors) {
      subjectField = composeWindow.querySelector(selector);
      if (subjectField && subjectField.value) break;
    }
  }
  
  return subjectField && subjectField.value ? subjectField.value.trim() : 'No Subject';
}

/**
 * Extract preview text from email body
 */
function extractPreview(composeWindow) {
  const emailBody = findEmailBody(composeWindow);
  
  if (emailBody) {
    // Clean up text and limit length
    const text = emailBody.textContent || emailBody.innerText || '';
    return text.replace(/\s+/g, ' ').trim().substring(0, 100) + '...';
  }
  
  return 'No preview available';
}

/**
 * Handle when an email is opened
 */
function markEmailAsOpened(trackingId, openedTimestamp) {
  console.log('Mail Tracker Pro: Marking email as opened:', trackingId);
  
  browserAPI.storage.local.get(trackingId).then(result => {
    if (result[trackingId]) {
      const emailData = result[trackingId];
      
      // Only update if not already marked as opened
      if (!emailData.opened) {
        emailData.opened = true;
        emailData.openedAt = openedTimestamp;
        emailData.status = 'opened';
        
        browserAPI.storage.local.set({
          [trackingId]: emailData
        }).then(() => {
          console.log('Mail Tracker Pro: Email marked as opened in storage');
          
          // Show notification
          browserAPI.notifications.create({
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon-48.png'),
            title: 'Email Opened!',
            message: `${emailData.to} opened: ${emailData.subject}`
          });
        });
      }
    }
  }).catch(error => {
    console.error('Mail Tracker Pro: Error marking email as opened:', error);
  });
}

/**
 * Add tracking status tooltips to sent emails
 */
function injectStatusTooltipIntoSentItems() {
  // Only run in Gmail for now
  if (!isGmail) return;
  
  const sentRows = document.querySelectorAll('[role="main"] .zA');
  if (!sentRows.length) return;

  browserAPI.storage.local.get(null).then(storage => {
    Object.entries(storage).forEach(([id, email]) => {
      if (!id.startsWith('track_')) return;

      sentRows.forEach(row => {
        if (row.dataset.trackerAttached === 'true') return;

        const subjectEl = row.querySelector('.bog');
        if (!subjectEl) return;

        // Try to match by subject
        if (subjectEl.textContent.includes(email.subject)) {
          row.dataset.trackerAttached = 'true';

          // Create tracking icon
          const trackingIcon = document.createElement('span');
          trackingIcon.className = 'mail-tracker-icon';
          trackingIcon.textContent = email.opened ? '👁️' : '🔄';
          trackingIcon.title = email.opened ? 'Opened' : 'Not yet opened';
          trackingIcon.style.cssText = `
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-left: 8px;
            font-size: 14px;
            cursor: pointer;
            color: ${email.opened ? '#10b981' : '#6b7280'};
          `;

          // Create tooltip
          const tooltip = document.createElement('div');
          tooltip.className = 'mail-tracker-tooltip';
          tooltip.style.cssText = `
            position: absolute;
            background: white;
            color: #111827;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 12px;
            font-size: 13px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            z-index: 9999;
            display: none;
            min-width: 200px;
            max-width: 300px;
          `;

          // Prepare tooltip content
          let statusText = '<span style="color: #6b7280;">Not yet opened</span>';
          let timeInfo = '';
          let openInfo = '';

          if (email.opened) {
            const openedDate = new Date(email.openedAt);
            const formattedDate = openedDate.toLocaleDateString();
            const formattedTime = openedDate.toLocaleTimeString([], {
              hour: '2-digit', 
              minute: '2-digit'
            });
            
            statusText = '<span style="color: #10b981; font-weight: 500;">Opened</span>';
            timeInfo = `<div style="margin-top: 8px;">
                          <strong>Opened on:</strong> ${formattedDate} at ${formattedTime}
                        </div>`;
          }

          // Calculate time since sent
          const sentDate = new Date(email.sentAt);
          const formattedSentDate = sentDate.toLocaleDateString();
          const formattedSentTime = sentDate.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          });

          tooltip.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 8px;">Tracking Status: ${statusText}</div>
            <div><strong>To:</strong> ${email.to}</div>
            <div><strong>Subject:</strong> ${email.subject}</div>
            <div style="margin-top: 8px;">
              <strong>Sent on:</strong> ${formattedSentDate} at ${formattedSentTime}
            </div>
            ${timeInfo}
          `;

          // Show tooltip on hover
          trackingIcon.addEventListener('mouseenter', (e) => {
            const rect = trackingIcon.getBoundingClientRect();
            tooltip.style.left = (rect.right + 10) + 'px';
            tooltip.style.top = (rect.top - 10) + 'px';
            tooltip.style.display = 'block';
          });

          trackingIcon.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
          });

          document.body.appendChild(tooltip);
          subjectEl.appendChild(trackingIcon);
        }
      });
    });
  }).catch(error => {
    console.error('Mail Tracker Pro: Error fetching tracking data for tooltips:', error);
  });
}

/**
 * Test if tracking pixel URL is accessible
 */
function testPixelURL(trackingId) {
  const testUrl = `${TRACKING_SERVER}/track/${trackingId}`;
  
  fetch(testUrl, {
    method: 'HEAD',
    cache: 'no-store',
    headers: {
      'ngrok-skip-browser-warning': 'true' // For local development with ngrok
    }
  })
    .then(response => {
      if (response.ok) {
        console.log('Mail Tracker Pro: Tracking pixel URL is accessible');
      } else {
        console.warn(`Mail Tracker Pro: Tracking pixel URL returned status ${response.status}`);
      }
    })
    .catch(error => {
      console.error('Mail Tracker Pro: Tracking pixel URL test failed:', error);
    });
}

// Initialize when page loads
window.addEventListener('load', init);
