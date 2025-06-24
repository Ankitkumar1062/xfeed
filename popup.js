// Enhanced popup script with modern features and comprehensive functionality
class EmailTrackerPopup {
  constructor() {
    this.allEmails = [];
    this.currentFilter = 'all';
    this.currentSearchTerm = '';
    this.currentSort = 'newest';
    this.refreshInterval = null;
    this.isOnline = false;
    this.lastUpdated = null;
    
    this.init();
  }

  async init() {
    await this.checkServerConnection();
    this.setupUI();
    this.setupEventListeners();
    await this.loadTrackingData();
    this.startAutoRefresh();
    
    console.log('Email Tracker Popup: Initialized successfully');
  }

  setupUI() {
    // Get current user dynamically
    this.getCurrentUser();
    this.updateLastUpdatedTime();
    this.updateConnectionStatus();
    this.showLoadingState();
  }

  getCurrentUser() {
    // Try to get current user from browser tabs (Gmail)
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({url: "*://mail.google.com/*"}, (tabs) => {
        if (tabs && tabs.length > 0) {
          // Extract user info from Gmail URL or title if possible
          const gmailTab = tabs[0];
          if (gmailTab.title && gmailTab.title.includes('-')) {
            const userPart = gmailTab.title.split('-')[0].trim();
            if (userPart && userPart !== 'Gmail') {
              document.getElementById('current-user').textContent = userPart;
            }
          } else {
            document.getElementById('current-user').textContent = 'User';
          }
        }
      });
    } else {
      // Fallback to generic user
      document.getElementById('current-user').textContent = 'User';
    }
  }

  setupEventListeners() {
    // Refresh button
    document.getElementById('refresh-btn')?.addEventListener('click', () => {
      this.handleRefresh();
    });
    
    // Clear all button
    document.getElementById('clear-btn')?.addEventListener('click', () => {
      this.handleClearAll();
    });
    
    // Export button
    document.getElementById('export-btn')?.addEventListener('click', () => {
      this.handleExport();
    });
    
    // Settings button
    document.getElementById('settings-btn')?.addEventListener('click', () => {
      this.handleSettings();
    });
    
    // Open Gmail button
    document.getElementById('open-gmail')?.addEventListener('click', () => {
      this.openGmail();
    });
    
    // View Guide button
    document.getElementById('view-guide')?.addEventListener('click', () => {
      this.showGuide();
    });
    
    // Filter tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const filter = e.currentTarget.getAttribute('data-filter');
        this.setActiveFilter(filter);
      });
    });

    // Search input
    const searchInput = document.getElementById('search-input');
    const clearSearch = document.getElementById('clear-search');
    
    searchInput?.addEventListener('input', (e) => {
      this.currentSearchTerm = e.target.value.toLowerCase();
      clearSearch.style.visibility = this.currentSearchTerm ? 'visible' : 'hidden';
      this.displayFilteredEmails();
    });

    // Clear search button
    clearSearch?.addEventListener('click', () => {
      searchInput.value = '';
      this.currentSearchTerm = '';
      clearSearch.style.visibility = 'hidden';
      this.displayFilteredEmails();
    });

    // Sort dropdown
    document.getElementById('sort-select')?.addEventListener('change', (e) => {
      this.currentSort = e.target.value;
      this.displayFilteredEmails();
    });

    // Storage change listener
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
          console.log('Storage changed, refreshing data');
          this.loadTrackingData();
        }
      });
    }

    // Modal close button
    document.getElementById('closeModal')?.addEventListener('click', () => {
      document.getElementById('emailModal').style.display = 'none';
    });

    // Close modal when clicking outside
    document.getElementById('emailModal')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('emailModal')) {
        document.getElementById('emailModal').style.display = 'none';
      }
    });

    // Window focus event to refresh data
    window.addEventListener('focus', () => {
      this.loadTrackingData();
    });

    // Close context menu when clicking outside
    document.addEventListener('click', () => {
      document.getElementById('contextMenu').style.display = 'none';
    });
  }

  async checkServerConnection() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('https://api.mailtrackerpro.com/health', {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      this.isOnline = response.ok;
    } catch (error) {
      console.warn('Server connection check failed:', error);
      this.isOnline = false;
    } finally {
      this.updateConnectionStatus();
    }
  }

  updateConnectionStatus() {
    const statusDot = document.getElementById('connection-status');
    const statusText = document.getElementById('status-text');
    const serverStatus = document.getElementById('server-status');

    if (this.isOnline) {
      statusDot?.classList.add('connected');
      statusDot?.classList.remove('disconnected');
      statusText.textContent = 'Connected';
      serverStatus.textContent = 'Online';
      serverStatus.className = 'server-status online';
    } else {
      statusDot?.classList.add('disconnected');
      statusDot?.classList.remove('connected');
      statusText.textContent = 'Disconnected';
      serverStatus.textContent = 'Offline';
      serverStatus.className = 'server-status offline';
    }
  }

  updateLastUpdatedTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    document.getElementById('last-updated').textContent = `Last updated: ${timeString}`;
    this.lastUpdated = now;
  }

  showLoadingState() {
    const loadingState = document.getElementById('loadingState');
    const noDataMessage = document.getElementById('noDataMessage');
    const emptySearchMessage = document.getElementById('emptySearchMessage');
    
    if (loadingState) {
      loadingState.style.display = 'flex';
      
      if (noDataMessage) noDataMessage.style.display = 'none';
      if (emptySearchMessage) emptySearchMessage.style.display = 'none';
    }
  }

  hideLoadingState() {
    const loadingState = document.getElementById('loadingState');
    if (loadingState) {
      loadingState.style.display = 'none';
    }
  }

  async handleRefresh() {
    this.showLoadingState();
    await this.checkServerConnection();
    await this.loadTrackingData();
    this.showToast('Data refreshed successfully', 'success');
  }

  async handleClearAll() {
    const confirmed = confirm('Are you sure you want to clear all tracking data? This action cannot be undone.');
    if (confirmed) {
      this.showLoadingState();
      await this.clearAllData();
      this.showToast('All tracking data cleared', 'info');
    }
  }

  handleExport() {
    if (this.allEmails.length === 0) {
      this.showToast('No data to export', 'warning');
      return;
    }

    // Prepare CSV data
    const csvRows = [];
    const headers = ['Recipient', 'Subject', 'Sent Date', 'Status', 'Opened Date', 'Tracking ID'];
    csvRows.push(headers.join(','));
    
    this.allEmails.forEach(email => {
      const row = [
        `"${email.to}"`,
        `"${email.subject || 'No Subject'}"`,
        this.formatFullTimestamp(email.sentAt),
        email.opened ? 'Opened' : 'Pending',
        email.opened ? this.formatFullTimestamp(email.openedAt) : 'N/A',
        email.trackingId
      ];
      csvRows.push(row.join(','));
    });
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `email-tracking-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showToast('Data exported successfully', 'success');
  }

  handleSettings() {
    const settingsHtml = `
      <div class="settings-content">
        <div class="detail-section">
          <h4>Refresh Settings</h4>
          <label>
            <input type="checkbox" id="settings-auto-refresh" ${this.refreshInterval ? 'checked' : ''}> 
            Auto-refresh data every 30 seconds
          </label>
        </div>
        
        <div class="detail-section">
          <h4>Notifications</h4>
          <label>
            <input type="checkbox" id="settings-desktop-notifications" checked> 
            Desktop notifications for new opens
          </label>
        </div>
        
        <div class="detail-section">
          <h4>Data Management</h4>
          <button class="btn btn-danger" id="settings-clear-data">
            Clear All Data
          </button>
        </div>
        
        <div class="settings-info">
          <p><strong>Server Status:</strong> ${this.isOnline ? 'Connected' : 'Disconnected'}</p>
          <p><strong>Total Emails:</strong> ${this.allEmails.length}</p>
          <p><strong>Last Updated:</strong> ${this.lastUpdated ? this.lastUpdated.toLocaleString() : 'Never'}</p>
          <p><strong>Version:</strong> 1.0.0</p>
        </div>
      </div>
    `;
    
    this.showModal('Settings', settingsHtml);

    // Setup settings event listeners
    setTimeout(() => {
      document.getElementById('settings-auto-refresh')?.addEventListener('change', (e) => {
        if (e.target.checked) {
          this.startAutoRefresh();
        } else {
          this.stopAutoRefresh();
        }
      });
      
      document.getElementById('settings-clear-data')?.addEventListener('click', () => {
        this.handleClearAll();
        document.getElementById('emailModal').style.display = 'none';
      });
    }, 0);
  }

  openGmail() {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url: 'https://mail.google.com/mail/u/0/#inbox?compose=new' });
    } else {
      window.open('https://mail.google.com', '_blank');
    }
    this.showToast('Opening Gmail...', 'info');
  }

  showGuide() {
    const guideHtml = `
      <div class="guide-content">
        <div class="guide-step">
          <h4>Step 1: Install Extension</h4>
          <p>Make sure the Mail Tracker Pro extension is installed and enabled in your browser.</p>
        </div>
        
        <div class="guide-step">
          <h4>Step 2: Compose Email</h4>
          <p>Go to Gmail and compose a new email as you normally would.</p>
        </div>
        
        <div class="guide-step">
          <h4>Step 3: Send Email</h4>
          <p>Send your email normally. The tracking pixel will be automatically inserted.</p>
        </div>
        
        <div class="guide-step">
          <h4>Step 4: Track Opens</h4>
          <p>When recipients open your email, you'll see the tracking data here in the dashboard.</p>
        </div>
        
        <div class="guide-features">
          <h4>Features:</h4>
          <ul>
            <li>Real-time open tracking</li>
            <li>Email statistics and analytics</li>
            <li>Export data to CSV</li>
            <li>Filter and search emails</li>
            <li>Desktop notifications</li>
          </ul>
        </div>
      </div>
    `;
    
    this.showModal('How to Use Mail Tracker Pro', guideHtml);
  }

  setActiveFilter(filter) {
    this.currentFilter = filter;
    
    // Update active tab and ARIA states
    document.querySelectorAll('.filter-tab').forEach(tab => {
      const isActive = tab.getAttribute('data-filter') === filter;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-pressed', isActive);
    });
    
    // Filter and display emails
    this.displayFilteredEmails();
  }

  async loadTrackingData() {
    try {
      this.showLoadingState();
      
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(null, (items) => {
          if (chrome.runtime.lastError) {
            console.error('Error retrieving data:', chrome.runtime.lastError);
            this.allEmails = []; // Fallback to empty array
          } else {
            const emails = [];
            
            // Get all email items from storage
            Object.keys(items).forEach(key => {
              if (key.startsWith('track_')) {
                const data = items[key];
                emails.push({
                  ...data,
                  id: key
                });
              }
            });
            
            this.allEmails = emails.length > 0 ? emails : [];
          }
          
          this.updateStatistics();
          this.updateTabCounts();
          this.displayFilteredEmails();
          this.updateLastUpdatedTime();
          this.hideLoadingState();
        });
      } else {
        // Fallback for testing without browser extension API
        console.warn('Browser storage API not available, using empty array');
        this.allEmails = [];
        
        this.updateStatistics();
        this.updateTabCounts();
        this.displayFilteredEmails();
        this.updateLastUpdatedTime();
        this.hideLoadingState();
      }
    } catch (error) {
      console.error('Error loading tracking data:', error);
      this.allEmails = [];
      
      this.updateStatistics();
      this.updateTabCounts();
      this.displayFilteredEmails();
      this.updateLastUpdatedTime();
      this.hideLoadingState();
    }
  }

  updateTabCounts() {
    const total = this.allEmails.length;
    const opened = this.allEmails.filter(email => email.opened).length;
    const pending = total - opened;
    const today = this.allEmails.filter(email => 
      this.isToday(new Date(email.sentAt))
    ).length;

    document.getElementById('all-count').textContent = total;
    document.getElementById('opened-count').textContent = opened;
    document.getElementById('pending-tab-count').textContent = pending;
    document.getElementById('today-tab-count').textContent = today;
  }

  displayFilteredEmails() {
    const emailList = document.getElementById('emailList');
    const noDataMessage = document.getElementById('noDataMessage');
    const emptySearchMessage = document.getElementById('emptySearchMessage');
    
    let filteredEmails = [...this.allEmails];
    
    // Apply filter
    switch (this.currentFilter) {
      case 'opened':
        filteredEmails = filteredEmails.filter(email => email.opened);
        break;
      case 'pending':
        filteredEmails = filteredEmails.filter(email => !email.opened);
        break;
      case 'today':
        filteredEmails = filteredEmails.filter(email => 
          this.isToday(new Date(email.sentAt))
        );
        break;
    }

    // Apply search term
    if (this.currentSearchTerm) {
      filteredEmails = filteredEmails.filter(email => 
        email.to.toLowerCase().includes(this.currentSearchTerm) ||
        (email.subject && email.subject.toLowerCase().includes(this.currentSearchTerm))
      );
    }
    
    // Apply sorting
    this.sortEmails(filteredEmails);
    
    // Clear existing items
    while (emailList.firstChild) {
      emailList.removeChild(emailList.firstChild);
    }
    
    // Hide all message states
    noDataMessage.style.display = 'none';
    emptySearchMessage.style.display = 'none';
    
    if (filteredEmails.length === 0) {
      if (this.currentSearchTerm && this.allEmails.length > 0) {
        // Show empty search message
        emptySearchMessage.style.display = 'flex';
      } else {
        // Show no data message
        const message = this.getNoDataMessage();
        noDataMessage.querySelector('h3').textContent = message.title;
        noDataMessage.querySelector('p').textContent = message.subtitle;
        noDataMessage.style.display = 'flex';
      }
      return;
    }
    
    // Display emails
    filteredEmails.forEach(email => {
      const element = this.createEmailElement(email);
      emailList.appendChild(element);
    });
  }

  sortEmails(emails) {
    switch (this.currentSort) {
      case 'newest':
        emails.sort((a, b) => b.sentAt - a.sentAt);
        break;
      case 'oldest':
        emails.sort((a, b) => a.sentAt - b.sentAt);
        break;
      case 'most-opened':
        emails.sort((a, b) => {
          if (a.opened === b.opened) return b.sentAt - a.sentAt;
          return a.opened ? -1 : 1;
        });
        break;
      case 'recently-opened':
        emails.sort((a, b) => {
          if (!a.opened && !b.opened) return b.sentAt - a.sentAt;
          if (!a.opened) return 1;
          if (!b.opened) return -1;
          return b.openedAt - a.openedAt;
        });
        break;
      case 'recipient':
        emails.sort((a, b) => a.to.localeCompare(b.to));
        break;
    }
  }

  getNoDataMessage() {
    const messages = {
      all: {
        title: 'No tracked emails yet',
        subtitle: 'Compose an email in Gmail and the tracking pixel will be automatically inserted when you send!'
      },
      opened: {
        title: 'No opened emails',
        subtitle: 'None of your tracked emails have been opened yet.'
      },
      pending: {
        title: 'No pending emails',
        subtitle: 'All your tracked emails have been opened!'
      },
      today: {
        title: 'No emails today',
        subtitle: 'You haven\'t sent any tracked emails today.'
      }
    };
    
    return messages[this.currentFilter] || messages.all;
  }

  updateStatistics() {
    const totalEmails = this.allEmails.length;
    const openedEmails = this.allEmails.filter(email => email.opened).length;
    const openRate = totalEmails > 0 ? Math.round((openedEmails / totalEmails) * 100) : 0;
    
    const todayEmails = this.allEmails.filter(email => 
      this.isToday(new Date(email.sentAt))
    ).length;
    
    const pendingEmails = totalEmails - openedEmails;
    
    // Update stat cards
    document.getElementById('total-emails').textContent = totalEmails;
    document.getElementById('opened-emails').textContent = openedEmails;
    document.getElementById('open-rate').textContent = openRate + '%';
    document.getElementById('today-count').textContent = todayEmails;
    
    // Update change indicators
    document.getElementById('total-change').textContent = `+${todayEmails} today`;
    document.getElementById('opened-change').textContent = `+${openedEmails} total`;
    document.getElementById('pending-count').textContent = `${pendingEmails} pending`;
    
    // Update footer stats
    document.getElementById('footer-total').textContent = totalEmails;
    document.getElementById('footer-success-rate').textContent = openRate + '%';
    
    // Update trend indicator
    const trendElement = document.getElementById('rate-trend');
    if (trendElement) {
      if (openRate > 50) {
        trendElement.className = 'stat-trend up';
        trendElement.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/>
            <polyline points="17,6 23,6 23,12"/>
          </svg>
        `;
      } else {
        trendElement.className = 'stat-trend down';
        trendElement.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23,18 13.5,8.5 8.5,13.5 1,6"/>
            <polyline points="17,18 23,18 23,12"/>
          </svg>
        `;
      }
    }
  }

  createEmailElement(email) {
    const emailItem = document.createElement('div');
    emailItem.className = `email-item ${email.opened ? 'opened' : 'pending'}`;
    emailItem.setAttribute('data-id', email.id);
    
    emailItem.innerHTML = `
      <div class="email-header">
        <div class="recipient">${this.truncateText(email.to, 30)}</div>
        <div class="timestamp">${this.formatTimestamp(email.sentAt)}</div>
      </div>
      
      <div class="email-subject">${this.truncateText(email.subject || 'No Subject', 50)}</div>
      <div class="email-preview">${this.truncateText(email.preview || 'No preview available', 60)}</div>
      
      <div class="email-footer">
        <div class="tracking-status ${email.opened ? 'opened' : 'pending'}">
          <span class="status-icon">
            ${email.opened ? 
              `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>` : 
              `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12,6 12,12 16,14"/>
              </svg>`
            }
          </span>
          ${email.opened ? 
            `Opened ${this.formatTimestamp(email.openedAt)}` : 
            'Not opened yet'
          }
        </div>
        
        <div class="email-actions">
          <button class="action-btn" title="View Details" aria-label="View email details">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </button>
          <button class="action-btn" title="More Options" aria-label="Show more options">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="1"/>
              <circle cx="12" cy="5" r="1"/>
              <circle cx="12" cy="19" r="1"/>
            </svg>
          </button>
        </div>
      </div>
    `;
    
    // Add event listeners
    emailItem.addEventListener('click', () => {
      this.showEmailDetails(email);
    });
    
    emailItem.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showContextMenu(e, email);
    });
    
    const detailsBtn = emailItem.querySelector('.action-btn[title="View Details"]');
    detailsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showEmailDetails(email);
    });
    
    const moreBtn = emailItem.querySelector('.action-btn[title="More Options"]');
    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      
      // Position context menu near the button
      const rect = e.target.getBoundingClientRect();
      const fakeEvent = {
        pageX: rect.right,
        pageY: rect.bottom
      };
      
      this.showContextMenu(fakeEvent, email);
    });
    
    return emailItem;
  }

  showContextMenu(event, email) {
    const contextMenu = document.getElementById('contextMenu');
    if (!contextMenu) return;
    
    // Clear any existing handlers first
    const menuItems = contextMenu.querySelectorAll('.context-item');
    menuItems.forEach(item => {
      const clone = item.cloneNode(true);
      item.parentNode.replaceChild(clone, item);
    });
    
    // Position the context menu
    const x = event.pageX;
    const y = event.pageY;
    
    // Ensure menu stays within viewport
    const menuWidth = 180;
    const menuHeight = 150;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    let posX = x;
    let posY = y;
    
    if (x + menuWidth > windowWidth) {
      posX = windowWidth - menuWidth - 10;
    }
    
    if (y + menuHeight > windowHeight) {
      posY = windowHeight - menuHeight - 10;
    }
    
    contextMenu.style.left = posX + 'px';
    contextMenu.style.top = posY + 'px';
    contextMenu.style.display = 'block';
    
    // Setup context menu actions
    const viewDetailsItem = contextMenu.querySelector('[data-action="view-details"]');
    viewDetailsItem.addEventListener('click', () => {
      this.showEmailDetails(email);
    });
    
    const copyLinkItem = contextMenu.querySelector('[data-action="copy-link"]');
    copyLinkItem.addEventListener('click', () => {
      this.copyTrackingLink(email);
    });
    
    const resendItem = contextMenu.querySelector('[data-action="resend"]');
    resendItem.addEventListener('click', () => {
      this.resendEmail(email);
    });
    
    const deleteItem = contextMenu.querySelector('[data-action="delete"]');
    deleteItem.addEventListener('click', () => {
      this.deleteTracking(email);
    });
    
    // Prevent normal context menu
    event.preventDefault();
  }

  showEmailDetails(email) {
    const detailsHtml = `
      <div class="email-details-modal">
        <div class="detail-section">
          <h4>Email Information</h4>
          <table class="details-table">
            <tr><td>Recipient:</td><td>${email.to}</td></tr>
            <tr><td>Subject:</td><td>${email.subject || 'No Subject'}</td></tr>
            <tr><td>Platform:</td><td>${email.platform || 'Gmail'}</td></tr>
          </table>
        </div>
        
        <div class="detail-section">
          <h4>Tracking Information</h4>
          <table class="details-table">
            <tr><td>Status:</td><td>${email.opened ? 'Opened' : 'Pending'}</td></tr>
            <tr><td>Sent:</td><td>${this.formatFullTimestamp(email.sentAt)}</td></tr>
            ${email.opened ? `<tr><td>Opened:</td><td>${this.formatFullTimestamp(email.openedAt)}</td></tr>` : ''}
            <tr><td>Tracking ID:</td><td class="tracking-id">${email.trackingId}</td></tr>
          </table>
        </div>
        
        <div class="detail-section">
          <h4>Actions</h4>
          <div style="display: flex; gap: 10px;">
            <button class="btn btn-primary" id="modal-copy-link">
              <span class="btn-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
              </span>
              Copy Tracking Link
            </button>
            <button class="btn btn-danger" id="modal-delete">
              <span class="btn-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3,6 5,6 21,6"/>
                  <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6"/>
                </svg>
              </span>
              Delete Tracking
            </button>
          </div>
        </div>
      </div>
    `;
    
    this.showModal('Email Details', detailsHtml);
    
    // Setup action buttons
    setTimeout(() => {
      document.getElementById('modal-copy-link')?.addEventListener('click', () => {
        this.copyTrackingLink(email);
      });
      
      document.getElementById('modal-delete')?.addEventListener('click', () => {
        document.getElementById('emailModal').style.display = 'none';
        this.deleteTracking(email);
      });
    }, 0);
  }

  copyTrackingLink(email) {
    const trackingUrl = `https://track.mailtrackerpro.com/${email.trackingId}`;
    
    navigator.clipboard.writeText(trackingUrl)
      .then(() => {
        this.showToast('Tracking link copied to clipboard', 'success');
      })
      .catch(() => {
        // Fallback for browsers that don't support clipboard API
        const tempInput = document.createElement('input');
        tempInput.value = trackingUrl;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
        this.showToast('Tracking link copied to clipboard', 'success');
      });
  }

  resendEmail(email) {
    // Open Gmail compose with pre-filled data
    const composeUrl = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(email.to)}&su=${encodeURIComponent('Re: ' + (email.subject || ''))}`;
    
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url: composeUrl });
    } else {
      window.open(composeUrl, '_blank');
    }
    
    this.showToast('Opening Gmail compose...', 'info');
  }

  async deleteTracking(email) {
    const confirmed = confirm(`Are you sure you want to delete tracking for the email to ${email.to}?`);
    
    if (!confirmed) return;
    
    this.showLoadingState();
    
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.remove(email.id, () => {
          if (chrome.runtime.lastError) {
            console.error('Error deleting tracking:', chrome.runtime.lastError);
            this.showToast('Failed to delete tracking', 'error');
          } else {
            // Remove from local array
            this.allEmails = this.allEmails.filter(e => e.id !== email.id);
            this.updateStatistics();
            this.updateTabCounts();
            this.displayFilteredEmails();
            this.showToast('Tracking deleted successfully', 'success');
          }
          this.hideLoadingState();
        });
      } else {
        // For demo without storage API
        this.allEmails = this.allEmails.filter(e => e.id !== email.id);
        this.updateStatistics();
        this.updateTabCounts();
        this.displayFilteredEmails();
        this.showToast('Tracking deleted successfully', 'success');
        this.hideLoadingState();
      }
    } catch (error) {
      console.error('Error deleting tracking:', error);
      this.showToast('Failed to delete tracking', 'error');
      this.hideLoadingState();
    }
  }

  showModal(title, content) {
    const modal = document.getElementById('emailModal');
    if (!modal) return;
    
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    modalTitle.textContent = title;
    modalBody.innerHTML = content;
    modal.style.display = 'flex';
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Determine icon based on type
    let icon = '';
    switch (type) {
      case 'success':
        icon = '<svg class="toast-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
        break;
      case 'error':
        icon = '<svg class="toast-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
        break;
      case 'warning':
        icon = '<svg class="toast-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
        break;
      case 'info':
      default:
        icon = '<svg class="toast-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    }
    
    toast.innerHTML = `
      ${icon}
      <span class="toast-message">${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        if (toast.parentNode === container) {
          container.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  async clearAllData() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        // Get all keys in storage
        chrome.storage.local.get(null, (items) => {
          const keysToRemove = Object.keys(items).filter(key => key.startsWith('track_'));
          
          if (keysToRemove.length > 0) {
            chrome.storage.local.remove(keysToRemove, () => {
              this.allEmails = [];
              this.updateStatistics();
              this.updateTabCounts();
              this.displayFilteredEmails();
              this.hideLoadingState();
            });
          } else {
            this.allEmails = [];
            this.updateStatistics();
            this.updateTabCounts();
            this.displayFilteredEmails();
            this.hideLoadingState();
          }
        });
      } else {
        // For demo without storage API
        this.allEmails = [];
        this.updateStatistics();
        this.updateTabCounts();
        this.displayFilteredEmails();
        this.hideLoadingState();
      }
    } catch (error) {
      console.error('Error clearing data:', error);
      this.showToast('Failed to clear data', 'error');
      this.hideLoadingState();
    }
  }

  startAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    
    this.refreshInterval = setInterval(() => {
      this.loadTrackingData();
    }, 30000); // Refresh every 30 seconds
  }

  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  // Utility functions
  isToday(date) {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  }

  truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  formatTimestamp(timestamp) {
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
    
    return date.toLocaleDateString();
  }

  formatFullTimestamp(timestamp) {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
}

// Initialize the email tracker popup when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
  window.emailTracker = new EmailTrackerPopup();
});
