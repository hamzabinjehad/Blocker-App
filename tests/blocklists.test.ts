import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  buildDangerousAppRules,
  buildDomainOutputs,
  buildDnsRewriteRules,
  buildKeywordRules,
  loadSourceConfig,
  normalizeDomainCandidate,
  normalizeKeywordText,
  parseDomainLine,
  parseDomainSource,
  validateSourceConfig,
} from "../scripts/update_blocklists";

test("normalizes URL and IDN domains to punycode", () => {
  assert.equal(
    normalizeDomainCandidate("HTTPS://Münich.de/path?x=1"),
    "xn--mnich-kva.de",
  );
});

test("parses hosts format and strips inline comments", () => {
  assert.equal(
    parseDomainLine("0.0.0.0 AdultSite.org # source comment"),
    "adultsite.org",
  );
  assert.equal(parseDomainLine("127.0.0.1 sub.AdultSite.org"), "sub.adultsite.org");
});

test("parses AdGuard DNS rules", () => {
  assert.equal(parseDomainLine("||ExampleAdult.com^$important"), "exampleadult.com");
  assert.equal(parseDomainLine("@@||allowed.example.org^"), null);
});

test("parses Pi-hole, dnsmasq, and JSON policy formats", () => {
  assert.equal(parseDomainLine("adultsite.example", "pihole"), "adultsite.example");
  assert.equal(parseDomainLine("address=/adultsite.example/0.0.0.0", "dnsmasq"), "adultsite.example");
  assert.equal(parseDomainLine("server=/sub.adultsite.example/", "dnsmasq"), "sub.adultsite.example");

  const parsed = parseDomainSource({
    id: "json_policy",
    name: "JSON Policy",
    license: "test",
    url: "memory://json",
    format: "json_policy",
    lines: [
      JSON.stringify({
        domains: ["one-adult.example"],
        rules: [{ domain: "two-adult.example" }, { url: "https://three-adult.example/path" }],
      }),
    ],
  });

  assert.deepEqual(
    parsed.entries.map((entry) => entry.domain).sort(),
    ["one-adult.example", "three-adult.example", "two-adult.example"],
  );
});

test("deduplicates merged block domains and keeps source attribution", () => {
  const result = buildDomainOutputs(
    [
      {
        id: "a",
        name: "Source A",
        license: "test",
        url: "memory://a",
        lines: ["0.0.0.0 adultsite.org", "0.0.0.0 second-adult.org"],
      },
      {
        id: "b",
        name: "Source B",
        license: "test",
        url: "memory://b",
        lines: ["||adultsite.org^", "||other-adult.org^"],
      },
    ],
  );

  assert.deepEqual(result.domains, [
    "adultsite.org",
    "other-adult.org",
    "second-adult.org",
  ]);
  assert.deepEqual(result.attribution["adultsite.org"], ["Source A", "Source B"]);
  assert.equal(result.sourceStats[1]?.removedDuplicates, 1);
});

test("critical domains are never emitted as adult domains", () => {
  const result = buildDomainOutputs(
    [
      {
        id: "critical",
        name: "Critical Test",
        license: "test",
        url: "memory://critical",
        lines: [
          "0.0.0.0 google.com",
          "0.0.0.0 classroom.google.com",
          "0.0.0.0 youtube.com",
          "0.0.0.0 play.googleapis.com",
          "0.0.0.0 adultsite.org",
        ],
      },
    ],
  );

  assert.deepEqual(result.domains, ["adultsite.org"]);
  assert.equal(result.sourceStats[0]?.removedCritical, 4);
});

test("allowlist domains override block sources", () => {
  const result = buildDomainOutputs(
    [
      {
        id: "a",
        name: "Source A",
        license: "test",
        url: "memory://a",
        lines: ["0.0.0.0 adultsite.org", "0.0.0.0 keep-safe.example"],
      },
    ],
    new Set(["keep-safe.example"]),
  );

  assert.deepEqual(result.domains, ["adultsite.org"]);
  assert.equal(result.sourceStats[0]?.removedAllowlisted, 1);
});

