import { TRACKING_SERVER } from './config.js';

// Complete Multi-platform content script for Gmail and Yahoo Mail
console.log('Mail Tracker: Multi-platform content script loaded');

// Detect which email platform we're on
const isGmail = window.location.hostname.includes('mail.google.com');
const isYahoo = window.location.hostname.includes('yahoo.com');

window.addEventListener('load', function() {
  console.log(`Page loaded on ${isGmail ? 'Gmail' : isYahoo ? 'Yahoo' : 'Unknown'}, starting tracker`);
  initTracker();
});

function initTracker() {
  setInterval(checkForCompose, 2000);
}

function checkForCompose() {
  let composeWindows = [];
  
  if (isGmail) {
    composeWindows = document.querySelectorAll('[role="dialog"]');
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
        composeWindows = Array.from(elements);
        console.log(`Found Yahoo compose windows with selector: ${selector}`);
        break;
      }
    }
    
    // Fallback: look for any container with compose elements
    if (composeWindows.length === 0) {
      const allElements = document.querySelectorAll('*');
      for (let element of allElements) {
        if (element.querySelector && 
            (element.querySelector('input[placeholder*="To"]') || 
             element.querySelector('[data-test-id="to-field"]') ||
             element.querySelector('button[aria-label*="Send"]'))) {
          composeWindows = [element];
          console.log('Found Yahoo compose using fallback method');
          break;
        }
      }
    }
  }
  
  if (composeWindows.length === 0) return;
  
  composeWindows.forEach(window => {
    if (isComposeWindow(window) && !window.dataset.trackerAdded) {
      console.log('Found compose window, adding tracker');
      addTrackingButton(window);
      window.dataset.trackerAdded = 'true';
    }
  });
}

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

