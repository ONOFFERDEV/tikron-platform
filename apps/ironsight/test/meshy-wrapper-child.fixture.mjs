import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const index = process.argv.indexOf('--result');
if (index < 0 || !process.argv[index + 1]) process.exit(2);
const received = process.env.MESHY_API_KEY === 'synthetic-wrapper-secret' && process.env.MESHY_CREDENTIAL_SOURCE === 'ironsight-meshy-fixture';
await writeFile(resolve(process.argv[index + 1]), JSON.stringify({ trustedChildRan: true, receivedSyntheticCredential: received }));
if (process.argv.includes('--fail')) process.exit(7);
