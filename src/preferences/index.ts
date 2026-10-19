// The driver's "open this app automatically next time" choice.
// Stored only in this browser; unticking the box deletes it.

export const APP_KEY = 'gogogo.app.v1';

export class AppPreference {
  constructor(private readonly storage: Storage | null) {}

  get available(): boolean {
    return this.storage !== null;
  }

  get(): string | null {
    try {
      return this.storage?.getItem(APP_KEY) ?? null;
    } catch {
      return null;
    }
  }

  set(appId: string): void {
    this.storage?.setItem(APP_KEY, appId);
  }

  forget(): void {
    this.storage?.removeItem(APP_KEY);
  }
}
