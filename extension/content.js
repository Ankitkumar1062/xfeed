// Global variables
let currentUsername = null;
let isCustomFeed = false;
let apiBaseUrl = 'http://localhost:3000'; // Change this to your backend URL

// Initialize when the content script loads
init();

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Message received:', request);
  
  switch(request.action) {
    case 'switchFeed':
      switchToUserFeed(request.username, request.token);
      break;
    case 'viewOwnFeed':
      restoreOriginalFeed();
      break;
    case 'refreshFeed':
      refreshFeed();
      break;
  }
  
  return true;
});

// Initialize the extension
function init() {
  // Check if we have a saved state
  chrome.storage.sync.get('currentFeed', function(data) {
    if (data.currentFeed) {
      // We have a saved feed, let's restore it
      chrome.storage.sync.get('savedFeeds', function(feedData) {
        const savedFeeds = feedData.savedFeeds || [];
        const feed = savedFeeds.find(f => f.username === data.currentFeed);
        
        if (feed) {
          // Wait for the page to be fully loaded
          if (document.readyState === 'complete') {
            switchToUserFeed(feed.username, feed.token);
          } else {
            window.addEventListener('load', function() {
              switchToUserFeed(feed.username, feed.token);
            });
          }
        }
      });
    }
  });
  
  // Observe for timeline changes (Twitter dynamically loads content)
  observeTimelineChanges();
}

// Switch to viewing a user's feed
function switchToUserFeed(username, token) {
  console.log(`Switching to @${username}'s feed`);
  currentUsername = username;
  isCustomFeed = true;
  
  // Fetch the user's feed from our backend
  fetchUserFeed(username, token);
}

// Restore the original feed
function restoreOriginalFeed() {
  console.log('Restoring original feed');
  currentUsername = null;
  isCustomFeed = false;
  
  // Reload the page to get back to the original feed
  window.location.reload();
}

// Refresh the current feed
function refreshFeed() {
  if (isCustomFeed && currentUsername) {
    // Re-fetch the custom feed
    chrome.storage.sync.get('savedFeeds', function(data) {
      const savedFeeds = data.savedFeeds || [];
      const feed = savedFeeds.find(f => f.username === currentUsername);
      
      if (feed) {
        fetchUserFeed(feed.username, feed.token);
      }
    });
  } else {
    // Just reload the page for the original feed
    window.location.reload();
  }
}

// Fetch a user's feed from our backend
function fetchUserFeed(username, token) {
  // Show loading indicator
  showLoadingIndicator();
  
  fetch(`${apiBaseUrl}/api/feed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      username: username,
      token: token
    })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    console.log('Received feed data:', data);
    replaceFeed(data.tweets);
    hideLoadingIndicator();
  })
  .catch(error => {
    console.error('Error fetching feed:', error);
    showError('Failed to load feed. Please check the token and try again.');
    hideLoadingIndicator();
  });
}

// Replace the current feed with the fetched one
function replaceFeed(tweets) {
  // Find the timeline element
  const timeline = document.querySelector('[aria-label="Timeline: Your Home Timeline"]') || 
                   document.querySelector('[data-testid="primaryColumn"]');
  
  if (!timeline) {
    console.error('Could not find timeline element');
    showError('Could not find timeline element. The X/Twitter interface may have changed.');
    return;
  }
  
  // Clear existing timeline content
  const timelineContent = timeline.querySelector('div[aria-label="Timeline: Your Home Timeline"] > div') || 
                          timeline.querySelector('div[data-testid="primaryColumn"] > div > div');
  
  if (timelineContent) {
    // Keep the first child (usually the "Home" header) and remove the rest
    const children = Array.from(timelineContent.children);
    if (children.length > 1) {
      const header = children[0];
      timelineContent.innerHTML = '';
      timelineContent.appendChild(header);
      
      // Add a custom header to indicate we're viewing someone else's feed
      const customHeader = document.createElement('div');
      customHeader.id = 'x-feed-viewer-header';
      customHeader.style.padding = '12px 16px';
      customHeader.style.backgroundColor = '#f7f9fa';
      customHeader.style.borderBottom = '1px solid #cfd9de';
      customHeader.style.color = '#536471';
      customHeader.style.fontWeight = 'bold';
      customHeader.style.fontSize = '15px';
      customHeader.style.textAlign = 'center';
      customHeader.innerHTML = `Viewing <span style="color:#1da1f2">@${currentUsername}</span>'s feed (read-only)`;
      
      timelineContent.appendChild(customHeader);
      
      // Add the tweets
      const tweetsContainer = document.createElement('div');
      tweetsContainer.id = 'x-feed-viewer-tweets';
      
      if (tweets.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.style.padding = '40px 20px';
        emptyState.style.textAlign = 'center';
        emptyState.style.color = '#536471';
        emptyState.innerHTML = 'No tweets found in this feed.';
        tweetsContainer.appendChild(emptyState);
      } else {
        tweets.forEach(tweet => {
          const tweetElement = createTweetElement(tweet);
          tweetsContainer.appendChild(tweetElement);
        });
      }
      
      timelineContent.appendChild(tweetsContainer);
    }
  } else {
    console.error('Could not find timeline content');
    showError('Could not find timeline content. The X/Twitter interface may have changed.');
  }
}

