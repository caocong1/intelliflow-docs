import { api } from "../api/client";

export type WecomConfig =
  | { enabled: false }
  | { enabled: true; corpId: string; agentId: string; redirectUri: string };

export async function fetchWecomConfig(): Promise<WecomConfig> {
  try {
    const { data } = await api.api.auth["wecom-config"].get();
    if (!data || !(data as WecomConfig).enabled) {
      return { enabled: false };
    }
    return data as WecomConfig;
  } catch {
    return { enabled: false };
  }
}
