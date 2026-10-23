import type { User } from './user';

export type AuditTarget = { type: string | null; id: string | null; label: string };

export type AuditEntry = {
  id: string;
  action: string;
  actor: User | null;
  target: AuditTarget | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type AuditPage = { entries: AuditEntry[]; hasMore: boolean; nextCursor: string | null };
