/**
 * Branded Types for Dragon-UI
 * Type-safe branded primitives for domain modeling
 *
 * @module types/branded
 */

/**
 * Brand symbol for nominal typing
 */
declare const __brand: unique symbol;

/**
 * Generic branded type helper
 * Creates a nominal type from a primitive
 */
export type Brand<T, B extends string> = T & { readonly [__brand]: B };

/**
 * Flavor symbol for soft branding
 */
declare const __flavor: unique symbol;

/**
 * Generic flavored type helper
 * Creates a soft-branded type (compatible with underlying type)
 */
export type Flavor<T, F extends string> = T & { readonly [__flavor]?: F };

// ============================================
// Session Types
// ============================================

/**
 * Unique session identifier
 * Format: UUID v4 or custom session ID string
 */
export type SessionId = Brand<string, 'SessionId'>;

/**
 * Create a SessionId from a string
 */
export function createSessionId(id: string): SessionId;

/**
 * Validate if a string is a valid SessionId format
 */
export function isValidSessionId(id: unknown): id is SessionId;

/**
 * Session status
 */
export type SessionStatus = Brand<'active' | 'completed' | 'error', 'SessionStatus'>;

// ============================================
// Token Types
// ============================================

/**
 * Token count - always non-negative integer
 */
export type TokenCount = Brand<number, 'TokenCount'>;

/**
 * Create a TokenCount from a number
 * @throws if value is negative or not an integer
 */
export function createTokenCount(count: number): TokenCount;

/**
 * Input token count
 */
export type InputTokenCount = Brand<number, 'InputTokenCount'>;

/**
 * Output token count
 */
export type OutputTokenCount = Brand<number, 'OutputTokenCount'>;

/**
 * Cached token count
 */
export type CachedTokenCount = Brand<number, 'CachedTokenCount'>;

/**
 * Token price per million
 */
export type TokenPricePerMillion = Brand<number, 'TokenPricePerMillion'>;

// ============================================
// Cost Types
// ============================================

/**
 * Monetary cost in USD
 * Always a non-negative number
 */
export type USDCost = Brand<number, 'USDCost'>;

/**
 * Create a USDCost from a number
 * @throws if value is negative
 */
export function createUSDCost(amount: number): USDCost;

/**
 * Add two costs
 */
export function addCost(a: USDCost, b: USDCost): USDCost;

/**
 * Format cost for display
 */
export function formatCost(cost: USDCost, options?: CostFormatOptions): string;

/**
 * Cost format options
 */
export interface CostFormatOptions {
  currency?: 'USD' | 'EUR' | 'GBP';
  decimals?: number;
  showSymbol?: boolean;
}

/**
 * Daily cost aggregate
 */
export type DailyCost = Brand<number, 'DailyCost'>;

/**
 * Monthly cost aggregate
 */
export type MonthlyCost = Brand<number, 'MonthlyCost'>;

// ============================================
// Model Types
// ============================================

/**
 * Model identifier
 * e.g., "claude-3-opus-20240229", "claude-3-sonnet-20240229"
 */
export type ModelId = Brand<string, 'ModelId'>;

/**
 * Create a ModelId from a string
 */
export function createModelId(id: string): ModelId;

/**
 * Validate if a string is a valid Claude model ID
 */
export function isValidModelId(id: unknown): id is ModelId;

/**
 * Model family
 */
export type ModelFamily = Brand<'claude-3' | 'claude-2' | 'claude-instant' | 'gpt-4' | 'gpt-5', 'ModelFamily'>;

/**
 * Model variant
 */
export type ModelVariant = Brand<'opus' | 'sonnet' | 'haiku' | 'turbo' | 'mini', 'ModelVariant'>;

/**
 * Parsed model name
 */
export interface ParsedModelName {
  family: ModelFamily;
  variant: ModelVariant;
  version?: string;
  raw: ModelId;
}

/**
 * Parse a model ID into components
 */
export function parseModelId(id: ModelId): ParsedModelName;

// ============================================
// Time Types
// ============================================

/**
 * Unix timestamp in milliseconds
 */
export type UnixTimestampMs = Brand<number, 'UnixTimestampMs'>;

/**
 * Unix timestamp in seconds
 */
export type UnixTimestampSec = Brand<number, 'UnixTimestampSec'>;

/**
 * Duration in milliseconds
 */
