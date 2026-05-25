import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { isIP } from "node:net";
import { basename, join } from "node:path";
import { domainToASCII } from "node:url";

import type {
  BlocklistCategory,
  BlocklistFormat,
  DangerousAppRule,
  RemoteBlocklistSource,
  TrustLevel,
} from "../src/types/policy";

type SourceFormat = BlocklistFormat | "domains";
type SourceBucket = "adult-domains" | "bypass-domains" | "keywords" | "allowlist" | "ignored";
type SourceCategory = BlocklistCategory;

type SafetyConfig = {
  minimumAdultDomains: number;
  maxGrowthRatio: number;
  maxShrinkRatio: number;
};

type SourceConfigFile = {
  schemaVersion: number;
  safety?: Partial<SafetyConfig>;
  sources: SourceConfig[];
};

type SourceConfig = Omit<RemoteBlocklistSource, "format" | "category"> & {
  format: SourceFormat;
  category: SourceCategory;
};

type DownloadedSource = SourceConfig & {
  bucket: SourceBucket;
  resolvedUrl: string;
  text?: string;
  checksum?: string;
  rawLineCount: number;
  downloadedAt?: string;
  usedCachedRaw: boolean;
  error?: string;
};

type ParsedDomainSource = {
  id: string;
  name: string;
  license: string;
  format?: SourceFormat;
  category?: SourceCategory;
  priority?: number;
  trustLevel?: TrustLevel;
  enabled?: boolean;
  url: string;
  lines: string[];
};

type SourceManifest = {
  id: string;
  name: string;
  category: SourceCategory;
  bucket: SourceBucket;
  format: SourceFormat;
  trustLevel: TrustLevel;
  priority: number;
  enabled: boolean;
  url: string;
  license: string;
  downloadedAt?: string;
  checksum?: string;
  rawLineCount: number;
  processedLineCount: number;
  removedDuplicates: number;
  removedInvalid: number;
  removedCritical: number;
  removedAllowlisted: number;
  usedCachedRaw: boolean;
  error?: string;
};

type DomainEntry = {
  domain: string;
  sourceId: string;
  sourceName: string;
};

export type KeywordClass =
  | "HARD_BLOCK"
  | "CONTEXTUAL_BLOCK"
  | "WARNING"
  | "ALLOW_CONTEXT";

type KeywordCategory =
  | "ADULT"
  | "SOFTCORE"
  | "BYPASS"
  | "PLATFORM"
  | "SHORT_FORM"
  | "UNKNOWN";

type KeywordSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

type KeywordRule = {
  id: string;
  term: string;
  locale: "ar" | "en" | "mixed";
  language: "ar" | "en" | "mixed";
  pattern: string;
  normalized: string;
  compact: string;
  matchType: "EXACT" | "CONTAINS" | "REGEX" | "NORMALIZED";
  category: KeywordCategory;
  severity: KeywordSeverity;
  classification: KeywordClass;
  enabled: boolean;
  source: string;
  contexts: string[];
  reviewRequired: boolean;
  notes?: string;
};

type DangerousAppRuleWithMatchers = DangerousAppRule & {
  packages?: string[];
  packageMarkers?: string[];
  labelMarkers?: string[];
};

const DEFAULT_SAFETY: SafetyConfig = {
  minimumAdultDomains: 1000,
  maxGrowthRatio: 2.5,
  maxShrinkRatio: 0.2,
};

const SOURCE_FORMATS = new Set<SourceFormat>([
  "adguard",
  "hosts",
  "domains",
  "domain_list",
  "pihole",
  "dnsmasq",
  "json_policy",
  "words",
]);

const SOURCE_CATEGORIES = new Set<SourceCategory>([
  "adult",
  "nsfw",
  "social",
  "short_video",
  "gambling",
  "proxy",
  "vpn",
  "tor",
  "bypass",
  "malware",
  "keywords",
  "allowlist",
  "unknown",
]);

const TRUST_LEVELS = new Set<TrustLevel>([
  "high",
  "medium",
  "low",
  "review",
  "local_override",
]);

const CRITICAL_DOMAINS = new Set([
  "android.com",
  "firebase.google.com",
  "firebaseio.com",
  "google.com",
  "googleapis.com",
  "googleusercontent.com",
  "googlevideo.com",
  "gstatic.com",
  "gvt1.com",
  "play.googleapis.com",
  "youtube.com",
  "youtube-nocookie.com",
  "ytimg.com",
]);

const SAFE_DOMAIN_CANARIES = new Set([
  "apple.com",
  "cloudflare.com",
  "github.com",
  "microsoft.com",
  "openai.com",
  "wikipedia.org",
]);

const LOCAL_TLDS = [
  ".home",
  ".home.arpa",
  ".internal",
  ".invalid",
  ".lan",
  ".local",
  ".localhost",
  ".test",
];

const ACTIVE_CONTEXTS = [
  "BROWSER_SEARCH",
  "WEB_PAGE",
  "YOUTUBE_SEARCH",
  "TELEGRAM_SEARCH",
  "TELEGRAM_PUBLIC_CHANNEL",
  "TIKTOK_SEARCH",
  "TIKTOK_FEED",
  "PUBLIC_FEED",
];

const CURATED_KEYWORDS: Array<
  Omit<
    KeywordRule,
    | "id"
    | "normalized"
    | "compact"
    | "source"
    | "reviewRequired"
    | "pattern"
    | "matchType"
    | "notes"
  >
