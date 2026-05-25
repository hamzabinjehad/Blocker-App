# Manual Blocking Test Checklist

Run these tests on a physical Android device with the app installed.

## Layer 1 — DNS Blocking

- [ ] Open Chrome, navigate to a blocked domain — should fail silently (no DNS)
- [ ] Open Chrome, navigate to google.com — should redirect to forcesafesearch
- [ ] Open Chrome, navigate to youtube.com — should load in Restricted Mode
- [ ] Open a VPN app (e.g. NordVPN) in strict mode — domain should fail to resolve
- [ ] Enable DoH in Chrome settings, navigate to blocked site — should still be blocked
- [ ] Set custom DNS to 8.8.8.8 in device settings — DNS should still be intercepted
- [ ] Verify IPv6-only DNS queries are also blocked for adult domains

## Layer 2 — URL/Keyword Filtering (HTTPS inspection mode)

- [ ] Search "adult content" on Google — SafeSearch should filter results
- [ ] Search on Bing with adult terms — adlt=strict should be appended
- [ ] Search on DuckDuckGo — kp=1 should be appended
- [ ] Navigate to URL with adult keyword in path — should be blocked

## Layer 3 — Accessibility/Keyword Detection

- [ ] Open Instagram, type a blocked keyword in search bar — overlay should appear
- [ ] Open Telegram, paste a blocked keyword in chat — should be detected
- [ ] Open YouTube, search for blocked keyword — overlay should appear
- [ ] Open private browser tab in Chrome — overlay should appear immediately
- [ ] Open private browser tab in Firefox — overlay should appear immediately
- [ ] Open private browser tab in Brave — overlay should appear immediately
- [ ] Open InPrivate tab in Edge — overlay should appear immediately
- [ ] Open Secret mode in Samsung Internet — overlay should appear immediately

## Layer 4 — Image Scanning

- [ ] Open a website with swimwear/sports ads — should NOT trigger (false positive test)
- [ ] Open app with NSFW test image — overlay should appear
- [ ] Verify scan throttle works: rapid page loads should not cause excessive battery use
- [ ] Verify large images are downscaled (check memory usage)

## Layer 5 — App Blocking

- [ ] Install a test VPN app — should be detected and flagged in strict mode
- [ ] Open a blocked app in strict mode — should be suspended
- [ ] Focus mode active, open a non-allowed app — should be blocked

## Anti-Tamper

- [ ] Try to disable Accessibility Service — TamperMonitor should alert within 30s
- [ ] Reboot in safe mode — guardian notification should appear on next normal boot
- [ ] Try to uninstall app — should be prevented by Device Admin
- [ ] Kill app from Recent Apps — VPN watchdog should restart it within 15 min
- [ ] Verify TamperDetector reports all signals correctly in status screen

## Bypass Attempts

- [ ] Enable Airplane mode + WiFi — VPN should restart and continue filtering
- [ ] Use 1.1.1.1 app (hardcoded DNS) — should be intercepted and redirected
- [ ] Try connecting to known DoH resolvers on port 443 — should be dropped
- [ ] Try enabling Private DNS in Android settings — should be detected

## Blocklist Updates

- [ ] Trigger a delta blocklist update — should use ETag caching
- [ ] Verify 304 response does not re-download full list
- [ ] Verify updated blocklist takes effect after invalidation
