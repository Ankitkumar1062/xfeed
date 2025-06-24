/**
 * Mail Tracker Pro - Background script
 * Handles tracking server communication, polling, and notifications
 */

const TRACKING_SERVER = 'https://mail-931k.onrender.com';
const INITIAL_POLL_INTERVAL = 5000; // 5 seconds
const MAX_POLL_INTERVAL = 300000; // 5 minutes
const MAX_POLL_DURATION = 86400000; // 24 hours

// State management
const activePolling = new Map();
const openedEmails = new Set();
const notifiedEmails = new Set(); // Track which emails we've already notified about

// Browser API compatibility layer
const browserAPI = {
  runtime: {
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
        }
      }
    },
    sendMessage: (message) => {
      return new Promise((resolve, reject) => {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
              console.log('Message sending error (normal if page not active):', chrome.runtime.lastError.message);
              resolve({ success: false, error: chrome.runtime.lastError.message });
            } else {
              resolve(response || { success: true });
            }
          });
        } else if (typeof browser !== 'undefined' && browser.runtime) {
          browser.runtime.sendMessage(message).then(resolve).catch(reject);
        } else {
          reject(new Error('No runtime API available'));
        }
      });
    },
    getURL: (path) => {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        return chrome.runtime.getURL(path);
      } else if (typeof browser !== 'undefined' && browser.runtime) {
        return browser.runtime.getURL(path);
      }
      return path;
    }
  },
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
            reject(new Error('No storage API available'));
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
            reject(new Error('No storage API available'));
          }
        });
      }
    }
  },
  notifications: {
    create: (id, options) => {
      const notificationId = id || `mail-tracker-${Date.now()}`;
      
      if (typeof chrome !== 'undefined' && chrome.notifications) {
        chrome.notifications.create(notificationId, options);
      } else if (typeof browser !== 'undefined' && browser.notifications) {
        browser.notifications.create(notificationId, options);
      } else {
        console.warn('No notifications API available');
      }
      
      return notificationId;
    }
  },
  alarms: {
    create: (name, alarmInfo) => {
      if (typeof chrome !== 'undefined' && chrome.alarms) {
        chrome.alarms.create(name, alarmInfo);
      } else if (typeof browser !== 'undefined' && browser.alarms) {
        browser.alarms.create(name, alarmInfo);
      } else {
        console.warn('No alarms API available');
      }
    },
    onAlarm: {
      addListener: (callback) => {
        if (typeof chrome !== 'undefined' && chrome.alarms) {
          chrome.alarms.onAlarm.addListener(callback);
        } else if (typeof browser !== 'undefined' && browser.alarms) {
          browser.alarms.onAlarm.addListener(callback);
        }
      }
    },
    clear: (name) => {
      if (typeof chrome !== 'undefined' && chrome.alarms) {
        chrome.alarms.clear(name);
      } else if (typeof browser !== 'undefined' && browser.alarms) {
        browser.alarms.clear(name);
      }
    }
  }
};

// Initialize the background script
function init() {
  console.log('Mail Tracker Pro: Background script initialized');
  
  // Load active tracking sessions from storage
  restoreTrackingSessions();
  
  // Set up notification click handler
  setupNotificationHandlers();
}

// Set up message listeners
browserAPI.runtime.onMessage.addListener((message, sender) => {
  console.log('Mail Tracker Pro: Background received message:', message.type);
  
  if (message.type === 'START_POLLING') {
    startBackgroundPolling(message.trackingId);
    return Promise.resolve({ success: true, message: 'Background polling started' });
  }
  
  return Promise.resolve({ success: false, error: 'Unknown message type' });
});

/**
 * Restore tracking sessions after browser restart
 */
async function restoreTrackingSessions() {
  try {
    const storage = await browserAPI.storage.local.get('activeTrackingSessions');
    
    if (storage.activeTrackingSessions) {
      const sessions = storage.activeTrackingSessions;
      console.log('Mail Tracker Pro: Restoring tracking sessions:', sessions);
      
      // Start polling for each saved tracking ID
      Object.keys(sessions).forEach(trackingId => {
        const session = sessions[trackingId];
        
        // If the session is still valid (within 24-hour window)
        if (Date.now() - session.startTime < MAX_POLL_DURATION) {
          console.log(`Mail Tracker Pro: Resuming polling for ${trackingId}`);
          startBackgroundPolling(trackingId, true);
        }
      });
    }
  } catch (error) {
    console.error('Mail Tracker Pro: Error restoring tracking sessions:', error);
  }
}

/**
 * Set up notification click handler
 */
