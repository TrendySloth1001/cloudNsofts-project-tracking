'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  PROJECT_STATUS_LABELS,
  projectStatusSchema,
  type Project,
  type ProjectStatus,
} from '@cnsofts/shared';
import { Button, Card, Icon, Input, Select, Spinner } from '@/components/ui';
import { UserAvatar } from '@/features/profile/components/user-avatar';
import { useProjects } from '../use-projects';
import { projectInitials, projectTint } from '../project-visuals';
import { formatDate, projectProgress } from '../task-utils';
import { CreateProjectDialog } from './create-project-dialog';
import { ProjectStatusBadge } from './project-status-badge';
import styles from './projects-view.module.css';

type StatusFilter = 'all' | ProjectStatus;

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  ...projectStatusSchema.options.map((s) => ({
    value: s,
    label: PROJECT_STATUS_LABELS[s],
  })),
];

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function ProjectsView() {
  const router = useRouter();
  const { projects: all, loading } = useProjects();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const projects = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter(
      (p) =>
        (statusFilter === 'all' || p.status === statusFilter) &&
        (q === '' ||
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)),
    );
  }, [all, query, statusFilter]);

  return (
    <div>
      <div className={styles.header}>
        <div className={styles.headingGroup}>
          <h1 className={styles.title}>Projects</h1>
          <p className={styles.subtitle}>
            {all.length > 0
              ? `${plural(all.length, 'project')} in your workspace`
              : 'Create a project, then add its clients and team.'}
          </p>
        </div>
        <Button leftIcon="add" onClick={() => setDialogOpen(true)}>
          New project
        </Button>
      </div>

      {all.length > 0 && (
        <div className={styles.toolbar}>
          <div className={styles.search}>
            <Input
              leftIcon="search"
              placeholder="Search projects"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className={styles.filter}>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              options={STATUS_FILTER_OPTIONS}
            />
          </div>
        </div>
      )}

      {loading && all.length === 0 ? (
        <div className={styles.loading}>
          <Spinner size={24} />
        </div>
      ) : all.length === 0 ? (
        <Card className={styles.empty}>
          <span className={styles.emptyIcon}>
            <Icon name="folder" size={26} tone="brand" />
          </span>
          <p className={styles.emptyTitle}>No projects yet</p>
          <p className={styles.emptyText}>
            Create your first project to start adding clients and team members —
            or wait to be invited to one.
          </p>
          <Button leftIcon="add" onClick={() => setDialogOpen(true)}>
            New project
          </Button>
        </Card>
      ) : projects.length === 0 ? (
        <div className={styles.noResults}>
          No projects match your search.
        </div>
      ) : (
        <div className={styles.grid}>
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onOpen={() => router.push(`/projects/${project.id}`)}
            />
          ))}
        </div>
      )}

      <CreateProjectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={(id) => {
          setDialogOpen(false);
          router.push(`/projects/${id}`);
        }}
      />
    </div>
  );
}

function ProjectCard({
  project,
  onOpen,
}: {
  project: Project;
  onOpen: () => void;
}) {
  const tint = projectTint(project.id);
  const total = project.tasks.length;
  const done = project.tasks.filter((t) => t.status === 'done').length;
  const pct = projectProgress(project);

  return (
    <Card interactive className={styles.card} onClick={onOpen}>
      {/* Identity — monogram, name + status, description, at-a-glance stats. */}
      <div className={styles.identity}>
        <span
          className={styles.monogram}
          style={{ background: tint.bg, color: tint.fg }}
        >
          {projectInitials(project.name)}
        </span>
        <div className={styles.idText}>
          <div className={styles.nameRow}>
            <h3 className={styles.cardName}>{project.name}</h3>
            <ProjectStatusBadge status={project.status} />
          </div>
          <p className={styles.cardDesc}>
            {project.description || 'No description yet.'}
          </p>
          <div className={styles.chips}>
            <span className={styles.chip}>
              <Icon name="layers" size={13} />
              {plural(project.features.length, 'feature')}
            </span>
            <span className={styles.chip}>
              <Icon name="flag" size={13} />
              {plural(project.milestones.length, 'milestone')}
            </span>
            {project.dueDate && (
              <span className={styles.chip}>
                <Icon name="calendar" size={13} />
                Due {formatDate(project.dueDate)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className={styles.progressRegion}>
        {total > 0 ? (
          <>
            <div className={styles.progressHead}>
              <span className={styles.progressPct}>{pct}%</span>
              <span className={styles.progressTasks}>
                {done}/{total} tasks
              </span>
            </div>
            <div className={styles.progressTrack}>
              <span
                className={styles.progressBar}
                style={{ width: `${pct}%` }}
              />
            </div>
          </>
        ) : (
          <span className={styles.progressEmpty}>No tasks yet</span>
        )}
      </div>

      {/* People */}
      <div className={styles.people}>
        <div className={styles.avatars}>
          {project.members.length === 0 ? (
            <span className={styles.noTeam}>No team yet</span>
          ) : (
            <>
              {project.members.slice(0, 4).map((m) => (
                <UserAvatar
                  key={m.id}
                  name={m.name}
                  seed={m.id}
                  size={28}
                  className={styles.avatar}
                />
              ))}
              {project.members.length > 4 && (
                <span className={styles.moreAvatars}>
                  +{project.members.length - 4}
                </span>
              )}
            </>
          )}
        </div>
        <span className={styles.clientCount}>
          {plural(project.clients.length, 'client')}
        </span>
      </div>
    </Card>
  );
}
