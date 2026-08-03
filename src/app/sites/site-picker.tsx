"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { sortSitesByDistance } from "@/lib/geo";

type Site = { id: string; name: string; lat: number | null; lng: number | null };
type SiteWithDistance = Site & { distanceKm?: number };

export function SitePicker({ sites }: { sites: Site[] }) {
  const [ordered, setOrdered] = useState<SiteWithDistance[]>(sites);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    let cancelled = false;
    const timeoutId = setTimeout(() => {
      cancelled = true;
    }, 5000);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        setOrdered(sortSitesByDistance(sites, pos.coords.latitude, pos.coords.longitude));
      },
      () => {
        // 拒否/取得失敗時は何もしない（五十音順のデフォルト表示のまま）
        clearTimeout(timeoutId);
      },
      { timeout: 5000 },
    );

    return () => clearTimeout(timeoutId);
  }, [sites]);

  return (
    <ul className="flex flex-col gap-3">
      {ordered.map((site) => (
        <li key={site.id}>
          <Link
            href={`/clock?siteId=${site.id}`}
            className="flex items-center justify-between rounded-lg border border-black/10 bg-white px-5 py-4 text-lg font-medium shadow-sm active:bg-zinc-100 dark:border-white/10 dark:bg-zinc-900 dark:active:bg-zinc-800"
          >
            <span>{site.name}</span>
            {site.distanceKm !== undefined && (
              <span className="text-sm font-normal text-zinc-500">
                {formatDistance(site.distanceKm)}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}
