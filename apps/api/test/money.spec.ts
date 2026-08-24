import { describe, it, expect } from "vitest";
import { applyBps, rupeesToPaise, splitEqually, formatPaiseAsInr } from "../src/domain/money.js";

describe("money", () => {
  it("computes 10% referral commission on ₹3,50,000 as ₹35,000", () => {
    const base = rupeesToPaise(350_000);
    expect(applyBps(base, 1000)).toBe(rupeesToPaise(35_000));
  });

  it("computes 5% admin charge and 2% TDS on ₹35,000 gross", () => {
    const gross = rupeesToPaise(35_000);
    expect(applyBps(gross, 500)).toBe(rupeesToPaise(1_750));
    expect(applyBps(gross, 200)).toBe(rupeesToPaise(700));
  });

  it("computes 1% ROI monthly on ₹3,50,000 as ₹3,500", () => {
    const base = rupeesToPaise(350_000);
    expect(applyBps(base, 100)).toBe(rupeesToPaise(3_500));
  });

  it("computes 2% royalty pool on ₹1,00,00,000 turnover as ₹2,00,000", () => {
    const turnover = rupeesToPaise(1_00_00_000);
    expect(applyBps(turnover, 200)).toBe(rupeesToPaise(2_00_000));
  });

  it("splits ₹2,00,000 royalty pool equally among 4 achievers", () => {
    const pool = rupeesToPaise(2_00_000);
    const shares = splitEqually(pool, 4);
    expect(shares).toEqual([rupeesToPaise(50_000), rupeesToPaise(50_000), rupeesToPaise(50_000), rupeesToPaise(50_000)]);
    expect(shares.reduce((a, b) => a + b, 0n)).toBe(pool);
  });

  it("splits an indivisible pool without losing or inventing a paisa", () => {
    const pool = 1000n; // 10 paise per share won't divide evenly across 3
    const shares = splitEqually(pool, 3);
    expect(shares.reduce((a, b) => a + b, 0n)).toBe(pool);
    expect(shares).toEqual([334n, 333n, 333n]);
  });

  it("formats paise as Indian-grouped rupees", () => {
    expect(formatPaiseAsInr(rupeesToPaise(351_000))).toBe("₹3,51,000.00");
    expect(formatPaiseAsInr(rupeesToPaise(1_00_00_000))).toBe("₹1,00,00,000.00");
  });
});
