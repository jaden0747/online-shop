"use client";

import { useEffect, useState } from "react";

export function useDarkMode(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    function read() {
      setDark(document.documentElement.classList.contains("dark"));
    }
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

export const TILE_URL_LIGHT = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
export const TILE_URL_DARK = "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png";
export const TILE_ATTRIBUTION_LIGHT = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
export const TILE_ATTRIBUTION_DARK = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://stadiamaps.com/">Stadia Maps</a>';
