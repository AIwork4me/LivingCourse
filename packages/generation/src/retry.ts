export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
}

export interface ProviderErrorLike extends Error {
  status?: number;
  code?: string;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 4,
  baseDelayMs: 500,
  maxDelayMs: 8_000,
  jitterRatio: 0.2
};

export const isRetryableProviderError = (error: ProviderErrorLike): boolean => {
  if (error.status !== undefined) return [408, 409, 425, 429].includes(error.status) || error.status >= 500;
  return ["ETIMEDOUT", "ECONNRESET", "EAI_AGAIN", "NETWORK_ERROR"].includes(error.code ?? "");
};

export const withRetry = async <T>(
  operation: (attempt: number) => Promise<T>,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
  dependencies: { sleep?: (milliseconds: number) => Promise<void>; random?: () => number } = {}
): Promise<T> => {
  const sleep = dependencies.sleep ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const random = dependencies.random ?? Math.random;
  let lastError: ProviderErrorLike | null = null;
  for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error as ProviderErrorLike;
      if (!isRetryableProviderError(lastError) || attempt === policy.maxAttempts) throw lastError;
      const exponential = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** (attempt - 1));
      const jitter = exponential * policy.jitterRatio * (random() * 2 - 1);
      await sleep(Math.max(0, Math.round(exponential + jitter)));
    }
  }
  throw lastError ?? new Error("Retry policy exhausted without an error.");
};
