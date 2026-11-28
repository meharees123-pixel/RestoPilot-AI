import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/theme.service';
import { environment } from '../../../environments/environment';

interface BranchSummary {
  _id: string;
  name: string;
  status: string;
}

interface MenuItemSummary {
  _id: string;
  name: string;
  price: string;
  isAvailable: boolean;
}

interface OrderSummary {
  _id: string;
  orderNumber: string;
  status: string;
  grandTotal: string;
  createdAt: string;
}

interface CustomerSummary {
  _id: string;
  name: string;
  whatsappNumber: string;
  totalOrders: number;
  lastOrderDate?: string;
}

interface ActivityItem {
  orderNumber: string;
  status: string;
  time: string;
}

type WorkspacePage = 'overview' | 'orders' | 'customers' | 'menu';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, TitleCasePipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly theme = inject(ThemeService);
  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  readonly selectedPage = computed<WorkspacePage>(() => {
    const page = this.queryParams().get('page');
    return page === 'orders' || page === 'customers' || page === 'menu' ? page : 'overview';
  });
  readonly loading = signal(true);
  readonly error = signal('');
  readonly branches = signal<BranchSummary[]>([]);
  readonly items = signal<MenuItemSummary[]>([]);
  readonly orders = signal<OrderSummary[]>([]);
  readonly customers = signal<CustomerSummary[]>([]);
  readonly search = signal('');
  readonly notificationsOpen = signal(false);
  readonly profileOpen = signal(false);
  readonly mobileSidebarOpen = signal(false);
  readonly todayLabel = new Intl.DateTimeFormat('en-QA', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());
  readonly greeting = this.getGreeting();

  readonly activeBranches = computed(
    () => this.branches().filter((branch) => branch.status === 'active').length,
  );
  readonly availableItems = computed(
    () => this.items().filter((item) => item.isAvailable).length,
  );
  readonly todayOrders = computed(() => this.orders().filter((order) => this.isToday(order.createdAt)));
  readonly todayRevenue = computed(() =>
    this.todayOrders().reduce((total, order) => total + Number(order.grandTotal || 0), 0),
  );
  readonly openOrders = computed(
    () => this.orders().filter((order) => !['delivered', 'cancelled'].includes(order.status)).length,
  );
  readonly recentOrders = computed(() => {
    const query = this.search().trim().toLowerCase();
    const orders = [...this.orders()]
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .filter((order) => !query || order.orderNumber.toLowerCase().includes(query));
    return this.selectedPage() === 'orders' ? orders : orders.slice(0, 6);
  });
  readonly visibleMenuItems = computed(() =>
    this.selectedPage() === 'menu' ? this.items() : this.items().slice(0, 4),
  );
  readonly activity = computed<ActivityItem[]>(() =>
    [...this.orders()]
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, 4)
      .map((order) => ({
        orderNumber: order.orderNumber,
        status: order.status,
        time: this.formatTime(order.createdAt),
      })),
  );
  readonly revenueLabel = computed(() =>
    new Intl.NumberFormat('en-QA', {
      style: 'currency',
      currency: 'QAR',
      maximumFractionDigits: 0,
    }).format(this.todayRevenue()),
  );

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      branches: this.http.get<BranchSummary[]>(`${environment.apiUrl}/branches`),
      items: this.http.get<MenuItemSummary[]>(`${environment.apiUrl}/menu/items`),
      orders: this.http.get<OrderSummary[]>(`${environment.apiUrl}/orders`),
      customers: this.http.get<CustomerSummary[]>(`${environment.apiUrl}/customers`),
    }).subscribe({
      next: (result) => {
        this.branches.set(result.branches);
        this.items.set(result.items);
        this.orders.set(result.orders);
        this.customers.set(result.customers);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Check your connection and sign in again if your session has expired.');
        this.loading.set(false);
      },
    });
  }

  updateSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  statusClass(status: string): string {
    return `status-${status.toLowerCase()}`;
  }

  formatTime(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? 'Recently'
      : new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(date);
  }

  formatDate(value?: string): string {
    if (!value) return 'No orders yet';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? 'Recently'
      : new Intl.DateTimeFormat('en-QA', { dateStyle: 'medium' }).format(date);
  }

  toggleNotifications(): void {
    this.notificationsOpen.update((open) => !open);
    this.profileOpen.set(false);
  }

  toggleProfile(): void {
    this.profileOpen.update((open) => !open);
    this.notificationsOpen.set(false);
  }

  closeSidebar(): void {
    this.mobileSidebarOpen.set(false);
  }

  logout(): void {
    this.auth.logout().subscribe({
      next: () => void this.router.navigateByUrl('/login'),
      error: () => void this.router.navigateByUrl('/login'),
    });
  }

  private isToday(value: string): boolean {
    const date = new Date(value);
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  }

  private getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }
}