function setupNotificationHandlers() {
  if (typeof chrome !== 'undefined' && chrome.notifications) {
    chrome.notifications.onClicked.addListener((notificationId) => {
      if (notificationId.startsWith('mail-tracker-')) {
        // Open extension popup or options page
        chrome.action?.openPopup();
      }
    });
  } else if (typeof browser !== 'undefined' && browser.notifications) {
    browser.notifications.onClicked.addListener((notificationId) => {
      if (notificationId.startsWith('mail-tracker-')) {
        browser.browserAction?.openPopup();
      }
    });
  }
}

/**
 * Start background polling for email open detection
 * @param {string} trackingId - The tracking ID to poll for
 * @param {boolean} isRestored - Whether this is restored from a previous session
 */
async function startBackgroundPolling(trackingId, isRestored = false) {
  // Don't start if already polling
  if (activePolling.has(trackingId)) {
    console.log('Mail Tracker Pro: Already polling for', trackingId);
    return;
  }
  
  // Don't start if already opened
  if (openedEmails.has(trackingId)) {
    console.log('Mail Tracker Pro: Email already marked as opened:', trackingId);
    return;
  }
  
  console.log('Mail Tracker Pro: Starting background polling for', trackingId);
  
  // Save to active sessions
  await saveTrackingSession(trackingId);
  
  // Set up adaptive polling with exponential backoff
  let pollCount = 0;
  let currentInterval = INITIAL_POLL_INTERVAL;
  let startTime = isRestored ? Date.now() : Date.now();
  
  // Create state object
  const state = {
    trackingId,
    startTime,
    pollCount: 0,
    lastPollTime: 0,
    currentInterval
  };
  
  // Schedule first poll
  schedulePoll(state);
  
  // Add to active polling map
  activePolling.set(trackingId, state);
}

/**
 * Schedule a poll with the current state
 * @param {Object} state - The polling state
 */
function schedulePoll(state) {
  const { trackingId, currentInterval } = state;
  
  // Check if we've been polling for too long
  if (Date.now() - state.startTime >= MAX_POLL_DURATION) {
    console.log(`Mail Tracker Pro: Stopping polling for ${trackingId} after 24 hours`);
    stopPolling(trackingId);
    return;
  }
  
  // Schedule next poll using setTimeout
  state.timerId = setTimeout(async () => {
    state.pollCount++;
    state.lastPollTime = Date.now();
    
    console.log(`Mail Tracker Pro: Poll #${state.pollCount} for ${trackingId}`);
    
    try {
      await checkEmailStatus(trackingId);
      
      // Increase interval with exponential backoff (up to max interval)
      if (state.pollCount > 10) {
        state.currentInterval = Math.min(state.currentInterval * 1.5, MAX_POLL_INTERVAL);
      }
      
      // Schedule next poll
      schedulePoll(state);
      
    } catch (error) {
      console.error(`Mail Tracker Pro: Error polling ${trackingId}:`, error);
      
      // If there was an error, increase backoff more aggressively
      state.currentInterval = Math.min(state.currentInterval * 2, MAX_POLL_INTERVAL);
      schedulePoll(state);
    }
  }, currentInterval);
}

/**
 * Save the tracking session to persistent storage
 * @param {string} trackingId - The tracking ID
 */
async function saveTrackingSession(trackingId) {
  try {
    const storage = await browserAPI.storage.local.get('activeTrackingSessions');
    const sessions = storage.activeTrackingSessions || {};
    
    sessions[trackingId] = {
      startTime: Date.now(),
      lastCheck: Date.now()
    };
    
    await browserAPI.storage.local.set({ activeTrackingSessions: sessions });
  } catch (error) {
    console.error('Mail Tracker Pro: Error saving tracking session:', error);
  }
}

/**
 * Stop polling for a tracking ID
 * @param {string} trackingId - The tracking ID to stop polling for
 */
async function stopPolling(trackingId) {
  if (!activePolling.has(trackingId)) {
    return;
  }
  
  const state = activePolling.get(trackingId);
  
  // Clear the timer
  if (state.timerId) {
    clearTimeout(state.timerId);
  }
  
  // Remove from active polling map
  activePolling.delete(trackingId);
  
  // Remove from active sessions in storage
  try {
    const storage = await browserAPI.storage.local.get('activeTrackingSessions');
    const sessions = storage.activeTrackingSessions || {};
    
    if (sessions[trackingId]) {
      delete sessions[trackingId];
      await browserAPI.storage.local.set({ activeTrackingSessions: sessions });
    }
  } catch (error) {
    console.error('Mail Tracker Pro: Error removing tracking session:', error);
  }
  
  console.log(`Mail Tracker Pro: Stopped polling for ${trackingId}`);
}

