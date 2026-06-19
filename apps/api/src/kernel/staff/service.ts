import type { PdfStorage } from '../../storage'
import { ONBOARDING_PACKAGE } from '../documents'
import type { StaffCaseFilter, StaffStore } from './store'

/** Read-only staff operations over any case. Mirrors CaseService's PDF path but
 *  cross-owner via the StaffStore's `withStaffScope`. */
export class StaffService {
  private readonly store: StaffStore
  private readonly storage: PdfStorage

  constructor(store: StaffStore, storage: PdfStorage) {
    this.store = store
    this.storage = storage
  }

  listCases(userId: string, filter: StaffCaseFilter) {
    return this.store.list(userId, filter)
  }

  getCase(userId: string, id: string) {
    return this.store.get(userId, id)
  }

  async getPdf(userId: string, id: string): Promise<Uint8Array | null> {
    const doc = await this.store.findDocument(userId, id, ONBOARDING_PACKAGE)
    if (!doc) return null
    return this.storage.get(doc.storageKey)
  }

  async getPdfSignedUrl(userId: string, id: string, expiresInSeconds: number): Promise<string | null> {
    const doc = await this.store.findDocument(userId, id, ONBOARDING_PACKAGE)
    if (!doc || !this.storage.signedUrl) return null
    return this.storage.signedUrl(doc.storageKey, expiresInSeconds)
  }
}
