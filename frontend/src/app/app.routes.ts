import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

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
    path: 'dashboard/assistant',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/assistant/assistant.component').then(
        (module) => module.AssistantComponent,
      ),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((module) => module.DashboardComponent),
  },
  { path: '**', redirectTo: '' },
];
