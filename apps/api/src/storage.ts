import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Config } from './config'

export interface PdfStorage {
  /** Persist bytes at a logical key (e.g. 'cases/<id>.pdf'). Returns the key. */
  put(key: string, bytes: Uint8Array): Promise<string>
  /** Read bytes back; null if absent. */
  get(key: string): Promise<Uint8Array | null>
  /**
   * Optional: a short-lived URL to the object, if the backend can mint one.
   * Backends that can't (e.g. local filesystem) omit this; callers fall back to get().
   */
  signedUrl?(key: string, expiresInSeconds: number): Promise<string | null>
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

/**
 * Supabase Storage (S3-compatible) for production. Authenticates with the
 * service-role key, which is held SERVER-SIDE ONLY — the browser never receives
 * Supabase credentials (invariant 4). PDFs live in a private bucket; the API
 * either streams them (get) or mints a short-lived signed URL (signedUrl).
 */
export class SupabaseStorage implements PdfStorage {
  private readonly client: SupabaseClient
  private readonly bucket: string

  constructor(url: string, serviceRoleKey: string, bucket: string) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    this.bucket = bucket
  }

  async put(key: string, bytes: Uint8Array): Promise<string> {
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(key, Buffer.from(bytes), { contentType: 'application/pdf', upsert: true })
    if (error) throw error
    return key
  }

  async get(key: string): Promise<Uint8Array | null> {
    const { data, error } = await this.client.storage.from(this.bucket).download(key)
    if (error || !data) return null
    return new Uint8Array(await data.arrayBuffer())
  }

  async signedUrl(key: string, expiresInSeconds: number): Promise<string | null> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(key, expiresInSeconds)
    if (error || !data) return null
    return data.signedUrl
  }
}

/**
 * Supabase env present -> SupabaseStorage (production object storage).
 * Otherwise -> LocalPdfStorage (zero-config local dev/tests).
 */
export function createStorage(config: Config): PdfStorage {
  if (config.supabaseUrl && config.supabaseServiceRoleKey && config.supabaseBucket) {
    return new SupabaseStorage(
      config.supabaseUrl,
      config.supabaseServiceRoleKey,
      config.supabaseBucket,
    )
  }
  return new LocalPdfStorage(config.storageDir)
}
