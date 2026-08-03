export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // 地球の半径(km)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 位置情報が未設定の現場は距離を計算できないため、距離が近い順に並べた現場の
// 後ろにそのままの順番でつなげる（distanceKmは付けない）。
export function sortSitesByDistance<T extends { lat: number | null; lng: number | null }>(
  sites: T[],
  userLat: number,
  userLng: number,
): (T & { distanceKm?: number })[] {
  const withLocation: (T & { distanceKm: number })[] = [];
  const withoutLocation: T[] = [];
  for (const s of sites) {
    if (s.lat === null || s.lng === null) {
      withoutLocation.push(s);
    } else {
      withLocation.push({ ...s, distanceKm: haversineDistanceKm(userLat, userLng, s.lat, s.lng) });
    }
  }
  withLocation.sort((a, b) => a.distanceKm - b.distanceKm);
  return [...withLocation, ...withoutLocation];
}
