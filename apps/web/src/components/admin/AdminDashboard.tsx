/**
 * @file        AdminDashboard.tsx
 * @description ⭐ מעטפת טאבים לפאנל האדמין — מודרציה / feature flags / GenrePacks / audit log.
 * @author      Soundiform
 * @created     2026-08-20
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

'use client';

import { useState } from 'react';
import { ModerationPanel } from './ModerationPanel';
import { FeatureFlagsPanel } from './FeatureFlagsPanel';
import { GenrePacksPanel } from './GenrePacksPanel';
import { AuditLogPanel } from './AuditLogPanel';

const TABS = [
  { id: 'moderation', label: 'מודרציה' },
  { id: 'feature-flags', label: 'Feature Flags' },
  { id: 'genre-packs', label: 'GenrePacks' },
  { id: 'audit-log', label: 'Audit Log' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('moderation');

  return (
    <div>
      <nav className="mb-6 flex gap-2 border-b" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => {
              setActiveTab(tab.id);
            }}
            className={`px-3 py-2 text-sm ${
              activeTab === tab.id
                ? 'border-b-2 border-foreground font-medium'
                : 'text-muted-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      {activeTab === 'moderation' && <ModerationPanel />}
      {activeTab === 'feature-flags' && <FeatureFlagsPanel />}
      {activeTab === 'genre-packs' && <GenrePacksPanel />}
      {activeTab === 'audit-log' && <AuditLogPanel />}
    </div>
  );
}
