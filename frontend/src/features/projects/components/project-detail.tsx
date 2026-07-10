'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Button,
  Icon,
  IconButton,
  Menu,
  Spinner,
  Tabs,
  useConfirm,
} from '@/components/ui';
import { cx } from '@/lib/cx';
import { useProjectPermissions } from '@/features/auth/use-project-permissions';
import { useProject } from '../use-projects';
import { projectStore } from '../projects.store';
import { projectInitials, projectTint } from '../project-visuals';
import { ProjectStatusBadge } from './project-status-badge';
import { ProjectHome } from './project-home';
import { ProjectDiscussion } from './project-discussion';
import { ProjectDocs } from './project-docs';
import { ProjectRoadmap } from './project-roadmap';
import styles from './project-detail.module.css';

type ProjectTab = 'home' | 'discussion' | 'docs';

export function ProjectDetail({ projectId }: { projectId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const confirm = useConfirm();
  const { project, loading } = useProject(projectId);
  const perms = useProjectPermissions(project);
  // A notification deep-link (?tab=discussion|docs) opens straight to that tab.
  const paramTab = searchParams.get('tab');
  const [tab, setTab] = useState<ProjectTab>(
    paramTab === 'discussion' || paramTab === 'docs' ? paramTab : 'home',
  );
  // Roadmap is a distinct full-width view opened from a header button (not a
  // tab) so the tab bar stays light. It overlays whichever tab is selected.
  const [roadmapOpen, setRoadmapOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  // Mobile: the discussion's chat detail is open (hide the project header).
  const [chatDetail, setChatDetail] = useState(false);

  function selectTab(next: ProjectTab) {
    setRoadmapOpen(false);
    setTab(next);
  }

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
  // Discussion and docs both use the bounded, panel-scrolls-internally layout;
  // the roadmap view scrolls normally like Home.
  const panelTab = !roadmapOpen && (tab === 'discussion' || tab === 'docs');

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
    <div
      className={cx(
        styles.page,
        panelTab && styles.discussionTab,
        panelTab && chatDetail && styles.chatDetail,
      )}
    >
      <div className={styles.head}>
        <Link href="/" className={styles.back}>
          <Icon name="chevronLeft" size={16} />
          <span>Projects</span>
        </Link>
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
            <h1 className={styles.title}>{project.name}</h1>
            <ProjectStatusBadge status={project.status} />
            {project.description && (
              <span className={styles.desc}>{project.description}</span>
            )}
          </div>

          {/* Mobile app-bar: actions collapse to icons on the identity row. */}
          <div className={styles.headActionsMobile}>
            <IconButton
              icon="flag"
              label="Roadmap"
              variant={roadmapOpen ? 'primary' : 'outline'}
              onClick={() => setRoadmapOpen((open) => !open)}
              aria-pressed={roadmapOpen}
            />
            {tab === 'home' && !roadmapOpen && !perms.isClient && (
              <IconButton
                icon="user"
                label="Team & clients"
                variant="outline"
                onClick={() => setPeopleOpen((open) => !open)}
                aria-expanded={peopleOpen}
              />
            )}
            {perms.canDeleteProject && (
              <IconButton
                icon="delete"
                label="Delete project"
                variant="outline"
                onClick={deleteProject}
              />
            )}
          </div>
        </div>

        <Tabs
          className={styles.headTabs}
          variant="pill"
          fluid
          value={roadmapOpen ? '' : tab}
          onValueChange={(v) => selectTab(v as ProjectTab)}
          items={[
            { value: 'home', label: 'Home', icon: 'home', iconTone: 'brand' },
            {
              value: 'discussion',
              label: 'Discussion',
              icon: 'chat',
              iconTone: 'info',
            },
            { value: 'docs', label: 'Docs', icon: 'docs', iconTone: 'success' },
          ]}
        />

        <div className={styles.headActions}>
          <Button
            variant={roadmapOpen ? 'primary' : 'outline'}
            leftIcon="flag"
            onClick={() => setRoadmapOpen((open) => !open)}
            aria-pressed={roadmapOpen}
          >
            Roadmap
          </Button>
          {tab === 'home' && !roadmapOpen && !perms.isClient && (
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
          {perms.canDeleteProject && (
            <Menu
              align="end"
              trigger={
                <IconButton
                  icon="moreVertical"
                  label="Project actions"
                  variant="outline"
                />
              }
              items={[
                {
                  label: 'Delete project',
                  icon: 'delete',
                  danger: true,
                  onSelect: deleteProject,
                },
              ]}
            />
          )}
        </div>
      </div>

      {roadmapOpen ? (
        <ProjectRoadmap project={project} canEdit={perms.canEditBoard} />
      ) : (
        <>
          {tab === 'home' && (
            <ProjectHome
              project={project}
              peopleOpen={peopleOpen}
              canEditBoard={perms.canEditBoard}
              canManageTeam={perms.canManageTeam}
            />
          )}
          {tab === 'discussion' && (
            <ProjectDiscussion
              projectId={project.id}
              candidates={[...project.members, ...project.clients].map((p) => ({
                email: p.email,
                name: p.name,
              }))}
              canManageChannels={perms.canManageChannels}
              onChatDetailChange={setChatDetail}
            />
          )}
          {tab === 'docs' && (
            <ProjectDocs
              projectId={project.id}
              canEdit={perms.canEditBoard}
              onDetailChange={setChatDetail}
            />
          )}
        </>
      )}
    </div>
  );
}
