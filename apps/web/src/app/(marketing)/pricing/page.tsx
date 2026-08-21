/**
 * @file        page.tsx
 * @description ⭐ דף תמחור — Free / Pro / Studio (ראה PROJECT.md §9). עיצוב מלא (2026-08-20).
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';

interface PlanFeature {
  label: string;
  value: string;
}

interface Plan {
  name: string;
  price: string;
  highlighted?: boolean;
  /** §11: תשלום עדיין לא מחובר בפועל — רק Free פעיל, Pro/Studio מציגים "Coming soon" כנה. */
  purchasable?: boolean;
  features: PlanFeature[];
}

const PLANS: Plan[] = [
  {
    name: 'Free',
    price: '$0',
    purchasable: true,
    features: [
      { label: 'Length', value: '30 sec' },
      { label: 'Creations / month', value: '10' },
      { label: 'Saved projects', value: '5' },
      { label: 'Download', value: 'MP3, watermarked' },
      { label: 'License', value: 'Personal' },
      { label: 'Video', value: '720p, watermarked' },
    ],
  },
  {
    name: 'Pro',
    price: '~$9/mo',
    highlighted: true,
    features: [
      { label: 'Length', value: '3 min' },
      { label: 'Creations / month', value: 'Unlimited' },
      { label: 'Saved projects', value: 'Unlimited' },
      { label: 'Download', value: 'WAV' },
      { label: 'License', value: 'Commercial' },
      { label: 'Video', value: '1080p, clean' },
    ],
  },
  {
    name: 'Studio',
    price: '~$29/mo',
    features: [
      { label: 'Length', value: '10 min' },
      { label: 'Creations / month', value: 'Unlimited' },
      { label: 'Saved projects', value: 'Unlimited' },
      { label: 'Download', value: 'WAV + stems + MIDI' },
      { label: 'License', value: 'Extended commercial' },
      { label: 'Video', value: '4K, clean' },
    ],
  },
];

export default function PricingPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-6 py-20">
        <div className="mb-14 text-center">
          <h1 className="text-4xl font-semibold tracking-tight">Pricing</h1>
          <p className="mt-3 text-muted-foreground">
            First 500 sign-ups get Pro, free, for life — Founding Members.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <Card
              key={plan.name}
              className={
                plan.highlighted
                  ? 'border-primary/60 shadow-lg shadow-primary/10'
                  : 'border-border/60'
              }
            >
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  {plan.highlighted && <Badge>Most popular</Badge>}
                </div>
                <CardDescription className="text-2xl font-semibold text-foreground">
                  {plan.price}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                  {plan.features.map((feature) => (
                    <li key={feature.label} className="flex justify-between gap-3">
                      <span>{feature.label}</span>
                      <span className="text-foreground">{feature.value}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                {plan.purchasable ? (
                  <Button
                    className="w-full"
                    variant={plan.highlighted ? 'default' : 'outline'}
                    nativeButton={false}
                    render={<Link href="/studio" />}
                  >
                    Start creating
                  </Button>
                ) : (
                  <Button className="w-full" variant="outline" disabled title="Coming soon">
                    Coming soon — contact us
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      </main>
    </>
  );
}
