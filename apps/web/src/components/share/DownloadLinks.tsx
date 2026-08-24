/**
 * @file        DownloadLinks.tsx
 * @description ⭐ קישורי הורדה ל-api/renders/[renderId]/download (§11 item 5+7). audio זמין
 *              לכל אחד; midi/stems מוצגים רק כש-showMidiAndStems=true (הקורא אחראי לוודא
 *              isOwner && plan==='studio' — ראה app/u/[username]/page.tsx).
 *
 * ⭐ 2026-08-22 (§11 גלריה, וידאו-קודם): hasVideo מוסיף "Download video" — עד עכשיו הקומפוננטה
 * הזו (מוצגת בעמוד שיתוף/פרופיל) לא חשפה הורדת וידאו בכלל, רק Studio's useDownload hook יכול
 * היה (בזרימת היצירה המקורית). עכשיו שהוידאו הוא הפריט המרכזי בגלריה, גם כאן.
 * @author      Soundiform
 * @created     2026-08-21
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { Button } from '@/components/ui/button';

export interface DownloadLinksProps {
  renderId: string;
  hasVideo?: boolean;
  showMidiAndStems?: boolean;
  stemRoles?: string[];
}

export function DownloadLinks({
  renderId,
  hasVideo,
  showMidiAndStems,
  stemRoles,
}: DownloadLinksProps) {
  const base = `/api/renders/${renderId}/download`;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {hasVideo && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<a href={`${base}?type=video`} />}
        >
          Download video
        </Button>
      )}
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
