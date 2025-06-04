document.addEventListener('DOMContentLoaded', function() {
  const statusContainer = document.getElementById('status-container');
  const currentUrlElement = document.getElementById('current-url');
  const checkButton = document.getElementById('checkButton');
  const addToWhitelistButton = document.getElementById('addToWhitelist');
  const addToBlacklistButton = document.getElementById('addToBlacklist');
  const whitelistContainer = document.getElementById('whitelist');
  const blacklistContainer = document.getElementById('blacklist');
  const notification = document.getElementById('notification');
  
  let currentUrl = '';
  let currentHost = '';
  
  // Tab switching functionality
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      const tabId = this.getAttribute('data-tab');
      
      // Remove active class from all buttons and tabs
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to clicked button and corresponding tab
      this.classList.add('active');
      document.getElementById(tabId).classList.add('active');
    });
  });
  
  // Check for URL parameters (for when popup is opened automatically)
  const urlParams = new URLSearchParams(window.location.search);
  const domainParam = urlParams.get('domain');
  const tabIdParam = urlParams.get('tabId');
  
  if (domainParam) {
    // The popup was opened automatically for a domain warning
    currentHost = domainParam;
    currentUrlElement.innerHTML = `<strong>Warning:</strong> ${currentHost}`;
    
    // Get fresh lists and check current domain status
    chrome.runtime.sendMessage({ action: 'readLists' }, function(response) {
      if (response) {
        const whitelist = Array.isArray(response.whitelist) ? response.whitelist : [];
        const blacklist = Array.isArray(response.blacklist) ? response.blacklist : [];
        
        if (blacklist.includes(currentHost)) {
          const icon = '<img src="../icons/warning.svg" alt="warning" style="width:16px;height:16px;margin-right:5px;">';
          displayStatus('danger', `${icon} This domain is in your blacklist`, true);
        }
         else if (whitelist.includes(currentHost)) {
          const icon = '<img src="../icons/success.svg" alt="success" style="width:16px;height:16px;margin-right:5px;">';
          displayStatus('success', `${icon} This domain is in your whitelist`, true);
        } else {
          // Get check results from background script
          chrome.runtime.sendMessage({ action: 'getCheckResult', url: currentHost }, function(checkResponse) {
            if (checkResponse && checkResponse.result) {
              displayStatus(checkResponse.result.type, checkResponse.result.message, checkResponse.result.inList);
            } else {
              // Force a check if no result exists
              checkUrlSafety(currentHost);
            }
          });
        }
        
        // Display lists
        displayList(whitelist, whitelistContainer, 'whitelist');
        displayList(blacklist, blacklistContainer, 'blacklist');
      } else {
        console.error('Error reading lists');
        displayStatus('warning', 'Error reading domain lists', false);
      }
    });
  } else {
    // Normal popup opening, fetch current tab info
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0] && tabs[0].url) {
        currentUrl = tabs[0].url;
        try {
          const url = new URL(currentUrl);
          currentHost = url.hostname;
          currentUrlElement.innerHTML = `<strong>Current URL:</strong> ${currentHost}`;
          
          // Always refresh lists from storage first
          chrome.runtime.sendMessage({ action: 'readLists' }, function(response) {
            if (response) {
              const whitelist = Array.isArray(response.whitelist) ? response.whitelist : [];
              const blacklist = Array.isArray(response.blacklist) ? response.blacklist : [];
              
              // Display lists
              displayList(whitelist, whitelistContainer, 'whitelist');
              displayList(blacklist, blacklistContainer, 'blacklist');
              
              // Check domain status
              if (whitelist.includes(currentHost)) {
                displayStatus('safe', 'This domain is in your whitelist', true);
              } else if (blacklist.includes(currentHost)) {
                displayStatus('danger', 'This domain is in your blacklist', true);
              } else {
                // Not in lists, check from cache or API
                chrome.runtime.sendMessage({ action: 'getCheckResult', url: currentHost }, function(checkResponse) {
                  if (checkResponse && checkResponse.result) {
                    displayStatus(checkResponse.result.type, checkResponse.result.message, checkResponse.result.inList);
                  } else {
                    // Force a check if no cached result
                    checkUrlSafety(currentHost);
                  }
                });
              }
            } else {
              // Fallback to just checking domain
              checkLocalLists(currentHost);
            }
          });
        } catch (e) {
          currentUrlElement.textContent = "Invalid URL";
        }
      }
    });
  }
  
  // Check local lists
  function checkLocalLists(host) {
    // Try to load lists from background script
    chrome.runtime.sendMessage({ action: 'readLists' }, function(response) {
      if (response) {
        const whitelist = Array.isArray(response.whitelist) ? response.whitelist : [];
        const blacklist = Array.isArray(response.blacklist) ? response.blacklist : [];
        
        if (whitelist.includes(host)) {
          displayStatus('safe', 'This domain is in your whitelist', true);
        } else if (blacklist.includes(host)) {
          displayStatus('danger', 'This domain is in your blacklist', true);
        } else {
          // Auto-check the URL
          checkUrlSafety(host);
        }
        
        // Display lists
        displayList(whitelist, whitelistContainer, 'whitelist');
        displayList(blacklist, blacklistContainer, 'blacklist');
      } else {
        console.error('Error reading lists');
        displayStatus('warning', 'Error reading domain lists', false);
      }
    });
  }
  
  // Check button
  if (checkButton) {
    checkButton.addEventListener('click', function() {
      checkUrlSafety(currentHost);
    });
  }
  
  // Add to whitelist
  if (addToWhitelistButton) {
    addToWhitelistButton.addEventListener('click', function() {
      if (!currentHost) return;
      
      chrome.runtime.sendMessage({ 
        action: 'addToList', 
        listType: 'whitelist', 
        domain: currentHost 
      }, function(response) {
        if (response && response.success) {
          displayStatus('safe', 'Added to whitelist', true);
          displayList(response.whitelist, whitelistContainer, 'whitelist');
          displayList(response.blacklist, blacklistContainer, 'blacklist');
          showNotification('Added to whitelist', '#28a745');
          
          // Update badge on the current tab if tabId is available
          if (tabIdParam) {
            chrome.action.setBadgeText({ text: '', tabId: parseInt(tabIdParam) });
          }
        } else {
          showNotification('Error adding to whitelist', '#dc3545');
        }
      });
    });
  }
  
  // Add to blacklist
  if (addToBlacklistButton) {
    addToBlacklistButton.addEventListener('click', function() {
      if (!currentHost) return;
      
      chrome.runtime.sendMessage({ 
        action: 'addToList', 
        listType: 'blacklist', 
        domain: currentHost 
      }, function(response) {
        if (response && response.success) {
          displayStatus('danger', 'Added to blacklist', true);
          displayList(response.whitelist, whitelistContainer, 'whitelist');
          displayList(response.blacklist, blacklistContainer, 'blacklist');
          showNotification('Added to blacklist', '#dc3545');
          
          // Update badge on the current tab if tabId is available
          if (tabIdParam) {
            chrome.action.setBadgeText({ text: '!', tabId: parseInt(tabIdParam) });
            chrome.action.setBadgeBackgroundColor({ color: '#ff0000', tabId: parseInt(tabIdParam) });
          }
        } else {
          showNotification('Error adding to blacklist', '#dc3545');
        }
      });
    });
  }
  
  function checkUrlSafety(host) {
    if (!host) return;
    
    statusContainer.innerHTML = '<div class="status warning">Checking domain safety...</div>';
    
    // Send message to background script to perform the check
    chrome.runtime.sendMessage({ action: 'checkUrl', url: host }, function(response) {
      if (response && response.error) {
        displayStatus('warning', 'Error in URL check: ' + response.error);
      } else if (response && response.data) {
        // Handle response from AbuseIPDB
        const data = response.data;
        const abuseScore = data.abuseConfidenceScore || 0;
        
        // Check if the result is from a list
        if (data.inList) {
          if (data.listType === 'whitelist') {
            displayStatus('safe', 'This domain is in your whitelist', true);
          } else {
            displayStatus('danger', 'This domain is in your blacklist', true);
          }
        } else {
          // Display based on score
          if (abuseScore === 0) {
            displayStatus('safe', 'Domain appears safe (Score: ' + abuseScore + '/100)');
            
            // Auto-add to whitelist
            chrome.runtime.sendMessage({ 
              action: 'autoAddSafe', 
              domain: host 
            });
          } 
          else if (abuseScore >= 20) {
            displayStatus('danger', 'Domain has been reported as potentially harmful (Score: ' + abuseScore + '/100)');
            
            // Auto-add to blacklist for high-risk domains
            chrome.runtime.sendMessage({
              action: 'autoAddDangerous',
              domain: host
            });
          
          }
        }
      } else {
        displayStatus('warning', 'No response received from server');
      }
    });
  }
  
  function displayStatus(type, message, hideCheckButton = false) {
    let iconHTML = '';
    
    // Add appropriate icon based on status type
    if (type === 'safe' || type === 'whitelist') {
      iconHTML = '<img src="../icons/success.png" alt="Safe" class="status-icon" /> ';
    } else if (type === 'danger' || type === 'blacklist') {
      iconHTML = '<img src="../icons/danger.png" alt="Danger" class="status-icon" /> ';
    } else {
      iconHTML = '<img src="../icons/warning.png" alt="Unknown" class="status-icon" /> ';
    }
    
    
    statusContainer.innerHTML = `<div class="status ${type}">${iconHTML}${message}</div>`;
    
    if (checkButton) {
      if (hideCheckButton) {
        checkButton.style.display = 'none';
      } else {
        checkButton.style.display = 'block';
      }
    }
  }
  
  function displayList(list, container, listType) {
    if (!container) return;
    
    container.innerHTML = '';
    
    // Make sure list is an array
    if (!Array.isArray(list) || list.length === 0) {
      container.innerHTML = '<div>No domains in list</div>';
      return;
    }
    
    list.forEach(domain => {
      const item = document.createElement('div');
      item.className = 'list-item';
      
      const domainText = document.createElement('span');
      domainText.textContent = domain;
      
      const removeButton = document.createElement('button');
      removeButton.className = 'remove-btn';
      removeButton.textContent = 'X';
      removeButton.addEventListener('click', function() {
        chrome.runtime.sendMessage({ 
          action: 'removeFromList', 
          listType: listType, 
          domain: domain 
        }, function(response) {
          if (response && response.success) {
            displayList(response.whitelist, whitelistContainer, 'whitelist');
            displayList(response.blacklist, blacklistContainer, 'blacklist');
            showNotification(`${domain} removed from list`, '#007bff');
            
            // If the current domain was removed, update the status
            if (domain === currentHost) {
              if (listType === 'whitelist') {
                // Recheck the domain as it's no longer whitelisted
                checkUrlSafety(currentHost);
              } else if (listType === 'blacklist') {
                // Recheck the domain as it's no longer blacklisted
                checkUrlSafety(currentHost);
              }
            }
          } else {
            showNotification('Failed to remove from list', '#dc3545');
          }
        });
      });
      
      item.appendChild(domainText);
      item.appendChild(removeButton);
      container.appendChild(item);
    });
  }
  
  function showNotification(message, color) {
    if (!notification) return;
    
    notification.textContent = message;
    notification.style.backgroundColor = color;
    notification.style.display = 'block';
    
    // Hide after 3 seconds
    setTimeout(function() {
      notification.style.display = 'none';
    }, 3000);
  }
  
  // Export button handlers
  const exportWhitelistBtn = document.getElementById('exportWhitelist');
  const exportBlacklistBtn = document.getElementById('exportBlacklist');
  
  if (exportWhitelistBtn) {
    exportWhitelistBtn.addEventListener('click', function() {
      exportList('whitelist');
    });
  }
  
  if (exportBlacklistBtn) {
    exportBlacklistBtn.addEventListener('click', function() {
      exportList('blacklist');
    });
  }
  
  function exportList(listType) {
    chrome.runtime.sendMessage({ action: 'readLists' }, function(response) {
      if (response) {
        const list = listType === 'whitelist' ? response.whitelist : response.blacklist;
        
        if (Array.isArray(list) && list.length > 0) {
          const blob = new Blob([list.join('\n')], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${listType}.txt`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          showNotification(`${listType === 'whitelist' ? 'Whitelist' : 'Blacklist'} exported`, '#28a745');
        } else {
          showNotification(`${listType === 'whitelist' ? 'Whitelist' : 'Blacklist'} is empty`, '#ffc107');
        }
      }
    });
  }
  
  // Import button handlers
  const importWhitelistBtn = document.getElementById('importWhitelist');
  const importBlacklistBtn = document.getElementById('importBlacklist');
  const importFileInput = document.createElement('input');
  importFileInput.type = 'file';
  importFileInput.accept = '.txt';
  let currentImportListType = '';
  
  if (importWhitelistBtn) {
    importWhitelistBtn.addEventListener('click', function() {
      currentImportListType = 'whitelist';
      importFileInput.click();
    });
  }
  
  if (importBlacklistBtn) {
    importBlacklistBtn.addEventListener('click', function() {
      currentImportListType = 'blacklist';
      importFileInput.click();
    });
  }
  
  importFileInput.addEventListener('change', function(e) {
    if (e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
      const content = e.target.result;
      const domains = content.split('\n').filter(Boolean);
      
      chrome.runtime.sendMessage({
        action: 'importList',
        listType: currentImportListType,
        domains: domains
      }, function(response) {
        if (response && response.success) {
          displayList(response.whitelist, whitelistContainer, 'whitelist');
          displayList(response.blacklist, blacklistContainer, 'blacklist');
          showNotification(`${currentImportListType === 'whitelist' ? 'Whitelist' : 'Blacklist'} imported`, '#28a745');
          
          // Check if current domain is now in a list
          if (currentHost) {
            if (response.whitelist.includes(currentHost)) {
              displayStatus('safe', 'This domain is in your whitelist', true);
            } else if (response.blacklist.includes(currentHost)) {
              displayStatus('danger', 'This domain is in your blacklist', true);
            }
          }
        } else {
          showNotification('Import failed', '#dc3545');
        }
      });
    };
    
    reader.readAsText(file);
    // Reset the input to allow importing the same file again
    importFileInput.value = '';
  });
});