> = [
  keyword("porn", "HARD_BLOCK", "en", "ADULT", "CRITICAL"),
  keyword("porno", "HARD_BLOCK", "en", "ADULT", "CRITICAL"),
  keyword("pornography", "HARD_BLOCK", "en", "ADULT", "CRITICAL"),
  keyword("xxx", "HARD_BLOCK", "en", "ADULT", "CRITICAL"),
  keyword("nude", "HARD_BLOCK", "en", "SOFTCORE", "HIGH"),
  keyword("nudity", "HARD_BLOCK", "en", "SOFTCORE", "HIGH"),
  keyword("onlyfans", "HARD_BLOCK", "en", "PLATFORM", "CRITICAL"),
  keyword("hentai", "HARD_BLOCK", "en", "ADULT", "CRITICAL"),
  keyword("cam site", "HARD_BLOCK", "en", "ADULT", "HIGH"),
  keyword("nsfw leaks", "HARD_BLOCK", "en", "ADULT", "CRITICAL"),
  keyword("sex", "CONTEXTUAL_BLOCK", "en", "ADULT", "HIGH"),
  keyword("escort", "CONTEXTUAL_BLOCK", "en", "ADULT", "HIGH"),
  keyword("dating", "CONTEXTUAL_BLOCK", "en", "PLATFORM", "MEDIUM"),
  keyword("adult", "CONTEXTUAL_BLOCK", "en", "ADULT", "MEDIUM"),
  keyword("proxy", "CONTEXTUAL_BLOCK", "en", "BYPASS", "HIGH"),
  keyword("vpn", "CONTEXTUAL_BLOCK", "en", "BYPASS", "HIGH"),
  keyword("tor browser", "HARD_BLOCK", "en", "BYPASS", "CRITICAL"),
  keyword("unblocked", "CONTEXTUAL_BLOCK", "en", "BYPASS", "HIGH"),
  keyword("sexual health", "ALLOW_CONTEXT", "en", "ADULT", "LOW"),
  keyword("sex education", "ALLOW_CONTEXT", "en", "ADULT", "LOW"),
  keyword("biology", "ALLOW_CONTEXT", "en", "UNKNOWN", "LOW"),
  keyword("health", "ALLOW_CONTEXT", "en", "UNKNOWN", "LOW"),
  keyword("chromosome", "ALLOW_CONTEXT", "en", "UNKNOWN", "LOW"),
  keyword("بورن", "HARD_BLOCK", "ar", "ADULT", "CRITICAL"),
  keyword("اباحي", "HARD_BLOCK", "ar", "ADULT", "CRITICAL"),
  keyword("إباحي", "HARD_BLOCK", "ar", "ADULT", "CRITICAL"),
  keyword("سكس", "HARD_BLOCK", "ar", "ADULT", "CRITICAL"),
  keyword("جنس", "CONTEXTUAL_BLOCK", "ar", "ADULT", "HIGH"),
  keyword("تعري", "CONTEXTUAL_BLOCK", "ar", "SOFTCORE", "HIGH"),
  keyword("عاري", "CONTEXTUAL_BLOCK", "ar", "SOFTCORE", "HIGH"),
  keyword("بروكسي", "CONTEXTUAL_BLOCK", "ar", "BYPASS", "HIGH"),
  keyword("في بي ان", "CONTEXTUAL_BLOCK", "ar", "BYPASS", "HIGH"),
  keyword("تثقيف جنسي", "ALLOW_CONTEXT", "ar", "ADULT", "LOW"),
  keyword("صحة", "ALLOW_CONTEXT", "ar", "UNKNOWN", "LOW"),
  keyword("أحياء", "ALLOW_CONTEXT", "ar", "UNKNOWN", "LOW"),
  keyword("طب", "ALLOW_CONTEXT", "ar", "UNKNOWN", "LOW"),
];

const REVIEW_CANDIDATE_HINTS = [
  "adult",
  "cam",
  "escort",
  "hentai",
  "nude",
  "nudity",
  "onlyfans",
  "porn",
  "sex",
  "xxx",
];

const DNS_REWRITE_RULES = [
  {
    id: "google_safesearch_wildcard",
    domainPattern: "www.google.*",
    action: "REDIRECT",
    target: "forcesafesearch.google.com",
    category: "safesearch",
    enabled: true,
    strictOnly: false,
    reason: "Force Google SafeSearch through DNS CNAME-style rewrite.",
  },
  {
    id: "youtube_restricted_www",
    domainPattern: "www.youtube.com",
    action: "REDIRECT",
    target: "restrict.youtube.com",
    category: "youtube_restricted_mode",
    enabled: true,
    strictOnly: false,
    reason: "Force YouTube Restricted Mode.",
  },
  {
    id: "youtube_restricted_mobile",
    domainPattern: "m.youtube.com",
    action: "REDIRECT",
    target: "restrict.youtube.com",
    category: "youtube_restricted_mode",
    enabled: true,
    strictOnly: false,
    reason: "Force YouTube Restricted Mode on mobile web.",
  },
  {
    id: "youtube_restricted_youtubei_api",
    domainPattern: "youtubei.googleapis.com",
    action: "REDIRECT",
    target: "restrict.youtube.com",
    category: "youtube_restricted_mode",
    enabled: true,
    strictOnly: false,
    reason: "Force Restricted Mode for YouTube internal API.",
  },
  {
    id: "youtube_restricted_youtube_api",
    domainPattern: "youtube.googleapis.com",
    action: "REDIRECT",
    target: "restrict.youtube.com",
    category: "youtube_restricted_mode",
    enabled: true,
    strictOnly: false,
    reason: "Force Restricted Mode for YouTube API.",
  },
  {
    id: "youtube_restricted_nocookie",
    domainPattern: "www.youtube-nocookie.com",
    action: "REDIRECT",
    target: "restrict.youtube.com",
    category: "youtube_restricted_mode",
    enabled: true,
    strictOnly: false,
    reason: "Force Restricted Mode for embedded YouTube.",
  },
  {
    id: "bing_safesearch_www",
    domainPattern: "www.bing.com",
    action: "REDIRECT",
    target: "strict.bing.com",
    category: "safesearch",
    enabled: true,
    strictOnly: false,
    reason: "Force Bing Strict SafeSearch.",
  },
  {
    id: "bing_safesearch_edge_services",
    domainPattern: "edgeservices.bing.com",
    action: "REDIRECT",
    target: "strict.bing.com",
    category: "safesearch",
    enabled: true,
    strictOnly: false,
    reason: "Force Bing Strict SafeSearch for Microsoft Edge sidebar/services.",
  },
  {
    id: "duckduckgo_safesearch",
    domainPattern: "duckduckgo.com",
    action: "REDIRECT",
    target: "safe.duckduckgo.com",
    category: "safesearch",
    enabled: true,
    strictOnly: false,
    reason: "Force DuckDuckGo Strict Safe Search.",
  },
] as const;

