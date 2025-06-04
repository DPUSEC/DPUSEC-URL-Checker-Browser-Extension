const ABUSEIPDB_API_KEY = "74e29f6a9243eaa169da0d34b8ae91744d8b2a75fa1fb8395fc597330ff08278506d0b260bdf1a0d";
const ABUSEIPDB_API_URL = "https://api.abuseipdb.com/api/v2";

// Check result cache
const checkResultsCache = {};

// Initialize whitelist and blacklist arrays
let whitelist = [];
let blacklist = [];

// Load lists from storage when extension starts
initializeLists();

// Function to initialize lists from storage
function initializeLists() {
  chrome.storage.local.get(['whitelist', 'blacklist'], function(result) {
    // Initialize whitelist
    if (result.whitelist && Array.isArray(result.whitelist)) {
      whitelist = result.whitelist;
      console.log('Whitelist loaded from storage:', whitelist);
    } else {
      // Default empty array if nothing in storage
      whitelist = [];
      // Save empty array to storage
      chrome.storage.local.set({ whitelist: [] });
      console.log('Initialized empty whitelist');
    }
    
    // Initialize blacklist
    if (result.blacklist && Array.isArray(result.blacklist)) {
      blacklist = result.blacklist;
      console.log('Blacklist loaded from storage:', blacklist);
    } else {
      // Default empty array if nothing in storage
      blacklist = [];
      // Save empty array to storage
      chrome.storage.local.set({ blacklist: [] });
      console.log('Initialized empty blacklist');
    }
  });
}

// Function to save whitelist to storage
function saveWhitelist() {
  // Ensure whitelist is an array
  if (!Array.isArray(whitelist)) {
    whitelist = [];
  }
  
  // Save to chrome storage
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ whitelist }, function() {
      if (chrome.runtime.lastError) {
        console.error('Error saving whitelist:', chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
      } else {
        console.log('Whitelist saved successfully:', whitelist);
        resolve(true);
      }
    });
  });
}

