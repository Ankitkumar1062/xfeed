// Enhanced popup script with filtering and better UI
document.addEventListener('DOMContentLoaded', function() {
  loadTrackingData();
  setupEventListeners();
});

let allEmails = [];
let currentFilter = 'all';
// Add this to your popup.js
browser.storage.onChanged.addListener((changes, namespace) => {
  console.log('Storage changed:', changes);
  // Reload data when storage changes
  loadTrackingData();
});

function setupEventListeners() {
  // Refresh button
  document.getElementById('refresh-btn').addEventListener('click', () => {
    loadTrackingData();
  });
  
  // Clear all button
  document.getElementById('clear-btn').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all tracking data?')) {
      clearAllData();
    }
  });
  
  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const filter = e.target.dataset.filter;
      setActiveFilter(filter);
    });
  });
}

function setActiveFilter(filter) {
  currentFilter = filter;
  
  // Update active tab
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
  
  // Filter and display emails
  displayFilteredEmails();
}

function loadTrackingData() {
  browser.storage.local.get(null).then(items => {
    const emails = [];
    
    // Get all email items
    Object.keys(items).forEach(key => {
      if (key.startsWith('track_')) {
        emails.push(items[key]);
      }
    });
    
    allEmails = emails;
    updateStatistics(emails);
    displayFilteredEmails();
  });
}

function displayFilteredEmails() {
  const emailList = document.getElementById('emailList');
  let filteredEmails = [...allEmails];
  
  // Apply filter
  switch (currentFilter) {
    case 'opened':
      filteredEmails = allEmails.filter(email => email.opened);
      break;
    case 'sent':
      filteredEmails = allEmails.filter(email => !email.opened);
      break;
    case 'today':
      const today = new Date().toDateString();
      filteredEmails = allEmails.filter(email => 
        new Date(email.sentAt).toDateString() === today
      );
      break;
  }
  
  // Clear existing items
  emailList.innerHTML = '';
  
  if (filteredEmails.length === 0) {
    emailList.innerHTML = getNoDataMessage();
    return;
  }
  
  // Sort by timestamp (newest first)
  filteredEmails.sort((a, b) => b.sentAt - a.sentAt);
  
  // Display emails
  filteredEmails.forEach(email => {
    const element = createEmailElement(email);
    emailList.appendChild(element);
  });
}

function getNoDataMessage() {
  const messages = {
    all: {
      icon: '📭',
      title: 'No tracked emails yet',
      subtitle: 'Compose an email in Gmail or Yahoo Mail and click the "Track" button to get started!'
    },
    opened: {
      icon: '👀',
      title: 'No opened emails',
      subtitle: 'None of your tracked emails have been opened yet.'
    },
    sent: {
      icon: '📤',
      title: 'No pending emails',
      subtitle: 'All your tracked emails have been opened!'
    },
    today: {
      icon: '📅',
      title: 'No emails today',
      subtitle: 'You haven\'t sent any tracked emails today.'
    }
  };
  
  const msg = messages[currentFilter];
  return `
    <div class="no-data">
      <div class="no-data-icon">${msg.icon}</div>
      <h3>${msg.title}</h3>
      <p>${msg.subtitle}</p>
    </div>
  `;
}

function updateStatistics(emails) {
  const totalEmails = emails.length;
  const openedEmails = emails.filter(email => email.opened).length;
  const openRate = totalEmails > 0 ? Math.round((openedEmails / totalEmails) * 100) : 0;
  
  const today = new Date().toDateString();
  const todayEmails = emails.filter(email => 
    new Date(email.sentAt).toDateString() === today
  ).length;
  
  document.getElementById('total-emails').textContent = totalEmails;
  document.getElementById('opened-emails').textContent = openedEmails;
  document.getElementById('open-rate').textContent = openRate + '%';
  document.getElementById('today-count').textContent = todayEmails;
}

function createEmailElement(email) {
  const div = document.createElement('div');
  div.className = `tracking-item ${email.opened ? 'opened' : 'sent'}`;
  
  const statusText = email.opened ? 'Opened' : 'Pending';
  const statusClass = email.opened ? 'status-opened' : 'status-sent';
  const statusIcon = email.opened ? '✅' : '⏳';
  
  const platform = email.platform || 'Gmail';
  const platformClass = platform.toLowerCase() === 'yahoo mail' ? 'platform-yahoo' : 'platform-gmail';
  
  div.innerHTML = `
    <div class="email-header">
      <div class="email-to">To: ${email.to}</div>
      <div class="platform-badge ${platformClass}">${platform}</div>
    </div>
    
    <div class="email-subject">"${email.subject || 'No Subject'}"</div>
    
    <div class="email-details">
      <div class="detail-item">
        <span class="status-badge ${statusClass}">${statusIcon} ${statusText}</span>
      </div>
      <div class="detail-item">
        <span class="timestamp">📅 ${formatTimestamp(email.sentAt)}</span>
      </div>
      ${email.opened ? `
        <div class="detail-item">
          <span class="timestamp">👀 Opened ${formatTimestamp(email.openedAt)}</span>
        </div>
      ` : ''}
    </div>
    
    <div class="tracking-id">ID: ${email.trackingId}</div>
  `;
  
  return div;
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

function clearAllData() {
  browser.storage.local.get(null).then(items => {
    const keysToRemove = Object.keys(items).filter(key => key.startsWith('track_'));
    
    if (keysToRemove.length > 0) {
      browser.storage.local.remove(keysToRemove).then(() => {
        loadTrackingData(); // Refresh the display
      });
    }
  });
}
