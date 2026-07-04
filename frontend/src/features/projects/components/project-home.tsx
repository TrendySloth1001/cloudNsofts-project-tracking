'use client';

import { useState } from 'react';
import {
  TASK_PRIORITY_LABELS,
  taskPrioritySchema,
  type Project,
  type Task,
  type TaskStatus,
} from '@cnsofts/shared';
import { Button, Input, Select, Tabs } from '@/components/ui';
import { ProjectPeople } from './project-people';
import { TaskBoard } from './task-board';
import { TaskList } from './task-list';
import { TaskDialog } from './task-dialog';
import { TaskDetailDialog } from './task-detail-dialog';
import styles from './project-home.module.css';

export interface ProjectHomeProps {
  project: Project;
  peopleOpen: boolean;
}

export function ProjectHome({ project, peopleOpen }: ProjectHomeProps) {
  const [taskView, setTaskView] = useState<'board' | 'list'>('board');
  const [taskDialog, setTaskDialog] = useState<{
    open: boolean;
    taskId: string | null;
    status: TaskStatus;
  }>({ open: false, taskId: null, status: 'todo' });
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
          ? t.assigneeId === null
          : t.assigneeId === assigneeFilter;
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
        />
      )}

      <div className={styles.tasksToolbar}>
        <Tabs
          variant="pill"
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
        <span className={styles.spacer} />
        <Button leftIcon="add" onClick={() => openNewTask('todo')}>
          New task
        </Button>
      </div>

      {taskView === 'board' ? (
        <TaskBoard
          tasks={filteredTasks}
          members={project.members}
          projectId={project.id}
          onOpenTask={openTaskDetail}
        />
      ) : (
        <TaskList
          tasks={filteredTasks}
          members={project.members}
          projectId={project.id}
          onOpenTask={openTaskDetail}
        />
      )}

      <TaskDetailDialog
        open={detailTaskId !== null}
        onClose={() => setDetailTaskId(null)}
        projectId={project.id}
        task={detailTask}
        members={project.members}
        onEdit={editFromDetail}
      />

      <TaskDialog
        open={taskDialog.open}
        onClose={closeTaskDialog}
        projectId={project.id}
        members={project.members}
        defaultStatus={taskDialog.status}
        task={dialogTask}
      />
    </div>
  );
}
