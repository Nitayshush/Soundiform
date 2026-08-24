/**
 * @file        Header.tsx
 * @description ⭐ Header/Nav ראשי — לוגו + ניווט + מצב חשבון. משמש בכל עמוד חוץ מ-Studio
 *              (יש לו סרגל קומפקטי משלו, ה-Header הכללי היה תופס מקום מהקנבס).
 * @author      Soundiform
 * @created     2026-08-20
 *
 * ⭐ 2026-08-24 (מובייל): מתחת ל-sm, קישורי הניווט (כולל My Gallery) היו hidden sm:flex בלי
 * שום חלופה — משתמש מובייל לא היה יכול להגיע ל-/gallery/pricing/studio בכלל חוץ מ-URL ישיר.
 * נוסף תפריט המבורגר (lucide-react, כבר תלות קיימת — בלי Sheet/Drawer חדש, מספיק דרופדאון
 * פשוט לכמה קישורים).
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
          <div className="hidden items-center gap-2 sm:flex">
            {!isLoading && user && (
              <Button
                variant="ghost"
                nativeButton={false}
                render={<Link href="/account/gallery" />}
              >
                My Gallery
              </Button>
            )}
          </div>
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
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden"
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen((open) => !open)}
          >
            {isMobileMenuOpen ? <X /> : <Menu />}
          </Button>
        </div>
      </div>
      {isMobileMenuOpen && (
        <nav className="flex flex-col gap-1 border-t border-border/60 bg-background/95 px-4 py-3 sm:hidden">
          {navLinks.map((link) => (
            <Button
              key={link.href}
              variant="ghost"
              className="justify-start"
              nativeButton={false}
              render={<Link href={link.href} onClick={() => setIsMobileMenuOpen(false)} />}
            >
              {link.label}
            </Button>
          ))}
          {!isLoading && user && (
            <Button
              variant="ghost"
              className="justify-start"
              nativeButton={false}
              render={<Link href="/account/gallery" onClick={() => setIsMobileMenuOpen(false)} />}
            >
              My Gallery
            </Button>
          )}
        </nav>
      )}
    </header>
  );
}
