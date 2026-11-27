import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../core/auth/auth.service';

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
        <h1>Welcome back</h1>
        <p class="muted">Sign in to manage your restaurant operations.</p>

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <mat-form-field appearance="outline">
            <mat-label>Email address</mat-label>
            <input matInput type="email" autocomplete="username" formControlName="email" />
            @if (form.controls.email.hasError('email')) {
              <mat-error>Enter a valid email address.</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Password</mat-label>
            <input matInput type="password" autocomplete="current-password" formControlName="password" />
            @if (form.controls.password.hasError('minlength')) {
              <mat-error>Password must be at least 12 characters.</mat-error>
            }
          </mat-form-field>
          @if (error()) {
            <p class="form-error" role="alert">{{ error() }}</p>
          }
          <button mat-flat-button color="primary" class="submit-button" [disabled]="form.invalid || busy()">
            {{ busy() ? 'Signing in…' : 'Sign in' }}
          </button>
        </form>
        <p class="login-footnote">Need access? Ask your restaurant administrator.</p>
      </mat-card>
    </main>
  `,
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly busy = signal(false);
  readonly error = signal('');
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(12), Validators.maxLength(128)]],
  });

  submit(): void {
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () => {
        this.busy.set(false);
        void this.router.navigateByUrl('/dashboard');
      },
      error: () => {
        this.busy.set(false);
        this.error.set('Sign-in failed. Check your credentials or contact your administrator.');
      },
    });
  }
}
