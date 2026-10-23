import { DirectMessageWorkspace } from '@/components/conversation/DirectMessageWorkspace';

export default async function DirectMessagePage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  return <DirectMessageWorkspace conversationId={conversationId} />;
}
