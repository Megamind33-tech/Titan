/**
 * GitHub Connector Types
 *
 * Defines the contract for connecting to GitHub repositories,
 * fetching supported project data, and importing SWIM26 projects.
 *
 * Scope: Public repo read-only access. Private repo access is future work.
 */

/**
 * Repository identification
 */
export interface GitHubRepoIdentifier {
  owner: string;
  repo: string;
  branch?: string;
  subpath?: string; // optional subdirectory path
}

/**
 * Parsed GitHub URL or repo reference
 */
export interface GitHubRepoReference {
  /** Full HTTPS URL, e.g., https://github.com/owner/repo */
  url: string;
  owner: string;
  repo: string;
  branch?: string;
  subpath?: string;
}

/**
 * Repository metadata from GitHub
 */
export interface GitHubRepoMetadata {
  owner: string;
  repo: string;
  url: string;
  isPrivate: boolean;
  defaultBranch: string;
  description?: string;
  topics?: string[];
  language?: string;
  stars?: number;
  lastUpdated?: string;
}

/**
 * File listing response from GitHub
 */
export interface GitHubFileInfo {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
  sha?: string;
  downloadUrl?: string;
}

/**
 * File content response
 */
export interface GitHubFileContent {
  path: string;
  name: string;
  content: string;
  encoding: 'utf-8' | 'base64';
  size: number;
  sha?: string;
}

/**
 * Connector access mode (defines what auth is available)
 */
export type GitHubAccessMode = 'public-only' | 'authenticated' | 'oauth';

/**
 * Supported file extensions for inspection
 */
export const SUPPORTED_MANIFEST_FILES = [
  'swim26.manifest.json',
  'babylon.config.json',
  'swim26.config.json',
  'package.json',
  'README.md',
];

/**
 * Blocked file patterns that must not be imported
 */
export const BLOCKED_FILE_PATTERNS = [
  /\.ts$/, // TypeScript files
  /\.tsx$/, // TSX files
  /\.js$/, // JavaScript files
  /\.jsx$/, // JSX files
  /webpack\.config/, // Webpack config
  /vite\.config/, // Vite config
  /\.env/, // Environment files
  /secrets/, // Secret files
];

/**
 * GitHub connector configuration
 */
export interface GitHubConnectorConfig {
  accessMode: GitHubAccessMode;
  authToken?: string; // optional GitHub token for higher rate limits
  timeout?: number; // request timeout in ms (default: 10000)
  rateLimitBuffer?: number; // buffer for rate limiting awareness
}

/**
 * GitHub connector error types
 */
export enum GitHubConnectorErrorType {
  INVALID_URL = 'INVALID_URL',
  REPO_NOT_FOUND = 'REPO_NOT_FOUND',
  RATE_LIMITED = 'RATE_LIMITED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  UNSUPPORTED_FILE = 'UNSUPPORTED_FILE',
  INVALID_MANIFEST = 'INVALID_MANIFEST',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Connector error with context
 */
export class GitHubConnectorError extends Error {
  constructor(
    public type: GitHubConnectorErrorType,
    message: string,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'GitHubConnectorError';
  }
}

/**
 * Result of fetching a repository
 */
export interface GitHubRepoFetchResult {
  success: boolean;
  metadata?: GitHubRepoMetadata;
  branch?: string;
  error?: GitHubConnectorError;
}

/**
 * Result of listing repository files
 */
export interface GitHubFileListResult {
  success: boolean;
  files?: GitHubFileInfo[];
  error?: GitHubConnectorError;
}

/**
 * Result of fetching a file
 */
export interface GitHubFileFetchResult {
  success: boolean;
  content?: GitHubFileContent;
  error?: GitHubConnectorError;
}

/**
 * Repository ingestion result
 */
export interface GitHubRepoIngestResult {
  success: boolean;
  metadata?: GitHubRepoMetadata;
  branch: string;
  files: Map<string, GitHubFileContent>; // path -> content
  errors: GitHubConnectorError[];
  warnings: string[];
}
