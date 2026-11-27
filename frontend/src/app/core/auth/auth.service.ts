import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly access = signal<string | null>(null);
  readonly accessToken = this.access.asReadonly();
  private readonly refreshStorageKey = 'foodflow.refresh';
  private refreshInFlight: Observable<boolean> | null = null;

  login(email: string, password: string): Observable<void> {
    return this.http
      .post<TokenPair>(`${environment.apiUrl}/auth/login`, { email, password })
      .pipe(tap((tokens) => this.store(tokens)), map(() => undefined));
  }

  restoreSession(): Observable<boolean> {
    if (this.access()) return of(true);
    return this.refreshAccess();
  }

  refreshAccess(): Observable<boolean> {
    if (this.refreshInFlight) return this.refreshInFlight;
    const refreshToken = sessionStorage.getItem(this.refreshStorageKey);
    if (!refreshToken) return of(false);

    this.refreshInFlight = this.http
      .post<TokenPair>(`${environment.apiUrl}/auth/refresh`, { refreshToken })
      .pipe(
        tap((tokens) => this.store(tokens)),
        map(() => true),
        catchError((error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 401) this.clear();
          return of(false);
        }),
        finalize(() => (this.refreshInFlight = null)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.refreshInFlight;
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/auth/logout`, {}).pipe(
      tap(() => this.clear()),
      catchError((error: unknown) => {
        this.clear();
        return throwError(() => error);
      }),
    );
  }

  clear(): void {
    this.access.set(null);
    sessionStorage.removeItem(this.refreshStorageKey);
  }

  private store(tokens: TokenPair): void {
    this.access.set(tokens.accessToken);
    sessionStorage.setItem(this.refreshStorageKey, tokens.refreshToken);
  }
}
