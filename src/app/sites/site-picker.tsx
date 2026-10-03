"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { sortSitesByDistance } from "@/lib/geo";
import { InlineAddSite } from "./inline-add-site";

type Site = {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  contractor: { id: string; name: string } | null;
};
type SiteWithDistance = Site & { distanceKm?: number };
type Contractor = { id: string; name: string };

const NEARBY_COUNT = 3;

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, "");
}

// 現場選択。位置情報が取れたら近い現場を上に出し、その下に元請けごとにまとめた一覧を出す。
// 検索欄に入力すると、現場名・元請け名のどちらかに一致する現場だけを一覧にする。
export function SitePicker({ sites, contractors }: { sites: Site[]; contractors: Contractor[] }) {
  const router = useRouter();
  const [nearby, setNearby] = useState<SiteWithDistance[]>([]);
  const [query, setQuery] = useState("");

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
        const sorted = sortSitesByDistance(sites, pos.coords.latitude, pos.coords.longitude);
        setNearby(sorted.filter((s) => s.distanceKm !== undefined).slice(0, NEARBY_COUNT));
      },
      () => {
        // 拒否/取得失敗時は何もしない（元請けごとの一覧だけを表示する）
        clearTimeout(timeoutId);
      },
      { timeout: 5000 },
    );

    return () => clearTimeout(timeoutId);
  }, [sites]);

  const q = normalize(query);
  const matches = q
    ? sites.filter((s) => normalize(s.name).includes(q) || (s.contractor && normalize(s.contractor.name).includes(q)))
    : [];

  // 現場側の元請けからグループを作る（元請けが無効化されていても、その現場が有効なら選べるようにする）。
  const siteContractors = [...new Map(sites.flatMap((s) => (s.contractor ? [[s.contractor.id, s.contractor]] : []))).values()];
  const groups = siteContractors
    .sort((a, b) => a.name.localeCompare(b.name, "ja"))
    .map((c) => ({ key: c.id, label: c.name, sites: sites.filter((s) => s.contractor?.id === c.id) }));
  const unassigned = sites.filter((s) => !s.contractor);
  if (unassigned.length > 0) {
    groups.push({ key: "unassigned", label: "元請け未設定", sites: unassigned });
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="🔍 現場名・元請け名で検索"
        className="rounded-lg border border-black/20 px-4 py-3 text-lg dark:border-white/20 dark:bg-zinc-900"
      />

      {q ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-zinc-500">検索結果 {matches.length}件</p>
          <SiteList sites={matches} showContractor />
          {matches.length === 0 && <p className="text-zinc-500">一致する現場がありません。</p>}
        </div>
      ) : (
        <>
          {nearby.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-bold text-zinc-500">近くの現場</p>
              <SiteList sites={nearby} showContractor />
            </div>
          )}
          <div className="flex flex-col gap-2">
            {groups.map((g) => (
              <details
                key={g.key}
                open={groups.length === 1}
                className="rounded-lg border border-black/10 dark:border-white/10"
              >
                <summary className="cursor-pointer px-4 py-3 font-bold">
                  {g.label}
                  <span className="ml-2 text-sm font-normal text-zinc-500">{g.sites.length}現場</span>
                </summary>
                <div className="p-2 pt-0">
                  <SiteList sites={g.sites} showContractor={false} />
                </div>
              </details>
            ))}
          </div>
        </>
      )}

      <InlineAddSite contractors={contractors} onCreated={(siteId) => router.push(`/clock?siteId=${siteId}`)} />
    </div>
  );
}

function SiteList({ sites, showContractor }: { sites: SiteWithDistance[]; showContractor: boolean }) {
  return (
    <ul className="flex flex-col gap-2">
      {sites.map((site) => (
        <li key={site.id}>
          <Link
            href={`/clock?siteId=${site.id}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-black/10 bg-white px-5 py-4 text-lg font-medium shadow-sm active:bg-zinc-100 dark:border-white/10 dark:bg-zinc-900 dark:active:bg-zinc-800"
          >
            <span>
              {site.name}
              {showContractor && site.contractor && (
                <span className="ml-2 text-sm font-normal text-zinc-500">{site.contractor.name}</span>
              )}
            </span>
            {site.distanceKm !== undefined && (
              <span className="shrink-0 text-sm font-normal text-zinc-500">{formatDistance(site.distanceKm)}</span>
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