// Function to save blacklist to storage
function saveBlacklist() {
  // Ensure blacklist is an array
  if (!Array.isArray(blacklist)) {
    blacklist = [];
  }
  
  // Save to chrome storage
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ blacklist }, function() {
      if (chrome.runtime.lastError) {
        console.error('Error saving blacklist:', chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
      } else {
        console.log('Blacklist saved successfully:', blacklist);
        resolve(true);
      }
    });
  });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  // Handle checkUrl requests
  if (request.action === 'checkUrl') {
    checkDomain(request.url)
      .then(data => {
        sendResponse({ data: data });
      })
      .catch(error => {
        sendResponse({ error: error.message });
      });
    return true; // Keep channel open for async response
  }
  
  // Handle readLists requests
  else if (request.action === 'readLists') {
    // Read directly from storage to ensure we have fresh data
    chrome.storage.local.get(['whitelist', 'blacklist'], function(result) {
      const safeWhitelist = Array.isArray(result.whitelist) ? result.whitelist : [];
      const safeBlacklist = Array.isArray(result.blacklist) ? result.blacklist : [];
      
      // Update local variables
      whitelist = safeWhitelist;
      blacklist = safeBlacklist;
      
      sendResponse({ 
        whitelist: safeWhitelist, 
        blacklist: safeBlacklist 
      });
    });
    return true; // Keep channel open for async response
  }
  
  // Handle addToList requests
  else if (request.action === 'addToList') {
    const domain = request.domain;
    const listType = request.listType;
    
    // Read current lists from storage to ensure we have the latest data
    chrome.storage.local.get(['whitelist', 'blacklist'], function(result) {
      // Get current lists with fallbacks to empty arrays
      let currentWhitelist = Array.isArray(result.whitelist) ? result.whitelist : [];
      let currentBlacklist = Array.isArray(result.blacklist) ? result.blacklist : [];
      
      if (listType === 'whitelist') {
        // Remove from blacklist if present
        currentBlacklist = currentBlacklist.filter(d => d !== domain);
        
        // Add to whitelist if not already there
        if (!currentWhitelist.includes(domain)) {
          currentWhitelist.push(domain);
        }
        
        // Update local variables
        whitelist = currentWhitelist;
        blacklist = currentBlacklist;
        
        // Save both lists
        Promise.all([
          chrome.storage.local.set({ whitelist: currentWhitelist }),
          chrome.storage.local.set({ blacklist: currentBlacklist })
        ]).then(() => {
          // Update cache
          const type = 'safe';
          const message = 'This domain is in your whitelist';
          checkResultsCache[domain] = { type, message, inList: true, listType: 'whitelist' };
          
          sendResponse({ 
            success: true, 
            whitelist: currentWhitelist,
            blacklist: currentBlacklist
          });
        }).catch(error => {
          console.error('Error saving lists:', error);
          sendResponse({ success: false, error: error.message });
        });
      } else {
        // Remove from whitelist if present
        currentWhitelist = currentWhitelist.filter(d => d !== domain);
        
        // Add to blacklist if not already there
        if (!currentBlacklist.includes(domain)) {
          currentBlacklist.push(domain);
        }
        
        // Update local variables
        whitelist = currentWhitelist;
        blacklist = currentBlacklist;
        
        // Save both lists
        Promise.all([
          chrome.storage.local.set({ whitelist: currentWhitelist }),
          chrome.storage.local.set({ blacklist: currentBlacklist })
        ]).then(() => {
          // Update cache
          const type = 'danger';
          const message = 'This domain is in your blacklist';
          checkResultsCache[domain] = { type, message, inList: true, listType: 'blacklist' };
          
          sendResponse({ 
            success: true, 
            whitelist: currentWhitelist,
            blacklist: currentBlacklist
          });
        }).catch(error => {
          console.error('Error saving lists:', error);
          sendResponse({ success: false, error: error.message });
        });
      }
    });
    return true; // Keep channel open for async response
  }
  
  // Handle removeFromList requests
  else if (request.action === 'removeFromList') {
    const domain = request.domain;
    const listType = request.listType;
    
    // Read current lists from storage
    chrome.storage.local.get(['whitelist', 'blacklist'], function(result) {
      let currentWhitelist = Array.isArray(result.whitelist) ? result.whitelist : [];
      let currentBlacklist = Array.isArray(result.blacklist) ? result.blacklist : [];
      
      if (listType === 'whitelist') {
        currentWhitelist = currentWhitelist.filter(d => d !== domain);
        whitelist = currentWhitelist;
        
        chrome.storage.local.set({ whitelist: currentWhitelist }, function() {
          // Remove from cache if present
          if (checkResultsCache[domain]) {
            delete checkResultsCache[domain];
          }
          
          sendResponse({ 
            success: true, 
            whitelist: currentWhitelist,
            blacklist: currentBlacklist
          });
        });
      } else {
        currentBlacklist = currentBlacklist.filter(d => d !== domain);
        blacklist = currentBlacklist;
        
        chrome.storage.local.set({ blacklist: currentBlacklist }, function() {
          // Remove from cache if present
          if (checkResultsCache[domain]) {
            delete checkResultsCache[domain];
          }
          
          sendResponse({ 
            success: true, 
            whitelist: currentWhitelist,
            blacklist: currentBlacklist
          });
        });
      }
    });
    return true; // Keep channel open for async response
  }
  
  // Handle getCheckResult requests
  else if (request.action === 'getCheckResult') {
    sendResponse({ result: checkResultsCache[request.url] || null });
    return false;
  }
  
  // Handle autoAddDangerous requests (automatic whitelist)
  else if (request.action === 'autoAddDangerous') {
    const domain = request.domain;
    
    // Read current whitelist from storage
    chrome.storage.local.get(['whitelist', 'blacklist'], function(result) {
      let currentWhitelist = Array.isArray(result.whitelist) ? result.whitelist : [];
      let currentBlacklist = Array.isArray(result.blacklist) ? result.blacklist : [];
      
      // Remove from blacklist if present
      currentBlacklist = currentBlacklist.filter(d => d !== domain);
      
      // Add to blacklist if not already there
      if (!currentBlacklist.includes(domain)) {
        currentBlacklist.push(domain);
      }
      
      // Update local variables
      whitelist = currentWhitelist;
      blacklist = currentBlacklist;
      
      // Save both lists
      Promise.all([
        chrome.storage.local.set({ whitelist: currentWhitelist }),
        chrome.storage.local.set({ blacklist: currentBlacklist })
      ]).then(() => {
        // Update cache
        checkResultsCache[domain] = { 
          type: 'danger', 
          message: 'This domain is in your blacklist', 
          inList: true, 
          listType: 'blacklist' 
        };
        
        sendResponse({ 
          success: true, 
          whitelist: currentWhitelist,
          blacklist: currentBlacklist
        });
      }).catch(error => {
        console.error('Error auto-adding to blacklist:', error);
        sendResponse({ success: false, error: error.message });
      });
    });
    return true; // Keep channel open for async response
  }
  
  // Handle autoAddSafe requests (automatic whitelist)
  else if (request.action === 'autoAddSafe') {
    const domain = request.domain;
    
    // Read current whitelist from storage
    chrome.storage.local.get(['whitelist', 'blacklist'], function(result) {
      let currentWhitelist = Array.isArray(result.whitelist) ? result.whitelist : [];
      let currentBlacklist = Array.isArray(result.blacklist) ? result.blacklist : [];
      
      // Remove from blacklist if present
      currentBlacklist = currentBlacklist.filter(d => d !== domain);
      
      // Add to whitelist if not already there
      if (!currentWhitelist.includes(domain)) {
        currentWhitelist.push(domain);
      }
      
      // Update local variables
      whitelist = currentWhitelist;
      blacklist = currentBlacklist;
      
      // Save both lists
      Promise.all([
        chrome.storage.local.set({ whitelist: currentWhitelist }),
        chrome.storage.local.set({ blacklist: currentBlacklist })
      ]).then(() => {
        // Update cache
        checkResultsCache[domain] = { 
          type: 'safe', 
          message: 'This domain is in your whitelist', 
          inList: true, 
          listType: 'whitelist' 
        };
        
        sendResponse({ 
          success: true, 
          whitelist: currentWhitelist,
          blacklist: currentBlacklist
        });
      }).catch(error => {
        console.error('Error auto-adding to whitelist:', error);
        sendResponse({ success: false, error: error.message });
      });
    });
    return true; // Keep channel open for async response
  }
});
// Check newly opened tabs automatically
chrome.tabs.onUpdated.addListener(async function(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
    try {
      const url = new URL(tab.url);
      const host = url.hostname;
      
      // Read fresh lists from storage
      chrome.storage.local.get(['whitelist', 'blacklist'], async function(result) {
        const currentWhitelist = Array.isArray(result.whitelist) ? result.whitelist : [];
        const currentBlacklist = Array.isArray(result.blacklist) ? result.blacklist : [];
        
        // Update local variables
        whitelist = currentWhitelist;
        blacklist = currentBlacklist;
        
        // First check whitelist
        if (currentWhitelist.includes(host)) {
          checkResultsCache[host] = { 
            type: 'safe', 
            message: 'This domain is in your whitelist', 
            inList: true,
            listType: 'whitelist'
          };
          // Clear badge
          chrome.action.setBadgeText({ text: '', tabId: tabId });
          return;
        }
        
        // Then check blacklist
        if (currentBlacklist.includes(host) && !url.searchParams.has('bypassWarning')) {
          checkResultsCache[host] = { 
            type: 'danger', 
            message: 'This domain is in your blacklist', 
            inList: true,
            listType: 'blacklist'
          };
          // Set warning badge
          chrome.action.setBadgeText({ text: '!', tabId: tabId });
          chrome.action.setBadgeBackgroundColor({ color: '#ff0000', tabId: tabId });
          chrome.tabs.update(tabId, { 
            url: chrome.runtime.getURL('blocked.html') + `?url=${encodeURIComponent(tab.url)}` 
          });          
          
          // Show warning popup
          chrome.windows.create({
            url: `popup/popup.html?domain=${encodeURIComponent(host)}&tabId=${tabId}`,
            type: 'popup',
            width: 400,
            height: 600
          });
          
          return;
        }
        
        // Not in either list, check with API
        try {
          const data = await checkDomain(host);
          const abuseScore = data.abuseConfidenceScore || 0;
          
          // Cache result and set appropriate badge
          if (abuseScore === 0) {
            checkResultsCache[host] = { 
              type: 'safe', 
              message: `Domain appears safe (Score: ${abuseScore}/100)`, 
              inList: false 
            };
            // Clear badge for safe site
            chrome.action.setBadgeText({ text: '', tabId: tabId });
            
            // Auto-add to whitelist for safe domains
            // Read current whitelist
            chrome.storage.local.get(['whitelist'], function(result) {
              let currentWL = Array.isArray(result.whitelist) ? result.whitelist : [];
              
              // Add to whitelist if not already there
              if (!currentWL.includes(host)) {
                currentWL.push(host);
                whitelist = currentWL;
                
                // Save updated whitelist
                chrome.storage.local.set({ whitelist: currentWL }, function() {
                  console.log('Safe domain auto-added to whitelist:', host);
                  
                  // Update cache
                  checkResultsCache[host] = { 
                    type: 'safe', 
                    message: 'This domain is in your whitelist',
                    inList: true,
                    listType: 'whitelist'
                  };
                });
              }
            });
          } else if (abuseScore < 20) {
            checkResultsCache[host] = { 
              type: 'warning', 
              message: `Domain has low abuse reports (Score: ${abuseScore}/100)`, 
              inList: false 
            };
            // Set warning badge
            chrome.action.setBadgeText({ text: '!', tabId: tabId });
            chrome.action.setBadgeBackgroundColor({ color: '#ffa500', tabId: tabId });
          } else {
            checkResultsCache[host] = { 
              type: 'danger', 
              message: `Domain reported as potentially malicious (Score: ${abuseScore}/100)`, 
              inList: false 
            };
          
            // Set danger badge
            chrome.action.setBadgeText({ text: '!', tabId: tabId });
            chrome.action.setBadgeBackgroundColor({ color: '#ff0000', tabId: tabId });
          
            // ❗️Kullanıcıyı blocked.html'e yönlendir
            chrome.tabs.update(tabId, { 
              url: chrome.runtime.getURL('blocked.html') + `?url=${encodeURIComponent(tab.url)}` 
            });
          
            // Opsiyonel: popup da göster
            chrome.windows.create({
              url: `popup/popup.html?domain=${encodeURIComponent(host)}&tabId=${tabId}`,
              type: 'popup',
              width: 400,
              height: 600
            });
          }
        } catch (error) {
          console.error('Error checking domain:', error);
          checkResultsCache[host] = { 
            type: 'warning', 
            message: `Error checking domain: ${error.message}`, 
            inList: false 
          };
        }
      });
    } catch (e) {
      console.error('Error parsing URL:', e);
    }
  }
});

