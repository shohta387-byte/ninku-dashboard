const BOM = String.fromCharCode(0xfeff);

function escapeCsvField(value: string | number): string {
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ExcelでSJIS化けしないよう先頭にUTF-8 BOMを付ける。
export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvField).join(","));
  return BOM + lines.join("\r\n");
}
