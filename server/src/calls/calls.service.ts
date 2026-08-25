import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type IceServerConfig = { urls: string[]; username?: string; credential?: string };

@Injectable()
export class CallsService {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  iceConfig(): { iceServers: IceServerConfig[]; turnConfigured: boolean } {
    const turnUrls = (this.config.get<string>("YEMNA_TURN_URLS") ?? "")
      .split(",")
      .map(value => value.trim())
      .filter(value => /^turns?:/i.test(value));
    const username = this.config.get<string>("YEMNA_TURN_USERNAME")?.trim();
    const credential = this.config.get<string>("YEMNA_TURN_CREDENTIAL")?.trim();
    const turnConfigured = Boolean(turnUrls.length && username && credential);
    const iceServers: IceServerConfig[] = [{ urls: ["stun:stun.l.google.com:19302"] }];
    if (turnConfigured) iceServers.push({ urls: turnUrls, username, credential });
    return { iceServers, turnConfigured };
  }
}
