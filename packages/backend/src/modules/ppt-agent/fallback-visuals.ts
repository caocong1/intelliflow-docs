import type { DeckPlan, DeckSlide, VisualAsset } from "./types";

const SVG_WIDTH = 1600;
const SVG_HEIGHT = 900;

export function buildFallbackVisual(
  deckPlan: DeckPlan,
  slide: DeckSlide,
  index: number,
): VisualAsset {
  const palette = ensurePalette(deckPlan.theme.palette);
  const main = palette[index % palette.length];
  const support = palette[(index + 1) % palette.length];
  const accent = palette[(index + 2) % palette.length];
  const pattern = fallbackVisualPattern(slide.pageType, index);

  const motif =
    pattern === 0
      ? layeredPanels(main, support, accent)
      : pattern === 1
        ? diagonalSystem(main, support, accent)
        : pattern === 2
          ? radialField(main, support, accent)
          : pattern === 3
            ? capabilityGrid(main, support, accent)
            : roadmapBands(main, support, accent);

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}">`,
    "<defs>",
    `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#${main}"/><stop offset="1" stop-color="#${support}"/></linearGradient>`,
    `<filter id="soft"><feGaussianBlur stdDeviation="20"/></filter>`,
    "</defs>",
    '<rect width="1600" height="900" fill="url(#bg)"/>',
    `<rect x="0" y="0" width="1600" height="900" fill="#${accent}" opacity="0.09"/>`,
    motif,
    "</svg>",
  ].join("");

  return {
    slideId: slide.id,
    dataUri: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
    source: "fallback",
  };
}

function ensurePalette(palette: string[]): string[] {
  const normalized = palette
    .map((value) =>
      value
        .replace(/^#/, "")
        .replace(/[^0-9a-f]/gi, "")
        .slice(0, 6)
        .toUpperCase(),
    )
    .filter((value) => value.length === 6);
  return normalized.length >= 3 ? normalized : ["0B1220", "111827", "38BDF8", "F59E0B"];
}

function fallbackVisualPattern(pageType: string, index: number): number {
  switch (pageType) {
    case "architecture":
    case "capability":
    case "team":
      return 3; // capabilityGrid
    case "timeline":
    case "agenda":
    case "roadmap":
    case "process":
      return 4; // roadmapBands
    case "metrics":
    case "table":
    case "comparison":
      return 0; // layeredPanels
    case "risk":
    case "governance":
    case "chart":
      return 2; // radialField
    case "strategy":
    case "scenario":
      return 1; // diagonalSystem
    case "quote":
    case "contact":
      return 0; // layeredPanels
    default:
      return index % 5;
  }
}

function layeredPanels(main: string, support: string, accent: string): string {
  return [
    `<rect x="910" y="90" width="520" height="700" rx="46" fill="#${support}" opacity="0.48"/>`,
    `<rect x="1010" y="150" width="340" height="520" rx="36" fill="#${accent}" opacity="0.32"/>`,
    `<circle cx="1160" cy="430" r="230" fill="#${main}" opacity="0.22" filter="url(#soft)"/>`,
    `<path d="M1040 230 C1200 160 1350 230 1390 380 C1430 540 1280 690 1110 630 C970 580 900 420 960 310 C980 270 1000 250 1040 230Z" fill="#${accent}" opacity="0.38"/>`,
  ].join("");
}

function diagonalSystem(main: string, support: string, accent: string): string {
  return [
    `<path d="M760 -80 L1680 0 L1180 980 L250 900Z" fill="#${support}" opacity="0.42"/>`,
    `<path d="M950 0 L1660 120 L1330 900 L620 820Z" fill="#${accent}" opacity="0.26"/>`,
    `<path d="M1060 180 L1490 230 L1320 680 L890 630Z" fill="#${main}" opacity="0.18"/>`,
    ...Array.from({ length: 7 }, (_, i) => {
      const x = 900 + i * 70;
      return `<circle cx="${x}" cy="${260 + i * 44}" r="${32 + i * 4}" fill="#${accent}" opacity="${0.17 + i * 0.025}"/>`;
    }),
  ].join("");
}

function radialField(main: string, support: string, accent: string): string {
  return [
    `<circle cx="1210" cy="430" r="340" fill="#${support}" opacity="0.34" filter="url(#soft)"/>`,
    `<circle cx="1210" cy="430" r="245" fill="#${accent}" opacity="0.24"/>`,
    `<circle cx="1210" cy="430" r="110" fill="#${main}" opacity="0.28"/>`,
    ...Array.from({ length: 10 }, (_, i) => {
      const angle = (i / 10) * Math.PI * 2;
      const x = Math.round(1210 + Math.cos(angle) * 275);
      const y = Math.round(430 + Math.sin(angle) * 205);
      return `<line x1="1210" y1="430" x2="${x}" y2="${y}" stroke="#${accent}" stroke-width="8" opacity="0.22"/><circle cx="${x}" cy="${y}" r="30" fill="#${accent}" opacity="0.36"/>`;
    }),
  ].join("");
}

function capabilityGrid(main: string, support: string, accent: string): string {
  const cells = Array.from({ length: 12 }, (_, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    return `<rect x="${840 + col * 145}" y="${170 + row * 145}" width="104" height="104" rx="22" fill="#${
      i % 3 === 0 ? accent : i % 3 === 1 ? support : main
    }" opacity="${i % 2 === 0 ? "0.34" : "0.22"}"/>`;
  });
  return [
    `<rect x="770" y="100" width="680" height="690" rx="52" fill="#${support}" opacity="0.26"/>`,
    ...cells,
    `<path d="M860 650 C980 570 1130 700 1280 590 C1350 540 1410 500 1470 530" stroke="#${accent}" stroke-width="18" fill="none" opacity="0.34"/>`,
  ].join("");
}

function roadmapBands(main: string, support: string, accent: string): string {
  return [
    `<path d="M780 210 H1440" stroke="#${support}" stroke-width="64" stroke-linecap="round" opacity="0.34"/>`,
    `<path d="M890 390 H1490" stroke="#${accent}" stroke-width="64" stroke-linecap="round" opacity="0.32"/>`,
    `<path d="M790 570 H1340" stroke="#${main}" stroke-width="64" stroke-linecap="round" opacity="0.24"/>`,
    ...Array.from({ length: 5 }, (_, i) => {
      const x = 850 + i * 145;
      return `<circle cx="${x}" cy="${210 + (i % 3) * 180}" r="38" fill="#${accent}" opacity="0.5"/>`;
    }),
    `<path d="M750 720 C950 650 1120 780 1450 690" stroke="#${accent}" stroke-width="10" fill="none" opacity="0.34"/>`,
  ].join("");
}
