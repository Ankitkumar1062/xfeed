document.addEventListener('DOMContentLoaded', function() {
  // Configuration
  const apiBaseUrl = 'http://localhost:3000/api'; // Change this to your backend URL
  
  // Elements
  const serverStatus = document.getElementById('server-status');
  const saveTokenButton = document.getElementById('save-token');
  const usernameInput = document.getElementById('username');
  const tokenInput = document.getElementById('token');
  const feedList = document.getElementById('feed-list');
  const currentFeed = document.getElementById('current-feed');
  const viewOwnFeedButton = document.getElementById('view-own-feed');
  const refreshFeedButton = document.getElementById('refresh-feed');

  // Check server status
  checkServerStatus();
  
  // Load saved feeds
  loadSavedFeeds();

  // Event Listeners
  saveTokenButton.addEventListener('click', saveToken);
  viewOwnFeedButton.addEventListener('click', viewOwnFeed);
  refreshFeedButton.addEventListener('click', refreshCurrentFeed);

  // Functions
  function checkServerStatus() {
    fetch(`${apiBaseUrl}/health`)
      .then(response => {
        if (response.ok) {
          serverStatus.textContent = 'Server online';
          serverStatus.className = 'server-status online';
        } else {
          throw new Error('Server not responding');
        }
      })
      .catch(error => {
        console.error('Server check failed:', error);
        serverStatus.textContent = 'Server offline - check configuration';
        serverStatus.className = 'server-status offline';
      });
  }

  function saveToken() {
    const username = usernameInput.value.trim().replace('@', '');
    const token = tokenInput.value.trim();
    
    if (!username || !token) {
      alert('Please enter both username and token');
      return;
    }
    
    // Validate token format
    try {
      const parsedToken = JSON.parse(token);
      if (!parsedToken.auth_token || !parsedToken.ct0) {
        alert('Token must include auth_token and ct0 properties');
        return;
      }
    } catch (e) {
      alert('Token must be valid JSON format');
      return;
    }
    
    // Validate token with server
    fetch(`${apiBaseUrl}/api/validate-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token })
    })
    .then(response => response.json())
    .then(data => {
      if (data.valid) {
        // Save to storage
        saveTokenToStorage(username, token);
      } else {
        alert('The token is invalid. Please check and try again.');
      }
    })
    .catch(error => {
      console.error('Validation error:', error);
      alert('Failed to validate token. Server may be offline.');
    });
  }

  function saveTokenToStorage(username, token) {
    chrome.storage.sync.get('savedFeeds', function(data) {
      const savedFeeds = data.savedFeeds || [];
      
      // Check if username already exists
      const existingIndex = savedFeeds.findIndex(feed => feed.username.toLowerCase() === username.toLowerCase());
      
      if (existingIndex !== -1) {
        // Update existing entry
        savedFeeds[existingIndex].token = token;
      } else {
        // Add new entry
        savedFeeds.push({ username, token });
      }
      
      chrome.storage.sync.set({ savedFeeds }, function() {
        alert(`Feed for @${username} has been saved!`);
        usernameInput.value = '';
        tokenInput.value = '';
        loadSavedFeeds();
      });
    });
  }

  function loadSavedFeeds() {
    chrome.storage.sync.get(['savedFeeds', 'currentFeed'], function(data) {
      const savedFeeds = data.savedFeeds || [];
      const currentFeedUsername = data.currentFeed || null;
      
      // Clear the list
      feedList.innerHTML = '';
      
      // Populate the list
      savedFeeds.forEach(feed => {
        const li = document.createElement('li');
        
        const usernameSpan = document.createElement('span');
        usernameSpan.textContent = `@${feed.username}`;
        li.appendChild(usernameSpan);
        
        if (currentFeedUsername === feed.username) {
          li.classList.add('active');
          currentFeed.textContent = `@${feed.username}`;
        }
        
        li.addEventListener('click', function(e) {
          if (e.target.className !== 'delete-btn') {
            switchToFeed(feed.username);
          }
        });
        
        // Add delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '×';
        deleteBtn.className = 'delete-btn';
        deleteBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          deleteFeed(feed.username);
        });
        
        li.appendChild(deleteBtn);
        feedList.appendChild(li);
      });
      
      if (savedFeeds.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'No feeds saved yet';
        li.style.color = '#657786';
        li.style.fontStyle = 'italic';
        li.style.cursor = 'default';
        feedList.appendChild(li);
        
        currentFeed.textContent = 'None selected';
      }
    });
  }

  function switchToFeed(username) {
    chrome.storage.sync.get('savedFeeds', function(data) {
      const savedFeeds = data.savedFeeds || [];
      const feed = savedFeeds.find(f => f.username.toLowerCase() === username.toLowerCase());
      
      if (feed) {
        chrome.storage.sync.set({ currentFeed: username }, function() {
          // Send message to content script to switch feed
          chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (tabs[0] && (tabs[0].url.includes('twitter.com') || tabs[0].url.includes('x.com'))) {
              chrome.tabs.sendMessage(tabs[0].id, { 
                action: 'switchFeed', 
                username: username,
                token: feed.token
              });
              currentFeed.textContent = `@${username}`;
              loadSavedFeeds(); // Refresh the list to update active state
            } else {
              alert('Please navigate to X.com or Twitter.com to view feeds');
            }
          });
        });
      }
    });
  }

  function viewOwnFeed() {
    chrome.storage.sync.set({ currentFeed: null }, function() {
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs[0] && (tabs[0].url.includes('twitter.com') || tabs[0].url.includes('x.com'))) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'viewOwnFeed' });
          currentFeed.textContent = 'My Own Feed';
          loadSavedFeeds(); // Refresh the list to update active state
        } else {
          alert('Please navigate to X.com or Twitter.com to view feeds');
        }
      });
    });
  }

  function refreshCurrentFeed() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0] && (tabs[0].url.includes('twitter.com') || tabs[0].url.includes('x.com'))) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'refreshFeed' });
      } else {
        alert('Please navigate to X.com or Twitter.com to refresh the feed');
      }
    });
  }

  function deleteFeed(username) {
    if (confirm(`Are you sure you want to remove @${username}'s feed?`)) {
      chrome.storage.sync.get(['savedFeeds', 'currentFeed'], function(data) {
        const savedFeeds = data.savedFeeds || [];
        const currentFeedUsername = data.currentFeed;
        
        const updatedFeeds = savedFeeds.filter(feed => feed.username.toLowerCase() !== username.toLowerCase());
        
        chrome.storage.sync.set({ savedFeeds: updatedFeeds }, function() {
          // If we're deleting the currently active feed, switch to own feed
          if (currentFeedUsername && currentFeedUsername.toLowerCase() === username.toLowerCase()) {
            viewOwnFeed();
          } else {
            loadSavedFeeds();
          }
        });
      });
    }
  }
});
