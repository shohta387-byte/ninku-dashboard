import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // スマホなどLAN経由(PCのIPやnip.io経由のホスト名)からdevサーバーにアクセスした際に
  // HMR等のクロスオリジンアクセスがブロックされないようにする。
  allowedDevOrigins: ["192.168.0.15", "192.168.0.15.nip.io"],
};

export default nextConfig;
