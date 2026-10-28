import { ProjectView } from '@/components/projects/ProjectView';
import { UnassignedView } from '@/components/projects/UnassignedView';
import { UNASSIGNED_KEY } from '@/types/project';

export default async function ProjectPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const projectKey = decodeURIComponent(key);
  // TASK is the built-in "Unassigned" board, not a project.
  return projectKey.toUpperCase() === UNASSIGNED_KEY ? (
    <UnassignedView />
  ) : (
    <ProjectView projectKey={projectKey} />
  );
}
