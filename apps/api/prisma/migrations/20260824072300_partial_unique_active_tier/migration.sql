-- Structural guard: at most one ACTIVE TierAchievement per partner at any time.
-- Prisma's schema DSL cannot express a partial/filtered unique index, so it is
-- added here directly. This backs up (does not replace) the transactional
-- supersession logic in RoyaltyService.
CREATE UNIQUE INDEX "TierAchievement_partner_active_unique"
  ON "TierAchievement" ("partnerId")
  WHERE "status" = 'ACTIVE';
