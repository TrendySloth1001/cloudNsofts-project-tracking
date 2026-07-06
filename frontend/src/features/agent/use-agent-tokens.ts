'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  ApiTokenSummary,
  CreateApiTokenInput,
  CreatedApiToken,
} from '@cnsofts/shared';
import { agentApi } from './agent.api';

/** Loads and mutates the current user's access tokens. */
export function useAgentTokens() {
  const [tokens, setTokens] = useState<ApiTokenSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    agentApi
      .list()
      .then((res) => {
        if (alive) setTokens(res.tokens);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const create = useCallback(
    async (input: CreateApiTokenInput): Promise<CreatedApiToken> => {
      const result = await agentApi.create(input);
      setTokens((prev) => [result.apiToken, ...prev]);
      return result;
    },
    [],
  );

  const rename = useCallback(async (id: string, name: string) => {
    const updated = await agentApi.rename(id, { name });
    setTokens((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }, []);

  const rotate = useCallback(
    async (id: string): Promise<CreatedApiToken> => {
      // Rotation revokes `id` and mints a new token; swap it into the list.
      const result = await agentApi.rotate(id);
      setTokens((prev) => [
        result.apiToken,
        ...prev.filter((t) => t.id !== id),
      ]);
      return result;
    },
    [],
  );

  const revoke = useCallback(async (id: string) => {
    await agentApi.revoke(id);
    setTokens((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { tokens, loading, create, rename, rotate, revoke };
}
