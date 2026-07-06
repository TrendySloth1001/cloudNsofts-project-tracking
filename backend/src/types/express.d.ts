import type { ApiTokenScope, AuthUser, ProjectRole } from '@cnsofts/shared';

// Expose the verified principal on the request for authenticated handlers.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authUser?: AuthUser;
      // Set by `requireProjectAccess` for routes under `/projects/:id`.
      projectRole?: ProjectRole;
      // Name of the coding agent (PAT) when the request is agent-authenticated.
      agentName?: string;
      // Present only when authenticated via a PAT — drives scope enforcement.
      tokenScope?: {
        scope: ApiTokenScope;
        projectIds: string[];
        canDelete: boolean;
      };
    }
  }
}

export {};
