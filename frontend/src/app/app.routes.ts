import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';
import { UserRole } from './core/auth/auth.service';

const restaurantRoles: UserRole[] = [
  'RESTAURANT_OWNER',
  'RESTAURANT_MANAGER',
  'BRANCH_MANAGER',
];

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./features/landing/landing.component').then((module) => module.LandingComponent),
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then((module) => module.LoginComponent),
  },
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard(['SUPER_ADMIN'])],
    loadComponent: () =>
      import('./features/platform-admin/platform-admin.component').then(
        (module) => module.PlatformAdminComponent,
      ),
  },
  {
    path: 'dashboard/assistant',
    canActivate: [authGuard, roleGuard(restaurantRoles)],
    loadComponent: () =>
      import('./features/dashboard/assistant/assistant.component').then(
        (module) => module.AssistantComponent,
      ),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard, roleGuard(restaurantRoles)],
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((module) => module.DashboardComponent),
  },
  { path: '**', redirectTo: '' },
];
