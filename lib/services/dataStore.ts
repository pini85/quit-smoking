import type { Repositories, Snapshot } from '@/lib/persistence/repositories';
import type {
  AchievementUnlock,
  CravingSession,
  PersonalReason,
  Preferences,
  QuitProfile,
} from '@/domain/types';

/**
 * Framework-agnostic reactive wrapper around {@link Repositories}. This is
 * the ONLY piece of stateful glue between IndexedDB and the UI: it holds a
 * single cached snapshot, notifies subscribers when it changes, and exposes
 * write-through methods that persist then re-read so the cache is always a
 * faithful mirror of what's on disk.
 *
 * Deliberately has no React import — testable in plain node with
 * fake-indexeddb, no DOM/React required. `lib/hooks/useAppData.ts` is the
 * thin `useSyncExternalStore` adapter on top of this.
 */
export interface AppData extends Snapshot {
  status: 'loading' | 'ready';
}

function initialSnapshot(): AppData {
  return {
    status: 'loading',
    profile: null,
    cravings: [],
    achievementUnlocks: [],
    reasons: [],
    preferences: null,
  };
}

export class DataStore {
  private snapshot: AppData = initialSnapshot();
  private readonly listeners = new Set<() => void>();
  // Monotonic sequence number guarding against out-of-order resolution of
  // concurrent readSnapshot() calls: two write-throughs firing close
  // together each kick off their own readAndPublish(), and IndexedDB gives
  // no ordering guarantee on which finishes first. Without this guard, an
  // older read that happens to settle last would silently overwrite a
  // newer one with stale data. Each call captures its own ticket; if the
  // sequence has moved on by the time it resolves, its result is discarded.
  private seq = 0;

  constructor(private readonly repos: Repositories) {}

  /**
   * Cached, stable-by-reference until the next `load()`/`refresh()`/write —
   * required by the `useSyncExternalStore` contract (React compares
   * `getSnapshot()` results with `Object.is` to decide whether to re-render).
   */
  getSnapshot(): AppData {
    return this.snapshot;
  }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private async readAndPublish(): Promise<void> {
    const mine = ++this.seq;
    const snap = await this.repos.readSnapshot();
    // A newer readAndPublish() call started after this one and will publish
    // its own (newer) result — discard this now-stale result rather than
    // clobber whatever it (or something even newer still) installs.
    if (mine !== this.seq) return;
    // `snap` spread first, `status` after: a future `Snapshot` field can
    // never clobber `status`, and `status` can never be clobbered by one.
    this.snapshot = { ...snap, status: 'ready' };
    this.notify();
  }

  async load(): Promise<void> {
    await this.readAndPublish();
  }

  /** Re-read from persistence and notify. Call after any external write. */
  async refresh(): Promise<void> {
    await this.readAndPublish();
  }

  // Convenience write-throughs: persist, then refresh (simple + always
  // consistent — per-store patching of the cached snapshot is premature
  // optimization the brief explicitly rules out).

  async saveProfile(p: QuitProfile): Promise<void> {
    await this.repos.profile.save(p);
    await this.refresh();
  }

  async savePreferences(p: Preferences): Promise<void> {
    await this.repos.preferences.save(p);
    await this.refresh();
  }

  async addCraving(s: CravingSession): Promise<void> {
    await this.repos.cravings.add(s);
    await this.refresh();
  }

  async updateCraving(s: CravingSession): Promise<void> {
    await this.repos.cravings.update(s);
    await this.refresh();
  }

  async addReason(r: PersonalReason): Promise<void> {
    await this.repos.reasons.add(r);
    await this.refresh();
  }

  async updateReason(r: PersonalReason): Promise<void> {
    await this.repos.reasons.update(r);
    await this.refresh();
  }

  async removeReason(id: string): Promise<void> {
    await this.repos.reasons.remove(id);
    await this.refresh();
  }

  async addUnlocks(u: AchievementUnlock[]): Promise<void> {
    await this.repos.achievements.addUnlocks(u);
    await this.refresh();
  }
}
