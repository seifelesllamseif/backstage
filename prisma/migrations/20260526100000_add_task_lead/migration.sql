-- AlterTable
ALTER TABLE "task" ADD COLUMN "lead_id" UUID;

-- CreateIndex
CREATE INDEX "task_lead_id_idx" ON "task"("lead_id");

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crew_member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
