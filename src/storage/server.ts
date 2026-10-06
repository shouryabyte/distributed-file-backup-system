import { createStorageNode } from './nodeServer.js';
const port = Number(process.env.PORT ?? 3100);
const dataDir = process.env.DATA_DIR ?? '/data';
const token = process.env.INTERNAL_TOKEN;
if (!token || token.length < 16) throw new Error('INTERNAL_TOKEN must be configured');
createStorageNode(dataDir, token, Number(process.env.CHUNK_SIZE_BYTES ?? 5242880)).listen(port);
