import { TRACKING_SERVER } from './config.js';

// Background script for polling server
console.log('🚀 Mail Tracker: Background script with network capabilities');

const activePolling = new Map();

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Background received message:', message.type);
  
  if (message.type === 'START_POLLING') {
    console.log('🎯 Starting background polling for:', message.trackingId);
    startBackgroundPolling(message.trackingId);
    sendResponse({ success: true, message: 'Background polling started' });
  }
  
  return true;
});

function startBackgroundPolling(trackingId) {
  if (activePolling.has(trackingId)) {
    console.log('⚠️ Already polling:', trackingId);
    return;
  }
  
  console.log('🔄 Background polling started for:', trackingId);
  
  let pollCount = 0;
  const maxPolls = 288; 
  
  const pollInterval = setInterval(async () => {
    pollCount++;
    console.log(`📊 Background poll ${pollCount} for:`, trackingId);
    
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
      console.log('📈 Background server response:', data);
      
      if (data.opened && data.events && data.events.length > 0) {
        console.log('🎉 Email opened detected by background!', trackingId);
        clearInterval(pollInterval);
        activePolling.delete(trackingId);
        
        updateEmailStatusInStorage(trackingId, data.events[0].timestamp);
        
      } else {
        console.log('📭 Email not opened yet');
      }
    } catch (error) {
      console.error('❌ Background polling error:', error.message);
    }
    
    if (pollCount >= maxPolls) {
      clearInterval(pollInterval);
      activePolling.delete(trackingId);
      console.log('⏰ Stopped background polling after 24 hours:', trackingId);
    }
  }, 5000);
  
  activePolling.set(trackingId, pollInterval);
}

//Update email status in storage
function updateEmailStatusInStorage(trackingId, openedTimestamp) {
  console.log('💾 Updating email status in storage for:', trackingId);
  
  browser.storage.local.get(trackingId).then(result => {
    if (result[trackingId]) {
      const emailData = result[trackingId];
      
      // Update the email data
      emailData.opened = true;
      emailData.openedAt = openedTimestamp;
      emailData.status = 'opened';
      
      console.log('📝 Updated email data:', emailData);
      
      // Save back to storage
      browser.storage.local.set({
        [trackingId]: emailData
      }).then(() => {
        console.log('✅ Email status updated in storage successfully!');
        
        // Send message to content script
        browser.runtime.sendMessage({
          type: 'EMAIL_OPENED',
          data: {
            trackingId: trackingId,
            timestamp: openedTimestamp,
            emailData: emailData
          }
        }).catch(error => {
          console.log('📝 Content script not active (normal if not on email page)');
        });
        
        // Show notification
        browser.notifications.create({
          type: 'basic',
          iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
          title: '🎉 Email Opened!',
          message: `${emailData.to} opened: ${emailData.subject || 'your email'}`
        });
        
      }).catch(error => {
        console.error('❌ Failed to update storage:', error);
      });
      
    } else {
      console.error('❌ Email data not found in storage for:', trackingId);
      
      //List all storage items
      browser.storage.local.get(null).then(allItems => {
        console.log('📋 All storage items:', Object.keys(allItems));
      });
    }
  }).catch(error => {
    console.error('❌ Failed to get email data from storage:', error);
  });
}
