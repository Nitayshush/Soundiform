/**
 * @file        DownloadLinks.tsx
 * @description ⭐ קישורי הורדה ל-api/renders/[renderId]/download (§11 item 5+7). audio זמין
 *              לכל אחד; midi/stems מוצגים רק כש-showMidiAndStems=true (הקורא אחראי לוודא
 *              isOwner && plan==='studio' — ראה app/u/[username]/page.tsx).
 * @author      Soundiform
 * @created     2026-08-21
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { Button } from '@/components/ui/button';

export interface DownloadLinksProps {
  renderId: string;
  showMidiAndStems?: boolean;
  stemRoles?: string[];
}

export function DownloadLinks({ renderId, showMidiAndStems, stemRoles }: DownloadLinksProps) {
  const base = `/api/renders/${renderId}/download`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        nativeButton={false}
        render={<a href={`${base}?type=audio`} />}
      >
        Download audio
      </Button>
      {showMidiAndStems && (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<a href={`${base}?type=midi`} />}
          >
            Download MIDI
          </Button>
          {(stemRoles ?? []).map((role) => (
            <Button
              key={role}
              type="button"
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<a href={`${base}?type=stem&role=${role}`} />}
            >
              Stem: {role}
            </Button>
          ))}
        </>
      )}
    </div>
  );
}
