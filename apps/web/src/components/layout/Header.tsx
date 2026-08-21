/**
 * @file        Header.tsx
 * @description ⭐ Header/Nav ראשי — לוגו + ניווט + מצב חשבון. משמש בכל עמוד חוץ מ-Studio
 *              (יש לו סרגל קומפקטי משלו, ה-Header הכללי היה תופס מקום מהקנבס).
 * @author      Soundiform
 * @created     2026-08-20
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

'use client';

import Link from 'next/link';
import { Logo } from '@/components/branding/Logo';
import { Button } from '@/components/ui/button';
import { useSupabaseUser } from '@/hooks/useSupabaseUser';
import { useUsername } from '@/hooks/useUsername';

const NAV_LINKS = [
  { href: '/studio', label: 'Studio' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/pricing', label: 'Pricing' },
];

const LOGGED_IN_NAV_LINKS = [...NAV_LINKS, { href: '/feed', label: 'Feed' }];

export function Header() {
  const { user, isLoading } = useSupabaseUser();
  const username = useUsername();
  const navLinks = user ? LOGGED_IN_NAV_LINKS : NAV_LINKS;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="transition-opacity hover:opacity-80">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 sm:flex">
          {navLinks.map((link) => (
            <Button
              key={link.href}
              variant="ghost"
              nativeButton={false}
              render={<Link href={link.href} />}
            >
              {link.label}
            </Button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {!isLoading && user ? (
            <Button
              variant="secondary"
              nativeButton={false}
              render={<Link href={username ? `/u/${username}` : '/account'} />}
            >
              Account
            </Button>
          ) : (
            <Button nativeButton={false} render={<Link href="/login" />}>
              Sign in
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
