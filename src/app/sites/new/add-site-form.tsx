"use client";

import { useActionState, useState } from "react";
import { createSite, searchAddress, type CreateSiteState } from "@/app/actions";

const initialState: CreateSiteState = { status: "idle", message: "" };

export function AddSiteForm() {
  const [state, formAction, isPending] = useActionState(createSite, initialState);
  const [name, setName] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locationLabel, setLocationLabel] = useState("");
  const [addressQuery, setAddressQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    { lat: number; lng: number; displayName: string }[]
  >([]);
  const [searching, setSearching] = useState(false);
  const [locationError, setLocationError] = useState("");

  const showDuplicateWarning = state.status === "duplicate_warning";

  // 登録成功後は、続けて別の現場を追加できるようフォームをリセットする。
  // (レンダー中に状態を調整するReact推奨パターン。useEffectは使わない)
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.status === "success") {
      setName("");
      setLat(null);
      setLng(null);
      setLocationLabel("");
      setAddressQuery("");
      setSearchResults([]);
    }
  }

  function useCurrentLocation() {
    setLocationError("");
    if (!("geolocation" in navigator)) {
      setLocationError("この端末では位置情報が使えません");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setLocationLabel(
          `現在地（緯度${pos.coords.latitude.toFixed(5)}, 経度${pos.coords.longitude.toFixed(5)}）`,
        );
        setSearchResults([]);
      },
      () => {
        setLocationError(
          "位置情報を取得できませんでした。HTTPS接続でない場合は取得できないことがあります。住所で検索してください。",
        );
      },
      { timeout: 10000 },
    );
  }

  async function handleSearch() {
    if (addressQuery.trim().length < 2) return;
    setSearching(true);
    setLocationError("");
    try {
      const results = await searchAddress(addressQuery);
      setSearchResults(results);
      if (results.length === 0) {
        setLocationError("該当する住所が見つかりませんでした");
      }
    } catch {
      setLocationError("住所検索に失敗しました");
    } finally {
      setSearching(false);
    }
  }

  function selectResult(r: { lat: number; lng: number; displayName: string }) {
    setLat(r.lat);
    setLng(r.lng);
    setLocationLabel(r.displayName);
    setSearchResults([]);
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-500">現場名</span>
        <input
          name="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="〇〇ビル新築工事"
          className="rounded-lg border border-black/20 px-4 py-3 text-lg dark:border-white/20 dark:bg-zinc-900"
        />
      </label>

      <div className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
        <div>
          <p className="text-sm text-zinc-500">位置情報（任意）</p>
          <p className="text-xs text-zinc-400">
            設定しなくても現場を登録できますが、地図表示や近くの現場から探す機能が使えなくなります。
          </p>
        </div>

        <button
          type="button"
          onClick={useCurrentLocation}
          className="rounded-lg bg-zinc-100 px-4 py-3 font-bold dark:bg-zinc-800"
        >
          現在地を使う（その場にいる場合）
        </button>

        <div className="flex gap-2">
          <input
            type="text"
            value={addressQuery}
            onChange={(e) => setAddressQuery(e.target.value)}
            placeholder="住所や建物名で検索（その場にいない場合）"
            className="flex-1 rounded-lg border border-black/20 px-4 py-3 dark:border-white/20 dark:bg-zinc-900"
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={searching}
            className="rounded-lg bg-zinc-100 px-4 py-3 font-bold dark:bg-zinc-800 disabled:opacity-50"
          >
            {searching ? "検索中…" : "検索"}
          </button>
        </div>

        {searchResults.length > 0 && (
          <ul className="flex flex-col gap-2">
            {searchResults.map((r, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => selectResult(r)}
                  className="w-full rounded-lg border border-black/10 px-3 py-2 text-left text-sm active:bg-zinc-100 dark:border-white/10 dark:active:bg-zinc-800"
                >
                  {r.displayName}
                </button>
              </li>
            ))}
          </ul>
        )}

        {locationError && <p className="text-sm text-red-600">{locationError}</p>}

        {lat !== null && lng !== null && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-zinc-500">選択中: {locationLabel}</p>
            <iframe
              title="選択した場所の地図"
              className="h-48 w-full rounded-lg border border-black/10 dark:border-white/10"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.005}%2C${lat - 0.005}%2C${lng + 0.005}%2C${lat + 0.005}&marker=${lat}%2C${lng}`}
            />
          </div>
        )}
      </div>

      <input type="hidden" name="lat" value={lat ?? ""} />
      <input type="hidden" name="lng" value={lng ?? ""} />
      {showDuplicateWarning && <input type="hidden" name="confirmDuplicate" value="on" />}

      {state.status === "error" && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {state.message}
        </p>
      )}
      {showDuplicateWarning && (
        <p className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-blue-600 px-5 py-4 text-lg font-bold text-white shadow-sm active:bg-blue-700 disabled:opacity-50"
      >
        {isPending ? "登録中…" : showDuplicateWarning ? "それでも登録する" : "登録する"}
      </button>
    </form>
  );
}
