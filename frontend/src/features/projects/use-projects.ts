'use client';

import { useEffect, useSyncExternalStore } from 'react';
import type { Project } from '@cnsofts/shared';
import { projectStore } from './projects.store';

/** Reactive list of all projects, with load state. */
export function useProjects(): {
  projects: Project[];
  loading: boolean;
  error: boolean;
} {
  useEffect(() => {
    projectStore.ensureLoaded();
  }, []);

  const projects = useSyncExternalStore(
    projectStore.subscribe,
    projectStore.getSnapshot,
    projectStore.getServerSnapshot,
  );
  const status = useSyncExternalStore(
    projectStore.subscribe,
    projectStore.getStatus,
    projectStore.getServerStatus,
  );

  return {
    projects,
    loading: status === 'idle' || status === 'loading',
    error: status === 'error',
  };
}

/** Reactive single project. */
export function useProject(id: string): {
  project: Project | undefined;
  loading: boolean;
} {
  const { projects, loading } = useProjects();
  return { project: projects.find((p) => p.id === id), loading };
}
