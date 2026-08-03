export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

// OpenStreetMapの無料ジオコーディング(Nominatim)を使う。APIキー・課金設定は不要。
// 利用ポリシー上、識別可能なUser-Agentを付ける必要がある。
export async function geocodeAddress(query: string): Promise<GeocodeResult[]> {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "jp");
  url.searchParams.set("accept-language", "ja");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "ninku-system/1.0 (internal company attendance app)",
    },
  });
  if (!response.ok) {
    throw new Error("住所検索に失敗しました");
  }

  const data = (await response.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;

  return data.map((d) => ({
    lat: parseFloat(d.lat),
    lng: parseFloat(d.lon),
    displayName: d.display_name,
  }));
}