const DANGEROUS_APP_RULES: DangerousAppRuleWithMatchers[] = [
  dangerousAppRule({
    id: "short_video.tiktok",
    packageName: "com.zhiliaoapp.musically",
    appName: "TikTok",
    category: "short_video",
    riskLevel: "critical",
    defaultAction: "ASK_GUARDIAN",
    strictModeAction: "BLOCK",
    reason: "Short-form video feed with high adult-content and compulsive-use risk.",
    packages: ["com.zhiliaoapp.musically", "com.ss.android.ugc.trill", "com.ss.android.ugc.aweme"],
    packageMarkers: ["tiktok", "musically", "ss.android.ugc"],
  }),
  dangerousAppRule({
    id: "social.instagram",
    packageName: "com.instagram.android",
    appName: "Instagram",
    category: "social_media",
    riskLevel: "high",
    defaultAction: "ASK_GUARDIAN",
    strictModeAction: "BLOCK",
    reason: "Explore, reels, and public search surfaces can expose unsafe content.",
    packages: ["com.instagram.android"],
    packageMarkers: ["instagram"],
  }),
  dangerousAppRule({
    id: "social.snapchat",
    packageName: "com.snapchat.android",
    appName: "Snapchat",
    category: "social_media",
    riskLevel: "high",
    defaultAction: "ASK_GUARDIAN",
    strictModeAction: "BLOCK",
    reason: "Discovery and public social surfaces can expose unsafe content.",
    packages: ["com.snapchat.android"],
    packageMarkers: ["snapchat"],
  }),
  dangerousAppRule({
    id: "social.telegram",
    packageName: "org.telegram.messenger",
    appName: "Telegram",
    category: "social_media",
    riskLevel: "high",
    defaultAction: "ASK_GUARDIAN",
    strictModeAction: "BLOCK",
    reason: "Public channels and global search can expose adult or bypass content.",
    packages: ["org.telegram.messenger", "org.thunderdog.challegram"],
    packageMarkers: ["telegram", "challegram"],
  }),
  dangerousAppRule({
    id: "social.x_twitter",
    packageName: "com.twitter.android",
    appName: "X/Twitter",
    category: "social_media",
    riskLevel: "high",
    defaultAction: "ASK_GUARDIAN",
    strictModeAction: "BLOCK",
    reason: "Search, trends, media, and For You feeds can expose unsafe content.",
    packages: ["com.twitter.android", "com.x.android"],
    packageMarkers: ["twitter.android", "x.android", "xcorp"],
  }),
  dangerousAppRule({
    id: "social.reddit",
    packageName: "com.reddit.frontpage",
    appName: "Reddit",
    category: "social_media",
    riskLevel: "high",
    defaultAction: "ASK_GUARDIAN",
    strictModeAction: "BLOCK",
    reason: "Public communities and search can expose adult content.",
    packages: ["com.reddit.frontpage"],
    packageMarkers: ["reddit"],
  }),
  dangerousAppRule({
    id: "social.discord",
    packageName: "com.discord",
    appName: "Discord",
    category: "social_media",
    riskLevel: "high",
    defaultAction: "ASK_GUARDIAN",
    strictModeAction: "BLOCK",
    reason: "Public servers and chat discovery can expose unsafe content.",
    packages: ["com.discord"],
    packageMarkers: ["discord"],
  }),
  dangerousAppRule({
    id: "social.facebook",
    packageName: "com.facebook.katana",
    appName: "Facebook",
    category: "social_media",
    riskLevel: "medium",
    defaultAction: "ASK_GUARDIAN",
    strictModeAction: "BLOCK",
    reason: "Reels, groups, stories, and search surfaces can expose unsafe content.",
    packages: ["com.facebook.katana", "com.facebook.lite"],
    packageMarkers: ["facebook", "katana"],
  }),
  dangerousAppRule({
    id: "social.pinterest_tumblr",
    packageName: "com.pinterest",
    appName: "Pinterest/Tumblr",
    category: "social_media",
    riskLevel: "medium",
    defaultAction: "ASK_GUARDIAN",
    strictModeAction: "BLOCK",
    reason: "Image discovery surfaces can expose unsafe content.",
    packages: ["com.pinterest", "com.tumblr"],
    packageMarkers: ["pinterest", "tumblr"],
  }),
  dangerousAppRule({
    id: "streaming.live",
    packageName: "tv.twitch.android.app",
    appName: "Live streaming apps",
    category: "livestream",
    riskLevel: "high",
    defaultAction: "ASK_GUARDIAN",
    strictModeAction: "BLOCK",
    reason: "Live-streaming discovery and chat can expose unsafe content.",
    packages: [
      "tv.twitch.android.app",
      "com.kick.mobile",
      "sg.bigo.live",
      "com.younow.live",
      "com.sgiggle.production",
      "com.nimo.tv",
    ],
    packageMarkers: ["twitch", "kick", "bigo", "liveme", "younow", "tango", "nimo", "trovo", "nonolive", "afreecatv"],
  }),
  dangerousAppRule({
    id: "video.youtube",
    packageName: "com.google.android.youtube",
    appName: "YouTube",
    category: "short_video",
    riskLevel: "medium",
    defaultAction: "ASK_GUARDIAN",
    strictModeAction: "BLOCK",
    reason: "Shorts and search can expose unsafe content without restricted mode.",
    packages: ["com.google.android.youtube", "com.google.android.apps.youtube.kids"],
    packageMarkers: ["youtube"],
  }),
  dangerousAppRule({
    id: "browser.general",
    packageName: "com.android.chrome",
    appName: "General browsers",
    category: "browser",
    riskLevel: "high",
    defaultAction: "ASK_GUARDIAN",
    strictModeAction: "BLOCK",
    reason: "Unmanaged browsers can bypass app-level controls.",
    packages: [
      "com.android.chrome",
      "org.mozilla.firefox",
      "com.opera.browser",
      "com.opera.mini.native",
      "com.sec.android.app.sbrowser",
    ],
    packageMarkers: ["chrome", "firefox", "opera", "sbrowser", "browser"],
  }),
  dangerousAppRule({
    id: "browser.private",
    packageName: "com.brave.browser",
    appName: "Private browsers",
    category: "private_browser",
    riskLevel: "critical",
    defaultAction: "ASK_GUARDIAN",
    strictModeAction: "BLOCK",
    reason: "Privacy-focused browsers can evade supervision and history review.",
    packages: ["com.brave.browser", "com.duckduckgo.mobile.android", "org.torproject.torbrowser"],
    packageMarkers: ["duckduckgo", "brave", "firefox.focus", "privatebrowser", "incognito"],
    labelMarkers: ["private browser", "incognito"],
  }),
  dangerousAppRule({
    id: "bypass.vpn",
    packageName: "com.wireguard.android",
    appName: "VPN apps",
    category: "vpn",
    riskLevel: "critical",
    defaultAction: "BLOCK",
    strictModeAction: "BLOCK",
    reason: "VPN apps can bypass the local protection VPN and DNS filtering.",
    packages: [
      "com.cloudflare.onedotonedotonedotone",
      "com.wireguard.android",
      "net.openvpn.openvpn",
      "de.blinkt.openvpn",
      "com.expressvpn.vpn",
      "com.nordvpn.android",
      "com.surfshark.vpnclient.android",
      "com.windscribe.vpn",
    ],
    packageMarkers: ["vpn", "wireguard", "openvpn", "cloudflare", "warp"],
  }),
  dangerousAppRule({
    id: "bypass.proxy",
    packageName: "marker:proxy",
    appName: "Proxy apps",
    category: "proxy",
    riskLevel: "critical",
    defaultAction: "BLOCK",
    strictModeAction: "BLOCK",
    reason: "Proxy tools can bypass domain and SafeSearch policy.",
    packageMarkers: ["proxy", "psiphon", "ultrasurf"],
  }),
  dangerousAppRule({
    id: "bypass.tor",
    packageName: "org.torproject.android",
    appName: "Tor apps",
    category: "tor",
    riskLevel: "critical",
    defaultAction: "BLOCK",
    strictModeAction: "BLOCK",
    reason: "Tor tools can bypass DNS and network supervision.",
    packages: ["org.torproject.torbrowser", "org.torproject.android"],
    packageMarkers: ["tor", "orbot"],
  }),
  dangerousAppRule({
    id: "install.apk_stores",
    packageName: "cm.aptoide.pt",
    appName: "APK stores and installers",
    category: "apk_store",
    riskLevel: "critical",
    defaultAction: "BLOCK",
    strictModeAction: "BLOCK",
    reason: "Third-party app stores can install bypass tools outside guardian review.",
    packages: [
      "cm.aptoide.pt",
      "com.apkpure.aegon",
      "com.uptodown",
      "org.fdroid.fdroid",
      "com.android.vending.billing.inappbillingservice",
    ],
    packageMarkers: ["aptoide", "apkpure", "uptodown", "apk", "fdroid", "f-droid"],
  }),
  dangerousAppRule({
    id: "bypass.app_cloner",
    packageName: "marker:app_cloner",
    appName: "App cloners",
    category: "app_cloner",
    riskLevel: "critical",
    defaultAction: "BLOCK",
    strictModeAction: "BLOCK",
    reason: "App cloners can create unsupervised duplicates of blocked apps.",
    packageMarkers: ["parallel", "dualspace", "island", "shelter", "clone"],
    labelMarkers: ["parallel space", "dual space", "app cloner"],
  }),
  dangerousAppRule({
    id: "bypass.hidden_vault",
    packageName: "marker:hidden_vault",
    appName: "Hidden vault apps",
    category: "hidden_vault",
    riskLevel: "critical",
    defaultAction: "BLOCK",
    strictModeAction: "BLOCK",
    reason: "Hidden vault apps can conceal unsafe media or bypass behavior.",
    packageMarkers: ["vault", "hide", "calculatorvault", "securefolder"],
    labelMarkers: ["vault", "hide app", "secure folder", "calculator vault"],
  }),
  dangerousAppRule({
    id: "social.random_chat",
    packageName: "marker:random_chat",
    appName: "Random chat apps",
    category: "random_chat",
    riskLevel: "high",
    defaultAction: "ASK_GUARDIAN",
    strictModeAction: "BLOCK",
    reason: "Random chat and video chat apps can expose unsafe strangers and content.",
    packageMarkers: ["omegle", "ometv", "azarlive", "holla", "chatroulette"],
    labelMarkers: ["random chat", "video chat"],
  }),
  dangerousAppRule({
    id: "social.dating",
    packageName: "marker:dating",
    appName: "Dating apps",
    category: "dating",
    riskLevel: "high",
    defaultAction: "ASK_GUARDIAN",
    strictModeAction: "BLOCK",
    reason: "Dating apps are not appropriate in strict parental-control mode.",
    packageMarkers: ["tinder", "bumble", "hinge", "grindr", "badoo", "meetme", "skout"],
    labelMarkers: ["dating"],
  }),
  dangerousAppRule({
    id: "ai.unsafe_image_chat",
    packageName: "marker:unsafe_ai",
    appName: "Unsafe AI apps",
    category: "unsafe_ai",
    riskLevel: "medium",
    defaultAction: "ASK_GUARDIAN",
    strictModeAction: "BLOCK",
    reason: "AI chat and image apps can produce or search unsafe content.",
    packageMarkers: ["characterai", "chatai", "ai.chat", "image.generator", "dream", "waifu", "nsfw"],
    labelMarkers: ["ai chat", "image generator", "nsfw", "waifu"],
  }),
  dangerousAppRule({
    id: "sharing.file_torrent",
    packageName: "marker:file_sharing",
    appName: "File sharing apps",
    category: "file_sharing",
    riskLevel: "medium",
    defaultAction: "ASK_GUARDIAN",
    strictModeAction: "BLOCK",
    reason: "File sharing and torrent apps can be used to access unsafe media.",
    packageMarkers: ["torrent", "utorrent", "bittorrent", "mega", "mediafire"],
    labelMarkers: ["torrent", "file sharing"],
  }),
];

