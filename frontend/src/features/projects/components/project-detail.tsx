'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Icon, Spinner, Tabs, useConfirm } from '@/components/ui';
import { useProject } from '../use-projects';
import { projectStore } from '../projects.store';
import { projectInitials, projectTint } from '../project-visuals';
import { ProjectStatusBadge } from './project-status-badge';
import { ProjectHome } from './project-home';
import { ProjectDiscussion } from './project-discussion';
import styles from './project-detail.module.css';

type ProjectTab = 'home' | 'discussion';

export function ProjectDetail({ projectId }: { projectId: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { project, loading } = useProject(projectId);
  const [tab, setTab] = useState<ProjectTab>('home');
  const [peopleOpen, setPeopleOpen] = useState(false);

  if (loading && !project) {
    return (
      <div className={styles.loading}>
        <Spinner size={28} />
      </div>
    );
  }

  if (!project) {
    return (
      <div className={styles.notFound}>
        <p>This project doesn&apos;t exist.</p>
        <Link href="/" className={styles.back}>
          <Icon name="chevronLeft" size={16} />
          <span>Back to projects</span>
        </Link>
      </div>
    );
  }

  const currentProject = project;

  async function deleteProject() {
    const ok = await confirm({
      title: 'Delete project?',
      message: (
        <>
          Delete <strong>“{currentProject.name}”</strong>? This can’t be undone.
        </>
      ),
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    await projectStore.remove(currentProject.id);
    router.replace('/');
  }

  return (
    <div className={styles.page}>
      <Link href="/" className={styles.back}>
        <Icon name="chevronLeft" size={16} />
        <span>Projects</span>
      </Link>

      <div className={styles.head}>
        <div className={styles.headLeft}>
          <span
            className={styles.monogram}
            style={{
              background: projectTint(project.id).bg,
              color: projectTint(project.id).fg,
            }}
          >
            {projectInitials(project.name)}
          </span>
          <div className={styles.headText}>
            <div className={styles.titleRow}>
              <h1 className={styles.title}>{project.name}</h1>
              <ProjectStatusBadge status={project.status} />
            </div>
            {project.description && (
              <p className={styles.desc}>{project.description}</p>
            )}
          </div>
        </div>

        <Tabs
          className={styles.headTabs}
          variant="pill"
          value={tab}
          onValueChange={(v) => setTab(v as ProjectTab)}
          items={[
            { value: 'home', label: 'Home', icon: 'home', iconTone: 'brand' },
            {
              value: 'discussion',
              label: 'Discussion',
              icon: 'chat',
              iconTone: 'info',
            },
          ]}
        />

        <div className={styles.headActions}>
          {tab === 'home' && (
            <Button
              variant="outline"
              leftIcon="user"
              rightIcon={peopleOpen ? 'chevronUp' : 'chevronDown'}
              onClick={() => setPeopleOpen((open) => !open)}
              aria-expanded={peopleOpen}
            >
              Team &amp; clients
            </Button>
          )}
          <Button variant="outline" leftIcon="delete" onClick={deleteProject}>
            Delete
          </Button>
        </div>
      </div>

      {tab === 'home' ? (
        <ProjectHome project={project} peopleOpen={peopleOpen} />
      ) : (
        <ProjectDiscussion />
      )}
    </div>
  );
}
