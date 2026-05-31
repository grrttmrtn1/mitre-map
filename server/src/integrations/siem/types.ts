export interface SiemConnector {
  testConnection(): Promise<{ ok: boolean; message: string }>;
  pushRule(detection: { id: number; name: string; sigmaYaml: string }): Promise<{ ok: boolean; remoteId?: string; message: string }>;
  pullStatuses(): Promise<Array<{ remote_id: string; enabled: boolean; fire_count?: number }>>;
}
