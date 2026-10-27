import { ProjectView } from '@/components/projects/ProjectView';

export default async function ProjectPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return <ProjectView projectKey={decodeURIComponent(key)} />;
}
