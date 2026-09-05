"use client";

import { ReactNode } from "react";
import Sidebar from "./sidebar";

export type ViewKey =
  | "dashboard"
  | "chat"
  | "agents"
  | "knowledge"
  | "settings";

interface AppShellProps {
  children: ReactNode;
  active: ViewKey;
  onNavigate: (view: ViewKey) => void;
  sidebarOpen: boolean;
  onSidebarClose: () => void;
  sidebarCollapsed: boolean;
  onSidebarToggle: () => void;
}

export default function AppShell({
  children,
  active,
  onNavigate,
  sidebarOpen,
  onSidebarClose,
  sidebarCollapsed,
  onSidebarToggle,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-[#111111] p-4">
      <div className="relative min-h-[calc(100vh-2rem)] overflow-hidden rounded-[32px] bg-[#111111]">
        <Sidebar
          active={active}
          onNavigate={onNavigate}
          open={sidebarOpen}
          onClose={onSidebarClose}
          collapsed={sidebarCollapsed}
          onToggleCollapse={onSidebarToggle}
        />

        <main
          className={[
            "min-h-[calc(100vh-2rem)] transition-all duration-300",
            sidebarCollapsed ? "lg:pl-[92px]" : "lg:pl-[272px]",
          ].join(" ")}
        >
          <div className="min-h-[calc(100vh-2rem)] rounded-[30px] bg-white">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}