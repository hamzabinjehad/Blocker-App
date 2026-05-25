export type BlocklistFormat =
  | 'adguard'
  | 'hosts'
  | 'domain_list'
  | 'pihole'
  | 'dnsmasq'
  | 'json_policy'
  | 'words';

export type BlocklistCategory =
  | 'adult'
  | 'nsfw'
  | 'social'
  | 'short_video'
  | 'gambling'
  | 'proxy'
  | 'vpn'
  | 'tor'
  | 'bypass'
  | 'malware'
  | 'keywords'
  | 'allowlist'
  | 'unknown';

export type TrustLevel = 'high' | 'medium' | 'low' | 'review' | 'local_override';

export type RemoteBlocklistSource = {
  id: string;
  name: string;
  category: BlocklistCategory;
  url?: string;
  format: BlocklistFormat;
  enabled: boolean;
  priority: number;
  trustLevel: TrustLevel;
  updateIntervalHours: number;
  lastUpdated?: string | null;
  checksum?: string | null;
  signature?: string | null;
  license: string;
  dynamicUrl?: {
    type: 'json_meta_name';
    key: string;
    baseUrl: string;
  };
};

export type KeywordRule = {
  id: string;
  locale: 'ar' | 'en' | 'mixed';
  pattern: string;
  normalized: string;
  compact: string;
  matchType: 'EXACT' | 'CONTAINS' | 'REGEX' | 'NORMALIZED';
  category: 'ADULT' | 'SOFTCORE' | 'BYPASS' | 'PLATFORM' | 'SHORT_FORM' | 'UNKNOWN';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  enabled: boolean;
  source: string;
  notes?: string;
};

export type DangerousAppRule = {
  id: string;
  packageName: string;
  appName: string;
  category:
    | 'short_video'
    | 'social_media'
    | 'browser'
    | 'private_browser'
    | 'vpn'
    | 'proxy'
    | 'tor'
    | 'apk_store'
    | 'app_cloner'
    | 'hidden_vault'
    | 'random_chat'
    | 'dating'
    | 'livestream'
    | 'unsafe_ai'
    | 'file_sharing'
    | 'unknown_risk';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  defaultAction: 'BLOCK' | 'ALLOW' | 'ASK_GUARDIAN';
  strictModeAction: 'BLOCK' | 'ALLOW' | 'ASK_GUARDIAN';
  reason: string;
  source: string;
  enabled: boolean;
};

export type BlockedDomain = {
  domain: string;
  category: BlocklistCategory;
  severity: 'low' | 'medium' | 'high' | 'critical';
  sourceIds: string[];
};

export type BlockedUrlPattern = {
  id: string;
  pattern: string;
  matchType: 'EXACT' | 'CONTAINS' | 'REGEX' | 'NORMALIZED';
  category: BlocklistCategory;
  severity: 'low' | 'medium' | 'high' | 'critical';
  sourceId: string;
  enabled: boolean;
};

export type BlockedKeyword = KeywordRule;

export type BlockedPackage = DangerousAppRule;

export type AllowlistedDomain = {
  domain: string;
  reason?: string;
  source: 'guardian' | 'local' | 'policy';
};

export type AllowlistedPackage = {
  packageName: string;
  appName?: string;
  reason?: string;
  source: 'guardian' | 'local' | 'policy';
};

export type BlocklistSource = RemoteBlocklistSource;

export type BlocklistVersion = {
  generatedAt: string;
  sources: Array<{
    id: string;
    name: string;
    category: BlocklistCategory;
    format: BlocklistFormat;
    trustLevel: TrustLevel;
    priority: number;
    enabled: boolean;
    url?: string;
    license: string;
    checksum?: string;
    rawLineCount: number;
    processedLineCount: number;
    removedDuplicates: number;
    removedInvalid: number;
    removedCritical: number;
    usedCachedRaw: boolean;
    error?: string;
  }>;
};
