import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { environment } from '../../../environments/environment';

type AdminPage = 'overview' | 'restaurants' | 'users' | 'logs';

interface PlatformOverview {
  restaurants: number;
  activeRestaurants: number;
  users: number;
}

interface RestaurantRow {
  _id: string;
  name: string;
  slug: string;
  status: string;
  subscriptionPlan: string;
  createdAt: string;
}

interface UserRow {
  _id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email?: string;
  role: string;
  status: string;
}

interface AccessAuditRow {
  _id: string;
  userId: string | null;
  restaurantId: string | null;
  role: string | null;
  method: string;
  path: string;
  statusCode: number;
  occurredAt: string;
}

interface CreatedRestaurant {
  restaurant: RestaurantRow;
  owner: UserRow;
}

@Component({
  selector: 'app-platform-admin',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, DatePipe, TitleCasePipe],
  templateUrl: './platform-admin.component.html',
  styleUrl: './platform-admin.component.scss',
})
export class PlatformAdminComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly page = signal<AdminPage>('overview');
  readonly overview = signal<PlatformOverview | null>(null);
  readonly restaurants = signal<RestaurantRow[]>([]);
  readonly users = signal<UserRow[]>([]);
  readonly accessAudits = signal<AccessAuditRow[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly createdOwnerId = signal('');

  readonly restaurantForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    slug: ['', [Validators.required, Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)]],
    restaurantWhatsappNumber: ['', [Validators.required, Validators.pattern(/^\+[1-9]\d{7,14}$/)]],
    ownerFirstName: ['', [Validators.required, Validators.maxLength(80)]],
    ownerLastName: ['', [Validators.required, Validators.maxLength(80)]],
    ownerPhoneNumber: ['', [Validators.required, Validators.pattern(/^\+[1-9]\d{7,14}$/)]],
    ownerEmail: ['', [Validators.email]],
  });

  ngOnInit(): void {
    this.loadOverview();
    this.loadRestaurants();
  }

  openPage(page: AdminPage): void {
    this.page.set(page);
    this.error.set('');
    if (page === 'users' && !this.users().length) this.loadUsers();
    if (page === 'logs' && !this.accessAudits().length) this.loadAccessAudits();
  }

  loadOverview(): void {
    this.http.get<PlatformOverview>(`${environment.apiUrl}/platform/overview`).subscribe({
      next: (result) => {
        this.overview.set(result);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load platform overview.');
        this.loading.set(false);
      },
    });
  }

  loadRestaurants(): void {
    this.http.get<RestaurantRow[]>(`${environment.apiUrl}/platform/restaurants`).subscribe({
      next: (result) => this.restaurants.set(result),
      error: () => this.error.set('Could not load restaurants.'),
    });
  }

  loadUsers(): void {
    this.http.get<UserRow[]>(`${environment.apiUrl}/platform/users`).subscribe({
      next: (result) => this.users.set(result),
      error: () => this.error.set('Could not load platform users.'),
    });
  }

  loadAccessAudits(): void {
    this.http.get<AccessAuditRow[]>(`${environment.apiUrl}/platform/access-audits`).subscribe({
      next: (result) => this.accessAudits.set(result),
      error: () => this.error.set('Could not load access audit logs.'),
    });
  }

  createRestaurant(): void {
    if (this.restaurantForm.invalid || this.busy()) {
      this.restaurantForm.markAllAsTouched();
      return;
    }

    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    const formValue = this.restaurantForm.getRawValue();
    const payload = {
      ...formValue,
      ownerEmail: formValue.ownerEmail.trim() || undefined,
    };
    this.http
      .post<CreatedRestaurant>(
        `${environment.apiUrl}/platform/restaurants`,
        payload,
      )
      .subscribe({
        next: (created) => {
          this.createdOwnerId.set(created.owner._id);
          this.busy.set(false);
          this.restaurantForm.reset();
          this.loadRestaurants();
          this.loadUsers();
          this.sendInvitation(created.owner._id);
        },
        error: () => {
          this.busy.set(false);
          this.error.set('Restaurant setup failed. Check that the slug and owner phone are unique.');
        },
      });
  }

  sendInvitation(userId: string): void {
    this.busy.set(true);
    this.error.set('');
    this.http.post<{ message: string }>(`${environment.apiUrl}/platform/users/${userId}/invite`, {}).subscribe({
      next: () => {
        this.notice.set('Restaurant and owner created. The WhatsApp invitation has been sent.');
        this.createdOwnerId.set('');
        this.busy.set(false);
      },
      error: () => {
        this.error.set('The restaurant was created, but WhatsApp delivery failed. Check WhatsApp setup and retry.');
        this.busy.set(false);
      },
    });
  }

  logout(): void {
    this.auth.logout().subscribe({
      next: () => void this.router.navigateByUrl('/login'),
      error: () => void this.router.navigateByUrl('/login'),
    });
  }
}
