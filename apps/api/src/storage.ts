import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import type { Config } from './config'

export interface PdfStorage {
  /** Persist bytes at a logical key (e.g. 'cases/<id>.pdf'). Returns the key. */
  put(key: string, bytes: Uint8Array): Promise<string>
  /** Read bytes back; null if absent. */
  get(key: string): Promise<Uint8Array | null>
}

/** Filesystem-backed storage for local dev/tests; the API streams it back. */
export class LocalPdfStorage implements PdfStorage {
  private readonly root: string

  constructor(root: string) {
    this.root = root
  }

  async put(key: string, bytes: Uint8Array): Promise<string> {
    const full = join(resolve(this.root), key)
    await mkdir(dirname(full), { recursive: true })
    await writeFile(full, bytes)
    return key
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      return await readFile(join(resolve(this.root), key))
    } catch {
      return null
    }
  }
}

export function createStorage(config: Config): PdfStorage {
  // Production swaps in a SupabaseStorage (S3-compatible) implementing this same
  // interface — put() uploads to the bucket, get() downloads (or the route could
  // redirect to a signed URL). Kept out of the minimal spine until a Supabase
  // project exists; LocalPdfStorage satisfies the DoD ("PDF served from storage").
  return new LocalPdfStorage(config.storageDir)
}
