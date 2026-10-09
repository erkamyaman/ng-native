import { Component, inject, type OnInit } from '@angular/core';
import { Router, type Routes } from '@angular/router';
import { Text } from '../../components/src/text.ts';
import { NativeNavigation } from '../../router/src/native-navigation.ts';
import { NativeStackOutlet } from '../../router/src/native-stack-outlet.ts';

export const session = { signedIn: false };

@Component({ selector: 'x-guarded-a', imports: [Text], template: `<text>A</text>` })
export class GuardedA {}

@Component({ selector: 'x-guarded-b', imports: [Text], template: `<text>B</text>` })
export class GuardedB {}

@Component({ selector: 'x-guarded-home', imports: [Text], template: `<text>Home</text>` })
export class GuardedHome {}

@Component({ selector: 'x-guarded-login', imports: [Text], template: `<text>Login</text>` })
export class GuardedLogin {}

/** A page that sends a signed-out user to sign in as it is created, as a check in ngOnInit does. */
@Component({ selector: 'x-guarded-bounce', imports: [Text], template: `<text>Bounce</text>` })
export class GuardedBounce implements OnInit {
  private readonly router = inject(Router);

  ngOnInit(): void {
    if (!session.signedIn) void this.router.navigateByUrl('/login');
  }
}

/** A page that swaps itself for the sign-in page as it is created, leaving no way back to it. */
@Component({ selector: 'x-guarded-swap', imports: [Text], template: `<text>Swap</text>` })
export class GuardedSwap implements OnInit {
  private readonly nav = inject(NativeNavigation);

  ngOnInit(): void {
    if (!session.signedIn) void this.nav.replace('/login');
  }
}

@Component({
  selector: 'x-guarded-shell',
  imports: [NativeStackOutlet],
  template: '<native-stack-outlet />',
})
export class GuardedShell {}

export const guardedRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'a' },
  { path: 'a', component: GuardedA },
  { path: 'b', component: GuardedB },
  { path: 'login', component: GuardedLogin },
  {
    path: 'home',
    component: GuardedHome,
    canActivate: [() => session.signedIn || inject(Router).parseUrl('/login')],
  },
  {
    path: 'account',
    component: GuardedHome,
    canActivate: [() => session.signedIn || inject(Router).parseUrl('/login?next=account')],
  },
  { path: 'sign-in', redirectTo: 'login' },
  { path: 'bounce', component: GuardedBounce },
  { path: 'swap', component: GuardedSwap },
];