export type DurationMs = Brand<number, 'DurationMs'>;

/**
 * Duration in seconds
 */
export type DurationSec = Brand<number, 'DurationSec'>;

/**
 * Create a timestamp from Date
 */
export function createTimestamp(date: Date): UnixTimestampMs;

/**
 * Create duration from milliseconds
 */
export function createDuration(ms: number): DurationMs;

/**
 * Format duration for display
 */
export function formatDuration(duration: DurationMs, options?: DurationFormatOptions): string;

/**
 * Duration format options
 */
export interface DurationFormatOptions {
  compact?: boolean;
  maxUnits?: number;
  showMs?: boolean;
}

// ============================================
// API Key Types
// ============================================

/**
 * API key (full value - sensitive)
 */
export type ApiKey = Brand<string, 'ApiKey'>;

/**
 * API key hash (safe to store)
 */
export type ApiKeyHash = Brand<string, 'ApiKeyHash'>;

/**
 * API key preview (first/last chars)
 */
export type ApiKeyPreview = Brand<string, 'ApiKeyPreview'>;

/**
 * Create an API key preview
 */
export function createApiKeyPreview(key: ApiKey): ApiKeyPreview;

// ============================================
// Account Types
// ============================================

/**
 * Account identifier
 */
export type AccountId = Brand<string, 'AccountId'>;

/**
 * Account priority (0-100)
 */
export type AccountPriority = Brand<number, 'AccountPriority'>;

/**
 * Create account priority
 * @throws if value is not between 0 and 100
 */
export function createAccountPriority(priority: number): AccountPriority;

// ============================================
// Context Types
// ============================================

/**
 * Context window size
 */
export type ContextWindow = Brand<number, 'ContextWindow'>;

/**
 * Context usage percentage (0-100)
 */
export type ContextPercent = Brand<number, 'ContextPercent'>;

/**
 * Create context percentage
 */
export function createContextPercent(percent: number): ContextPercent;

// ============================================
// Path Types
// ============================================

/**
 * File system path
 */
export type FilePath = Brand<string, 'FilePath'>;

/**
 * Directory path
 */
export type DirectoryPath = Brand<string, 'DirectoryPath'>;

/**
 * URL string
 */
export type UrlString = Brand<string, 'UrlString'>;

// ============================================
// Git Types
// ============================================

/**
 * Git branch name
 */
export type GitBranch = Brand<string, 'GitBranch'>;

/**
 * Git commit hash
 */
export type GitCommitHash = Brand<string, 'GitCommitHash'>;

/**
 * Create a short commit hash (7 chars)
 */
export function createShortHash(hash: GitCommitHash): string;

// ============================================
// Utility Types
// ============================================

/**
 * Extract the base type from a branded type
 */
export type Unbrand<T> = T extends Brand<infer U, any> ? U : T;

/**
 * Extract the brand name from a branded type
 */
export type BrandOf<T> = T extends Brand<any, infer B> ? B : never;

/**
 * Make all properties of T branded with B
 */
export type BrandedProperties<T, B extends string> = {
  [K in keyof T]: Brand<T[K], B>;
};

/**
 * Validate and brand a value at runtime
 */
export function brand<T, B extends string>(
  value: T,
  validator: (v: T) => boolean,
  brandName: B
): Brand<T, B>;

/**
 * Safely unbrand a value
 */
export function unbrand<T>(value: Brand<T, any>): T;

// ============================================
// Type Guards
// ============================================

/**
 * Type guard for SessionId
 */
export function isSessionId(value: unknown): value is SessionId;

/**
 * Type guard for TokenCount
 */
export function isTokenCount(value: unknown): value is TokenCount;

/**
 * Type guard for USDCost
 */
export function isUSDCost(value: unknown): value is USDCost;

/**
 * Type guard for ModelId
 */
export function isModelId(value: unknown): value is ModelId;

// ============================================
// Constants
// ============================================

/**
 * Known Claude models
 */
export const CLAUDE_MODELS: readonly ModelId[];

/**
 * Model context windows
 */
export const MODEL_CONTEXT_WINDOWS: Readonly<Record<ModelId, ContextWindow>>;

/**
 * Default model prices
 */
export const MODEL_PRICES: Readonly<Record<ModelId, {
  input: TokenPricePerMillion;
  output: TokenPricePerMillion;
  cached: TokenPricePerMillion;
}>>;
