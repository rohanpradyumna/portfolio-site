import { GenerateInput, ModelProvider, ProviderError, ProviderStream, TokenUsage } from './provider';

// OpenRouter through its OpenAI-compatible chat completions endpoint, with
// plain fetch and server-sent events. Usage (and cost) arrives in an extra
// final chunk just before "data: [DONE]".

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

export interface OpenRouterOptions {
  apiKey: string;
  model: string;
  reasoningEffort: string | null;
  siteUrl: string;
  fetchImpl?: typeof fetch;
}

interface StreamChunk {
  choices?: { delta?: { content?: string | null }; finish_reason?: string | null }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number } | null;
  error?: unknown;
}

export function createOpenRouterProvider(options: OpenRouterOptions): ModelProvider {
  const doFetch = options.fetchImpl ?? fetch;

  return {
    stream(input: GenerateInput): ProviderStream {
      let usage: TokenUsage | null = null;
      let accepted = false;

      async function* chunks(): AsyncGenerator<string> {
        let response: Response;
        try {
          response = await doFetch(ENDPOINT, {
            method: 'POST',
            signal: input.signal,
            headers: {
              Authorization: `Bearer ${options.apiKey}`,
              'Content-Type': 'application/json',
              // Optional attribution headers; they only label the app on openrouter.ai.
              'HTTP-Referer': options.siteUrl,
              'X-OpenRouter-Title': 'The Council',
            },
            body: JSON.stringify({
              model: options.model,
              stream: true,
              max_tokens: input.maxTokens,
              ...(input.stop?.length ? { stop: input.stop } : {}),
              ...(options.reasoningEffort ? { reasoning: { effort: options.reasoningEffort, exclude: true } } : {}),
              messages: [
                { role: 'system', content: input.system },
                { role: 'user', content: input.user },
              ],
            }),
          });
        } catch (err) {
          if (input.signal.aborted) throw err;
          throw new ProviderError('network');
        }

        if (!response.ok || !response.body) {
          await response.body?.cancel().catch(() => {});
          throw new ProviderError('http', response.status);
        }
        accepted = true;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        try {
          for (;;) {
            let read: ReadableStreamReadResult<Uint8Array>;
            try {
              read = await reader.read();
            } catch (err) {
              if (input.signal.aborted) throw err;
              throw new ProviderError('network');
            }
            if (read.done) return;
            buffer += decoder.decode(read.value, { stream: true });

            let newline: number;
            while ((newline = buffer.indexOf('\n')) !== -1) {
              const line = buffer.slice(0, newline).replace(/\r$/, '');
              buffer = buffer.slice(newline + 1);
              // Blank separators and ": OPENROUTER PROCESSING" keep-alives.
              if (!line.startsWith('data:')) continue;
              const data = line.slice(5).trim();
              if (data === '[DONE]') return;
              let parsed: StreamChunk;
              try {
                parsed = JSON.parse(data);
              } catch {
                continue;
              }
              // Mid-stream failures arrive with HTTP 200 and an error object.
              if (parsed.error || parsed.choices?.[0]?.finish_reason === 'error') throw new ProviderError('stream');
              if (parsed.usage) {
                usage = {
                  promptTokens: parsed.usage.prompt_tokens ?? 0,
                  completionTokens: parsed.usage.completion_tokens ?? 0,
                  reportedCostUsd: typeof parsed.usage.cost === 'number' ? parsed.usage.cost : undefined,
                };
              }
              const text = parsed.choices?.[0]?.delta?.content;
              if (typeof text === 'string' && text.length > 0) yield text;
            }
          }
        } finally {
          // Runs on completion, on error and when the consumer stops early:
          // releasing the reader closes the connection, which is what tells
          // OpenRouter to stop generating (and billing).
          await reader.cancel().catch(() => {});
        }
      }

      return { chunks: chunks(), usage: () => usage, accepted: () => accepted };
    },
  };
}
