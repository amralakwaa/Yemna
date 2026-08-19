import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { YemnaEnv } from "../config/env";
import type { JwtPayload } from "./auth.types";

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(@Inject(ConfigService) config: ConfigService<YemnaEnv, true>) {
    super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), ignoreExpiration: false, secretOrKey: config.get("YEMNA_JWT_ACCESS_SECRET", { infer: true }) ?? "development-only-secret-change-before-production" });
  }
  validate(payload: JwtPayload): JwtPayload { return payload; }
}
