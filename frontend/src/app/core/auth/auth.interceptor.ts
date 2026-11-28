import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const token = auth.accessToken();
  const authEndpoint = /\/auth\/(login|request-otp|verify-otp|refresh)$/.test(request.url);
  if (!token || !request.url.startsWith(environment.apiUrl) || authEndpoint) {
    return next(request);
  }

  const authenticatedRequest = request.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });

  return next(authenticatedRequest).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

      return auth.refreshAccess().pipe(
        switchMap((refreshed) => {
          const renewedToken = auth.accessToken();
          return refreshed && renewedToken
            ? next(request.clone({ setHeaders: { Authorization: `Bearer ${renewedToken}` } }))
            : throwError(() => error);
        }),
      );
    }),
  );
};
