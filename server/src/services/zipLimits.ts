import JSZip from 'jszip';

/**
 * Zip bomb protection. Limits are checked twice: up-front from the central-directory metadata (cheap),
 * and again while inflating each entry (the metadata is attacker controlled and may lie).
 * `ZIP_LIMITS` is intentionally mutable so tests can use small values.
 */
export const ZIP_LIMITS = {
  maxEntries: 5000,
  maxFileBytes: 25 * 1024 * 1024,
  maxTotalBytes: 200 * 1024 * 1024,
  /** cap for archives downloaded from remote hosts (compressed bytes) */
  maxDownloadBytes: 100 * 1024 * 1024,
};

export class ZipLimitError extends Error {
  status = 413;
  constructor(message: string) {
    super(message);
    this.name = 'ZipLimitError';
  }
}

const mb = (n: number) => `${Math.round((n / (1024 * 1024)) * 10) / 10}MB`;

/** Reject archives whose declared entry count / sizes exceed the limits. */
export function assertZipWithinLimits(zip: JSZip): void {
  const names = Object.keys(zip.files);
  if (names.length > ZIP_LIMITS.maxEntries) {
    throw new ZipLimitError(`ZIP contains too many entries (${names.length}; the limit is ${ZIP_LIMITS.maxEntries}).`);
  }
  let total = 0;
  for (const n of names) {
    const entry: any = zip.files[n];
    if (entry.dir) continue;
    const size = entry?._data?.uncompressedSize;
    if (typeof size !== 'number') continue;
    if (size > ZIP_LIMITS.maxFileBytes) {
      throw new ZipLimitError(`ZIP entry "${n}" is too large when uncompressed (${mb(size)}; the limit is ${mb(ZIP_LIMITS.maxFileBytes)} per file).`);
    }
    total += size;
    if (total > ZIP_LIMITS.maxTotalBytes) {
      throw new ZipLimitError(`ZIP is too large when uncompressed (the limit is ${mb(ZIP_LIMITS.maxTotalBytes)} in total).`);
    }
  }
}

/** JSZip.loadAsync + metadata limit check. Throws ZipLimitError; other errors are JSZip's (corrupt archive). */
export async function loadZip(data: Buffer | ArrayBuffer | Uint8Array): Promise<JSZip> {
  const zip = await JSZip.loadAsync(data as any);
  assertZipWithinLimits(zip);
  return zip;
}

/** Inflate one entry, aborting as soon as more than `maxBytes` have been produced. */
export function readEntryLimited(entry: JSZip.JSZipObject, maxBytes: number): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let settled = false;
    const helper: any = (entry as any).internalStream('uint8array');
    helper
      .on('data', (data: Uint8Array) => {
        if (settled) return;
        total += data.length;
        if (total > maxBytes) {
          settled = true;
          helper.pause();
          reject(new ZipLimitError(`ZIP entry "${entry.name}" exceeds the uncompressed size limit while extracting.`));
          return;
        }
        chunks.push(Buffer.from(data));
      })
      .on('error', (e: Error) => {
        if (settled) return;
        settled = true;
        reject(e);
      })
      .on('end', () => {
        if (settled) return;
        settled = true;
        resolve(Buffer.concat(chunks));
      })
      .resume();
  });
}

/** Reads entries of one archive while tracking the total number of uncompressed bytes produced. */
export class ZipReader {
  private total = 0;
  async read(entry: JSZip.JSZipObject): Promise<Buffer> {
    const budget = Math.min(ZIP_LIMITS.maxFileBytes, ZIP_LIMITS.maxTotalBytes - this.total);
    const buf = await readEntryLimited(entry, budget);
    this.total += buf.length;
    if (this.total > ZIP_LIMITS.maxTotalBytes) {
      throw new ZipLimitError(`ZIP is too large when uncompressed (the limit is ${mb(ZIP_LIMITS.maxTotalBytes)} in total).`);
    }
    return buf;
  }
  async readText(entry: JSZip.JSZipObject): Promise<string> {
    return (await this.read(entry)).toString('utf-8');
  }
}
