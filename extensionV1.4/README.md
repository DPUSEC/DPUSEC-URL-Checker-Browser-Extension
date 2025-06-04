# URL Checker Browser Extension

This extension checks URLs against a local blacklist and the AbuseIPDB API to protect you from malicious websites and IP addresses.

## Features

- Checks URLs against local blacklist and whitelist files
- Resolves domains to IPs for more comprehensive checking
- Queries the AbuseIPDB API to check IP reputation
- Configurable confidence threshold for determining malicious IPs
- Simple user interface to manually check URLs
- Export and view the current blacklist and whitelist

## Setup

1. Replace `YOUR_API_KEY_HERE` in background.js with your AbuseIPDB API key
   - Get your API key from [AbuseIPDB](https://www.abuseipdb.com/register)
2. Load the extension in your browser:
   - Chrome: Go to `chrome://extensions/`, enable Developer mode, and click "Load unpacked"
   - Edge: Go to `edge://extensions/`, enable Developer mode, and click "Load unpacked"
   - Firefox: Go to `about:debugging`, click "This Firefox", and click "Load Temporary Add-on"

3. Select the extension directory

## How to Use

1. Click on the extension icon in your browser toolbar to open the popup
2. Enter a URL to check it against the blacklist and AbuseIPDB API
3. Use the "View Lists" button to see all currently blacklisted and whitelisted domains and IPs
4. Use the "Export Blacklist" or "Export Whitelist" buttons to download the current lists
5. Toggle "IP Mode" to enable checking IP addresses in addition to domains

## AbuseIPDB Integration

The extension uses the AbuseIPDB API to check the reputation of IP addresses. When you visit a website:

1. The extension extracts the domain from the URL
2. It resolves the domain to an IP address
3. The IP address is checked against the AbuseIPDB database
4. If the abuse confidence score is above the threshold (default: 80%), the site is considered malicious

You can customize the confidence threshold in the extension settings.
