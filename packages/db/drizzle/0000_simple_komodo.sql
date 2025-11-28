CREATE TABLE "aggregate_snapshots"
(
    "context"         text                                   NOT NULL,
    "stream_category" text                                   NOT NULL,
    "stream_id"       text                                   NOT NULL,
    "version"         INTEGER                                NOT NULL,
    "payload"         jsonb                                  NOT NULL,
    "created_at"      TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events"
(
    "position"        bigserial PRIMARY KEY                  NOT NULL,
    "event_id"        uuid                                   NOT NULL,
    "context"         text                                   NOT NULL,
    "stream_category" text                                   NOT NULL,
    "stream_id"       text                                   NOT NULL,
    "version"         INTEGER                                NOT NULL,
    "type"            text                                   NOT NULL,
    "payload"         jsonb                                  NOT NULL,
    "metadata"        jsonb                    DEFAULT '{}'::jsonb NOT NULL,
    "created_at"      TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "aggregate_snapshots_stream_version_uidx" ON "aggregate_snapshots" USING btree ("context","stream_category","stream_id","version");--> statement-breakpoint
CREATE INDEX "aggregate_snapshots_stream_idx" ON "aggregate_snapshots" USING btree ("context","stream_category","stream_id");--> statement-breakpoint
CREATE UNIQUE INDEX "events_stream_version_uidx" ON "events" USING btree ("stream_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "events_event_id_uidx" ON "events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "events_ctx_cat_created_idx" ON "events" USING btree ("context","stream_category","created_at");--> statement-breakpoint
CREATE INDEX "events_stream_id_idx" ON "events" USING btree ("stream_id");--> statement-breakpoint
CREATE INDEX "events_type_idx" ON "events" USING btree ("type");