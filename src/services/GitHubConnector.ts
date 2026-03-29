/**
 * GitHub Connector Service
 *
 * Handles low-level GitHub repository access for public repositories.
 * Fetches repository metadata, file listings, and file contents.
 *
 * Scope: Public repo read-only, no authentication required for MVP.
 * Private repos and OAuth support are future enhancements.
 */

import {
  GitHubRepoIdentifier,
  GitHubRepoReference,
  GitHubRepoMetadata,
  GitHubFileInfo,
  GitHubFileContent,
  GitHubConnectorConfig,
  GitHubConnectorError,
  GitHubConnectorErrorType,
  GitHubRepoFetchResult,
  GitHubFileListResult,
  GitHubFileFetchResult,
  GitHubRepoIngestResult,
  SUPPORTED_MANIFEST_FILES,
  BLOCKED_FILE_PATTERNS,
} from '../types/gitHubConnector';

/**
 * Parses a GitHub URL or owner/repo string into structured identifier
 */
export const parseGitHubReference = (input: string): GitHubRepoReference | null => {
  const trimmed = input.trim();

  // Try to parse as URL: https://github.com/owner/repo[/tree/branch][/subpath]
  const urlRegex = /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)(?:\/tree\/([^\/]+))?(?:\/(.+))?$/;
  const urlMatch = trimmed.match(urlRegex);
  if (urlMatch) {
    const [, owner, repo, branch, subpath] = urlMatch;
    return {
      url: `https://github.com/${owner}/${repo}`,
      owner,
      repo,
      branch: branch || undefined,
      subpath: subpath || undefined,
    };
  }

  // Try to parse as owner/repo format
  const shortRegex = /^([^\/]+)\/([^\/]+)$/;
  const shortMatch = trimmed.match(shortRegex);
  if (shortMatch) {
    const [, owner, repo] = shortMatch;
    return {
      url: `https://github.com/${owner}/${repo}`,
      owner,
      repo,
    };
  }

  return null;
};

/**
 * Validates repository reference
 */
const validateRepoReference = (ref: GitHubRepoReference): boolean => {
  if (!ref.owner || !ref.repo) return false;
  if (!/^[a-zA-Z0-9_-]+$/.test(ref.owner)) return false;
  if (!/^[a-zA-Z0-9_.-]+$/.test(ref.repo)) return false;
  return true;
};

/**
 * Checks if a file path should be blocked from import
 */
const isBlockedFile = (path: string): boolean => {
  return BLOCKED_FILE_PATTERNS.some(pattern => pattern.test(path));
};

/**
 * GitHub Connector Service
 */
export class GitHubConnector {
  private config: GitHubConnectorConfig;
  private readonly API_BASE = 'https://api.github.com';
  private readonly RAW_CONTENT_BASE = 'https://raw.githubusercontent.com';

  constructor(config: GitHubConnectorConfig) {
    this.config = {
      timeout: 10000,
      ...config,
    };
  }

