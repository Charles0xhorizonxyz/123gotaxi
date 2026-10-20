// This phone's navigation app, and whether a scanned QR opens it directly.
// Stored only in this browser; choosing "Ask every time" deletes it.

export const APP_KEY = 'gogogo.app.v1';
/** "0" means: show the app list even when an app is chosen. Absent means open directly. */
export const DIRECT_KEY = 'gogogo.app.direct.v1';

export class AppPreference {
  constructor(private readonly storage: Storage | null) {}

  get available(): boolean {
    return this.storage !== null;
  }

  get(): string | null {
    return this.read(APP_KEY);
  }

  set(appId: string): void {
    this.storage?.setItem(APP_KEY, appId);
  }

  forget(): void {
    this.storage?.removeItem(APP_KEY);
  }

  /** Open the chosen app straight away when a QR is scanned. On unless turned off. */
  get direct(): boolean {
    return this.read(DIRECT_KEY) !== '0';
  }

  setDirect(direct: boolean): void {
    if (direct) this.storage?.removeItem(DIRECT_KEY);
    else this.storage?.setItem(DIRECT_KEY, '0');
  }

  private read(key: string): string | null {
    try {
      return this.storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
}
