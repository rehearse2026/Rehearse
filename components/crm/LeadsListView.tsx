/**
 * LeadsListView.tsx
 * CRM Leads list — multi-entry table with New/Converted status badges.
 */

"use client";

import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { CrmLead } from "@/types";

type LeadsListViewProps = {
  leads: CrmLead[];
  onAddLead: () => void;
  onOpenLead: (leadId: string) => void;
};

/**
 * Status badge for a Lead row.
 */
function StatusBadge({ status }: { status: CrmLead["status"] }): React.ReactElement {
  if (status === "converted") {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full bg-[#0f4c4c] text-white text-[10px] font-bold uppercase tracking-widest">
        Converted
      </span>
    );
  }
  if (status === "selected") {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full bg-[#acc7ff] text-[#00315f] text-[10px] font-bold uppercase tracking-widest">
        Selected as Target
      </span>
    );
  }
  if (status === "shortlisted") {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full bg-[#ffdcc1] text-[#6c3a00] text-[10px] font-bold uppercase tracking-widest">
        Shortlisted
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-1 rounded-full bg-[#e3eae6] text-[#404848] text-[10px] font-bold uppercase tracking-widest">
      New
    </span>
  );
}

/**
 * Table of Leads for the current attempt.
 */
export function LeadsListView({
  leads,
  onAddLead,
  onOpenLead,
}: LeadsListViewProps): React.ReactElement {
  return (
    <div className="p-6 flex-grow overflow-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="text-2xl font-semibold tracking-tight text-[#003434]">Leads</h3>
            <p className="text-sm text-[#404848] mt-1">
              Capture companies you are researching. Select your target in the Prospecting
              simulation — conversion happens automatically when that stage completes.
            </p>
          </div>
          <button
            type="button"
            onClick={onAddLead}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0f4c4c] text-white text-[12px] font-medium tracking-wide hover:brightness-110"
          >
            <MaterialIcon name="add" className="text-[16px]" />
            Add Lead
          </button>
        </header>

        <div className="bg-white border border-[#bfc8c8] rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
          {leads.length > 0 ? (
            <>
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#eef5f2]">
                  <tr>
                    <th className="px-6 py-4 text-[12px] font-medium tracking-wide text-[#404848] border-b border-[#bfc8c8]">
                      Company
                    </th>
                    <th className="px-6 py-4 text-[12px] font-medium tracking-wide text-[#404848] border-b border-[#bfc8c8]">
                      Contact
                    </th>
                    <th className="px-6 py-4 text-[12px] font-medium tracking-wide text-[#404848] border-b border-[#bfc8c8]">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => {
                    const company = lead.company_name.trim() || "Untitled lead";
                    const contact = lead.contact_name.trim() || "—";
                    return (
                      <tr
                        key={lead.id}
                        className="group hover:bg-[#eef5f2] transition-colors duration-150 cursor-pointer"
                        onClick={() => onOpenLead(lead.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onOpenLead(lead.id);
                          }
                        }}
                        tabIndex={0}
                        role="link"
                        aria-label={`Open lead ${company}`}
                      >
                        <td className="px-6 py-6 border-b border-[#bfc8c8]">
                          <span className="text-sm text-[#161d1b] font-medium">{company}</span>
                        </td>
                        <td className="px-6 py-6 border-b border-[#bfc8c8]">
                          <span className="text-sm text-[#404848]">{contact}</span>
                        </td>
                        <td className="px-6 py-6 border-b border-[#bfc8c8]">
                          <StatusBadge status={lead.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="px-6 py-4 bg-white border-t border-[#bfc8c8] text-[12px] text-[#404848]">
                {leads.length} of {leads.length} lead{leads.length === 1 ? "" : "s"}
              </div>
            </>
          ) : (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-[#707978]">
                No leads yet. Add a Lead for the company you are researching.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
