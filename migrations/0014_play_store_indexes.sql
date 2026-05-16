-- 0014_play_store_indexes.sql
-- Índices faltantes detectados na auditoria pré-Play Store (2026-05-16).
-- Sem esses índices, queries fazem table scan em escala. Idempotente (IF NOT EXISTS).

-- Filtros de status em comunidades (active/pending) usados em todo CRUD de membros
CREATE INDEX IF NOT EXISTS "community_members_community_status_idx"
  ON "community_members" ("community_id", "status");

-- Conversas diretas: lookup por destinatário ordenado por data (inbox listing)
CREATE INDEX IF NOT EXISTS "direct_messages_recipient_created_idx"
  ON "direct_messages" ("recipient_id", "created_at" DESC);

-- Lookup do autor em comentários de posts de comunidade
CREATE INDEX IF NOT EXISTS "community_post_comments_user_idx"
  ON "community_post_comments" ("user_id");

-- Limpeza de impressões expiradas (cron job)
CREATE INDEX IF NOT EXISTS "ad_impressions_expires_idx"
  ON "ad_impressions" ("expires_at");

-- Contadores e reads em notificações
CREATE INDEX IF NOT EXISTS "notification_reads_notification_idx"
  ON "notification_reads" ("notification_id");

-- FK ausente em messages.replied_to_message_id (apontava para messages.id sem references)
-- Ao deletar uma mensagem, replies ficam com referência órfã. SET NULL preserva o reply.
-- Tentativa idempotente: drop constraint se existir antes de recriar.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'messages_replied_to_message_id_fk'
      AND table_name = 'messages'
  ) THEN
    ALTER TABLE "messages"
      ADD CONSTRAINT "messages_replied_to_message_id_fk"
      FOREIGN KEY ("replied_to_message_id") REFERENCES "messages"("id")
      ON DELETE SET NULL;
  END IF;
END $$;
