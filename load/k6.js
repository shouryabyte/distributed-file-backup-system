import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = { vus: 5, duration: '30s', thresholds: { http_req_failed: ['rate<0.05'] } };
const base = __ENV.API_URL || 'http://localhost:3000';
const token = __ENV.TOKEN;
const payload = open('./fixtures/load.bin', 'b');

export default function () {
  if (!token) throw new Error('TOKEN environment variable is required');
  const headers = { Authorization: `Bearer ${token}` };
  const list = http.get(`${base}/api/files`, { headers });
  check(list, { 'list succeeds': (r) => r.status === 200 });
  const upload = http.post(`${base}/api/files/upload`, payload, {
    headers: { ...headers, 'Content-Type': 'application/octet-stream', 'x-file-name': 'load.bin' },
  });
  check(upload, { 'upload succeeds': (r) => r.status === 201 });
  if (upload.status === 201) {
    const id = upload.json('fileId');
    const download = http.get(`${base}/api/files/${id}/download`, { headers });
    check(download, { 'download succeeds': (r) => r.status === 200 });
    http.del(`${base}/api/files/${id}`, null, { headers });
  }
  sleep(1);
}
