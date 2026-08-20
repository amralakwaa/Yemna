import "reflect-metadata";
import { SELF_DECLARED_DEPS_METADATA } from "@nestjs/common/constants";
import { describe, expect, it } from "vitest";
import { MediaController } from "../media/media.controller";
import { MediaService } from "../media/media.service";
import { MessagesController } from "../messages/messages.controller";
import { MessagesService } from "../messages/messages.service";
import { NotificationsController } from "../notifications/notifications.controller";
import { NotificationsService } from "../notifications/notifications.service";
import { RelationshipsController } from "../relationships/relationships.controller";
import { RelationshipsService } from "../relationships/relationships.service";
import { SupportController } from "../support/support.controller";
import { SupportService } from "../support/support.service";

describe("production protected-resource injection", () => {
  it.each([
    [RelationshipsController, RelationshipsService],
    [MessagesController, MessagesService],
    [NotificationsController, NotificationsService],
    [MediaController, MediaService],
    [SupportController, SupportService],
  ])("declares an explicit service token for %s", (controller, service) => {
    const dependencies = Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, controller) as Array<{ index: number; param: unknown }>;
    expect(dependencies).toContainEqual({ index: 0, param: service });
  });
});
