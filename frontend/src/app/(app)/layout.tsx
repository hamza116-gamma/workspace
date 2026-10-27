import { RequireAuth } from '@/components/guards/RequireAuth';
import { OrgProvider } from '@/context/OrgContext';
import { SocketProvider } from '@/context/SocketContext';
import { PresenceProvider } from '@/context/PresenceContext';
import { ChannelsProvider } from '@/context/ChannelsContext';
import { ConversationsProvider } from '@/context/ConversationsContext';
import { ActiveChannelProvider } from '@/context/ActiveChannelContext';
import { ActiveConversationProvider } from '@/context/ActiveConversationContext';
import { PinsProvider } from '@/context/PinsContext';
import { SavedProvider } from '@/context/SavedContext';
import { DraftsProvider } from '@/context/DraftsContext';
import { ScheduledProvider } from '@/context/ScheduledContext';
import { FocusMessageProvider } from '@/context/FocusMessageContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { DownloadProvider } from '@/context/DownloadContext';
import { UnreadProvider } from '@/context/UnreadContext';
import { ThreadProvider } from '@/context/ThreadContext';
import { HuddleProvider } from '@/context/HuddleContext';
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell';
import { QuickSearch } from '@/components/search/QuickSearch';

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <OrgProvider>
        <SocketProvider>
          <PresenceProvider>
            <ChannelsProvider>
              <ConversationsProvider>
                <ActiveChannelProvider>
                  <ActiveConversationProvider>
                    <PinsProvider>
                      <SavedProvider>
                        <DraftsProvider>
                          <ScheduledProvider>
                            <UnreadProvider>
                              <ThreadProvider>
                                <FocusMessageProvider>
                                  <NotificationProvider>
                                    <DownloadProvider>
                                      <HuddleProvider>
                                        <WorkspaceShell>
                                          {children}
                                          <QuickSearch />
                                        </WorkspaceShell>
                                      </HuddleProvider>
                                    </DownloadProvider>
                                  </NotificationProvider>
                                </FocusMessageProvider>
                              </ThreadProvider>
                            </UnreadProvider>
                          </ScheduledProvider>
                        </DraftsProvider>
                      </SavedProvider>
                    </PinsProvider>
                  </ActiveConversationProvider>
                </ActiveChannelProvider>
              </ConversationsProvider>
            </ChannelsProvider>
          </PresenceProvider>
        </SocketProvider>
      </OrgProvider>
    </RequireAuth>
  );
}
