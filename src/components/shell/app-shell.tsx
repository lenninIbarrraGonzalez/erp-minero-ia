import type { MineOption } from "@/lib/queries/dashboard";
import { Sidebar } from "./sidebar";

interface AppShellProps {
  children: React.ReactNode;
  mines: MineOption[];
}

export async function AppShell({ children, mines }: AppShellProps) {
  return (
    <div className="flex flex-row min-h-screen">
      <Sidebar mines={mines} />
      <main className="flex-1 bg-bg min-h-screen overflow-auto">
        {children}
      </main>
    </div>
  );
}
