import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, UserRole } from './auth.service';

export const roleGuard = (roles: UserRole[]): CanActivateFn => () => {
  const auth = inject(AuthService);
  const authUser = auth.user();
  const router = inject(Router);
  if (authUser && roles.includes(authUser.role)) return true;
  if (!authUser) return router.createUrlTree(['/login']);
  return router.createUrlTree([authUser?.role === 'SUPER_ADMIN' ? '/admin' : '/dashboard']);
};
