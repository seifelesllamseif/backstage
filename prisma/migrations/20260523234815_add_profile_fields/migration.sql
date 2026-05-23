-- AlterTable
ALTER TABLE "crew_member" ADD COLUMN     "avatar_url" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "social_instagram" TEXT,
ADD COLUMN     "social_linkedin" TEXT,
ADD COLUMN     "social_whatsapp" TEXT;
