import { EditorCapabilityFlags, ProjectMetadataProbe, RuntimeType } from './projectAdapter';

export interface ProjectSession {
  sessionId: string;
  projectId: string;
  projectName: string;
  profileId: string;
  adapterId: string;
  runtimeTarget: RuntimeType;
  bridgeId: string;
  metadata: ProjectMetadataProbe;
  capabilities: EditorCapabilityFlags;
  sceneVersionId?: string;
  lastOpenedAt: string;
}

export interface ProjectSessionRecovery {
  session: ProjectSession | null;
  requiresRecovery: boolean;
  recoveryReason?: string;
}