function keyword(
  term: string,
  classification: KeywordClass,
  language: "ar" | "en" | "mixed",
  category: KeywordCategory,
  severity: KeywordSeverity,
) {
  return {
    term,
    classification,
    locale: language,
    language,
    category,
    severity,
    enabled: classification !== "ALLOW_CONTEXT",
    contexts:
      classification === "ALLOW_CONTEXT"
        ? ["ALLOW_CONTEXT"]
        : [...ACTIVE_CONTEXTS],
  };
}

function dangerousAppRule(
  rule: Omit<DangerousAppRuleWithMatchers, "source" | "enabled"> & {
    source?: string;
    enabled?: boolean;
  },
): DangerousAppRuleWithMatchers {
  return {
    source: "curated",
    enabled: true,
    ...rule,
  };
}

export function loadSourceConfig(rootDir = process.cwd()): SourceConfigFile {
  const configPath = join(rootDir, "blocklists", "sources.json");
  const parsed = JSON.parse(readFileSync(configPath, "utf8")) as SourceConfigFile;
  return validateSourceConfig(parsed);
}

export function validateSourceConfig(config: SourceConfigFile): SourceConfigFile {
  if (!config || config.schemaVersion !== 1 || !Array.isArray(config.sources)) {
    throw new Error("blocklists/sources.json must contain schemaVersion 1 and a sources array.");
  }

  const ids = new Set<string>();
  const sources = config.sources.map((source) => {
    assertNonEmpty(source.id, "source.id");
    assertNonEmpty(source.name, `${source.id}.name`);
    assertNonEmpty(source.license, `${source.id}.license`);

    if (!/^[a-z0-9][a-z0-9_.-]*$/.test(source.id)) {
      throw new Error(`${source.id} must be a stable lowercase source id.`);
    }
    if (ids.has(source.id)) {
      throw new Error(`Duplicate blocklist source id: ${source.id}`);
    }
    ids.add(source.id);

    if (!SOURCE_FORMATS.has(source.format)) {
      throw new Error(`${source.id} has unsupported format: ${source.format}`);
    }
    if (!SOURCE_CATEGORIES.has(source.category)) {
      throw new Error(`${source.id} has unsupported category: ${source.category}`);
    }
    if (!TRUST_LEVELS.has(source.trustLevel)) {
      throw new Error(`${source.id} has unsupported trustLevel: ${source.trustLevel}`);
    }
    if (typeof source.enabled !== "boolean") {
      throw new Error(`${source.id}.enabled must be boolean.`);
    }
    if (!Number.isFinite(source.priority) || source.priority < 0 || source.priority > 100) {
      throw new Error(`${source.id}.priority must be between 0 and 100.`);
    }
    if (!Number.isFinite(source.updateIntervalHours) || source.updateIntervalHours <= 0) {
      throw new Error(`${source.id}.updateIntervalHours must be positive.`);
    }
    if (source.url && !source.url.startsWith("https://")) {
      throw new Error(`${source.id}.url must use HTTPS.`);
    }
    if (!source.url && !source.dynamicUrl) {
      throw new Error(`${source.id} must define url or dynamicUrl.`);
    }
    if (source.dynamicUrl) {
      if (source.dynamicUrl.type !== "json_meta_name") {
        throw new Error(`${source.id}.dynamicUrl.type is unsupported.`);
      }
      assertNonEmpty(source.dynamicUrl.key, `${source.id}.dynamicUrl.key`);
      assertNonEmpty(source.dynamicUrl.baseUrl, `${source.id}.dynamicUrl.baseUrl`);
      if (!source.dynamicUrl.baseUrl.startsWith("https://")) {
        throw new Error(`${source.id}.dynamicUrl.baseUrl must use HTTPS.`);
      }
    }

    return { ...source };
  });

  sources.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));

  return {
    schemaVersion: 1,
    safety: {
      ...DEFAULT_SAFETY,
      ...(config.safety ?? {}),
    },
    sources,
  };
}