/**
 * Check email status with the tracking server
 * @param {string} trackingId - The tracking ID to check
 */
async function checkEmailStatus(trackingId) {
  try {
    const response = await fetch(`${TRACKING_SERVER}/api/tracking/${trackingId}`, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Check if email has been opened
    if (data.opened && data.events && data.events.length > 0) {
      console.log(`Mail Tracker Pro: Email opened detected for ${trackingId}!`);
      
      // Stop polling for this email
      stopPolling(trackingId);
      
      // Add to opened emails set
      openedEmails.add(trackingId);
      
      // Update email status in storage
      await updateEmailStatusInStorage(trackingId, data.events[0].timestamp);
      
      // Return true to indicate the email was opened
      return true;
    }
    
    // Email not opened yet
    return false;
  } catch (error) {
    console.error(`Mail Tracker Pro: Error checking email status for ${trackingId}:`, error);
    throw error;
  }
}

/**
 * Update email status in storage with notification deduplication
 * @param {string} trackingId - The tracking ID
 * @param {number} openedTimestamp - The timestamp when the email was opened
 */
function updateEmailStatusInStorage(trackingId, openedTimestamp) {
  console.log('Updating email status in storage for:', trackingId);
  
  // Check if we've already notified about this email
  if (notifiedEmails.has(trackingId)) {
    console.log('Already notified about this email, updating data only');
    
    // Still update the status in storage, but don't show a notification
    browserAPI.storage.local.get(trackingId).then(result => {
      if (result[trackingId]) {
        const emailData = result[trackingId];
        emailData.opened = true;
        emailData.openedAt = openedTimestamp;
        emailData.status = 'opened';
        
        browserAPI.storage.local.set({
          [trackingId]: emailData
        }).catch(error => {
          console.error('Failed to update storage:', error);
        });
      }
    });
    
    return; // Exit early - no notification
  }
  
  // First time we've seen this open event
  browserAPI.storage.local.get(trackingId).then(result => {
    if (result[trackingId]) {
      const emailData = result[trackingId];
      
      // Update the email data
      emailData.opened = true;
      emailData.openedAt = openedTimestamp;
      emailData.status = 'opened';
      
      // Save back to storage
      browserAPI.storage.local.set({
        [trackingId]: emailData
      }).then(() => {
        console.log('Email status updated in storage successfully!');
        
        // Mark as notified to prevent duplicate notifications
        notifiedEmails.add(trackingId);
        
        // Send message to content script
        browserAPI.runtime.sendMessage({
          type: 'EMAIL_OPENED',
          data: {
            trackingId: trackingId,
            timestamp: openedTimestamp,
            emailData: emailData
          }
        }).catch(error => {
          console.log('Content script not active (normal if not on email page)');
        });
        
        // Show notification
        browserAPI.notifications.create(`mail-tracker-${trackingId}`, {
          type: 'basic',
          iconUrl: browserAPI.runtime.getURL('icons/icon-48.png'),
          title: 'Email Opened!',
          message: `${emailData.to} opened: ${emailData.subject || 'your email'}`,
          // Add a timeout to auto-close the notification
          requireInteraction: false
        });
        
      }).catch(error => {
        console.error('Failed to update storage:', error);
      });
    } else {
      console.error('Email data not found in storage for:', trackingId);
    }
  }).catch(error => {
    console.error('Failed to get email data from storage:', error);
  });
}

// Add this cleanup code to periodically clear very old notifications
// This prevents the Set from growing too large over time
setInterval(() => {
  // Keep the Set from growing too large by periodically clearing old entries
  // after a reasonable time (e.g., 7 days)
  if (notifiedEmails.size > 1000) {
    console.log('Clearing notification history (size exceeded 1000)');
    notifiedEmails.clear();
  }
}, 24 * 60 * 60 * 1000); // Check once per day

// Memory management - clean up open email records periodically
setInterval(() => {
  // Clean up opened emails older than 7 days
  browserAPI.storage.local.get(null).then(allItems => {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    Object.entries(allItems).forEach(([key, value]) => {
      if (key.startsWith('track_') && 
          value.opened && 
          value.openedAt < sevenDaysAgo) {
        openedEmails.add(key);
      }
    });
  }).catch(error => {
    console.error('Mail Tracker Pro: Error cleaning up opened emails:', error);
  });
}, 24 * 60 * 60 * 1000); // Once per day

// Initialize when loaded
init();
