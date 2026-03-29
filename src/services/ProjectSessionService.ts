import localforage from 'localforage';
import { ProjectSession, ProjectSessionRecovery } from '../types/projectSession';
import { ProjectMetadataProbe } from '../types/projectAdapter';
import { activateProjectForEditor } from './ProjectLoadService';

const SESSION_KEY = 'project_session';

export const createProjectSession = (input: {
  projectName: string;
  metadata: ProjectMetadataProbe;
  existingProjectId?: string;
}): ProjectSession => {
  const activation = activateProjectForEditor(input.metadata);
  const now = new Date().toISOString();
  const projectId = input.existingProjectId ?? `project-${Date.now()}`;

  return {
    sessionId: `session-${Date.now()}`,
    projectId,
    projectName: input.projectName.trim() || 'Untitled Project',
    profileId: activation.profile.id,
    adapterId: activation.adapter.id,
    runtimeTarget: activation.adapter.runtime,
    bridgeId: activation.bridgeId,
    metadata: input.metadata,
    capabilities: activation.activeCapabilities,
    lastOpenedAt: now,
  };
};

export const persistProjectSession = async (session: ProjectSession): Promise<void> => {
  await localforage.setItem(SESSION_KEY, session);
};

export const clearProjectSession = async (): Promise<void> => {
  await localforage.removeItem(SESSION_KEY);
};

export const loadProjectSession = async (): Promise<ProjectSessionRecovery> => {
  const raw = await localforage.getItem(SESSION_KEY);
  if (!raw) {
    return { session: null, requiresRecovery: false };
  }

  const session = raw as ProjectSession;

  try {
    const activation = activateProjectForEditor({
      ...session.metadata,
      profileHint: session.profileId,
      adapterHint: session.adapterId,
      runtimeHint: session.runtimeTarget,
    });

    const mismatchErrors: string[] = [];
    if (session.profileId !== activation.profile.id) {
      mismatchErrors.push(`profile ${session.profileId} -> ${activation.profile.id}`);
    }
    if (session.adapterId !== activation.adapter.id) {
      mismatchErrors.push(`adapter ${session.adapterId} -> ${activation.adapter.id}`);
    }
    if (session.bridgeId !== activation.bridgeId) {
      mismatchErrors.push(`bridge ${session.bridgeId} -> ${activation.bridgeId}`);
    }

    return {
      session: {
        ...session,
        profileId: activation.profile.id,
        adapterId: activation.adapter.id,
        bridgeId: activation.bridgeId,
        runtimeTarget: activation.adapter.runtime,
        capabilities: activation.activeCapabilities,
        lastOpenedAt: new Date().toISOString(),
      },
      requiresRecovery: mismatchErrors.length > 0,
      recoveryReason: mismatchErrors.length > 0 ? `Session references were remapped (${mismatchErrors.join(', ')})` : undefined,
    };
  } catch (error) {
    return {
      session,
      requiresRecovery: true,
      recoveryReason: error instanceof Error ? error.message : 'Stored project session is invalid.',
    };
  }
};
