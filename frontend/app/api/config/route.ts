export function GET() {
  return Response.json({
    maxFileSizeBytes: Number(process.env.MAX_FILE_SIZE_BYTES ?? 1073741824),
    chunkSizeBytes: Number(process.env.CHUNK_SIZE_BYTES ?? 5242880),
    replicationFactor: Number(process.env.REPLICATION_FACTOR ?? 3),
  });
}
