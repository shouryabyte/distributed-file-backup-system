import { splitChunks, sha256 } from '../src/chunking/chunks.js';

test('splits arbitrary stream boundaries and reconstructs original bytes', async () => {
  const source = Buffer.from('abcdefghijklm');
  const parts = [source.subarray(0, 2), source.subarray(2, 9), source.subarray(9)];
  const chunks: Buffer[] = [];
  for await (const chunk of splitChunks(parts, 5)) chunks.push(chunk);
  expect(chunks.map((c) => c.toString())).toEqual(['abcde', 'fghij', 'klm']);
  expect(Buffer.concat(chunks)).toEqual(source);
});

test('SHA-256 is stable and content based', () => {
  expect(sha256(Buffer.from('abc'))).toBe(
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
  expect(sha256(Buffer.from('abc'))).not.toBe(sha256(Buffer.from('abd')));
});