  /**
   * Fetches repository metadata from GitHub
   */
  async fetchRepoMetadata(ref: GitHubRepoReference): Promise<GitHubRepoFetchResult> {
    try {
      if (!validateRepoReference(ref)) {
        return {
          success: false,
          error: new GitHubConnectorError(
            GitHubConnectorErrorType.INVALID_URL,
            'Invalid repository reference format',
            { reference: ref }
          ),
        };
      }

      const url = `${this.API_BASE}/repos/${ref.owner}/${ref.repo}`;
      const response = await this.fetchWithTimeout(url);

      if (response.status === 404) {
        return {
          success: false,
          error: new GitHubConnectorError(
            GitHubConnectorErrorType.REPO_NOT_FOUND,
            `Repository ${ref.owner}/${ref.repo} not found`,
            { owner: ref.owner, repo: ref.repo }
          ),
        };
      }

      if (response.status === 403) {
        return {
          success: false,
          error: new GitHubConnectorError(
            GitHubConnectorErrorType.RATE_LIMITED,
            'GitHub API rate limit exceeded. Try again later or use an authenticated token.',
            { retryAfter: response.headers.get('retry-after') }
          ),
        };
      }

      if (!response.ok) {
        return {
          success: false,
          error: new GitHubConnectorError(
            GitHubConnectorErrorType.UNKNOWN,
            `GitHub API error: ${response.status} ${response.statusText}`,
            { status: response.status }
          ),
        };
      }

      const data = await response.json() as any;

      const metadata: GitHubRepoMetadata = {
        owner: ref.owner,
        repo: ref.repo,
        url: `https://github.com/${ref.owner}/${ref.repo}`,
        isPrivate: data.private,
        defaultBranch: data.default_branch,
        description: data.description,
        topics: data.topics,
        language: data.language,
        stars: data.stargazers_count,
        lastUpdated: data.updated_at,
      };

      // If private and no auth, fail gracefully
      if (metadata.isPrivate && !this.config.authToken) {
        return {
          success: false,
          error: new GitHubConnectorError(
            GitHubConnectorErrorType.UNAUTHORIZED,
            'This is a private repository. Add a GitHub personal access token with read access and retry.',
            { repo: `${ref.owner}/${ref.repo}` }
          ),
        };
      }

      return {
        success: true,
        metadata,
        branch: ref.branch || metadata.defaultBranch,
      };
    } catch (error) {
      return {
        success: false,
        error: new GitHubConnectorError(
          GitHubConnectorErrorType.NETWORK_ERROR,
          `Network error fetching repository metadata: ${error instanceof Error ? error.message : String(error)}`,
          { originalError: error }
        ),
      };
    }
  }

  /**
   * Lists files in a repository directory
   */
  async listFiles(
    ref: GitHubRepoReference,
    dirPath: string = ''
  ): Promise<GitHubFileListResult> {
    try {
      const branch = ref.branch || 'main';
      const path = dirPath ? `${dirPath}` : '';
      const url = `${this.API_BASE}/repos/${ref.owner}/${ref.repo}/contents/${path}?ref=${branch}`;

      const response = await this.fetchWithTimeout(url);

      if (response.status === 404) {
        return {
          success: false,
          error: new GitHubConnectorError(
            GitHubConnectorErrorType.FILE_NOT_FOUND,
            `Directory ${dirPath} not found in ${ref.owner}/${ref.repo}`,
            { path: dirPath, branch }
          ),
        };
      }

      if (response.status === 403) {
        return {
          success: false,
          error: new GitHubConnectorError(
            GitHubConnectorErrorType.RATE_LIMITED,
            'GitHub API rate limit exceeded.',
            {}
          ),
        };
      }

      if (!response.ok) {
        return {
          success: false,
          error: new GitHubConnectorError(
            GitHubConnectorErrorType.UNKNOWN,
            `GitHub API error: ${response.status}`,
            { status: response.status }
          ),
        };
      }

      const data = await response.json() as any[];
      if (!Array.isArray(data)) {
        return {
          success: false,
          error: new GitHubConnectorError(
            GitHubConnectorErrorType.UNKNOWN,
            'Unexpected response format from GitHub API',
            {}
          ),
        };
      }

      const files: GitHubFileInfo[] = data.map(item => ({
        name: item.name,
        path: item.path,
        type: item.type,
        size: item.size,
        sha: item.sha,
        downloadUrl: item.download_url,
      }));

      return {
        success: true,
        files,
      };
    } catch (error) {
      return {
        success: false,
        error: new GitHubConnectorError(
          GitHubConnectorErrorType.NETWORK_ERROR,
          `Network error listing files: ${error instanceof Error ? error.message : String(error)}`,
          {}
        ),
      };
    }
  }

