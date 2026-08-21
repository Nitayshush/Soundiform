/**
 * @file        ProfileEditForm.tsx
 * @description ⭐ טופס עריכת פרופיל (אווטאר/שם תצוגה/username) — PATCH /api/account +
 *              POST /api/account/avatar. הפרופיל הציבורי (/u/[username], §11) נבנה על גבי
 *              username שנקבע כאן.
 * @author      Soundiform
 * @created     2026-08-21
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface ProfileEditFormProps {
  initialUsername: string | null;
  initialDisplayName: string | null;
  initialAvatarUrl: string | null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}

export function ProfileEditForm({
  initialUsername,
  initialDisplayName,
  initialAvatarUrl,
}: ProfileEditFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [username, setUsername] = useState(initialUsername ?? '');
  const [displayName, setDisplayName] = useState(initialDisplayName ?? '');
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setIsUploadingAvatar(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set('file', file);
      const response = await fetch('/api/account/avatar', { method: 'POST', body: formData });
      const body: unknown = await response.json();
      const parsed = body as { avatarUrl?: string; error?: string };
      if (!response.ok) {
        throw new Error(parsed.error ?? 'Avatar upload failed');
      }
      // cache-bust: same path every time, so force the <img> to refetch the new image.
      setAvatarUrl(`${parsed.avatarUrl}?t=${String(Date.now())}`);
      router.refresh();
    } catch (caughtError) {
      setError(errorMessage(caughtError));
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(username && { username }),
          ...(displayName && { displayName }),
        }),
      });
      const body: unknown = await response.json();
      const parsed = body as { error?: string };
      if (!response.ok) {
        throw new Error(parsed.error ?? 'Save failed');
      }
      setSaved(true);
      router.refresh();
    } catch (caughtError) {
      setError(errorMessage(caughtError));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-base">Edit profile</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- avatar URL resolves through our own signed-redirect route, not next/image-friendly remote host config */}
          <img
            src={avatarUrl ?? '/icon.svg'}
            alt=""
            className="size-16 rounded-full border border-border/60 object-cover"
          />
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => void handleAvatarChange(event)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUploadingAvatar}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploadingAvatar ? 'Uploading…' : 'Change photo'}
            </Button>
          </div>
        </div>

        <form className="flex flex-col gap-3" onSubmit={(event) => void handleSubmit(event)}>
          <div>
            <label htmlFor="displayName" className="mb-1 block text-sm text-muted-foreground">
              Display name
            </label>
            <Input
              id="displayName"
              value={displayName}
              maxLength={80}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="username" className="mb-1 block text-sm text-muted-foreground">
              Username
            </label>
            <Input
              id="username"
              value={username}
              pattern="[a-z0-9_]{3,20}"
              maxLength={20}
              placeholder="lowercase, numbers, underscore"
              onChange={(event) => setUsername(event.target.value.toLowerCase())}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
            {saved && !isSaving && <span className="text-sm text-muted-foreground">Saved ✓</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
