/**
 * StudentSidebar.tsx
 * Fixed left navigation for the student portal — Stitch visual treatment.
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { DEFAULT_CLASS_ID, DEFAULT_CLASS_NAME } from "@/lib/constants";
import { useStudentShell } from "./StudentShellProvider";

export type StudentSidebarClass = {
  classId: string;
  className: string;
};

type StudentSidebarProps = {
  enrolledClasses: StudentSidebarClass[];
};

/**
 * Renders the student portal left sidebar with enrolled class links.
 */
export function StudentSidebar({ enrolledClasses }: StudentSidebarProps): React.ReactElement {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useStudentShell();
  const onDashboard =
    pathname === "/student/dashboard" || pathname.startsWith("/student/dashboard/");

  return (
    <aside
      className={`hidden md:flex flex-col h-full bg-surface-container-low border-r border-outline-variant shrink-0 transition-all duration-300 ease-in-out ${
        sidebarCollapsed ? "w-[72px]" : "w-64"
      }`}
    >
      <div className={`flex-1 overflow-y-auto custom-scrollbar ${sidebarCollapsed ? "p-2" : "p-4"}`}>
        <button
          type="button"
          onClick={toggleSidebar}
          className={`flex items-center rounded-lg text-on-surface-variant hover:bg-surface-container-highest transition-all duration-200 h-8 mb-2 ${
            sidebarCollapsed ? "justify-center w-full" : "justify-end px-1 w-full"
          }`}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <MaterialIcon
            name={sidebarCollapsed ? "chevron_right" : "chevron_left"}
            className="text-[20px]"
          />
        </button>

        {!sidebarCollapsed && (
          <Link
            href="/student/dashboard"
            className={`block font-label-md text-label-md mb-2 px-2 uppercase tracking-wider transition-colors ${
              onDashboard && !pathname.startsWith("/student/classes")
                ? "text-on-surface"
                : "text-outline hover:text-on-surface"
            }`}
          >
            My Classes
          </Link>
        )}

        {sidebarCollapsed && (
          <Link
            href="/student/dashboard"
            title="My Classes"
            className={`flex items-center justify-center py-2 rounded-lg mb-1 transition-colors ${
              onDashboard && !pathname.startsWith("/student/classes")
                ? "bg-surface-container-high text-on-surface"
                : "text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            <MaterialIcon name="school" className="text-[20px]" />
          </Link>
        )}

        <ul className="space-y-1">
          {enrolledClasses.map((cls) => {
            const href = `/student/classes/${cls.classId}`;
            const isActive = pathname === href || pathname.startsWith(`${href}/`);
            const label =
              cls.classId === DEFAULT_CLASS_ID ? DEFAULT_CLASS_NAME : cls.className;
            const icon = cls.classId === DEFAULT_CLASS_ID ? "auto_awesome" : "folder";

            return (
              <li key={cls.classId}>
                <Link
                  href={href}
                  title={sidebarCollapsed ? label : undefined}
                  className={`flex items-center rounded-lg transition-colors font-label-md text-label-md ${
                    sidebarCollapsed ? "justify-center px-2 py-2" : "gap-2 px-2 py-2"
                  } ${
                    isActive
                      ? "bg-surface-container-high text-on-surface"
                      : "text-on-surface-variant hover:bg-surface-container"
                  }`}
                >
                  <MaterialIcon name={icon} className="text-[20px] shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">{label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div
        className={`border-t border-outline-variant text-center ${
          sidebarCollapsed ? "p-2" : "p-4"
        }`}
      >
        <span
          className={`font-label-sm text-label-sm text-outline uppercase tracking-wider ${
            sidebarCollapsed ? "text-[10px]" : ""
          }`}
        >
          {sidebarCollapsed ? "Stu" : "Student Portal"}
        </span>
      </div>
    </aside>
  );
}
