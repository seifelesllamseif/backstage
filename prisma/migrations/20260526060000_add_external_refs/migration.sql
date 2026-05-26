-- CreateEnum
CREATE TYPE "external_ref_kind" AS ENUM ('issue', 'pr', 'commit', 'doc', 'link');

-- AlterTable
ALTER TABLE "project" ADD COLUMN "github_repo" TEXT;

-- AlterTable
ALTER TABLE "cycle" ADD COLUMN "doc_url" TEXT;

-- CreateTable
CREATE TABLE "task_external_ref" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "kind" "external_ref_kind" NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_external_ref_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_external_ref_task_id_idx" ON "task_external_ref"("task_id");

-- AddForeignKey
ALTER TABLE "task_external_ref" ADD CONSTRAINT "task_external_ref_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_external_ref" ADD CONSTRAINT "task_external_ref_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_external_ref" ADD CONSTRAINT "task_external_ref_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "crew_member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
