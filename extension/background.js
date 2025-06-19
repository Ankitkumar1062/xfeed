// Background script for X Feed Viewer

// Listen for when the extension is installed or updated
chrome.runtime.onInstalled.addListener(function() {
  console.log('X Feed Viewer extension installed');
  
  // Initialize storage with empty values if they don't exist
  chrome.storage.sync.get(['savedFeeds', 'currentFeed'], function(data) {
    if (!data.savedFeeds) {
      chrome.storage.sync.set({ savedFeeds: [] });
    }
    
    if (data.currentFeed === undefined) {
      chrome.storage.sync.set({ currentFeed: null });
    }
  });
});

// Listen for messages
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Background script received message:', request);
  
  if (request.action === 'logStorage') {
    chrome.storage.sync.get(null, function(data) {
      console.log('Current storage:', data);
    });
  }
  
  return true;
});
