export interface User {
  id: string;
  email: string;
  createdAt?: string;
}

export interface FileRecord {
  id: string;
  user_id: string;
  file_name: string;
  file_size: string;
  total_chunks: number;
  status: string;
  created_at: string;
}

export interface ChunkReplica {
  nodeId: string;
  status: string;
  enabled: boolean;
  healthy: boolean;
}

export interface FileChunk {
  sequenceNumber: number;
  hash: string;
  size: number;
  replicas: ChunkReplica[];
}

export interface StorageNode {
  id: string;
  url: string;
  enabled: boolean;
  healthy: boolean;
}

export interface InspectedReplica {
  node_id: string;
  status: string;
  enabled: boolean;
  healthy: boolean;
}

export interface InspectedChunk {
  id: string;
  hash: string;
  size: number;
  reference_count: string;
  replicas: InspectedReplica[];
}

export interface UploadResult {
  fileId: string;
}

export interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}
