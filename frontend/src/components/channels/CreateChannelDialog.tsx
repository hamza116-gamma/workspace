'use client';

import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { ChannelForm } from './ChannelForm';

export const CreateChannelDialog = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const router = useRouter();

  return (
    <Modal open={open} title="Create a channel" onClose={onClose}>
      <ChannelForm
        onCreated={(channel) => {
          onClose();
          router.push(`/channels/${channel.id}`);
        }}
        onCancel={onClose}
      />
    </Modal>
  );
};