function addTrackingButton(composeWindow) {
  console.log('🔧 Adding tracking button to compose window...');
  
  const sendButton = findSendButton(composeWindow);
  
  if (!sendButton) {
    console.log('❌ Could not find send button, trying alternative placement');
    tryAlternativeButtonPlacement(composeWindow);
    return;
  }
  
  console.log('✅ Found send button:', sendButton);
  
  const trackButton = document.createElement('button');
  trackButton.textContent = '📊 Track';
  trackButton.type = 'button'; // Prevent form submission
  trackButton.style.cssText = `
    margin-left: 10px;
    padding: 8px 12px;
    background: #1a73e8;
    color: white;
    border: none;
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
      trackButton.textContent = '✅ Tracking';
      trackButton.style.background = '#34a853';
      composeWindow.dataset.tracking = 'true';
      
      trackingId = 'track_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
      composeWindow.dataset.trackingId = trackingId;
      
      console.log('🎯 Tracking enabled, injecting pixel now...');
      injectTrackingPixel(composeWindow, trackingId);
      
      setupSendTracking(composeWindow);
    } else {
      trackButton.textContent = '📊 Track';
      trackButton.style.background = '#1a73e8';
      composeWindow.dataset.tracking = 'false';
      
      removeTrackingContent(composeWindow);
    }
  };
  
  // Try multiple insertion methods
  try {
    if (sendButton.parentElement) {
      sendButton.parentElement.insertBefore(trackButton, sendButton.nextSibling);
    } else {
      sendButton.insertAdjacentElement('afterend', trackButton);
    }
    console.log('✅ Tracking button added successfully');
  } catch (error) {
    console.log('❌ Error inserting button:', error);
    tryAlternativeButtonPlacement(composeWindow, trackButton);
  }
}

function tryAlternativeButtonPlacement(composeWindow, trackButton = null) {
  console.log('🔄 Trying alternative button placement...');
  
  if (!trackButton) {
    trackButton = document.createElement('button');
    trackButton.textContent = '📊 Track';
    trackButton.type = 'button';
    trackButton.style.cssText = `
      margin: 10px;
      padding: 8px 12px;
      background: #1a73e8;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 99999;
    `;
    
    // Add the same click handler
    let isTracking = false;
    let trackingId = null;
    
    trackButton.onclick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      isTracking = !isTracking;
      
      if (isTracking) {
        trackButton.textContent = '✅ Tracking';
        trackButton.style.background = '#34a853';
        composeWindow.dataset.tracking = 'true';
        
        trackingId = 'track_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        composeWindow.dataset.trackingId = trackingId;
        
        console.log('🎯 Tracking enabled (alternative), injecting pixel now...');
        injectTrackingPixel(composeWindow, trackingId);
        
        setupSendTracking(composeWindow);
      } else {
        trackButton.textContent = '📊 Track';
        trackButton.style.background = '#1a73e8';
        composeWindow.dataset.tracking = 'false';
        
        removeTrackingContent(composeWindow);
      }
    };
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
      console.log('✅ Alternative button placement successful');
      return;
    } catch (error) {
      continue;
    }
  }
  
  console.log('❌ All button placement methods failed');
}

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
      if (button) {
        console.log(`Found Yahoo send button with selector: ${selector}`);
        return button;
      }
    }
    
    // Fallback: look for any button containing "Send" text
    const buttons = composeWindow.querySelectorAll('button');
    for (let button of buttons) {
      if (button.textContent?.toLowerCase().includes('send')) {
        console.log('Found Yahoo send button by text content');
        return button;
      }
    }
  }
  return null;
}

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
      if (body) {
        console.log(`Found Yahoo email body with selector: ${selector}`);
        return body;
      }
    }
  }
  return null;
}

function injectTrackingPixel(composeWindow, trackingId) {
  console.log('🔍 Starting invisible pixel injection process...');
  
  const emailBody = findEmailBody(composeWindow);
  
  if (!emailBody) {
    console.error('❌ Could not find email body element');
    return;
  }
  
  console.log('✅ Found email body, injecting invisible tracking pixel...');
  
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
  
  console.log('✅ Invisible tracking pixel injected successfully');
  console.log('🌐 Pixel URL:', `${TRACKING_SERVER}/track/${trackingId}`);
  console.log('🔒 Tracking ID stored for monitoring:', trackingId);
  console.log('🎭 Stealth mode: Completely invisible to recipients');
  
  testPixelURL(trackingId);
}


function removeTrackingContent(composeWindow) {
  const emailBody = findEmailBody(composeWindow);
  if (emailBody) {
    const trackingElements = emailBody.querySelectorAll('.tracking-container, [id^="tracking-pixel-"]');
    trackingElements.forEach(el => el.remove());
    console.log('🗑️ Invisible tracking content removed');
  }
}


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

function handleEmailSent(composeWindow, trackingId) {
  console.log('📤 Email being sent with tracking ID:', trackingId);
  
  const emailData = extractEmailData(composeWindow);
  emailData.id = trackingId;
  emailData.trackingId = trackingId;
  emailData.sentAt = Date.now();
  emailData.opened = false;
  emailData.status = 'sent';
  emailData.platform = isGmail ? 'Gmail' : 'Yahoo Mail';
  
  console.log('📧 Email data extracted:', emailData);
  
  browser.storage.local.set({
    [emailData.id]: emailData
  }).then(() => {
    console.log('💾 Email data stored, starting polling...');
    startDirectPolling(trackingId);
  });
}

function extractEmailData(composeWindow) {
  let toField, subjectField;
  
  if (isGmail) {
    const toSelectors = ['input[name="to"]', '[aria-label*="To"]', '.vR input', '.aoD input'];
    const subjectSelectors = ['input[name="subjectbox"]', '[aria-label*="Subject"]'];
    
    for (let selector of toSelectors) {
      toField = composeWindow.querySelector(selector);
      if (toField && toField.value) break;
    }
    
    for (let selector of subjectSelectors) {
      subjectField = composeWindow.querySelector(selector);
      if (subjectField && subjectField.value) break;
    }
  } else if (isYahoo) {
    // Enhanced Yahoo Mail selectors
    const toSelectors = [
      '[data-test-id="to-field"]',
      'input[placeholder*="To"]',
      '[aria-label*="To"]',
      'input[name="to"]'
    ];
    
    const subjectSelectors = [
      '[data-test-id="subject-field"]',
      'input[placeholder*="Subject"]',
      '[aria-label*="Subject"]',
      'input[name="subject"]'
    ];
    
    for (let selector of toSelectors) {
      toField = composeWindow.querySelector(selector);
      if (toField && toField.value) break;
    }
    
    for (let selector of subjectSelectors) {
      subjectField = composeWindow.querySelector(selector);
      if (subjectField && subjectField.value) break;
    }
  }
  
  return {
    to: extractToFromGmail(composeWindow),
    subject: subjectField ? subjectField.value : 'No Subject'
  };
}
function extractToFromGmail(composeWindow) {
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
      const value = input.value.trim();
      if (value) recipients.add(value);
    });
  }

  // 3. Fallback: if nothing found, use your own Gmail (for self-send)
  if (recipients.size === 0) {
    const profileEmailNode = document.querySelector('a[href^="https://myaccount.google.com"]');
    if (profileEmailNode && profileEmailNode.textContent.includes('@')) {
      recipients.add(profileEmailNode.textContent.trim());
    }
  }

  return recipients.size > 0 ? Array.from(recipients).join(', ') : 'Unknown';
}



function testPixelURL(trackingId) {
  const testUrl = `${TRACKING_SERVER}/track/${trackingId}`;
  console.log('🧪 Testing pixel URL accessibility:', testUrl);
  
  fetch(testUrl, {
    headers: {
      'ngrok-skip-browser-warning': 'true'
    }
  })
    .then(response => {
      console.log('✅ Pixel URL is accessible, status:', response.status);
    })
    .catch(error => {
      console.error('❌ Pixel URL test failed:', error);
    });
}

// Remove the startDirectPolling function and replace with message passing
function handleEmailSent(composeWindow, trackingId) {
  console.log('📤 Email being sent with tracking ID:', trackingId);
  
  const emailData = extractEmailData(composeWindow);
  emailData.id = trackingId;
  emailData.trackingId = trackingId;
  emailData.sentAt = Date.now();
  emailData.opened = false;
  emailData.status = 'sent';
  emailData.platform = isGmail ? 'Gmail' : 'Yahoo Mail';
  
  console.log('📧 Email data extracted:', emailData);
  
  browser.storage.local.set({
    [emailData.id]: emailData
  }).then(() => {
    console.log('💾 Email data stored, requesting background polling...');
    
    // Send message to background script to start polling
    browser.runtime.sendMessage({
      type: 'START_POLLING',
      trackingId: trackingId
    }).then(response => {
      console.log('✅ Background polling started:', response);
    }).catch(error => {
      console.error('❌ Failed to start background polling:', error);
    });
  });
}

// Remove the startDirectPolling function entirely
// Add listener for background script messages
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EMAIL_OPENED') {
    console.log('🎉 Email opened notification from background:', message.data);
    markEmailAsOpened(message.data.trackingId, message.data.timestamp);
  }
});

function markEmailAsOpened(trackingId, openedTimestamp) {
  console.log('📝 Marking email as opened:', trackingId);
  
  browser.storage.local.get(trackingId).then(result => {
    if (result[trackingId]) {
      const emailData = result[trackingId];
      emailData.opened = true;
      emailData.openedAt = openedTimestamp;
      emailData.status = 'opened';
      
      browser.storage.local.set({
        [trackingId]: emailData
      }).then(() => {
        console.log('✅ Email marked as opened in storage:', trackingId);
        
        browser.notifications.create({
          type: 'basic',
          iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
          title: '🎉 Email Opened!',
          message: `${emailData.to} opened: ${emailData.subject} (via ${emailData.platform})`
        });
      });
    }
  });
}

// Debug function for Yahoo Mail structure
function debugYahooStructure() {
  console.log('🔍 Debugging Yahoo Mail structure...');
  console.log('Current URL:', window.location.href);
  console.log('Available elements:');
  
  const commonSelectors = [
    'button',
    '[data-test-id]',
    '[aria-label]',
    'input',
    'textarea',
    '[contenteditable]',
    '[role="dialog"]',
    '.compose'
  ];
  
  commonSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      console.log(`${selector}: ${elements.length} elements found`);
      elements.forEach((el, index) => {
        if (index < 3) {
          console.log(`  - ${el.tagName} ${el.className} ${el.getAttribute('data-test-id') || ''}`);
        }
      });
    }
  });
}
function injectStatusTooltipIntoSentItems() {
  const sentRows = document.querySelectorAll('[role="main"] .zA'); // Gmail rows

  if (!sentRows.length) return;

  browser.storage.local.get(null).then(storage => {
    Object.entries(storage).forEach(([id, email]) => {
      if (!id.startsWith('track_')) return;

      sentRows.forEach(row => {
        if (row.dataset.trackerAttached === 'true') return;

        const subjectEl = row.querySelector('.bog');
        if (!subjectEl) return;

        const subjectMatches = subjectEl.textContent.includes(email.subject);
        const trackingIdMatches = row.innerHTML.includes(email.trackingId);

        if (subjectMatches) {
          row.dataset.trackerAttached = 'true';

          // 📊 Hover icon
          const hoverIcon = document.createElement('div');
          hoverIcon.textContent = '📊';
          hoverIcon.style.cssText = `
            display: inline-block;
            margin-left: 6px;
            cursor: pointer;
            font-size: 13px;
          `;

          // 🛠 Tooltip element
          const tooltip = document.createElement('div');
          tooltip.style.cssText = `
            position: absolute;
            background: white;
            color: black;
            border: 1px solid #ccc;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            box-shadow: 0px 0px 10px rgba(0,0,0,0.1);
            z-index: 9999;
            display: none;
            white-space: nowrap;
          `;

          if (email.opened) {
            const openedDate = new Date(email.openedAt);
            const formattedTime = openedDate.toLocaleString('en-IN', {
              day: '2-digit', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
              hour12: true
            });

            tooltip.innerHTML = `
              ✅ <strong>Opened</strong><br>
              👀 ${formattedTime}
            `;
          } else {
            tooltip.textContent = '⏳ Not yet opened';
          }

          // Show tooltip on hover
          hoverIcon.addEventListener('mouseenter', (e) => {
            tooltip.style.left = e.pageX + 'px';
            tooltip.style.top = (e.pageY + 15) + 'px';
            tooltip.style.display = 'block';
          });

          hoverIcon.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
          });

          document.body.appendChild(tooltip);
          subjectEl.appendChild(hoverIcon);
        }
      });
    });
  });
}


// Make debug function available globally
window.debugYahooStructure = debugYahooStructure;

setInterval(() => {
  injectStatusTooltipIntoSentItems();
}, 4000); // Every 4 seconds

