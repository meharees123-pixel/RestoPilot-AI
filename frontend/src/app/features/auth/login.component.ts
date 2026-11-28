import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../core/auth/auth.service';

type LoginMode = 'restaurant' | 'admin';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <main class="login-shell">
      <mat-card class="login-card">
        <div class="brand-mark" aria-hidden="true">R</div>
        <p class="eyebrow">RESTOPILOT AI</p>
        <h1>{{ mode() === 'restaurant' ? 'Your restaurant, at hand' : 'Platform administration' }}</h1>
        <p class="muted">
          {{
            mode() === 'restaurant'
              ? 'Sign in securely with a WhatsApp verification code.'
              : 'Super administrators sign in with password and MFA.'
          }}
        </p>

        <div class="login-mode-switch" role="group" aria-label="Choose sign-in type">
          <button type="button" [class.selected]="mode() === 'restaurant'" (click)="setMode('restaurant')">
            Restaurant
          </button>
          <button type="button" [class.selected]="mode() === 'admin'" (click)="setMode('admin')">
            Platform admin
          </button>
        </div>

        @if (mode() === 'restaurant') {
          @if (!otpRequested()) {
            <form [formGroup]="form" (ngSubmit)="requestCode()" novalidate>
              <mat-form-field appearance="outline">
                <mat-label>WhatsApp phone number</mat-label>
                <input
                  matInput
                  type="tel"
                  autocomplete="tel"
                  placeholder="+97455112233"
                  formControlName="phoneNumber"
                />
                @if (form.controls.phoneNumber.hasError('pattern')) {
                  <mat-error>Enter the number in international format, e.g. +97455112233.</mat-error>
                }
              </mat-form-field>
              @if (error()) {
                <p class="form-error" role="alert">{{ error() }}</p>
              }
              <button
                mat-flat-button
                color="primary"
                class="submit-button"
                type="submit"
                [disabled]="form.controls.phoneNumber.invalid || busy()"
              >
                {{ busy() ? 'Sending code…' : 'Send WhatsApp code' }}
              </button>
            </form>
          } @else {
            <form [formGroup]="form" (ngSubmit)="verifyCode()" novalidate>
              <p class="otp-notice" role="status">Enter the 6-digit code sent to {{ form.controls.phoneNumber.value }}.</p>
              <mat-form-field appearance="outline">
                <mat-label>Verification code</mat-label>
                <input
                  matInput
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  maxlength="6"
                  formControlName="otp"
                />
                @if (form.controls.otp.hasError('pattern')) {
                  <mat-error>Enter the 6-digit code.</mat-error>
                }
              </mat-form-field>
              @if (error()) {
                <p class="form-error" role="alert">{{ error() }}</p>
              }
              <button
                mat-flat-button
                color="primary"
                class="submit-button"
                type="submit"
                [disabled]="form.controls.otp.invalid || busy()"
              >
                {{ busy() ? 'Verifying…' : 'Verify and sign in' }}
              </button>
              <button type="button" class="text-button" [disabled]="busy()" (click)="requestCode()">
                Resend WhatsApp code
              </button>
              <button type="button" class="text-button" (click)="changePhone()">Use a different number</button>
            </form>
          }
        } @else {
          <form [formGroup]="form" (ngSubmit)="submitAdmin()" novalidate>
            <mat-form-field appearance="outline">
              <mat-label>Administrator email</mat-label>
              <input matInput type="email" autocomplete="username" formControlName="email" />
              @if (form.controls.email.hasError('email')) {
                <mat-error>Enter a valid email address.</mat-error>
              }
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Password</mat-label>
              <input
                matInput
                type="password"
                autocomplete="current-password"
                formControlName="password"
              />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Authenticator code</mat-label>
              <input
                matInput
                inputmode="numeric"
                autocomplete="one-time-code"
                maxlength="6"
                formControlName="mfaCode"
              />
            </mat-form-field>
            @if (error()) {
              <p class="form-error" role="alert">{{ error() }}</p>
            }
            <button
              mat-flat-button
              color="primary"
              class="submit-button"
              type="submit"
              [disabled]="adminFormInvalid() || busy()"
            >
              {{ busy() ? 'Signing in…' : 'Sign in securely' }}
            </button>
          </form>
        }
        <p class="login-footnote">
          Restaurant access is invitation-only. Contact your platform administrator if you need access.
        </p>
      </mat-card>
    </main>
  `,
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly mode = signal<LoginMode>('restaurant');
  readonly otpRequested = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly form = this.fb.nonNullable.group({
    phoneNumber: ['', [Validators.required, Validators.pattern(/^\+[1-9]\d{7,14}$/)]],
    otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(12), Validators.maxLength(128)]],
    mfaCode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  adminFormInvalid(): boolean {
    return (
      this.form.controls.email.invalid ||
      this.form.controls.password.invalid ||
      this.form.controls.mfaCode.invalid
    );
  }

  setMode(mode: LoginMode): void {
    this.mode.set(mode);
    this.error.set('');
  }

  requestCode(): void {
    const phoneNumber = this.form.controls.phoneNumber;
    phoneNumber.markAsTouched();
    if (phoneNumber.invalid || this.busy()) return;

    this.busy.set(true);
    this.error.set('');
    this.auth.requestOtp(phoneNumber.value).subscribe({
      next: () => {
        this.busy.set(false);
        this.otpRequested.set(true);
      },
      error: (error: unknown) => this.handleError(error, 'Could not send a code. Try again shortly.'),
    });
  }

  verifyCode(): void {
    const { phoneNumber, otp } = this.form.getRawValue();
    if (this.form.controls.otp.invalid || this.busy()) return;

    this.busy.set(true);
    this.error.set('');
    this.auth.verifyOtp(phoneNumber, otp).subscribe({
      next: () => this.openPortal(),
      error: (error: unknown) => this.handleError(error, 'The code is invalid or has expired.'),
    });
  }

  submitAdmin(): void {
    if (this.adminFormInvalid() || this.busy()) return;

    const { email, password, mfaCode } = this.form.getRawValue();
    this.busy.set(true);
    this.error.set('');
    this.auth.loginSuperAdmin(email, password, mfaCode).subscribe({
      next: () => this.openPortal(),
      error: (error: unknown) => this.handleError(error, 'Sign-in failed. Check your credentials and MFA code.'),
    });
  }

  changePhone(): void {
    this.otpRequested.set(false);
    this.form.controls.otp.reset('');
    this.error.set('');
  }

  private openPortal(): void {
    this.busy.set(false);
    const destination = this.auth.user()?.role === 'SUPER_ADMIN' ? '/admin' : '/dashboard';
    void this.router.navigateByUrl(destination);
  }

  private handleError(error: unknown, fallback: string): void {
    this.busy.set(false);
    this.error.set(error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
      ? error.error.message
      : fallback);
  }
}