// Create a tweet element from tweet data
function createTweetElement(tweet) {
  const tweetEl = document.createElement('article');
  tweetEl.className = 'css-1dbjc4n r-1loqt21 r-18u37iz r-1ny4l3l r-1udh08x r-1qhn6m8 r-i023vh r-o7ynqc r-6416eg';
  tweetEl.style.padding = '12px 16px';
  tweetEl.style.borderBottom = '1px solid rgb(239, 243, 244)';
  
  // Basic tweet structure - we'll use Twitter's styles to make it look authentic
  tweetEl.innerHTML = `
    <div class="css-1dbjc4n r-18u37iz">
      <div class="css-1dbjc4n r-1wbh5a2 r-dnmrzs">
        <a href="/${tweet.author.username}" class="css-4rbku5 css-18t94o4 css-1dbjc4n r-1wbh5a2 r-dnmrzs r-1ny4l3l">
          <div class="css-1dbjc4n r-1awozwy r-18u37iz r-1wbh5a2">
            <div class="css-1dbjc4n r-1wbh5a2 r-1pi2tsx r-1777fci r-1ny4l3l">
              <div class="css-1dbjc4n r-1adg3ll r-1udh08x" style="height: 48px; width: 48px;">
                <div class="r-1adg3ll r-13qz1uu" style="padding-bottom: 100%"></div>
                <div class="r-1p0dtai r-1pi2tsx r-1d2f490 r-u8s1d r-ipm5af r-13qz1uu">
                  <img src="${tweet.author.profile_image_url}" alt="" class="css-9pa8cd" style="width: 100%; height: 100%; border-radius: 50%;">
                </div>
              </div>
            </div>
          </div>
        </a>
      </div>
      <div class="css-1dbjc4n r-1iusvr4 r-16y2uox r-1777fci r-kzbkwu">
        <div class="css-1dbjc4n r-18u37iz r-1wtj0ep r-1s2bzr4">
          <div class="css-1dbjc4n r-1wbh5a2 r-dnmrzs r-1ny4l3l">
            <div class="css-1dbjc4n r-1wbh5a2 r-dnmrzs r-1ny4l3l">
              <a href="/${tweet.author.username}" class="css-4rbku5 css-18t94o4 css-1dbjc4n r-1awozwy r-18u37iz r-1wbh5a2 r-dnmrzs r-1ny4l3l">
                <div class="css-1dbjc4n r-1awozwy r-18u37iz r-dnmrzs">
                  <div dir="auto" class="css-901oao css-1hf3ou5 r-1bwzh9t r-18u37iz r-37j5jr r-a023e6 r-16dba41 r-rjixqe r-bcqeeo r-qvutc0">
                    <span class="css-901oao css-16my406 r-poiln3 r-bcqeeo r-qvutc0">${tweet.author.name}</span>
                  </div>
                  <div dir="auto" class="css-901oao css-1hf3ou5 r-14j79pv r-18u37iz r-37j5jr r-a023e6 r-16dba41 r-rjixqe r-bcqeeo r-qvutc0">
                    <span class="css-901oao css-16my406 r-poiln3 r-bcqeeo r-qvutc0">@${tweet.author.username}</span>
                  </div>
                </div>
              </a>
            </div>
          </div>
          <div dir="auto" class="css-901oao css-1hf3ou5 r-14j79pv r-37j5jr r-a023e6 r-16dba41 r-rjixqe r-bcqeeo r-qvutc0">
            <span class="css-901oao css-16my406 r-poiln3 r-bcqeeo r-qvutc0">·</span>
          </div>
          <div class="css-1dbjc4n r-18u37iz r-1q142lx">
            <a href="#" class="css-4rbku5 css-18t94o4 css-1dbjc4n r-1loqt21 r-1ny4l3l">
              <div dir="auto" class="css-901oao r-14j79pv r-37j5jr r-a023e6 r-16dba41 r-rjixqe r-bcqeeo r-qvutc0">
                <span class="css-901oao css-16my406 r-poiln3 r-bcqeeo r-qvutc0">${formatDate(tweet.created_at)}</span>
              </div>
            </a>
          </div>
        </div>
        <div class="css-1dbjc4n">
          <div dir="auto" class="css-901oao r-1nao33i r-37j5jr r-a023e6 r-16dba41 r-rjixqe r-bcqeeo r-bnwqim r-qvutc0">
            <span class="css-901oao css-16my406 r-poiln3 r-bcqeeo r-qvutc0">${tweet.text}</span>
          </div>
          ${tweet.media_url ? `
          <div class="css-1dbjc4n r-1udh08x r-1yzf0co r-1v1z2uz" style="margin-top: 12px;">
            <div class="css-1dbjc4n r-1adg3ll r-1ny4l3l">
              <div class="r-1adg3ll r-13qz1uu" style="padding-bottom: 56.25%;"></div>
              <div class="r-1p0dtai r-1pi2tsx r-1d2f490 r-u8s1d r-ipm5af r-13qz1uu">
                <img src="${tweet.media_url}" alt="" class="css-9pa8cd" style="width: 100%; height: 100%; object-fit: cover; border-radius: 16px;">
              </div>
            </div>
          </div>` : ''}
        </div>
        <div class="css-1dbjc4n r-18u37iz r-1wtj0ep r-1s2bzr4 r-1mdbhws" style="margin-top: 12px;">
          <div class="css-1dbjc4n r-18u37iz r-1h0z5md">
            <div class="css-18t94o4 css-1dbjc4n r-1777fci r-bt1l66 r-1ny4l3l r-bztko3 r-lrvibr">
              <div dir="auto" class="css-901oao r-1awozwy r-14j79pv r-6koalj r-37j5jr r-a023e6 r-16dba41 r-1h0z5md r-rjixqe r-bcqeeo r-o7ynqc r-clp7b1 r-3s2u2q r-qvutc0">
                <div class="css-1dbjc4n r-xoduu5">
                  <div class="css-1dbjc4n r-1niwhzg r-sdzlij r-1p0dtai r-xoduu5 r-1d2f490 r-xf4iuw r-1ny4l3l r-u8s1d r-zchlnj r-ipm5af r-o7ynqc r-6416eg"></div>
                  <svg viewBox="0 0 24 24" aria-hidden="true" class="r-4qtqp9 r-yyyyoo r-1xvli5t r-dnmrzs r-bnwqim r-1plcrui r-lrvibr r-1hdv0qi" style="color: rgb(83, 100, 113);"><g><path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z"></path></g></svg>
                </div>
                <div class="css-1dbjc4n r-xoduu5 r-1udh08x">
                  <span>${tweet.reply_count || 0}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="css-1dbjc4n r-18u37iz r-1h0z5md">
            <div class="css-18t94o4 css-1dbjc4n r-1777fci r-bt1l66 r-1ny4l3l r-bztko3 r-lrvibr">
              <div dir="auto" class="css-901oao r-1awozwy r-14j79pv r-6koalj r-37j5jr r-a023e6 r-16dba41 r-1h0z5md r-rjixqe r-bcqeeo r-o7ynqc r-clp7b1 r-3s2u2q r-qvutc0">
                <div class="css-1dbjc4n r-xoduu5">
                  <div class="css-1dbjc4n r-1niwhzg r-sdzlij r-1p0dtai r-xoduu5 r-1d2f490 r-xf4iuw r-1ny4l3l r-u8s1d r-zchlnj r-ipm5af r-o7ynqc r-6416eg"></div>
                  <svg viewBox="0 0 24 24" aria-hidden="true" class="r-4qtqp9 r-yyyyoo r-1xvli5t r-dnmrzs r-bnwqim r-1plcrui r-lrvibr r-1hdv0qi" style="color: rgb(83, 100, 113);"><g><path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"></path></g></svg>
                </div>
                <div class="css-1dbjc4n r-xoduu5 r-1udh08x">
                  <span>${tweet.retweet_count || 0}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="css-1dbjc4n r-18u37iz r-1h0z5md">
            <div class="css-18t94o4 css-1dbjc4n r-1777fci r-bt1l66 r-1ny4l3l r-bztko3 r-lrvibr">
              <div dir="auto" class="css-901oao r-1awozwy r-14j79pv r-6koalj r-37j5jr r-a023e6 r-16dba41 r-1h0z5md r-rjixqe r-bcqeeo r-o7ynqc r-clp7b1 r-3s2u2q r-qvutc0">
                <div class="css-1dbjc4n r-xoduu5">
                  <div class="css-1dbjc4n r-1niwhzg r-sdzlij r-1p0dtai r-xoduu5 r-1d2f490 r-xf4iuw r-1ny4l3l r-u8s1d r-zchlnj r-ipm5af r-o7ynqc r-6416eg"></div>
                  <svg viewBox="0 0 24 24" aria-hidden="true" class="r-4qtqp9 r-yyyyoo r-1xvli5t r-dnmrzs r-bnwqim r-1plcrui r-lrvibr r-1hdv0qi" style="color: rgb(83, 100, 113);"><g><path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"></path></g></svg>
                </div>
                <div class="css-1dbjc4n r-xoduu5 r-1udh08x">
                  <span>${tweet.favorite_count || 0}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="css-1dbjc4n r-18u37iz r-1h0z5md">
            <div class="css-18t94o4 css-1dbjc4n r-1777fci r-bt1l66 r-1ny4l3l r-bztko3 r-lrvibr">
              <div dir="auto" class="css-901oao r-1awozwy r-14j79pv r-6koalj r-37j5jr r-a023e6 r-16dba41 r-1h0z5md r-rjixqe r-bcqeeo r-o7ynqc r-clp7b1 r-3s2u2q r-qvutc0">
                <div class="css-1dbjc4n r-xoduu5">
                  <div class="css-1dbjc4n r-1niwhzg r-sdzlij r-1p0dtai r-xoduu5 r-1d2f490 r-xf4iuw r-1ny4l3l r-u8s1d r-zchlnj r-ipm5af r-o7ynqc r-6416eg"></div>
                  <svg viewBox="0 0 24 24" aria-hidden="true" class="r-4qtqp9 r-yyyyoo r-1xvli5t r-dnmrzs r-bnwqim r-1plcrui r-lrvibr r-1hdv0qi" style="color: rgb(83, 100, 113);"><g><path d="M12 2.59l5.7 5.7-1.41 1.42L13 6.41V16h-2V6.41l-3.3 3.3-1.41-1.42L12 2.59zM21 15l-.02 3.51c0 1.38-1.12 2.49-2.5 2.49H5.5C4.11 21 3 19.88 3 18.5V15h2v3.5c0 .28.22.5.5.5h12.98c.28 0 .5-.22.5-.5L19 15h2z"></path></g></svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  return tweetEl;
}

// Format a date string
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) {
    return `${diffInSeconds}s`;
  } else if (diffInSeconds < 3600) {
    return `${Math.floor(diffInSeconds / 60)}m`;
  } else if (diffInSeconds < 86400) {
    return `${Math.floor(diffInSeconds / 3600)}h`;
  } else if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

// Observe timeline changes to maintain custom feed during scrolling
function observeTimelineChanges() {
  // Create a MutationObserver to watch for changes in the DOM
  const observer = new MutationObserver(function(mutations) {
    if (isCustomFeed && currentUsername) {
      // Check if we need to refresh our custom feed view
      // This happens when Twitter dynamically loads more tweets as you scroll
      mutations.forEach(function(mutation) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Check if new tweets were added and our custom header is gone
          if (!document.getElementById('x-feed-viewer-header')) {
            // Twitter is trying to add more tweets, refresh our custom feed
            chrome.storage.sync.get('savedFeeds', function(data) {
              const savedFeeds = data.savedFeeds || [];
              const feed = savedFeeds.find(f => f.username === currentUsername);
              
              if (feed) {
                fetchUserFeed(feed.username, feed.token);
              }
            });
          }
        }
      });
    }
  });
  
  // Start observing the timeline
  const config = { childList: true, subtree: true };
  observer.observe(document.body, config);
}

// Show a loading indicator
function showLoadingIndicator() {
  // Remove any existing indicators
  hideLoadingIndicator();
  
  const loading = document.createElement('div');
  loading.id = 'x-feed-viewer-loading';
  loading.style.position = 'fixed';
  loading.style.top = '50%';
  loading.style.left = '50%';
  loading.style.transform = 'translate(-50%, -50%)';
  loading.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  loading.style.color = 'white';
  loading.style.padding = '20px';
  loading.style.borderRadius = '10px';
  loading.style.zIndex = '9999';
  loading.style.display = 'flex';
  loading.style.alignItems = 'center';
  loading.style.justifyContent = 'center';
  loading.style.gap = '10px';
  loading.innerHTML = `
    <div class="loading-spinner" style="border: 4px solid rgba(255, 255, 255, 0.3); border-radius: 50%; border-top: 4px solid #1da1f2; width: 24px; height: 24px; animation: x-feed-viewer-spin 1s linear infinite;"></div>
    <span>Loading feed...</span>
  `;
  
  // Add the keyframe animation for the spinner
  const style = document.createElement('style');
  style.id = 'x-feed-viewer-style';
  style.textContent = `
    @keyframes x-feed-viewer-spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  
  document.head.appendChild(style);
  document.body.appendChild(loading);
}

