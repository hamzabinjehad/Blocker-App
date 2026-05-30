# Control Yourself Manual Test Checklist

Generated: 2026-05-29 23:47

Use this checklist on a physical Android device. Some tests require Device Owner or Profile Owner enrollment; those are marked clearly.

## Setup

- [ ] Install a fresh debug build.
- [ ] Grant VPN permission.
- [ ] Grant overlay permission.
- [ ] Grant usage access.
- [ ] Enable accessibility service for behavior protection.
- [ ] Enable device admin.
- [ ] For managed tests, enroll as Device Owner/Profile Owner.
- [ ] Start protection from Home.

## Blocking - DNS & VPN

- [ ] DNS blocking active on mobile data
  - Pass: a known adult test domain fails or is blocked while mobile data is active.
- [ ] DNS blocking active on WiFi
  - Pass: the same domain is blocked on WiFi.
- [ ] VPN stays alive after screen off
  - Pass: after 5 minutes screen-off, VPN is still active and blocked domains still fail.
- [ ] Blocklist update applies within 60 seconds
  - Pass: updated local blocklist is reflected after invalidation/refresh.
- [ ] Custom blocked domain works
  - Pass: adding a domain in Settings blocks it without reinstalling the app.

## Bypass & Tamper Resistance

- [ ] Uninstall blocked without PIN
  - Requires: Device Admin for basic protection; Device Owner for stronger uninstall block.
- [ ] VPN cannot be disabled from system settings
  - Requires: Device Owner/Profile Owner always-on VPN lockdown.
- [ ] Private browser is detected and blocked
  - Pass: installing or updating Brave/Tor/Firefox Focus shows overlay and alert.
- [ ] VPN app is detected and blocked
  - Pass: installing WireGuard/OpenVPN/1.1.1.1 shows overlay and alert.
- [ ] Safe mode boot is detected
  - Pass: next normal boot logs safe-mode tamper and shows warning.
- [ ] Wrong PIN triggers alert after 5 attempts
  - Pass: five failed PIN attempts queues a critical guardian alert.
- [ ] Turning off protection requires delay
  - Pass: native stop call returns countdown for 30 seconds and guardian alert is queued immediately.

## SafeSearch & Platform Filtering

- [ ] Google SafeSearch enforced
  - Pass: Google resolves through SafeSearch rewrite or strict search behavior.
- [ ] YouTube Restricted Mode enforced
  - Pass: YouTube restricted mode is active through DNS/header policy where supported.
- [ ] In-app blocking on Instagram (Reels/Explore)
  - Pass: accessibility screen context triggers block overlay for configured surfaces.
- [ ] Keyword detection via accessibility
  - Pass: typing a blocked keyword in a monitored app triggers overlay.

## Coach & Urge Support

- [ ] Urge surfing timer launches from block overlay
  - Pass: tapping "I'm struggling" opens the 7-minute breathing timer.
- [ ] Urge surfing timer launches from Coach tab
  - Pass: tapping "I'm struggling" in Coach opens the same timer.
- [ ] XP awarded after completing urge timer
  - Pass: completion shows "You made it. +50 XP" and XP increases.
- [ ] Relapse log submits without error
  - Pass: emotional state, trigger, and optional note save locally with no guardian alert.
- [ ] Journal entry saves and appears in recent list
  - Pass: saved entry appears under Recent journal.

## Gamification

- [ ] Streak increments correctly at midnight
  - Pass: a clean day records once per date and increments streak only once.
- [ ] Streak resets after relapse log
  - Pass: logging a moment resets current streak unless a freeze is used.
- [ ] Mood check-in awards XP once per day
  - Pass: first check-in awards +10 XP; repeat same day does not stack.
- [ ] Badge unlocks at 7-day milestone
  - Pass: 7-day badge unlocks and milestone modal appears.
- [ ] Level up triggers confirmation screen
  - Pass: milestone/level screen appears with grounded recovery message.

## Guardian & PIN

- [ ] Guardian alert received for tamper event
  - Pass: tamper event appears in Alert Center/guardian alert queue.
- [ ] Guardian cannot see journal or relapse details
  - Pass: guardian alerts contain no journal text, relapse note, emotional state, or trigger detail.
- [ ] Emergency unlock works and alerts guardian
  - Pass: emergency unlock changes protection state and queues guardian alert.
- [ ] PIN recovery only works via guardian device
  - Status: not implemented yet; requires guardian-device recovery flow.

## Current Known Gaps

- PIN recovery via guardian device is not implemented yet.
- Managed tests require Android Device Owner/Profile Owner enrollment; normal app installs cannot silently enforce those policies.
