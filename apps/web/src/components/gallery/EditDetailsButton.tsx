/**
 * @file        EditDetailsButton.tsx
 * @description ⭐ 2026-09-13 (לפי בקשה חיה): עריכת שם/תיאור/מילות-מפתח ליצירה קיימת מ-My
 *              Gallery — פותח את אותו CreationDetailsModal (variant='edit') שנשאל אחרי
 *              הורדה חדשה, כדי לא לכפול UI על אותו שדה בדיוק.
 * @author      Soundiform
 * @created     2026-09-13
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ router.refresh() ב-onDone (לא רק סגירת המודאל) — account/gallery/page.tsx הוא Server
 * Component; בלי refresh הכותרת המעודכנת לא הייתה מופיעה עד ריענון-דף ידני.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CreationDetailsModal } from '@/components/share/CreationDetailsModal';

export interface EditDetailsButtonProps {
  projectId: string;
  title: string | null;
  description: string | null;
  keywords: string | null;
}

export function EditDetailsButton({
  projectId,
  title,
  description,
  keywords,
}: EditDetailsButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        Edit details
      </Button>
      {isOpen && (
        <CreationDetailsModal
          projectId={projectId}
          defaultTitle={title ?? ''}
          initialDescription={description ?? ''}
          initialKeywords={keywords ?? ''}
          variant="edit"
          onDone={() => {
            setIsOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