test("rejects local, IP, and invalid domains", () => {
  assert.equal(parseDomainLine("0.0.0.0 localhost"), null);
  assert.equal(parseDomainLine("0.0.0.0 router.local"), null);
  assert.equal(parseDomainLine("0.0.0.0 192.168.1.1"), null);
  assert.equal(parseDomainLine("0.0.0.0 bad_domain.org"), null);
});

test("normalizes obfuscated English and Arabic keyword text", () => {
  assert.equal(normalizeKeywordText("s e x").compact, "sex");
  assert.equal(normalizeKeywordText("s*x").compact, "sex");
  assert.equal(normalizeKeywordText("p0rn").compact, "porn");
  assert.equal(normalizeKeywordText("إباحي").compact, "اباحي");
  assert.equal(normalizeKeywordText("إِبــاحي").compact, "اباحي");
  assert.equal(normalizeKeywordText("اباحي p0rn").compact, "اباحيporn");
});

test("local custom block sources participate in attribution", () => {
  const result = buildDomainOutputs(
    [
      {
        id: "local_block_domains",
        name: "Local block domains",
        license: "project-local",
        url: "memory://local",
        lines: ["custom-adult.example", "0.0.0.0 another-custom.example"],
      },
    ],
  );

  assert.deepEqual(result.domains, [
    "another-custom.example",
    "custom-adult.example",
  ]);
  assert.deepEqual(result.attribution["custom-adult.example"], [
    "Local block domains",
  ]);
});

test("DNS rewrite rules include SafeSearch and YouTube Restricted Mode targets", () => {
  const rules = buildDnsRewriteRules();

  assert.ok(
    rules.some(
      (rule) =>
        rule.domainPattern === "www.google.*" &&
        rule.target === "forcesafesearch.google.com",
    ),
  );
  assert.ok(
    rules.some(
      (rule) =>
        rule.domainPattern === "youtubei.googleapis.com" &&
        rule.target === "restrict.youtube.com",
    ),
  );
  assert.ok(
    rules.some(
      (rule) =>
        rule.domainPattern === "www.bing.com" &&
        rule.target === "strict.bing.com",
    ),
  );
  assert.ok(
    rules.some(
      (rule) =>
        rule.domainPattern === "edgeservices.bing.com" &&
        rule.target === "strict.bing.com",
    ),
  );
  assert.ok(
    rules.some(
      (rule) =>
        rule.domainPattern === "duckduckgo.com" &&
        rule.target === "safe.duckduckgo.com",
    ),
  );
  assert.equal(rules.every((rule) => rule.enabled), true);
});

test("processed runtime domain assets support exact and suffix matching", () => {
  const adultDomains = loadProcessedSet("adult_domains.txt");
  const bypassDomains = loadProcessedSet("bypass_domains.txt");

  assert.equal(matchesDomainRule("pornhub.com", adultDomains), true);
  assert.equal(matchesDomainRule("www.pornhub.com", adultDomains), true);
  assert.equal(matchesDomainRule("cloudflare-dns.com", bypassDomains), true);
  assert.equal(matchesDomainRule("security.cloudflare-dns.com", bypassDomains), true);
});

test("keeps raw NSFW words as disabled review candidates", () => {
  const rules = buildKeywordRules("p0rn onlyfans health chromosome");
  const reviewCandidate = rules.reviewQueue.find(
    (rule) => rule.compact === "porn" && rule.source.includes("candidate"),
  );
  const allowContext = rules.activeRules.find((rule) => rule.compact === "health");

  assert.equal(reviewCandidate?.enabled, false);
  assert.equal(allowContext?.classification, "ALLOW_CONTEXT");
  assert.equal(rules.activeRules.some((rule) => rule.normalized === "اباحي" && rule.locale === "ar"), true);
});

test("source config validates required metadata and HTTPS URLs", () => {
  const config = loadSourceConfig();

  assert.ok(config.sources.length > 0);
  assert.equal(config.sources.every((source) => typeof source.enabled === "boolean"), true);
  assert.equal(config.sources.every((source) => source.priority >= 0 && source.priority <= 100), true);
  assert.equal(config.sources.every((source) => !source.url || source.url.startsWith("https://")), true);
  assert.equal(config.sources.some((source) => source.id === "oisd_nsfw" && source.trustLevel === "high"), true);

  assert.throws(() =>
    validateSourceConfig({
      schemaVersion: 1,
      sources: [
        {
          id: "bad",
          name: "Bad",
          category: "adult",
          url: "http://example.com/list.txt",
          format: "hosts",
          enabled: true,
          priority: 1,
          trustLevel: "low",
          updateIntervalHours: 24,
          license: "test",
        },
      ],
    }),
  );
});

