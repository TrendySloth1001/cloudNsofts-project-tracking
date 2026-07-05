'use client';

import { useState } from 'react';
import {
  TASK_PRIORITY_LABELS,
  taskPrioritySchema,
  type Feature,
  type MessageAttachment,
  type Project,
  type Task,
  type TaskStatus,
} from '@cnsofts/shared';
import { Button, Input, Select, Tabs } from '@/components/ui';
import { ProjectPeople } from './project-people';
import { TaskBoard } from './task-board';
import { TaskBoardSwimlanes } from './task-board-swimlanes';
import { TaskList } from './task-list';
import { TaskDialog } from './task-dialog';
import { TaskDetailDialog } from './task-detail-dialog';
import { FeatureDialog } from './feature-dialog';
import { ShareToChannelDialog } from './share-to-channel-dialog';
import styles from './project-home.module.css';

export interface ProjectHomeProps {
  project: Project;
  peopleOpen: boolean;
  /** Caller may create/edit tasks (per-project: admin/manager/member). */
  canEditBoard: boolean;
  /** Caller may add/remove members & change roles (per-project: admin/manager). */
  canManageTeam: boolean;
}

export function ProjectHome({
  project,
  peopleOpen,
  canEditBoard,
  canManageTeam,
}: ProjectHomeProps) {
  const [taskView, setTaskView] = useState<'board' | 'list'>('board');
  const [groupBy, setGroupBy] = useState<'status' | 'feature'>('feature');
  const [taskDialog, setTaskDialog] = useState<{
    open: boolean;
    taskId: string | null;
    status: TaskStatus;
  }>({ open: false, taskId: null, status: 'todo' });
  const [featureDialog, setFeatureDialog] = useState<{
    open: boolean;
    feature: Feature | null;
  }>({ open: false, feature: null });
  // Share a task/feature into a discussion channel.
  const [share, setShare] = useState<{
    attachment: MessageAttachment;
    name: string;
  } | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [taskQuery, setTaskQuery] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const assigneeFilterOptions = [
    { value: 'all', label: 'All assignees' },
    { value: 'unassigned', label: 'Unassigned' },
    ...project.members.map((m) => ({ value: m.id, label: m.name })),
  ];
  const priorityFilterOptions = [
    { value: 'all', label: 'All priorities' },
    ...taskPrioritySchema.options.map((p) => ({
      value: p,
      label: TASK_PRIORITY_LABELS[p],
    })),
  ];
  const filteredTasks = project.tasks.filter((t) => {
    const q = taskQuery.trim().toLowerCase();
    const assigneeOk =
      assigneeFilter === 'all'
        ? true
        : assigneeFilter === 'unassigned'
          ? t.assigneeIds.length === 0
          : t.assigneeIds.includes(assigneeFilter);
    const priorityOk = priorityFilter === 'all' || t.priority === priorityFilter;
    const queryOk = q === '' || t.title.toLowerCase().includes(q);
    return assigneeOk && priorityOk && queryOk;
  });

  function openNewTask(status: TaskStatus = 'todo') {
    setTaskDialog({ open: true, taskId: null, status });
  }
  function openTaskDetail(task: Task) {
    setDetailTaskId(task.id);
  }
  function closeTaskDialog() {
    setTaskDialog((d) => ({ ...d, open: false }));
  }
  function editFromDetail() {
    if (!detailTaskId) return;
    const id = detailTaskId;
    setDetailTaskId(null);
    setTaskDialog({ open: true, taskId: id, status: 'todo' });
  }

  const dialogTask = taskDialog.taskId
    ? (project.tasks.find((t) => t.id === taskDialog.taskId) ?? null)
    : null;
  const detailTask = detailTaskId
    ? (project.tasks.find((t) => t.id === detailTaskId) ?? null)
    : null;

  return (
    <div className={styles.home}>
      {peopleOpen && (
        <ProjectPeople
          projectId={project.id}
          members={project.members}
          clients={project.clients}
          canManage={canManageTeam}
        />
      )}

      <div className={styles.tasksToolbar}>
        <Tabs
          variant="pill"
          fluid
          className={styles.viewTabs}
          value={taskView}
          onValueChange={(v) => setTaskView(v as 'board' | 'list')}
          items={[
            { value: 'board', label: 'Board', icon: 'board', iconTone: 'brand' },
            { value: 'list', label: 'List', icon: 'list', iconTone: 'info' },
          ]}
        />
        <Input
          inputSize="md"
          leftIcon="search"
          placeholder="Search tasks"
          value={taskQuery}
          onChange={(e) => setTaskQuery(e.target.value)}
          containerClassName={styles.taskSearch}
        />
        <Select
          selectSize="md"
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          options={assigneeFilterOptions}
          containerClassName={styles.taskFilter}
        />
        <Select
          selectSize="md"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          options={priorityFilterOptions}
          containerClassName={styles.taskFilter}
        />
        {taskView === 'board' && (
          <Select
            selectSize="md"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as 'status' | 'feature')}
            options={[
              { value: 'status', label: 'Group: Status' },
              { value: 'feature', label: 'Group: Feature' },
            ]}
            containerClassName={styles.taskFilter}
          />
        )}
        <span className={styles.spacer} />
        {canEditBoard && (
          <>
            <Button
              variant="outline"
              leftIcon="flag"
              className={styles.newTaskBtn}
              onClick={() => setFeatureDialog({ open: true, feature: null })}
            >
              New feature
            </Button>
            <Button
              variant="info"
              leftIcon="add"
              className={styles.newTaskBtn}
              onClick={() => openNewTask('todo')}
            >
              New task
            </Button>
          </>
        )}
      </div>

      {taskView === 'list' ? (
        <TaskList
          tasks={filteredTasks}
          members={project.members}
          projectId={project.id}
          onOpenTask={openTaskDetail}
          canEdit={canEditBoard}
        />
      ) : groupBy === 'feature' ? (
        <TaskBoardSwimlanes
          tasks={filteredTasks}
          features={project.features}
          members={project.members}
          projectId={project.id}
          onOpenTask={openTaskDetail}
          onEditFeature={(feature) => setFeatureDialog({ open: true, feature })}
          onShareFeature={(feature) =>
            setShare({
              attachment: { kind: 'feature', id: feature.id },
              name: feature.name,
            })
          }
          canEdit={canEditBoard}
        />
      ) : (
        <TaskBoard
          tasks={filteredTasks}
          members={project.members}
          features={project.features}
          projectId={project.id}
          onOpenTask={openTaskDetail}
          canEdit={canEditBoard}
        />
      )}

      <TaskDetailDialog
        open={detailTaskId !== null}
        onClose={() => setDetailTaskId(null)}
        projectId={project.id}
        task={detailTask}
        members={project.members}
        onEdit={editFromDetail}
        onShare={
          detailTask
            ? () =>
                setShare({
                  attachment: { kind: 'task', id: detailTask.id },
                  name: detailTask.title,
                })
            : undefined
        }
        canEdit={canEditBoard}
      />

      <TaskDialog
        open={taskDialog.open}
        onClose={closeTaskDialog}
        projectId={project.id}
        members={project.members}
        features={project.features}
        defaultStatus={taskDialog.status}
        task={dialogTask}
      />

      <FeatureDialog
        open={featureDialog.open}
        onClose={() => setFeatureDialog((d) => ({ ...d, open: false }))}
        projectId={project.id}
        members={project.members}
        feature={featureDialog.feature}
      />

      <ShareToChannelDialog
        open={share !== null}
        onClose={() => setShare(null)}
        projectId={project.id}
        attachment={share?.attachment ?? null}
        itemName={share?.name ?? ''}
      />
    </div>
  );
}
