import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export type UserRole =
  | 'SUPER_ADMIN'
  | 'RESTAURANT_OWNER'
  | 'RESTAURANT_MANAGER'
  | 'BRANCH_MANAGER';

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string | null;
  role: UserRole;
  restaurantId: string | null;
  branchIds: string[];
}

interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly access = signal<string | null>(null);
  readonly accessToken = this.access.asReadonly();
  private readonly currentUser = signal<AuthUser | null>(null);
  readonly user = this.currentUser.asReadonly();
  private readonly refreshStorageKey = 'foodflow.refresh';
  private refreshInFlight: Observable<boolean> | null = null;

  loginSuperAdmin(email: string, password: string, mfaCode: string): Observable<void> {
    return this.http
      .post<SessionTokens>(`${environment.apiUrl}/auth/login`, { email, password, mfaCode })
      .pipe(tap((tokens) => this.store(tokens)), map(() => undefined));
  }

  requestOtp(phoneNumber: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${environment.apiUrl}/auth/request-otp`, {
      phoneNumber,
    });
  }

  verifyOtp(phoneNumber: string, otp: string): Observable<void> {
    return this.http
      .post<SessionTokens>(`${environment.apiUrl}/auth/verify-otp`, { phoneNumber, otp })
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
      .post<SessionTokens>(`${environment.apiUrl}/auth/refresh`, { refreshToken })
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
    this.currentUser.set(null);
    sessionStorage.removeItem(this.refreshStorageKey);
  }

  private store(tokens: SessionTokens): void {
    this.access.set(tokens.accessToken);
    this.currentUser.set(tokens.user);
    sessionStorage.setItem(this.refreshStorageKey, tokens.refreshToken);
  }
}