  /**
   * Fetches a file's raw content from GitHub
   */
  async fetchFile(
    ref: GitHubRepoReference,
    filePath: string
  ): Promise<GitHubFileFetchResult> {
    try {
      // Check if file is blocked
      if (isBlockedFile(filePath)) {
        return {
          success: false,
          error: new GitHubConnectorError(
            GitHubConnectorErrorType.UNSUPPORTED_FILE,
            `File type is not supported for import: ${filePath}`,
            { filePath, reason: 'blocked file type' }
          ),
        };
      }

      const branch = ref.branch || 'main';
      const url = `${this.RAW_CONTENT_BASE}/${ref.owner}/${ref.repo}/${branch}/${filePath}`;

      const response = await this.fetchWithTimeout(url);

      if (response.status === 404) {
        return {
          success: false,
          error: new GitHubConnectorError(
            GitHubConnectorErrorType.FILE_NOT_FOUND,
            `File not found: ${filePath}`,
            { filePath, branch }
          ),
        };
      }

      if (response.status === 403) {
        return {
          success: false,
          error: new GitHubConnectorError(
            GitHubConnectorErrorType.RATE_LIMITED,
            'GitHub rate limit exceeded.',
            {}
          ),
        };
      }

      if (!response.ok) {
        return {
          success: false,
          error: new GitHubConnectorError(
            GitHubConnectorErrorType.UNKNOWN,
            `GitHub error: ${response.status}`,
            { status: response.status }
          ),
        };
      }

      const content = await response.text();

      return {
        success: true,
        content: {
          path: filePath,
          name: filePath.split('/').pop() || '',
          content,
          encoding: 'utf-8',
          size: content.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: new GitHubConnectorError(
          GitHubConnectorErrorType.NETWORK_ERROR,
          `Network error fetching file: ${error instanceof Error ? error.message : String(error)}`,
          { filePath }
        ),
      };
    }
  }

  /**
   * Ingest a repository: fetch supported manifest files
   * This is the main entry point for importing a GitHub repo
   */
  async ingestRepository(ref: GitHubRepoReference): Promise<GitHubRepoIngestResult> {
    const result: GitHubRepoIngestResult = {
      success: false,
      branch: ref.branch || 'main',
      files: new Map(),
      errors: [],
      warnings: [],
    };

    try {
      // Fetch repo metadata first
      const metaResult = await this.fetchRepoMetadata(ref);
      if (!metaResult.success) {
        result.errors.push(metaResult.error!);
        return result;
      }

      result.metadata = metaResult.metadata;
      result.branch = metaResult.branch || result.branch;

      // Try to fetch each supported manifest file
      // Don't fail if some are missing - they're optional
      for (const fileName of SUPPORTED_MANIFEST_FILES) {
        const fileResult = await this.fetchFile(ref, fileName);

        if (fileResult.success && fileResult.content) {
          result.files.set(fileName, fileResult.content);
        } else if (fileResult.error?.type !== GitHubConnectorErrorType.FILE_NOT_FOUND) {
          // Only record non-404 errors as warnings
          result.warnings.push(
            `Warning fetching ${fileName}: ${fileResult.error?.message || 'Unknown error'}`
          );
        }
      }

      // Success requires at least one import-relevant structured file.
      // README by itself should not be considered import-ready.
      const hasImportableContent = Array.from(result.files.keys()).some(file => file !== 'README.md');
      if (hasImportableContent) {
        result.success = true;
      } else {
        result.errors.push(
          new GitHubConnectorError(
            GitHubConnectorErrorType.FILE_NOT_FOUND,
            'No supported import files found in repository (expected manifest/config/package metadata).',
            { supportedFiles: SUPPORTED_MANIFEST_FILES }
          )
        );
      }

      return result;
    } catch (error) {
      result.errors.push(
        new GitHubConnectorError(
          GitHubConnectorErrorType.UNKNOWN,
          `Unexpected error during ingestion: ${error instanceof Error ? error.message : String(error)}`,
          {}
        )
      );
      return result;
    }
  }

  /**
   * Helper: fetch with timeout
   */
  private fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    return fetch(url, {
      headers: this.config.authToken ? {
        'Authorization': `token ${this.config.authToken}`,
        'Accept': 'application/vnd.github.v3.raw+json',
      } : {
        'Accept': 'application/vnd.github.v3.raw+json',
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));
  }
}
