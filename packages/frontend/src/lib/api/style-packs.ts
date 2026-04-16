export interface StylePackItem {
  id: string;
  label: string;
  preview: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    coverFill: "solid" | "gradient" | "accent_bar";
    titleAlign: "center" | "left";
    cornerRadius: number;
    cardShadow: boolean;
    dividerStyle: "line" | "dot" | "none";
  };
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function listStylePacks(): Promise<StylePackItem[]> {
  const res = await fetch("/api/runtime/style-packs", {
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error(`Failed to fetch style packs: ${res.status}`);
  return res.json();
}
