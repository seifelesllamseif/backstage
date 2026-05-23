-- CreateEnum
CREATE TYPE "handoff_status" AS ENUM ('in_progress', 'blocked', 'ready_for_review', 'done');

-- CreateTable
CREATE TABLE "handoff" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "from_member_id" UUID,
    "to_member_id" UUID,
    "status" "handoff_status" NOT NULL DEFAULT 'in_progress',
    "what_it_is" TEXT,
    "current_status" TEXT,
    "done_so_far" TEXT,
    "still_left" TEXT,
    "file_links" TEXT,
    "gotchas" TEXT,
    "who_to_ask" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "handoff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "handoff_task_id_key" ON "handoff"("task_id");

-- CreateIndex
CREATE INDEX "handoff_company_id_idx" ON "handoff"("company_id");

-- CreateIndex
CREATE INDEX "handoff_to_member_id_idx" ON "handoff"("to_member_id");

-- AddForeignKey
ALTER TABLE "handoff" ADD CONSTRAINT "handoff_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handoff" ADD CONSTRAINT "handoff_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handoff" ADD CONSTRAINT "handoff_from_member_id_fkey" FOREIGN KEY ("from_member_id") REFERENCES "crew_member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handoff" ADD CONSTRAINT "handoff_to_member_id_fkey" FOREIGN KEY ("to_member_id") REFERENCES "crew_member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
