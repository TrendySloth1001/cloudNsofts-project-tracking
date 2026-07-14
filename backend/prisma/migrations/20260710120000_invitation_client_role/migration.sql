-- Invitations can now grant a `client` role (invitee lands on the project's
-- client roster instead of the member roster). Introduce a dedicated
-- InvitationRole enum and migrate the existing column onto it. All current
-- values (admin/manager/member/viewer) exist in the new enum, so the cast is
-- lossless.
CREATE TYPE "InvitationRole" AS ENUM ('admin', 'manager', 'member', 'viewer', 'client');

ALTER TABLE "invitations" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "invitations"
  ALTER COLUMN "role" TYPE "InvitationRole" USING ("role"::text::"InvitationRole");
ALTER TABLE "invitations" ALTER COLUMN "role" SET DEFAULT 'member';
