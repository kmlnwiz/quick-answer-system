-- AlterTable
ALTER TABLE `questions` ADD COLUMN `allow_resubmission` BOOLEAN NULL,
    ADD COLUMN `finalized_at` DATETIME(3) NULL,
    ADD COLUMN `is_finalized` BOOLEAN NOT NULL DEFAULT false;
