-- CreateTable
CREATE TABLE "project_external_ref" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "kind" "external_ref_kind" NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_external_ref_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_external_ref_project_id_idx" ON "project_external_ref"("project_id");

-- AddForeignKey
ALTER TABLE "project_external_ref" ADD CONSTRAINT "project_external_ref_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_external_ref" ADD CONSTRAINT "project_external_ref_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_external_ref" ADD CONSTRAINT "project_external_ref_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "crew_member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