export function normalizeDomainCandidate(input: string): string | null {
  let candidate = input.replace(/^\uFEFF/, "").trim().toLowerCase();
  if (!candidate) {
    return null;
  }

  candidate = candidate.replace(/^@@/, "");
  candidate = candidate.replace(/^\|\|/, "");
  candidate = candidate.replace(/^\|/, "");
  candidate = candidate.replace(/^\*\./, "");
  candidate = candidate.replace(/\^.*$/, "");
  candidate = candidate.replace(/\$.*$/, "");
  candidate = candidate.trim();

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
    try {
      candidate = new URL(candidate).hostname;
    } catch {
      return null;
    }
  } else {
    candidate = candidate.split(/[/?#]/, 1)[0] ?? "";
  }

  candidate = candidate.replace(/:\d+$/, "");
  candidate = candidate.replace(/\.$/, "");
  candidate = candidate.replace(/^\*\./, "");
  candidate = candidate.trim();

  if (
    !candidate ||
    candidate.includes("*") ||
    candidate.includes("@") ||
    candidate.includes("_")
  ) {
    return null;
  }

  const asciiDomain = domainToASCII(candidate);
  if (!isValidPublicDomain(asciiDomain)) {
    return null;
  }

  return asciiDomain;
}

export function parseDomainLine(line: string, format: SourceFormat = "hosts"): string | null {
  let candidate = line.replace(/^\uFEFF/, "").trim();
  if (
    !candidate ||
    candidate.startsWith("#") ||
    candidate.startsWith("!") ||
    candidate.startsWith("[")
  ) {
    return null;
  }

  if (candidate.startsWith("@@")) {
    return null;
  }

  candidate = candidate.replace(/\s+[#!].*$/, "").trim();
  if (!candidate) {
    return null;
  }

  const dnsmasqMatch = candidate.match(/^(?:address|server|local)=\/\.?([^/]+)\//i);
  if (dnsmasqMatch?.[1]) {
    return normalizeDomainCandidate(dnsmasqMatch[1]);
  }

  if (format === "dnsmasq") {
    return null;
  }

  if (/^\/.+\/$/.test(candidate)) {
    return null;
  }

  const parts = candidate.split(/\s+/).filter(Boolean);
  if (parts.length > 1 && isHostsAddress(parts[0])) {
    candidate = parts[1] ?? "";
  } else {
    candidate = parts[0] ?? "";
  }

  return normalizeDomainCandidate(candidate);
}

export function parseDomainSource(
  source: ParsedDomainSource,
): { entries: DomainEntry[]; invalid: number; rawLineCount: number } {
  const entries: DomainEntry[] = [];
  let invalid = 0;
  const format = source.format ?? "hosts";
  const lines = format === "json_policy"
    ? extractJsonPolicyDomainCandidates(source.lines.join("\n"))
    : source.lines;

  for (const line of lines) {
    const trimmed = line.trim();
    const parsed = parseDomainLine(line, format);

    if (parsed) {
      entries.push({
        domain: parsed,
        sourceId: source.id,
        sourceName: source.name,
      });
      continue;
    }

    if (
      trimmed &&
      !trimmed.startsWith("#") &&
      !trimmed.startsWith("!") &&
      !trimmed.startsWith("[") &&
      !trimmed.startsWith("@@")
    ) {
      invalid += 1;
    }
  }

  return { entries, invalid, rawLineCount: source.lines.length };
}

export function buildDomainOutputs(
  blockSources: ParsedDomainSource[],
  allowlistDomains: Set<string> = new Set(),
) {
  const attribution = new Map<string, Set<string>>();
  const sourceStats = new Map<string, SourceManifest>();

  for (const source of blockSources) {
    const normalizedSource = withDomainSourceDefaults(source);
    sourceStats.set(normalizedSource.id, {
      id: normalizedSource.id,
      name: normalizedSource.name,
      category: normalizedSource.category,
      bucket: sourceBucket(normalizedSource),
      format: normalizeSourceFormat(normalizedSource.format),
      trustLevel: normalizedSource.trustLevel,
      priority: normalizedSource.priority,
      enabled: normalizedSource.enabled,
      url: normalizedSource.url,
      license: normalizedSource.license,
      rawLineCount: source.lines.length,
      processedLineCount: 0,
      removedDuplicates: 0,
      removedInvalid: 0,
      removedCritical: 0,
      removedAllowlisted: 0,
      usedCachedRaw: false,
    });
  }

  for (const source of blockSources) {
    const normalizedSource = withDomainSourceDefaults(source);
    const parsed = parseDomainSource(normalizedSource);
    const stats = sourceStats.get(normalizedSource.id);
    if (stats) {
      stats.removedInvalid += parsed.invalid;
      stats.processedLineCount += parsed.entries.length;
    }

    for (const entry of parsed.entries) {
      if (isCriticalDomain(entry.domain)) {
        if (stats) {
          stats.removedCritical += 1;
        }
        continue;
      }

      if (hasDomainOrParentInSet(entry.domain, allowlistDomains)) {
        if (stats) {
          stats.removedAllowlisted += 1;
        }
        continue;
      }

      const sources = attribution.get(entry.domain);
      if (sources) {
        sources.add(entry.sourceName);
        if (stats) {
          stats.removedDuplicates += 1;
        }
      } else {
        attribution.set(entry.domain, new Set([entry.sourceName]));
      }
    }
  }

  const domains = [...attribution.keys()].sort();
  const attributionJson = Object.fromEntries(
    [...attribution.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([domain, sources]) => [domain, [...sources].sort()]),
  );

  return {
    domains,
    attribution: attributionJson,
    sourceStats: [...sourceStats.values()],
  };
}

export function normalizeKeywordText(input: string) {
  const arabicNormalized = normalizeArabic(input);
  const leetNormalized = arabicNormalized
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[0]/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/[3]/g, "e")
    .replace(/[4@]/g, "a")
    .replace(/[5$]/g, "s")
    .replace(/[7]/g, "t");

  const normalized = leetNormalized
    .replace(/\bs[^a-z0-9\u0600-\u06ff]+x\b/g, "sex")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  return {
    normalized,
    compact: normalized.replace(/\s+/g, ""),
  };
}

export function buildKeywordRules(rawKeywordText: string): {
  generatedAt: string;
  policy: string;
  activeRules: KeywordRule[];
  reviewQueue: KeywordRule[];
} {
  const generatedAt = new Date().toISOString();
  const activeRules = new Map<string, KeywordRule>();

  for (const curated of CURATED_KEYWORDS) {
    const normalized = normalizeKeywordText(curated.term);
    activeRules.set(`${curated.classification}:${normalized.compact}`, {
      ...curated,
      id: keywordRuleId("curated", curated.term, curated.classification),
      pattern: curated.term,
      matchType: "NORMALIZED",
      normalized: normalized.normalized,
      compact: normalized.compact,
      source: "curated",
      reviewRequired: false,
      notes:
        curated.classification === "ALLOW_CONTEXT"
          ? "Safe context exception to reduce false positives."
          : undefined,
    });
  }

  const reviewQueue = new Map<string, KeywordRule>();
  for (const token of extractWordCandidates(rawKeywordText)) {
    const normalized = normalizeKeywordText(token);
    if (normalized.compact.length < 3) {
      continue;
    }
    if (
      !REVIEW_CANDIDATE_HINTS.some((hint) =>
        normalized.compact.includes(hint),
      )
    ) {
      continue;
    }

    const key = `WARNING:${normalized.compact}`;
    if (activeRules.has(key) || reviewQueue.has(key)) {
      continue;
    }

    reviewQueue.set(key, {
      id: keywordRuleId("candidate", token, "WARNING"),
      term: token,
      pattern: token,
      normalized: normalized.normalized,
      compact: normalized.compact,
      matchType: "NORMALIZED",
      classification: "WARNING",
      category: "UNKNOWN",
      severity: "LOW",
      locale: detectLanguage(token),
      language: detectLanguage(token),
      enabled: false,
      source: "NSFW-Words-List candidate",
      contexts: [...ACTIVE_CONTEXTS],
      reviewRequired: true,
      notes: "External raw keyword candidate; disabled until reviewed.",
    });
  }

  return {
    generatedAt,
    policy:
      "Raw word lists are treated as review candidates. Only curated rules are enabled by default; private chats must not be scanned.",
    activeRules: [...activeRules.values()].sort(keywordSort),
    reviewQueue: [...reviewQueue.values()].sort(keywordSort),
  };
}

export function buildDnsRewriteRules() {
  return DNS_REWRITE_RULES.map((rule) => ({ ...rule }));
}

export function buildDangerousAppRules() {
  return {
    generatedAt: new Date().toISOString(),
    policy:
      "Dangerous app policy is bundled at build time. Strict Mode blocks high-risk bypass and discovery apps unless guardian allowlists them.",
    rules: [...DANGEROUS_APP_RULES].sort((a, b) => a.id.localeCompare(b.id)),
  };
}

async function main() {
  const rootDir = process.cwd();
  const blocklistsDir = join(rootDir, "blocklists");
  const rawDir = join(blocklistsDir, "raw");
  const processedDir = join(blocklistsDir, "processed");
  const rollbackDir = join(blocklistsDir, "rollback");
  const localDir = join(blocklistsDir, "local");
  const config = loadSourceConfig(rootDir);

  ensureDir(rawDir);
  ensureDir(processedDir);
  ensureDir(rollbackDir);
  ensureDir(localDir);

  const downloaded = await downloadAllSources(rawDir, config);
  const blockDownloads = downloaded.filter(
    (source) => source.bucket === "adult-domains" && source.text,
  );
  const bypassDownloads = downloaded.filter(
    (source) => source.bucket === "bypass-domains" && source.text,
  );
  const keywordDownloads = downloaded.filter(
    (source) => source.bucket === "keywords" && source.text,
  );

  const localBlockText = readOptionalFile(join(localDir, "block_domains.txt"));
  const localBypassText = readOptionalFile(join(localDir, "bypass_domains.txt"));
  const localAllowText = readOptionalFile(join(localDir, "allow_domains.txt"));

  const blockSources = blockDownloads.map(downloadToParsedDomainSource);
  const bypassSources = bypassDownloads.map(downloadToParsedDomainSource);
  const allowSources: ParsedDomainSource[] = [];

  if (localBlockText) {
    blockSources.push(localParsedSource("local_block_domains", "Local block domains", "adult", localBlockText, join(localDir, "block_domains.txt")));
  }
  if (localBypassText) {
    bypassSources.push(localParsedSource("local_bypass_domains", "Local bypass domains", "bypass", localBypassText, join(localDir, "bypass_domains.txt")));
  }
  if (localAllowText) {
    allowSources.push(localParsedSource("local_allow_domains", "Guardian allowlist", "allowlist", localAllowText, join(localDir, "allow_domains.txt")));
  }

  if (blockSources.length === 0) {
    throw new Error("No domain sources were available and no cached raw files exist.");
  }

  const previousAdultDomainCount = countExistingLines(join(processedDir, "adult_domains.txt"));
  const previousSnapshot = snapshotProcessed(processedDir, rollbackDir);
  try {
    const allowOutputs = allowSources.length > 0
      ? buildDomainOutputs(allowSources)
      : { domains: [], attribution: {}, sourceStats: [] as SourceManifest[] };
    const allowlistDomains = new Set(allowOutputs.domains);
    const domainOutputs = buildDomainOutputs(blockSources, allowlistDomains);
    validateDomainOutputSafety(
      domainOutputs.domains,
      previousAdultDomainCount,
      config.safety as SafetyConfig,
    );

    const keywordRules = buildKeywordRules(
      keywordDownloads.map((source) => source.text ?? "").join("\n"),
    );
    const bypassOutputs =
      bypassSources.length > 0
        ? buildDomainOutputs(bypassSources, allowlistDomains)
        : {
            domains: [],
            attribution: {},
            sourceStats: [] as SourceManifest[],
          };
    const dnsRewriteRules = buildDnsRewriteRules();
    const dangerousAppRules = buildDangerousAppRules();
    const manifests = mergeDownloadStats(
      downloaded,
      [...domainOutputs.sourceStats, ...bypassOutputs.sourceStats, ...allowOutputs.sourceStats],
      keywordRules.activeRules.length + keywordRules.reviewQueue.length,
    );
    const manifest = {
      generatedAt: new Date().toISOString(),
      schemaVersion: config.schemaVersion,
      sources: manifests,
      totals: {
        adultDomains: domainOutputs.domains.length,
        bypassDomains: bypassOutputs.domains.length,
        allowlistedDomains: allowOutputs.domains.length,
        dnsRewriteRules: dnsRewriteRules.length,
        dangerousAppRules: dangerousAppRules.rules.length,
        sourceAttributionDomains: Object.keys(domainOutputs.attribution).length,
        activeKeywordRules: keywordRules.activeRules.length,
        keywordReviewCandidates: keywordRules.reviewQueue.length,
      },
      safety: {
        ...config.safety,
        safeDomainCanariesProtected: [...SAFE_DOMAIN_CANARIES].sort(),
        criticalDomainsProtected: [...CRITICAL_DOMAINS].sort(),
        privateMessagesPolicy:
          "Keyword output is intended only for public/search/browser contexts, never private chat text.",
      },
      rollback: {
        previousSnapshot,
      },
    };

    writeTextAtomic(
      join(processedDir, "adult_domains.txt"),
      `${domainOutputs.domains.join("\n")}\n`,
    );
    writeTextAtomic(
      join(processedDir, "allow_domains.txt"),
      `${allowOutputs.domains.join("\n")}\n`,
    );
    writeTextAtomic(
      join(processedDir, "bypass_domains.txt"),
      `${bypassOutputs.domains.join("\n")}\n`,
    );
    writeJsonAtomic(
      join(processedDir, "source_attribution.json"),
      domainOutputs.attribution,
    );
    writeJsonAtomic(
      join(processedDir, "bypass_source_attribution.json"),
      bypassOutputs.attribution,
    );
    writeJsonAtomic(
      join(processedDir, "dns_rewrite_rules.json"),
      dnsRewriteRules,
    );
    writeJsonAtomic(
      join(processedDir, "blocked_keywords.json"),
      keywordRules,
    );
    writeJsonAtomic(
      join(processedDir, "dangerous_app_rules.json"),
      dangerousAppRules,
    );
    writeJsonAtomic(
      join(processedDir, "blocklist_manifest.json"),
      manifest,
    );

    console.log(
      `Processed ${domainOutputs.domains.length} blocked domains, ${bypassOutputs.domains.length} bypass domains, ${allowOutputs.domains.length} allowlisted domains, ${dnsRewriteRules.length} DNS rewrite rules, ${dangerousAppRules.rules.length} dangerous app rules, and ${keywordRules.activeRules.length} active keyword rules.`,
    );
  } catch (error) {
    if (previousSnapshot) {
      restoreSnapshot(previousSnapshot, processedDir);
    }
    throw error;
  }
}

async function downloadAllSources(rawDir: string, config: SourceConfigFile) {
  const downloaded: DownloadedSource[] = [];

  for (const source of config.sources.filter((item) => item.enabled)) {
    downloaded.push(await downloadSource(source, rawDir));
  }

  return downloaded;
}

async function downloadSource(
  source: SourceConfig,
  rawDir: string,
): Promise<DownloadedSource> {
  const rawPath = join(rawDir, `${source.id}.txt`);
  const bucket = sourceBucket(source);

  try {
    const resolvedUrl = await resolveSourceUrl(source, rawDir);
    const text = await fetchText(resolvedUrl);
    writeFileSync(rawPath, text, "utf8");

    return {
      ...source,
      bucket,
      resolvedUrl,
      text,
      checksum: sha256(text),
      rawLineCount: countLines(text),
      downloadedAt: new Date().toISOString(),
      usedCachedRaw: false,
    };
  } catch (error) {
    if (existsSync(rawPath)) {
      const text = readFileSync(rawPath, "utf8");
      return {
        ...source,
        bucket,
        resolvedUrl: source.url ?? "cached-dynamic-url",
        text,
        checksum: sha256(text),
        rawLineCount: countLines(text),
        usedCachedRaw: true,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    return {
      ...source,
      bucket,
      resolvedUrl: source.url ?? "unresolved-dynamic-url",
      checksum: undefined,
      rawLineCount: 0,
      usedCachedRaw: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function resolveSourceUrl(source: SourceConfig, rawDir: string) {
  if (!source.dynamicUrl) {
    return requiredUrl(source);
  }

  const metaUrl = requiredUrl(source);
  const metaPath = join(rawDir, `${source.id}_meta.json`);
  let metaText: string;

  try {
    metaText = await fetchText(metaUrl);
    writeFileSync(metaPath, metaText, "utf8");
  } catch (error) {
    if (!existsSync(metaPath)) {
      throw error;
    }
    metaText = readFileSync(metaPath, "utf8");
  }

  const meta = JSON.parse(metaText) as Record<string, { name?: string }>;
  const fileName = meta[source.dynamicUrl.key]?.name;
  if (!fileName || fileName.includes("/") || fileName.includes("\\")) {
    throw new Error(`${source.id} metadata did not contain ${source.dynamicUrl.key}.name`);
  }

  return new URL(fileName, source.dynamicUrl.baseUrl).toString();
}

async function fetchText(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "guardian-blocker-blocklist-updater/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function downloadToParsedDomainSource(
  source: DownloadedSource,
): ParsedDomainSource {
  return {
    id: source.id,
    name: source.name,
    category: source.category,
    format: normalizeSourceFormat(source.format),
    priority: source.priority,
    trustLevel: source.trustLevel,
    enabled: source.enabled,
    license: source.license,
    url: source.resolvedUrl,
    lines: (source.text ?? "").split(/\r?\n/),
  };
}

function localParsedSource(
  id: string,
  name: string,
  category: SourceCategory,
  text: string,
  url: string,
): ParsedDomainSource {
  return {
    id,
    name,
    category,
    format: "domain_list",
    priority: 100,
    trustLevel: "local_override",
    enabled: true,
    license: "project-local",
    url,
    lines: text.split(/\r?\n/),
  };
}

function mergeDownloadStats(
  downloads: DownloadedSource[],
  domainStats: SourceManifest[],
  keywordRuleCount: number,
) {
  const statsById = new Map(domainStats.map((stats) => [stats.id, stats]));
  const downloadedIds = new Set(downloads.map((download) => download.id));

  const remoteStats = downloads.map((download) => {
    const domainStat = statsById.get(download.id);
    if (domainStat) {
      return {
        ...domainStat,
        downloadedAt: download.downloadedAt,
        checksum: download.checksum,
        rawLineCount: download.rawLineCount,
        usedCachedRaw: download.usedCachedRaw,
        error: download.error,
      };
    }

    return {
      id: download.id,
      name: download.name,
      category: download.category,
      bucket: download.bucket,
      format: normalizeSourceFormat(download.format),
      trustLevel: download.trustLevel,
      priority: download.priority,
      enabled: download.enabled,
      url: download.resolvedUrl,
      license: download.license,
      downloadedAt: download.downloadedAt,
      checksum: download.checksum,
      rawLineCount: download.rawLineCount,
      processedLineCount:
        download.bucket === "keywords" ? keywordRuleCount : 0,
      removedDuplicates: 0,
      removedInvalid: 0,
      removedCritical: 0,
      removedAllowlisted: 0,
      usedCachedRaw: download.usedCachedRaw,
      error: download.error,
    };
  });

  const localStats = domainStats.filter((stats) => !downloadedIds.has(stats.id));
  return [...remoteStats, ...localStats];
}

function sourceBucket(source: Pick<SourceConfig, "category" | "format">): SourceBucket {
  if (source.category === "keywords" || source.format === "words") {
    return "keywords";
  }
  if (source.category === "allowlist") {
    return "allowlist";
  }
  if (["bypass", "proxy", "vpn", "tor"].includes(source.category)) {
    return "bypass-domains";
  }
  if (["adult", "nsfw", "social", "short_video", "gambling", "malware", "unknown"].includes(source.category)) {
    return "adult-domains";
  }
  return "ignored";
}

function withDomainSourceDefaults(source: ParsedDomainSource): Required<ParsedDomainSource> {
  return {
    ...source,
    category: source.category ?? "adult",
    format: source.format ?? "hosts",
    priority: source.priority ?? 0,
    trustLevel: source.trustLevel ?? "review",
    enabled: source.enabled ?? true,
  };
}

function normalizeSourceFormat(format: SourceFormat): BlocklistFormat {
  return format === "domains" ? "domain_list" : format;
}

function extractJsonPolicyDomainCandidates(text: string): string[] {
  const parsed = JSON.parse(text) as unknown;
  const values: string[] = [];
  collectJsonPolicyStrings(parsed, values);
  return values;
}

function collectJsonPolicyStrings(value: unknown, values: string[]) {
  if (typeof value === "string") {
    values.push(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectJsonPolicyStrings(item, values));
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }

  const objectValue = value as Record<string, unknown>;
  for (const key of ["domain", "hostname", "host", "pattern", "url", "value"]) {
    if (typeof objectValue[key] === "string") {
      values.push(objectValue[key] as string);
    }
  }
  for (const key of ["domains", "blockedDomains", "allowDomains", "bypassDomains", "rules", "entries"]) {
    if (objectValue[key]) {
      collectJsonPolicyStrings(objectValue[key], values);
    }
  }
}

function validateDomainOutputSafety(
  domains: string[],
  previousAdultDomainCount: number,
  safety: SafetyConfig,
) {
  if (domains.length < safety.minimumAdultDomains) {
    throw new Error(
      `Processed domain list has ${domains.length} entries, below minimum ${safety.minimumAdultDomains}.`,
    );
  }

  if (
    previousAdultDomainCount > 0 &&
    domains.length > previousAdultDomainCount * safety.maxGrowthRatio
  ) {
    throw new Error(
      `Processed domain list grew from ${previousAdultDomainCount} to ${domains.length}; refusing unsafe growth.`,
    );
  }

  if (
    previousAdultDomainCount > 0 &&
    domains.length < previousAdultDomainCount * safety.maxShrinkRatio
  ) {
    throw new Error(
      `Processed domain list shrank from ${previousAdultDomainCount} to ${domains.length}; refusing unsafe shrink.`,
    );
  }

  const domainSet = new Set(domains);
  const blockedCanaries = [...SAFE_DOMAIN_CANARIES].filter((domain) =>
    hasDomainOrParentInSet(domain, domainSet),
  );
  if (blockedCanaries.length > 0) {
    throw new Error(`Safe domain canaries leaked into blocklist: ${blockedCanaries.join(", ")}`);
  }

  const leakedCritical = domains.filter(isCriticalDomain);
  if (leakedCritical.length > 0) {
    throw new Error(
      `Critical domains leaked into blocklist: ${leakedCritical.join(", ")}`,
    );
  }
}

function extractWordCandidates(rawKeywordText: string) {
  return rawKeywordText
    .split(/[\r\n,;]+|\s{2,}/)
    .flatMap((segment) => segment.split(/\s+(?=[\w\u0600-\u06ff]{3,}\s)/))
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 5000);
}

function normalizeArabic(input: string) {
  return input
    .replace(/[\u064b-\u065f\u0670]/g, "")
    .replace(/\u0640/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه");
}

function detectLanguage(input: string): "ar" | "en" | "mixed" {
  const hasArabic = /[\u0600-\u06ff]/.test(input);
  const hasLatin = /[a-z]/i.test(input);
  if (hasArabic && hasLatin) {
    return "mixed";
  }
  return hasArabic ? "ar" : "en";
}

function keywordRuleId(source: string, term: string, classification: string) {
  const normalized = normalizeKeywordText(term).compact || term;
  return `${source}.${classification.toLowerCase()}.${slug(normalized)}`;
}

function keywordSort(a: KeywordRule, b: KeywordRule) {
  return (
    a.classification.localeCompare(b.classification) ||
    a.normalized.localeCompare(b.normalized)
  );
}

function isHostsAddress(value: string) {
  return value === "0.0.0.0" || value === "127.0.0.1" || isIP(value) !== 0;
}

function isValidPublicDomain(domain: string) {
  if (!domain || domain.length > 253) {
    return false;
  }
  if (isIP(domain) !== 0) {
    return false;
  }
  if (!domain.includes(".")) {
    return false;
  }
  if (LOCAL_TLDS.some((suffix) => domain === suffix.slice(1) || domain.endsWith(suffix))) {
    return false;
  }

  const labels = domain.split(".");
  return labels.every((label) => {
    return (
      label.length > 0 &&
      label.length <= 63 &&
      /^[a-z0-9-]+$/.test(label) &&
      !label.startsWith("-") &&
      !label.endsWith("-")
    );
  });
}

function isCriticalDomain(domain: string) {
  return hasDomainOrParentInSet(domain, CRITICAL_DOMAINS);
}

function hasDomainOrParentInSet(domain: string, set: Set<string>) {
  let current = domain;
  while (current) {
    if (set.has(current)) {
      return true;
    }
    const dotIndex = current.indexOf(".");
    if (dotIndex === -1) {
      return false;
    }
    current = current.slice(dotIndex + 1);
  }
  return false;
}

function snapshotProcessed(processedDir: string, rollbackDir: string) {
  if (!existsSync(processedDir)) {
    return null;
  }

  const files = readdirSync(processedDir).filter((file) =>
    statSync(join(processedDir, file)).isFile(),
  );
  if (files.length === 0) {
    return null;
  }

  const snapshotDir = join(
    rollbackDir,
    new Date().toISOString().replace(/[:.]/g, "-"),
  );
  ensureDir(snapshotDir);
  for (const file of files) {
    copyFileSync(join(processedDir, file), join(snapshotDir, file));
  }
  return snapshotDir;
}

function restoreSnapshot(snapshotDir: string, processedDir: string) {
  for (const file of readdirSync(snapshotDir)) {
    copyFileSync(join(snapshotDir, file), join(processedDir, file));
  }
}

function writeTextAtomic(path: string, text: string) {
  const temporaryPath = `${path}.tmp`;
  writeFileSync(temporaryPath, text, "utf8");
  rmSync(path, { force: true });
  renameSync(temporaryPath, path);
}

function writeJsonAtomic(path: string, value: unknown) {
  writeTextAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
}

function readOptionalFile(path: string) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function countExistingLines(path: string) {
  if (!existsSync(path)) {
    return 0;
  }
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean).length;
}

function ensureDir(path: string) {
  mkdirSync(path, { recursive: true });
}

function sha256(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

function countLines(text: string) {
  if (!text) {
    return 0;
  }
  return text.split(/\r?\n/).length;
}

function requiredUrl(source: SourceConfig) {
  if (!source.url) {
    throw new Error(`${source.id} has no static URL`);
  }
  return source.url;
}

function assertNonEmpty(value: unknown, name: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${name} must be a non-empty string.`);
  }
}

function slug(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

if (basename(process.argv[1] ?? "") === "update_blocklists.ts") {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
