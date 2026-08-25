import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type IceServerConfig = { urls: string[]; username?: string; credential?: string };

function unwrapSecret(value: string | undefined): string | undefined {
  const normalized = value?.trim().replace(/^["']+|["']+$/g, "");
  return normalized || undefined;
}

function parseTurnUrls(value: string | undefined): string[] {
  const raw = unwrapSecret(value);
  if (!raw) return [];

  let candidates: string[] = [raw];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) candidates = parsed.filter((entry): entry is string => typeof entry === "string");
    else if (parsed && typeof parsed === "object" && "urls" in parsed) {
      const urls = (parsed as { urls?: unknown }).urls;
      candidates = Array.isArray(urls) ? urls.filter((entry): entry is string => typeof entry === "string") : typeof urls === "string" ? [urls] : candidates;
    }
  } catch {
    // يقبل الحقل أيضاً صيغة عناوين مفصولة بفواصل.
  }

  return candidates
    .flatMap(entry => entry.split(","))
    .map(entry => unwrapSecret(entry))
    .filter((entry): entry is string => Boolean(entry && /^turns?:/i.test(entry)));
}

@Injectable()
export class CallsService {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  iceConfig(): { iceServers: IceServerConfig[]; turnConfigured: boolean } {
    const turnUrls = parseTurnUrls(this.config.get<string>("WEBRTC_TURN_URL") ?? this.config.get<string>("YEMNA_TURN_URLS"));
    const username = unwrapSecret(this.config.get<string>("WEBRTC_TURN_USERNAME") ?? this.config.get<string>("YEMNA_TURN_USERNAME"));
    const credential = unwrapSecret(this.config.get<string>("WEBRTC_TURN_CREDENTIAL") ?? this.config.get<string>("YEMNA_TURN_CREDENTIAL"));
    const turnConfigured = Boolean(turnUrls.length && username && credential);
    const iceServers: IceServerConfig[] = [{ urls: ["stun:stun.l.google.com:19302"] }];
    if (turnConfigured) iceServers.push({ urls: turnUrls, username, credential });
    return { iceServers, turnConfigured };
  }

  iceStatus(): { turnConfigured: boolean } {
    return { turnConfigured: this.iceConfig().turnConfigured };
  }
}
