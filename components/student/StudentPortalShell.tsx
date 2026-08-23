/**
 * StudentPortalShell.tsx
 * Full-viewport student layout — header, optional sidebar, scrollable main content.
 * Sidebar hidden during active simulation stages (full-screen runner).
 */

"use client";

import { usePathname } from "next/navigation";
import { StudentDashboardHeader } from "./StudentDashboardHeader";
import { StudentShellProvider } from "./StudentShellProvider";
import { StudentSidebar } from "./StudentSidebar";

type StudentPortalShellProps = {
  displayName: string;
  classCount: number;
  children: React.ReactNode;
};

/**
 * Returns true when the student is inside the live simulation runner (no chrome).
 */
function shouldHideSidebar(pathname: string): boolean {
  return /^\/student\/simulation\/[^/]+$/.test(pathname);
}

/**
 * Wraps authenticated student pages with portal chrome.
 */
export function StudentPortalShell({
  displayName,
  classCount,
  children,
}: StudentPortalShellProps): React.ReactElement {
  const pathname = usePathname();
  const hideSidebar = shouldHideSidebar(pathname);

  return (
    <StudentShellProvider>
      <div className="fixed inset-0 z-40 flex flex-col bg-surface overflow-hidden font-body-md text-body-md text-on-surface">
        {!hideSidebar && (
          <StudentDashboardHeader displayName={displayName} classCount={classCount} />
        )}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {!hideSidebar && <StudentSidebar />}
          <main className="flex-1 overflow-y-auto custom-scrollbar bg-background">{children}</main>
        </div>
      </div>
    </StudentShellProvider>
  );
}
