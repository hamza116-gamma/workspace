'use client';

import { useCallback, useEffect, useState } from 'react';
import { listProjects } from '@/lib/projects';
import { useOrg } from './useOrg';
import { useSocket } from './useSocket';
import { useProjectsEnabled } from './useProjectsEnabled';
import type { Project } from '@/types/project';

/** Projects the viewer can see; refreshes live on "project.changed". */
export const useProjects = ({ archived = false }: { archived?: boolean } = {}) => {
  const enabled = useProjectsEnabled();
  const { active } = useOrg();
  const { socket } = useSocket();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!enabled) {
      setProjects([]);
      setLoading(false);
      return;
    }
    listProjects(archived).then(
      (result) => {
        setProjects(result.projects);
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [enabled, archived]);

  useEffect(() => {
    load();
  }, [load, active?.id]);

  useEffect(() => {
    if (!socket || !enabled) {
      return;
    }
    socket.on('project.changed', load);
    return () => {
      socket.off('project.changed', load);
    };
  }, [socket, enabled, load]);

  return { projects, loading, reload: load };
};
