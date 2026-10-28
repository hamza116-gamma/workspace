import { apiData } from './api';
import type { Milestone, Project, ProjectInput } from '@/types/project';
import type { Task, TaskInput } from '@/types/task';

export const listProjects = (archived = false) =>
  apiData<{ projects: Project[] }>(`/projects${archived ? '?archived=true' : ''}`);

// Accepts a former key too; `renamed` tells the page to switch to the new one.
export const getProject = (key: string) =>
  apiData<{ project: Project; renamed: boolean }>(`/projects/${encodeURIComponent(key)}`);

export const createProject = (body: ProjectInput) =>
  apiData<{ project: Project; adopted: number }>('/projects', { method: 'POST', body });

export const updateProject = (key: string, body: ProjectInput) =>
  apiData<{ project: Project }>(`/projects/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    body,
  });

export const archiveProject = (key: string) =>
  apiData<{ project: Project }>(`/projects/${encodeURIComponent(key)}/archive`, {
    method: 'POST',
  });

export const restoreProject = (key: string) =>
  apiData<{ project: Project }>(`/projects/${encodeURIComponent(key)}/restore`, {
    method: 'POST',
  });

export const deleteProject = (key: string, confirmKey: string) =>
  apiData<{ id: string; released: number; deleted: number }>(`/projects/${encodeURIComponent(key)}`, {
    method: 'DELETE',
    body: { confirmKey },
  });

export const listProjectTasks = (key: string) =>
  apiData<{ tasks: Task[] }>(`/projects/${encodeURIComponent(key)}/tasks`);

// WEB-12, an old TASK-n, or a pre-rename key.
export const getTaskByKey = (key: string) =>
  apiData<{ task: Task }>(`/tasks/by-key/${encodeURIComponent(key)}`);

// A ticket created on the project board (works with or without a channel).
export const createProjectTask = (key: string, body: TaskInput) =>
  apiData<{ task: Task }>(`/projects/${encodeURIComponent(key)}/tasks`, { method: 'POST', body });

const milestonesUrl = (key: string) => `/projects/${encodeURIComponent(key)}/milestones`;

export const listMilestones = (key: string) =>
  apiData<{ milestones: Milestone[] }>(milestonesUrl(key));

export const createMilestone = (key: string, body: { name: string; dueDate?: string | null }) =>
  apiData<{ milestone: Milestone }>(milestonesUrl(key), { method: 'POST', body });

export const updateMilestone = (
  key: string,
  id: string,
  body: Partial<Pick<Milestone, 'name' | 'dueDate' | 'status'>>,
) => apiData<{ milestone: Milestone }>(`${milestonesUrl(key)}/${id}`, { method: 'PATCH', body });

export const deleteMilestone = (key: string, id: string) =>
  apiData<{ id: string }>(`${milestonesUrl(key)}/${id}`, { method: 'DELETE' });
