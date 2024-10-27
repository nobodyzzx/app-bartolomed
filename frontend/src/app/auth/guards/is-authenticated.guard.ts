import { CanActivateFn } from '@angular/router';

export const isAuthenticatedGuard: CanActivateFn = (route, state) => {
  console.log('isAuthenticatedGuard');
  console.log({ route, state });
  return true;
};
