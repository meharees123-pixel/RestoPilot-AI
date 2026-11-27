import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storageKey = 'restopilot.theme';
  readonly dark = signal(this.readPreference());

  constructor() {
    this.apply();
  }

  toggle(): void {
    this.dark.update((value) => !value);
    localStorage.setItem(this.storageKey, this.dark() ? 'dark' : 'light');
    this.apply();
  }

  private readPreference(): boolean {
    const preference =
      localStorage.getItem(this.storageKey) ?? localStorage.getItem('foodflow.theme');
    return preference === null ? true : preference === 'dark';
  }

  private apply(): void {
    document.documentElement.classList.toggle('dark-mode', this.dark());
  }
}