test("Android hardening manifest keeps overlay and package receiver protections", () => {
  const manifest = readFileSync(join(process.cwd(), "android", "app", "src", "main", "AndroidManifest.xml"), "utf8");
  const plugin = readFileSync(join(process.cwd(), "plugins", "withBlockerAndroid.js"), "utf8");

  assert.match(manifest, /android\.permission\.SYSTEM_ALERT_WINDOW/);
  assert.doesNotMatch(manifest, /SYSTEM_ALERT_WINDOW" tools:node="remove"/);
  assert.match(manifest, /android:allowBackup="false"/);
  assert.match(manifest, /com\.example\.blocker\.BlockOverlayService/);
  assert.match(manifest, /com\.example\.blocker\.PackageChangeReceiver/);
  assert.match(plugin, /android\.permission\.SYSTEM_ALERT_WINDOW/);
  assert.match(plugin, /PackageChangeReceiver/);
});

test("dangerous app rules cover required high-risk categories", () => {
  const rules = buildDangerousAppRules().rules;
  const categories = new Set(rules.map((rule) => rule.category));
  const ids = rules.map((rule) => rule.id).join("\n");

  [
    "short_video",
    "social_media",
    "browser",
    "private_browser",
    "vpn",
    "proxy",
    "tor",
    "apk_store",
    "app_cloner",
    "hidden_vault",
    "random_chat",
    "dating",
    "livestream",
    "unsafe_ai",
    "file_sharing",
  ].forEach((category) => assert.equal(categories.has(category as never), true));

  [
    "tiktok",
    "instagram",
    "snapchat",
    "telegram",
    "reddit",
    "discord",
    "youtube",
  ].forEach((marker) => assert.match(ids, new RegExp(marker)));

  assert.equal(rules.every((rule) => rule.packageName && rule.appName && rule.reason && rule.source), true);
  assert.equal(
    rules
      .filter((rule) => ["short_video", "browser", "private_browser", "vpn", "proxy", "tor", "apk_store", "app_cloner", "hidden_vault"].includes(rule.category))
      .every((rule) => rule.strictModeAction === "BLOCK"),
    true,
  );
});

test("Phase 1 feature block keys are wired through native policy, TypeScript, and screen detection", () => {
  const policyRepository = readFileSync(join(process.cwd(), "modules", "blocker", "android", "src", "main", "java", "com", "example", "blocker", "PolicyRepository.kt"), "utf8");
  const tsTypes = readFileSync(join(process.cwd(), "src", "types", "blocker.ts"), "utf8");
  const stateStore = readFileSync(join(process.cwd(), "src", "store", "useProtectionState.ts"), "utf8");
  const detector = readFileSync(join(process.cwd(), "modules", "blocker", "android", "src", "main", "java", "com", "example", "blocker", "behavior", "ScreenContextDetector.kt"), "utf8");
  const featureSettings = readFileSync(join(process.cwd(), "src", "components", "behavior", "AppFeatureBlockingSettings.tsx"), "utf8");

  [
    "youtubeShorts",
    "youtubeComments",
    "pictureInPicture",
    "telegramGroups",
    "redditSearch",
    "redditSubreddits",
    "pinterestSearch",
    "androidTamperSettings",
    "playStoreUninstallControls",
    "packageInstallerControls",
  ].forEach((key) => {
    assert.match(policyRepository, new RegExp(key));
    assert.match(tsTypes, new RegExp(`${key}: boolean`));
    assert.match(stateStore, new RegExp(key));
    assert.match(detector, new RegExp(key));
    assert.match(featureSettings, new RegExp(key));
  });
});

test("DNS engine logs only enforcement events and supports SafeSearch rewrite targets", () => {
  const dnsEngine = readFileSync(join(process.cwd(), "modules", "blocker", "android", "src", "main", "java", "com", "example", "blocker", "DnsFilterEngine.kt"), "utf8");
  const classifier = readFileSync(join(process.cwd(), "modules", "blocker", "android", "src", "main", "java", "com", "example", "blocker", "DomainClassifier.kt"), "utf8");
  const blocklistStore = readFileSync(join(process.cwd(), "modules", "blocker", "android", "src", "main", "java", "com", "example", "blocker", "BlocklistStore.kt"), "utf8");

  assert.match(dnsEngine, /DNS_BYPASS_BLOCKED/);
  assert.match(dnsEngine, /recordDomainEvent\(classification\.domain, classification\.category, "blocked"\)/);
  assert.match(dnsEngine, /recordDomainEvent\(classification\.domain, classification\.category, "safe_search"\)/);
  assert.doesNotMatch(dnsEngine, /DomainClassification\.Action\.ALLOW -> \{[\s\S]*?recordDomainEvent/);
  assert.match(dnsEngine, /query\.queryType != DNS_TYPE_A && query\.queryType != DNS_TYPE_AAAA/);
  assert.match(dnsEngine, /buildCnameResponse/);
  assert.match(classifier, /repository\.allowlistedDomains\(\)/);
  assert.match(classifier, /repository\.isStrictModeEnabled\(\) \|\| repository\.shouldBlockBypassDomains\(\)/);
  assert.match(classifier, /safe\.duckduckgo\.com/);
  assert.match(blocklistStore, /dns_rewrite_rules\.json/);
});

test("VPN filter intercepts encrypted DNS resolver routes and checks destination ports", () => {
  const vpnService = readFileSync(join(process.cwd(), "modules", "blocker", "android", "src", "main", "java", "com", "example", "blocker", "FilterVpnService.kt"), "utf8");

  assert.match(vpnService, /addEncryptedDnsResolverRoutes\(builder\)/);
  assert.match(vpnService, /builder\.addRoute\(resolverIp, 32\)/);
  assert.match(vpnService, /builder\.addRoute\(resolverIp, 128\)/);
  assert.match(vpnService, /val destPort = readU16\(buffer, ipHeaderLength \+ 2\)/);
  assert.match(vpnService, /val destPort = readU16\(buffer, transportOffset \+ 2\)/);
  assert.match(vpnService, /ENCRYPTED_DNS_PORTS = setOf\(443, 853\)/);
  assert.match(vpnService, /ENCRYPTED_DNS_PROTOCOLS = setOf\(TCP_PROTOCOL, UDP_PROTOCOL\)/);
  assert.match(vpnService, /ACTION_ENCRYPTED_DNS_BLOCKED/);
});

test("unknown search engine blocking is enforced at domain-classification time", () => {
  const classifier = readFileSync(join(process.cwd(), "modules", "blocker", "android", "src", "main", "java", "com", "example", "blocker", "DomainClassifier.kt"), "utf8");
  const policyRepository = readFileSync(join(process.cwd(), "modules", "blocker", "android", "src", "main", "java", "com", "example", "blocker", "PolicyRepository.kt"), "utf8");

  assert.match(classifier, /repository\.isBlockUnknownSearchEnginesEnabled\(\) && isUnmanagedSearchDomain\(domain\)/);
  assert.match(classifier, /SEARCH_ENGINE_DOMAINS = setOf/);
  assert.match(classifier, /search\.brave\.com/);
  assert.match(classifier, /startpage\.com/);
  assert.match(policyRepository, /IDN\.toASCII\(withoutPort\)/);
});

test("adult-domain heuristics, text hardening, and bypass defaults are wired", () => {
  const classifier = readFileSync(join(process.cwd(), "modules", "blocker", "android", "src", "main", "java", "com", "example", "blocker", "DomainClassifier.kt"), "utf8");
  const policyRepository = readFileSync(join(process.cwd(), "modules", "blocker", "android", "src", "main", "java", "com", "example", "blocker", "PolicyRepository.kt"), "utf8");
  const stateStore = readFileSync(join(process.cwd(), "src", "store", "useProtectionState.ts"), "utf8");
  const keywordMatcher = readFileSync(join(process.cwd(), "modules", "blocker", "android", "src", "main", "java", "com", "example", "blocker", "behavior", "KeywordMatcher.kt"), "utf8");
  const contextualMatcher = readFileSync(join(process.cwd(), "modules", "blocker", "android", "src", "main", "java", "com", "example", "blocker", "behavior", "ContextualKeywordMatcher.kt"), "utf8");
  const appRuleEngine = readFileSync(join(process.cwd(), "modules", "blocker", "android", "src", "main", "java", "com", "example", "blocker", "AppRuleEngine.kt"), "utf8");
  const appInventory = readFileSync(join(process.cwd(), "modules", "blocker", "android", "src", "main", "java", "com", "example", "blocker", "AppInventory.kt"), "utf8");

  assert.match(classifier, /looksLikeAdultDomain\(domain\)/);
  assert.match(classifier, /ADULT_ONLY_TLDS = setOf\("adult", "porn", "sex", "xxx"\)/);
  assert.match(classifier, /STRONG_ADULT_DOMAIN_MARKERS = setOf\([\s\S]*"porno"[\s\S]*"xvideos"[\s\S]*"onlyfans"/);
  assert.match(classifier, /normalizeAdultSignalLabel/);
  assert.match(keywordMatcher, /compactSubstringKeywords/);
  assert.match(keywordMatcher, /"porno"/);
  assert.match(contextualMatcher, /val normalizedText = KeywordMatcher\.normalize\(screenText\)/);
  assert.match(policyRepository, /isBlockUnknownSearchEnginesEnabled\(\): Boolean = true/);
  assert.match(policyRepository, /isBlockVpnAppsEnabled\(\): Boolean = preferences\.getBoolean\(KEY_BLOCK_VPN_APPS, true\)/);
  assert.match(policyRepository, /isBlockPrivateBrowsersEnabled\(\): Boolean = preferences\.getBoolean\(KEY_BLOCK_PRIVATE_BROWSERS, true\)/);
  assert.match(policyRepository, /isBlockBypassToolsEnabled\(\): Boolean = preferences\.getBoolean\(KEY_BLOCK_BYPASS_TOOLS, true\)/);
  assert.match(policyRepository, /AppInventory\.isPrivateBrowser\(normalized, label\)/);
  assert.doesNotMatch(policyRepository, /rule\?\.category in setOf\("browser", "private_browser"\)/);
  assert.match(stateStore, /blockUnknownSearchEngines: true/);
  assert.match(stateStore, /blockVpnApps: true/);
  assert.match(stateStore, /blockPrivateBrowsers: true/);
  assert.match(stateStore, /blockBypassTools: true/);
  assert.match(appRuleEngine, /id = "browser\.private"/);
  assert.match(appInventory, /rule\?\.category == "private_browser"/);
  assert.doesNotMatch(appInventory, /rule\?\.category in setOf\("browser", "private_browser"\)/);
});

test("policy hardening stores runtime allowlists, queued Guardian alerts, and migrated PIN hashes", () => {
  const policyRepository = readFileSync(join(process.cwd(), "modules", "blocker", "android", "src", "main", "java", "com", "example", "blocker", "PolicyRepository.kt"), "utf8");
  const notifier = readFileSync(join(process.cwd(), "modules", "blocker", "android", "src", "main", "java", "com", "example", "blocker", "GuardianNotifier.kt"), "utf8");

  assert.match(policyRepository, /CURRENT_POLICY_SCHEMA_VERSION = 4/);
  assert.match(policyRepository, /PIN_ALGORITHM_PBKDF2/);
  assert.match(policyRepository, /PIN_ALGORITHM_LEGACY_SHA256/);
  assert.match(policyRepository, /PBKDF2WithHmacSHA256/);
  assert.match(policyRepository, /addAllowlistedDomain/);
  assert.match(policyRepository, /removeAllowlistedDomain/);
  assert.match(policyRepository, /fun addBlockedDomain\(domain: String, pin: String\? = null\)/);
  assert.match(policyRepository, /fun removeBlockedDomain\(domain: String, pin: String\? = null\)/);
  assert.match(policyRepository, /recordGuardianAlert/);
  assert.match(policyRepository, /clearGuardianAlert/);
  assert.match(notifier, /IMPORTANCE_HIGH/);
  assert.match(notifier, /ALERT_RATE_LIMIT_MS/);
});

test("app install and usage-limit controls are wired through native policy and UI", () => {
  const policyRepository = readFileSync(join(process.cwd(), "modules", "blocker", "android", "src", "main", "java", "com", "example", "blocker", "PolicyRepository.kt"), "utf8");
  const packageReceiver = readFileSync(join(process.cwd(), "modules", "blocker", "android", "src", "main", "java", "com", "example", "blocker", "PackageChangeReceiver.kt"), "utf8");
  const usageLimiter = readFileSync(join(process.cwd(), "modules", "blocker", "android", "src", "main", "java", "com", "example", "blocker", "AppUsageLimiter.kt"), "utf8");
  const behaviorEngine = readFileSync(join(process.cwd(), "modules", "blocker", "android", "src", "main", "java", "com", "example", "blocker", "behavior", "BehaviorEngine.kt"), "utf8");
  const screenDetector = readFileSync(join(process.cwd(), "modules", "blocker", "android", "src", "main", "java", "com", "example", "blocker", "behavior", "ScreenContextDetector.kt"), "utf8");
  const tsTypes = readFileSync(join(process.cwd(), "src", "types", "blocker.ts"), "utf8");
  const stateStore = readFileSync(join(process.cwd(), "src", "store", "useProtectionState.ts"), "utf8");
  const focusScreen = readFileSync(join(process.cwd(), "app", "focus.tsx"), "utf8");

  assert.match(policyRepository, /KEY_BLOCK_SIDELOADED_APPS = "blockSideloadedApps"/);
  assert.match(packageReceiver, /SIDELOADED_APK_BLOCKED/);
  assert.match(packageReceiver, /getInstallSourceInfo/);
  assert.match(usageLimiter, /queryUsageStats\(UsageStatsManager\.INTERVAL_DAILY/);
  assert.match(behaviorEngine, /reason = "usage_limit"/);
  assert.match(screenDetector, /playStoreAdultInstallControls/);
  assert.match(screenDetector, /isAdultPlayStoreInstallSurface/);
  assert.match(tsTypes, /export type UsageLimitPolicy/);
  assert.match(stateStore, /updateUsageLimitPolicy/);
  assert.match(focusScreen, /UsageLimitsCard/);
  assert.doesNotMatch(focusScreen, /ScheduleProfilesCard/);
});

test("rules screen merges website rules with keywords and keeps search enforcement locked", () => {
  const rulesScreen = readFileSync(join(process.cwd(), "app", "rules.tsx"), "utf8");
  const keywordManager = readFileSync(join(process.cwd(), "src", "components", "behavior", "CustomKeywordManager.tsx"), "utf8");
  const safeSearchCard = readFileSync(join(process.cwd(), "src", "components", "SafeSearchCard.tsx"), "utf8");
  const stateStore = readFileSync(join(process.cwd(), "src", "store", "useProtectionState.ts"), "utf8");
  const policyRepository = readFileSync(join(process.cwd(), "modules", "blocker", "android", "src", "main", "java", "com", "example", "blocker", "PolicyRepository.kt"), "utf8");
  const screenDetector = readFileSync(join(process.cwd(), "modules", "blocker", "android", "src", "main", "java", "com", "example", "blocker", "behavior", "ScreenContextDetector.kt"), "utf8");

  assert.doesNotMatch(rulesScreen, /BlocklistManagerCard/);
  assert.doesNotMatch(rulesScreen, /BehaviorProtectionCard/);
  assert.doesNotMatch(rulesScreen, /AIProtectionCard/);
  assert.match(rulesScreen, /CustomKeywordManager/);
  assert.match(keywordManager, /Keywords and Websites/);
  assert.match(keywordManager, /onAddBlockedDomain/);
  assert.match(keywordManager, /onRemoveBlockedDomain/);
  assert.match(safeSearchCard, /Search Enforcement/);
  assert.doesNotMatch(safeSearchCard, /Switch/);
  assert.match(stateStore, /googleSafeSearch: true/);
  assert.match(policyRepository, /fun isGoogleSafeSearchEnabled\(\): Boolean = true/);
  assert.match(policyRepository, /fun isBlockUnknownSearchEnginesEnabled\(\): Boolean = true/);
  assert.match(screenDetector, /BlockedFeature\("googleSearch", "Google", "Google Search", "Google Search"\)/);
});

test("uninstall lock and bypass hardening preserve resolver and suspension enforcement", () => {
  const dnsEngine = readFileSync(join(process.cwd(), "modules", "blocker", "android", "src", "main", "java", "com", "example", "blocker", "DnsFilterEngine.kt"), "utf8");
  const vpnService = readFileSync(join(process.cwd(), "modules", "blocker", "android", "src", "main", "java", "com", "example", "blocker", "FilterVpnService.kt"), "utf8");
  const managedEnforcer = readFileSync(join(process.cwd(), "modules", "blocker", "android", "src", "main", "java", "com", "example", "blocker", "ManagedEnforcer.kt"), "utf8");
  const uninstallLock = readFileSync(join(process.cwd(), "modules", "blocker", "android", "src", "main", "java", "com", "example", "blocker", "UninstallLockManager.kt"), "utf8");

  assert.match(vpnService, /plainDnsBypassResolverIp/);
  assert.match(vpnService, /engine\.processPacket\(packet, packet\.size, plainDnsResolverIp\)/);
  assert.match(dnsEngine, /originalResolverIp/);
  assert.match(dnsEngine, /PUBLIC_DNS_RESOLVERS/);
  assert.match(managedEnforcer, /val target = targetSuspendedPackages\(\)/);
  assert.match(managedEnforcer, /managedSuspensionActive && repository\.isAppAllowlistActive\(\)/);
  assert.match(uninstallLock, /UNINSTALL_PROTECTION_REAPPLIED/);
  assert.match(uninstallLock, /uninstall_lock_reapply_failed/);
});

test("native bridge exposes Usage Access, Guardian alert, allowlist, and strict overlay APIs", () => {
  const module = readFileSync(join(process.cwd(), "modules", "blocker", "android", "src", "main", "java", "com", "example", "blocker", "BlockerModule.kt"), "utf8");
  const tsTypes = readFileSync(join(process.cwd(), "src", "types", "blocker.ts"), "utf8");
  const manifest = readFileSync(join(process.cwd(), "android", "app", "src", "main", "AndroidManifest.xml"), "utf8");
  const plugin = readFileSync(join(process.cwd(), "plugins", "withBlockerAndroid.ts"), "utf8");

  [
    "getUsageAccessStatus",
    "openUsageAccessSettings",
    "getGuardianAlerts",
    "clearGuardianAlert",
    "addAllowlistedDomain",
    "removeAllowlistedDomain",
    "removeBlockedDomain",
    "setEmergencyLockEnabled",
  ].forEach((method) => {
    assert.match(module, new RegExp(method));
    assert.match(tsTypes, new RegExp(method));
  });
  assert.match(module, /"blockedDomains" to repo\.blockedDomains\(\)\.toList\(\)\.sorted\(\)/);
  assert.match(module, /"allowlistedDomains" to repo\.allowlistedDomains\(\)\.toList\(\)\.sorted\(\)/);
  assert.match(tsTypes, /blockedDomains\?: string\[\]/);
  assert.match(tsTypes, /allowlistedDomains\?: string\[\]/);
  assert.match(tsTypes, /hideBlockOverlay\(pin\?: string\): Promise<OverlayHideResult>/);
  assert.match(module, /hideBlockOverlay"\) \{ pin: String\? ->/);
  assert.match(manifest, /android\.permission\.PACKAGE_USAGE_STATS/);
  assert.match(plugin, /android\.permission\.PACKAGE_USAGE_STATS/);
});

test("setup checklist wires Android permission prompts into the dashboard", () => {
  const dashboard = readFileSync(join(process.cwd(), "app", "index.tsx"), "utf8");
  const checklist = readFileSync(join(process.cwd(), "src", "components", "PermissionChecklistCard.tsx"), "utf8");
  const stateStore = readFileSync(join(process.cwd(), "src", "store", "useProtectionState.ts"), "utf8");

  [
    "onGrantVpnPermission",
    "onOpenAccessibilitySettings",
    "onOpenOverlaySettings",
    "onOpenUsageAccessSettings",
    "onRequestDeviceAdminPermission",
  ].forEach((prop) => assert.match(checklist, new RegExp(prop)));

  [
    "protection.prepareVpn",
    "protection.openAccessibilitySettings",
    "protection.openOverlaySettings",
    "protection.openUsageAccessSettings",
    "protection.requestDeviceAdminPermission",
  ].forEach((handler) => assert.match(dashboard, new RegExp(handler.replace(".", "\\."))));

  [
    "vpnPermissionGranted",
    "accessibilityServiceEnabled",
    "overlayPermissionGranted",
    "usageAccessStatus.granted",
    "managedDeviceStatus.deviceAdminActive",
  ].forEach((statusKey) => assert.match(dashboard, new RegExp(statusKey.replace(".", "\\."))));

  assert.match(stateStore, /const prepareVpn = useCallback/);
  assert.match(stateStore, /const requestDeviceAdminPermission = useCallback/);
});

test("dashboard does not expose trigger history log", () => {
  const dashboard = readFileSync(join(process.cwd(), "app", "index.tsx"), "utf8");
  const stateStore = readFileSync(join(process.cwd(), "src", "store", "useProtectionState.ts"), "utf8");
  const tsTypes = readFileSync(join(process.cwd(), "src", "types", "blocker.ts"), "utf8");
  const module = readFileSync(join(process.cwd(), "modules", "blocker", "android", "src", "main", "java", "com", "example", "blocker", "BlockerModule.kt"), "utf8");
  const policyRepository = readFileSync(join(process.cwd(), "modules", "blocker", "android", "src", "main", "java", "com", "example", "blocker", "PolicyRepository.kt"), "utf8");
  const triggerHistoryLogPath = join(process.cwd(), "src", "components", "behavior", "TriggerHistoryLog.tsx");

  assert.equal(existsSync(triggerHistoryLogPath), false);
  assert.doesNotMatch(dashboard, /TriggerHistoryLog/);
  assert.doesNotMatch(dashboard, /Trigger History Log/);
  assert.doesNotMatch(dashboard, /triggerHistory/);
  assert.doesNotMatch(stateStore, /triggerHistory/);
  assert.doesNotMatch(tsTypes, /getTriggerHistory/);
  assert.doesNotMatch(module, /getTriggerHistory/);
  assert.doesNotMatch(policyRepository, /private const val KEY_TRIGGER_HISTORY/);
  assert.doesNotMatch(policyRepository, /MAX_TRIGGER_HISTORY/);
  assert.match(policyRepository, /DEPRECATED_KEY_TRIGGER_HISTORY/);
});

test("tamper detection covers expanded critical native signals", () => {
  const tamperDetector = readFileSync(join(process.cwd(), "modules", "blocker", "android", "src", "main", "java", "com", "example", "blocker", "TamperDetector.kt"), "utf8");
  const deviceOwner = readFileSync(join(process.cwd(), "modules", "blocker", "android", "src", "main", "java", "com", "example", "blocker", "DeviceOwnerPolicyManager.kt"), "utf8");

  [
    "usage_access_revoked",
    "device_admin_inactive",
    "app_signature_mismatch",
    "verified_boot_or_custom_build",
    "safe_mode_active",
    "installed_bypass_app",
  ].forEach((signalId) => assert.match(tamperDetector, new RegExp(signalId)));
  assert.match(tamperDetector, /GuardianNotifier\.notify/);
  assert.match(deviceOwner, /appliedRestrictions/);
  assert.match(deviceOwner, /missingRestrictions/);
  assert.match(deviceOwner, /setEmergencyLock/);
});

function loadProcessedSet(fileName: string) {
  return new Set(
    readFileSync(join(process.cwd(), "blocklists", "processed", fileName), "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  );
}

function matchesDomainRule(domain: string, rules: Set<string>) {
  let candidate = domain.trim().toLowerCase().replace(/\.$/, "");
  while (candidate) {
    if (rules.has(candidate)) return true;
    const nextDot = candidate.indexOf(".");
    if (nextDot === -1) break;
    candidate = candidate.slice(nextDot + 1);
  }
  return false;
}
