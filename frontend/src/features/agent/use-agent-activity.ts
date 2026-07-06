'use client';

import { useEffect, useState } from 'react';
import type { AgentActivity } from '@cnsofts/shared';
import { agentApi } from './agent.api';

/** Loads the current user's recent agent (PAT) activity. `reloadKey` re-fetches
 *  when it changes — bump it after a write so new actions show up. */
export function useAgentActivity(reloadKey: number = 0) {
  const [activity, setActivity] = useState<AgentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    agentApi
      .activity()
      .then((res) => {
        if (alive) setActivity(res.activity);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  return { activity, loading };
}
