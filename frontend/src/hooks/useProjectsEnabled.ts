'use client';

import { useOrg } from './useOrg';

/** Feature switch for Projects in the active workspace (Settings > General). */
export const useProjectsEnabled = () => {
  const { active } = useOrg();
  return Boolean(active?.settings?.projectsEnabled);
};