async function checkDomain(domain) {
  try {
    // Check if domain is IP or domain name
    let endpoint = `${ABUSEIPDB_API_URL}/check`;
    let params = new URLSearchParams();
    
    // Determine if the input is an IP address or domain
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipPattern.test(domain)) {
      params.append('ipAddress', domain);
    } else {
      // It's a domain, need to resolve it
      const ipData = await resolveIP(domain);
      if (ipData) {
        params.append('ipAddress', ipData);
      } else {
        throw new Error('Could not resolve domain to IP address');
      }
    }
    
    params.append('maxAgeInDays', '90');
    params.append('verbose', true);
    
    const response = await fetch(`${endpoint}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Key': ABUSEIPDB_API_KEY
      }
    });
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error checking domain:', error);
    throw error;
  }
}

async function resolveIP(domain) {
  // Use DNS resolution API
  try {
    const response = await fetch(`https://dns.google/resolve?name=${domain}`);
    const data = await response.json();
    
    if (data.Answer && data.Answer.length > 0) {
      // Find A records (IPv4 addresses)
      for (let record of data.Answer) {
        if (record.type === 1) { // Type 1 is an A record
          return record.data;
        }
      }
    }
    return null;
  } catch (error) {
    console.error('Error resolving domain:', error);
    return null;
  }
}