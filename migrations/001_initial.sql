CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  file_name text NOT NULL,
  file_size bigint NOT NULL CHECK(file_size >= 0),
  total_chunks integer NOT NULL CHECK(total_chunks >= 0),
  status text NOT NULL CHECK(status IN ('READY','FAILED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS files_user_id_idx ON files(user_id);
CREATE TABLE IF NOT EXISTS chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hash char(64) NOT NULL UNIQUE,
  size integer NOT NULL CHECK(size >= 0),
  reference_count bigint NOT NULL DEFAULT 0 CHECK(reference_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS file_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  chunk_id uuid NOT NULL REFERENCES chunks(id),
  sequence_number integer NOT NULL CHECK(sequence_number >= 1),
  UNIQUE(file_id, sequence_number)
);
CREATE INDEX IF NOT EXISTS file_chunks_file_id_idx ON file_chunks(file_id);
CREATE TABLE IF NOT EXISTS storage_nodes (
  id text PRIMARY KEY,
  url text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  healthy boolean NOT NULL DEFAULT true,
  checked_at timestamptz
);
CREATE TABLE IF NOT EXISTS chunk_replicas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id uuid NOT NULL REFERENCES chunks(id),
  node_id text NOT NULL REFERENCES storage_nodes(id),
  status text NOT NULL CHECK(status IN ('ACTIVE','CREATING','FAILED','CORRUPTED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(chunk_id,node_id)
);
CREATE INDEX IF NOT EXISTS chunk_replicas_chunk_id_idx ON chunk_replicas(chunk_id);
CREATE TABLE IF NOT EXISTS upload_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  file_name text NOT NULL,
  file_size bigint NOT NULL CHECK(file_size >= 0),
  total_chunks integer NOT NULL CHECK(total_chunks >= 0),
  status text NOT NULL CHECK(status IN ('OPEN','COMPLETED','FAILED')),
  file_id uuid REFERENCES files(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS upload_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id uuid NOT NULL REFERENCES upload_sessions(id) ON DELETE CASCADE,
  sequence_number integer NOT NULL CHECK(sequence_number >= 1),
  chunk_hash char(64) NOT NULL REFERENCES chunks(hash),
  size integer NOT NULL CHECK(size >= 0),
  status text NOT NULL CHECK(status IN ('UPLOADED')),
  UNIQUE(upload_id,sequence_number)
);
CREATE INDEX IF NOT EXISTS upload_chunks_upload_id_idx ON upload_chunks(upload_id);
CREATE TABLE IF NOT EXISTS outbox (
  id bigserial PRIMARY KEY,
  topic text NOT NULL,
  event_key text NOT NULL,
  payload jsonb NOT NULL,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS outbox_pending_idx ON outbox(id) WHERE sent_at IS NULL;
