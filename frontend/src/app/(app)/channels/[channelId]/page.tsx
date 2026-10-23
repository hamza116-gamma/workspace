import { ChannelWorkspace } from '@/components/conversation/ChannelWorkspace';

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = await params;
  return <ChannelWorkspace channelId={channelId} />;
}
