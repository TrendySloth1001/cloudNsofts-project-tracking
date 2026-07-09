'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Invitation } from '@cnsofts/shared';
import { invitationsApi } from './invitations.api';

/** The signed-in user's pending invitations, with local removal so the popup
 *  empties as each one is accepted/declined without a refetch. */
export function useMyInvitations() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const { invitations: rows } = await invitationsApi.listMine();
      setInvitations(rows);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const removeLocal = useCallback((id: string) => {
    setInvitations((prev) => prev.filter((i) => i.id !== id));
  }, []);

  return { invitations, loading, reload, removeLocal };
}
