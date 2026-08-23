/**
 * StudentSidebar.tsx
 * Fixed left navigation — Home, Classes, Simulations.
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useStudentShell } from "./StudentShellProvider";

type NavItem = {
  key: string;
  label: string;
  icon: string;
  href: string;
};

const PRIMARY_NAV: NavItem[] = [
  { key: "home", label: "Home", icon: "home", href: "/student/dashboard" },
  { key: "classes", label: "Classes", icon: "school", href: "/student/classes" },
  { key: "simulations", label: "Simulations", icon: "model_training", href: "/student/simulations" },
];

/**
 * Resolves which primary nav item is active from the current path.
 */
function resolveActiveNav(pathname: string): string {
  if (pathname.startsWith("/student/classes")) {
    return "classes";
  }
  if (pathname.startsWith("/student/simulations")) {
    return "simulations";
  }
  if (pathname.startsWith("/student/simulation")) {
    return "simulations";
  }
  return "home";
}

/**
 * Renders the student portal left sidebar with primary section tabs.
 */
export function StudentSidebar(): React.ReactElement {
  const pathname = usePathname();
  const activeNav = resolveActiveNav(pathname);
  const { sidebarCollapsed, toggleSidebar } = useStudentShell();

  return (
    <aside
      className={`hidden md:flex flex-col h-full bg-surface-container-low border-r border-outline-variant shrink-0 transition-all duration-300 ease-in-out ${
        sidebarCollapsed ? "w-[72px] p-2" : "w-64 p-4"
      }`}
    >
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

      <nav className="flex flex-col gap-1 flex-1">
        {PRIMARY_NAV.map((item) => {
          const isActive = item.key === activeNav;
          return (
            <Link
              key={item.key}
              href={item.href}
              title={sidebarCollapsed ? item.label : undefined}
              className={`flex items-center py-2 rounded-lg transition-all duration-200 ${
                sidebarCollapsed ? "justify-center px-2" : "gap-3 px-3"
              } ${
                isActive
                  ? "bg-primary-container text-on-primary-container font-bold"
                  : "text-on-surface-variant hover:bg-surface-container-highest"
              }`}
            >
              <MaterialIcon name={item.icon} className="text-[20px] shrink-0" />
              {!sidebarCollapsed && (
                <span className="font-label-sm text-label-sm">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-4 border-t border-outline-variant">
        <p
          className={`text-outline font-label-sm text-label-sm uppercase tracking-wider ${
            sidebarCollapsed ? "text-center text-[10px]" : "px-3"
          }`}
        >
          {sidebarCollapsed ? "Stu" : "Student Portal"}
        </p>
      </div>
    </aside>
  );
}
