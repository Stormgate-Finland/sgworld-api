import {
  OpenAPIRoute,
  OpenAPIRouteSchema,
} from "@cloudflare/itty-router-openapi";
import { cacheResult } from "@/utils/cache";
import { StreamLiveResponse as StreamsLiveResponse } from "@/types/streams";
import { Env } from "@/types/common";
import { Twitch } from "@/lib/twitch/client";

export class StreamLive extends OpenAPIRoute {
  static schema: OpenAPIRouteSchema = {
    tags: ["Streams/Live"],
    summary: "Get live streams",
    responses: {
      "200": {
        description:
          "Returns a list of live streams that are streaming Stormgate",
        schema: {
          success: Boolean,
          error: String,
          result: StreamsLiveResponse,
        },
      },
    },
  };

  async handle(
    request: Request,
    env: Env,
    context: ExecutionContext,
    data: Record<string, any>
  ) {
    const twitch = new Twitch(env);

    return await cacheResult(
      request,
      context,
      //@ts-ignore TODO: Fix this
      async () => {
        try {
          const streams = await env.DB.prepare(
            "SELECT provider_id FROM streams WHERE provider = 'twitch'"
          ).all<{ provider_id: string }>();
          if (!streams.results) {
            return {
              success: true,
              result: [],
            };
          }

          const liveStreams = await twitch.getStreams(
            streams.results.map((stream) => stream.provider_id)
          );
          const result = liveStreams.map((stream) => ({
            id: stream.id,
            name: stream.user_name,
            title: stream.title,
            viewers: stream.viewer_count,
            thumbnailUrl: Twitch.getTwitchThumbnail(stream.thumbnail_url),
            url: Twitch.getChannelUrl(stream.user_login),
          }));
          return {
            success: true,
            result,
          };
        } catch (error) {
          return {
            success: false,
            error: error.message,
          };
        }
      },
      { cacheTime: 60 * 3 }
    );
  }
}
