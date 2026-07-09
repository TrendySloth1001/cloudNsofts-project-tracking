'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui';
import { useMyInvitations } from '../use-my-invitations';
import { InvitationCard } from './invitation-card';
import styles from './pending-invites-modal.module.css';

/** Pops up on app load when the signed-in user has pending invitations — the
 *  surfacing of "pre-made" invites made before they signed up, plus any that
 *  arrive later. Closes automatically once every invite is accepted/declined. */
export function PendingInvitesModal() {
  const { invitations, loading, removeLocal } = useMyInvitations();
  const [dismissed, setDismissed] = useState(false);

  const open = !loading && invitations.length > 0 && !dismissed;
  const count = invitations.length;

  return (
    <Modal
      open={open}
      onClose={() => setDismissed(true)}
      title={count === 1 ? 'You have an invitation' : `You have ${count} invitations`}
      description="Accept to join the project, or decline."
      size="md"
    >
      <div className={styles.list}>
        {invitations.map((inv) => (
          <InvitationCard
            key={inv.id}
            invitation={inv}
            onResolved={(id) => removeLocal(id)}
          />
        ))}
      </div>
    </Modal>
  );
}
