// The one seam between The Council and whichever model host is behind it.
// Text in, a stream of text chunks out, token usage at the end. Nothing else
// in the feature knows which provider is in use.

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  /** Cost as billed by the provider, when it reports one. */
  reportedCostUsd?: number;
}

export interface GenerateInput {
  system: string;
  user: string;
  maxTokens: number;
  /** Generation should halt at any of these, where the model supports it. */
  stop?: string[];
  /** Aborting must stop the upstream request promptly. */
  signal: AbortSignal;
}

export interface ProviderStream {
  /** Text as it is generated. Throws ProviderError on failure, or the abort reason. */
  chunks: AsyncIterable<string>;
  /** Final usage. Null until the stream completes, and if the provider never reported it. */
  usage(): TokenUsage | null;
  /** True once the provider accepted the request, i.e. prompt tokens were likely billed. */
  accepted(): boolean;
}

export interface ModelProvider {
  stream(input: GenerateInput): ProviderStream;
}

export type ProviderErrorKind = 'http' | 'network' | 'stream';

/**
 * Carries a status and a kind only. Deliberately no upstream response body:
 * provider error payloads can echo prompt text, and nothing a visitor typed
 * may reach our logs.
 */
export class ProviderError extends Error {
  constructor(
    readonly kind: ProviderErrorKind,
    readonly status?: number,
  ) {
    super(`provider ${kind}${status ? ` ${status}` : ''}`);
    this.name = 'ProviderError';
  }
}
