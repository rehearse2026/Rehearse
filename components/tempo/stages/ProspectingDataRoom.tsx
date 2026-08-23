/**
 * ProspectingDataRoom.tsx
 * Prospecting research step: browse 10 roster companies, read Profile/News,
 * and shortlist exactly 3 leads via ProspectingShortlistForm.
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ProspectingShortlistForm } from "@/components/tempo/stages/ProspectingShortlistForm";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { DataRoomCompany } from "@/app/api/student/data-room/route";
import type { CrmLead } from "@/types";

type ShortlistEntry = {
  leadId: string;
  companyId: string;
  companyName: string;
};

type ProspectingDataRoomProps = {
  attemptId: string;
  selectedCompanyId: string | null;
  onSelectCompany: (companyId: string) => void;
  /** Syncs shortlisted company ids into wizard advance logic. */
  onShortlistChange: (companyIds: string[]) => void;
  onContinue?: () => void;
  canContinue?: boolean;
};

/**
 * Left roster list + center document viewer + shortlist tray.
 */
export function ProspectingDataRoom({
  attemptId,
  selectedCompanyId,
  onSelectCompany,
  onShortlistChange,
  onContinue,
  canContinue = false,
}: ProspectingDataRoomProps): React.ReactElement {
  const [companies, setCompanies] = useState<DataRoomCompany[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [docTab, setDocTab] = useState<"profile" | "news">("profile");
  const [shortlist, setShortlist] = useState<ShortlistEntry[]>([]);
  const [formCompany, setFormCompany] = useState<DataRoomCompany | null>(null);
  const [removingLeadId, setRemovingLeadId] = useState<string | null>(null);

  const syncShortlistFromLeads = useCallback(
    (leads: CrmLead[], roster: DataRoomCompany[]): ShortlistEntry[] => {
      const byName = new Map(roster.map((c) => [c.name.trim().toLowerCase(), c]));
      const entries: ShortlistEntry[] = [];
      for (const lead of leads) {
        if (lead.status !== "shortlisted") {
          continue;
        }
        const company = byName.get(lead.company_name.trim().toLowerCase());
        if (!company) {
          continue;
        }
        entries.push({
          leadId: lead.id,
          companyId: company.id,
          companyName: company.name,
        });
      }
      return entries;
    },
    []
  );

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const [roomRes, leadsRes] = await Promise.all([
          fetch(`/api/student/data-room?attemptId=${encodeURIComponent(attemptId)}`),
          fetch(`/api/student/crm-leads?attemptId=${encodeURIComponent(attemptId)}`),
        ]);

        if (!roomRes.ok) {
          if (!cancelled) {
            setError("Could not load Data Room.");
          }
          return;
        }

        const roomBody = (await roomRes.json()) as { companies?: DataRoomCompany[] };
        const nextCompanies = roomBody.companies ?? [];

        let nextShortlist: ShortlistEntry[] = [];
        if (leadsRes.ok) {
          const leadsBody = (await leadsRes.json()) as { leads?: CrmLead[] };
          nextShortlist = syncShortlistFromLeads(leadsBody.leads ?? [], nextCompanies);
        }

        if (!cancelled) {
          setCompanies(nextCompanies);
          setShortlist(nextShortlist);
          onShortlistChange(nextShortlist.map((e) => e.companyId));
        }
      } catch {
        if (!cancelled) {
          setError("Could not load Data Room.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return companies;
    }
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.industry.toLowerCase().includes(q) ||
        c.sizeLabel.toLowerCase().includes(q)
    );
  }, [companies, search]);

  const selected =
    selectedCompanyId === null
      ? null
      : companies.find((c) => c.id === selectedCompanyId) ?? null;

  const shortlistedIds = useMemo(
    () => new Set(shortlist.map((e) => e.companyId)),
    [shortlist]
  );
  const shortlistFull = shortlist.length >= 3;
  const selectedIsShortlisted = selected ? shortlistedIds.has(selected.id) : false;

  const activeDoc = useMemo(() => {
    if (!selected) {
      return null;
    }
    return selected.documents.find((d) => d.type === docTab) ?? selected.documents[0] ?? null;
  }, [docTab, selected]);

  const handleShortlistSaved = (lead: CrmLead): void => {
    if (!formCompany) {
      return;
    }
    const next = [
      ...shortlist.filter((e) => e.companyId !== formCompany.id),
      {
        leadId: lead.id,
        companyId: formCompany.id,
        companyName: formCompany.name,
      },
    ];
    setShortlist(next);
    onShortlistChange(next.map((e) => e.companyId));
    setFormCompany(null);
  };

  const handleRemoveShortlist = async (entry: ShortlistEntry): Promise<void> => {
    if (removingLeadId) {
      return;
    }
    setRemovingLeadId(entry.leadId);
    try {
      const res = await fetch(`/api/student/crm-leads/${encodeURIComponent(entry.leadId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        return;
      }
      const next = shortlist.filter((e) => e.leadId !== entry.leadId);
      setShortlist(next);
      onShortlistChange(next.map((e) => e.companyId));
    } finally {
      setRemovingLeadId(null);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[520px] border border-outline-variant rounded-xl overflow-hidden bg-surface">
      <div className="flex flex-col lg:flex-row flex-1 min-h-0">
        {/* Left: company list */}
        <section className="w-full lg:w-[280px] xl:w-[300px] flex flex-col bg-surface-container-lowest border-b lg:border-b-0 lg:border-r border-outline-variant shrink-0 min-h-0">
          <div className="p-3 border-b border-outline-variant shrink-0">
            <div className="mb-2">
              <nav className="flex items-center gap-0.5 text-[10px] leading-tight text-on-surface-variant mb-0.5">
                <span>Prospecting</span>
                <MaterialIcon name="chevron_right" className="text-[12px]" />
                <span className="text-primary font-bold">Data Room</span>
              </nav>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-primary leading-tight">
                    Candidate Companies
                  </h2>
                  <p className="text-[11px] text-on-surface-variant leading-tight">
                    Read the documents, then shortlist three accounts.
                  </p>
                </div>
                <span className="shrink-0 bg-surface-container-high px-1.5 py-0.5 rounded text-[10px] text-on-surface-variant">
                  {companies.length} Companies
                </span>
              </div>
            </div>
            <div className="relative">
              <MaterialIcon
                name="search"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]"
              />
              <input
                className="w-full h-8 pl-9 pr-3 bg-surface-container border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-secondary/50 focus:border-secondary outline-none transition-all"
                placeholder="Search companies..."
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
            {isLoading ? (
              <p className="text-body-md text-on-surface-variant py-4 text-center">Loading…</p>
            ) : error ? (
              <p className="text-sm text-error py-4 text-center">{error}</p>
            ) : filtered.length === 0 ? (
              <p className="text-body-md text-on-surface-variant py-4 text-center">No matches.</p>
            ) : (
              filtered.map((company) => {
                const isSelected = selectedCompanyId === company.id;
                const isShortlisted = shortlistedIds.has(company.id);
                return (
                  <button
                    key={company.id}
                    type="button"
                    onClick={() => {
                      setDocTab("profile");
                      onSelectCompany(company.id);
                    }}
                    className={`w-full text-left p-2.5 rounded-lg cursor-pointer transition-all group active:scale-[0.99] border ${
                      isSelected
                        ? "bg-surface border-2 border-secondary shadow-sm"
                        : "bg-surface border-outline-variant hover:border-outline hover:shadow-sm"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1 gap-1.5">
                      <h3
                        className={`text-[13px] leading-tight font-bold transition-colors ${
                          isSelected
                            ? "text-primary"
                            : "text-on-surface group-hover:text-primary"
                        }`}
                      >
                        {company.name}
                      </h3>
                      <span className="text-[9px] leading-tight px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant shrink-0">
                        {company.industry}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1 text-[10px] leading-tight text-on-surface-variant">
                      <span className="inline-flex items-center gap-1">
                        <MaterialIcon name="groups" className="text-[12px]" />
                        {company.sizeLabel}
                      </span>
                      {isShortlisted ? (
                        <span className="inline-flex items-center gap-0.5 text-secondary font-bold">
                          <MaterialIcon name="bookmark" className="text-[12px]" />
                          Shortlisted
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Center: documents */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-surface-container-low">
          {selected ? (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-4 pt-4 pb-3 border-b border-outline-variant bg-surface-container-lowest shrink-0">
                <h3 className="font-headline-md text-headline-md text-primary mb-1">
                  {selected.name}
                </h3>
                <p className="text-body-md text-on-surface-variant mb-3">
                  {selected.industry} · {selected.sizeLabel}
                </p>
                <div className="inline-flex rounded-lg border border-outline-variant overflow-hidden">
                  {(["profile", "news"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setDocTab(tab)}
                      className={`px-4 h-9 text-label-md font-bold capitalize transition-colors ${
                        docTab === tab
                          ? "bg-primary-container text-on-primary"
                          : "bg-white text-on-surface hover:bg-surface-container"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {activeDoc ? (
                  <article className="bg-white border border-outline-variant rounded-xl p-5 shadow-sm">
                    <h4 className="font-headline-md text-headline-md text-on-surface mb-3">
                      {activeDoc.title}
                    </h4>
                    <div className="text-body-md text-on-surface leading-relaxed whitespace-pre-wrap">
                      {activeDoc.content}
                    </div>
                  </article>
                ) : (
                  <p className="text-body-md text-on-surface-variant">
                    No document available for this view yet.
                  </p>
                )}
              </div>

              <div className="p-4 border-t border-outline-variant bg-surface-container-lowest shrink-0 flex flex-wrap items-center justify-between gap-3">
                <p className="text-label-sm text-on-surface-variant">
                  {shortlistFull && !selectedIsShortlisted
                    ? "3/3 — remove one to add another"
                    : selectedIsShortlisted
                      ? "This company is already on your shortlist."
                      : "Shortlist up to three companies after reading their docs."}
                </p>
                <button
                  type="button"
                  disabled={selectedIsShortlisted || shortlistFull}
                  onClick={() => setFormCompany(selected)}
                  className={`h-10 px-5 rounded-lg font-bold text-label-md transition-colors ${
                    selectedIsShortlisted || shortlistFull
                      ? "bg-surface-container-highest text-on-surface-variant/40 cursor-not-allowed"
                      : "bg-primary-container text-on-primary hover:bg-primary"
                  }`}
                >
                  Shortlist This Company
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-xl relative overflow-hidden">
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 2px 2px, #e2e8f0 1px, transparent 0)",
                  backgroundSize: "24px 24px",
                }}
              />
              <div className="relative z-10 text-center max-w-md">
                <div className="w-24 h-24 bg-surface rounded-2xl border border-outline-variant shadow-lg flex items-center justify-center mx-auto mb-lg">
                  <MaterialIcon name="folder_open" className="text-[48px] text-outline" />
                </div>
                <h3 className="font-display text-display text-primary mb-md">Open the Data Room</h3>
                <p className="text-body-lg text-on-surface-variant leading-relaxed">
                  Select a company to read its Profile and News documents, then shortlist the three
                  accounts you want to pursue.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Shortlist tray */}
      <div className="border-t border-outline-variant bg-surface-container-lowest px-4 py-3 flex flex-wrap items-center gap-3 shrink-0">
        <div className="flex items-center gap-2 shrink-0">
          <MaterialIcon name="bookmarks" className="text-secondary text-[18px]" />
          <span className="font-label-md text-label-md font-bold text-on-surface">
            My Shortlist ({shortlist.length}/3)
          </span>
        </div>
        <div className="flex-1 flex flex-wrap gap-2 min-w-0">
          {shortlist.length === 0 ? (
            <span className="text-label-sm text-on-surface-variant">No companies shortlisted yet.</span>
          ) : (
            shortlist.map((entry) => (
              <span
                key={entry.leadId}
                className="inline-flex items-center gap-1.5 h-8 pl-3 pr-1.5 rounded-full bg-secondary-container/30 text-on-surface text-label-sm font-bold border border-secondary/20"
              >
                {entry.companyName}
                <button
                  type="button"
                  disabled={removingLeadId === entry.leadId}
                  onClick={() => void handleRemoveShortlist(entry)}
                  className="w-6 h-6 rounded-full hover:bg-white/70 flex items-center justify-center text-on-surface-variant"
                  aria-label={`Remove ${entry.companyName}`}
                >
                  <MaterialIcon name="close" className="text-[14px]" />
                </button>
              </span>
            ))
          )}
        </div>
        {onContinue ? (
          <button
            type="button"
            disabled={!canContinue}
            onClick={onContinue}
            className={`h-9 px-4 rounded-lg font-bold text-label-md shrink-0 transition-colors ${
              canContinue
                ? "bg-primary-container text-on-primary hover:bg-primary"
                : "bg-surface-container-highest text-on-surface-variant/40 cursor-not-allowed"
            }`}
          >
            Continue
          </button>
        ) : null}
      </div>

      {formCompany ? (
        <ProspectingShortlistForm
          attemptId={attemptId}
          company={formCompany}
          onCancel={() => setFormCompany(null)}
          onSaved={handleShortlistSaved}
        />
      ) : null}
    </div>
  );
}
