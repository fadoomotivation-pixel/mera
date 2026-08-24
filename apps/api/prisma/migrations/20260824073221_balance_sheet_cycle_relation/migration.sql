-- AddForeignKey
ALTER TABLE "BalanceSheetLedger" ADD CONSTRAINT "BalanceSheetLedger_closingCycleId_fkey" FOREIGN KEY ("closingCycleId") REFERENCES "ClosingCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
