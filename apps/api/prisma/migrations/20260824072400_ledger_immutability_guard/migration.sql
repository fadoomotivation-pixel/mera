-- Financial immutability guard (defense in depth beyond the service layer):
-- LedgerEntry rows may NEVER be hard-deleted, and once posted their money
-- fields, type, source, and rule-version linkage may never change.
-- The only mutable field is `status` (POSTED -> VOID | REVERSED | ADJUSTED),
-- which is how the application marks a correction without rewriting history.

CREATE OR REPLACE FUNCTION prevent_ledger_entry_delete() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'LedgerEntry rows are immutable and cannot be deleted (id=%). Use status VOID/REVERSED/ADJUSTED plus an offsetting Adjustment instead.', OLD.id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ledger_entry_no_delete
  BEFORE DELETE ON "LedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION prevent_ledger_entry_delete();

CREATE OR REPLACE FUNCTION prevent_ledger_entry_financial_mutation() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."grossAmountPaise" IS DISTINCT FROM OLD."grossAmountPaise"
     OR NEW."deductionAmountPaise" IS DISTINCT FROM OLD."deductionAmountPaise"
     OR NEW."netAmountPaise" IS DISTINCT FROM OLD."netAmountPaise"
     OR NEW."type" IS DISTINCT FROM OLD."type"
     OR NEW."sourceType" IS DISTINCT FROM OLD."sourceType"
     OR NEW."sourceId" IS DISTINCT FROM OLD."sourceId"
     OR NEW."ruleVersionId" IS DISTINCT FROM OLD."ruleVersionId"
     OR NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey"
     OR NEW."entryDate" IS DISTINCT FROM OLD."entryDate" THEN
    RAISE EXCEPTION 'LedgerEntry financial fields are immutable once posted (id=%). Only `status` may change.', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ledger_entry_no_financial_mutation
  BEFORE UPDATE ON "LedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION prevent_ledger_entry_financial_mutation();
