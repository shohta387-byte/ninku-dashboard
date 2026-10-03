// 同じ名前の現場を見分けられるよう、元請けが設定されている現場は「現場名（元請け名）」で表示する。
export function siteLabel(site: { name: string; contractor?: { name: string } | null }): string {
  return site.contractor ? `${site.name}（${site.contractor.name}）` : site.name;
}
