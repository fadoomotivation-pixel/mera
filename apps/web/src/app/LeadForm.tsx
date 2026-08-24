"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";

export function LeadForm() {
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    const form = new FormData(e.currentTarget);
    try {
      await api.post("/api/v1/public/leads", {
        name: form.get("name"),
        phone: form.get("phone"),
        preferredPlotSize: form.get("preferredPlotSize") || undefined,
        message: form.get("message") || undefined,
        source: "DIRECT",
        consentGiven: true,
      });
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  if (status === "done") {
    return (
      <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-6 text-green-800">
        Thank you! Our team will reach out shortly to confirm your site visit.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-2xl border border-brand-100 bg-white p-6 shadow-sm">
      <div>
        <label className="text-sm font-medium text-ink-900">Name</label>
        <input name="name" required className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2" />
      </div>
      <div>
        <label className="text-sm font-medium text-ink-900">Mobile Number</label>
        <input name="phone" required className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2" />
      </div>
      <div>
        <label className="text-sm font-medium text-ink-900">Preferred Plot Size (optional)</label>
        <input name="preferredPlotSize" className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2" />
      </div>
      <div>
        <label className="text-sm font-medium text-ink-900">Message (optional)</label>
        <textarea name="message" rows={3} className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2" />
      </div>
      {status === "error" && <p className="text-sm text-red-600">{errorMsg}</p>}
      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full rounded-full bg-brand-700 px-6 py-3 font-semibold text-white shadow hover:bg-brand-800 disabled:opacity-60"
      >
        {status === "submitting" ? "Submitting…" : "Book a Site Visit"}
      </button>
    </form>
  );
}