// Hide the loading indicator
function hideLoadingIndicator() {
  const loading = document.getElementById('x-feed-viewer-loading');
  if (loading) {
    loading.remove();
  }
}

// Show an error message
function showError(message) {
  // Remove any existing errors
  const existingError = document.getElementById('x-feed-viewer-error');
  if (existingError) existingError.remove();
  
  const error = document.createElement('div');
  error.id = 'x-feed-viewer-error';
  error.style.position = 'fixed';
  error.style.top = '50%';
  error.style.left = '50%';
  error.style.transform = 'translate(-50%, -50%)';
  error.style.backgroundColor = 'rgba(224, 36, 94, 0.9)';
  error.style.color = 'white';
  error.style.padding = '20px';
  error.style.borderRadius = '10px';
  error.style.zIndex = '9999';
  error.style.maxWidth = '80%';
  error.style.textAlign = 'center';
  error.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 10px;">Error</div>
    <div>${message}</div>
    <button style="background-color: white; color: #e0245e; border: none; padding: 8px 15px; margin-top: 15px; border-radius: 50px; cursor: pointer; font-weight: bold;">Dismiss</button>
  `;
  
  document.body.appendChild(error);
  
  const dismissButton = error.querySelector('button');
  dismissButton.addEventListener('click', function() {
    error.remove();
  });
  
  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    if (document.getElementById('x-feed-viewer-error')) {
      document.getElementById('x-feed-viewer-error').remove();
    }
  }, 5000);
}
