import { useNavigate } from "react-router-dom";
import { Monitor, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface WorkspaceNavProps {
  sessionId: string;
  activePage: "config" | "matching" | "briefings";
  rightContent?: ReactNode;
  onDownloadPdf?: () => void;
  onDownloadCsv?: () => void;
}

const navItems = [
  { key: "config" as const, label: "Session Config", pathPrefix: "/admin/session/" },
  { key: "matching" as const, label: "Matching", pathPrefix: "/admin/match/" },
  { key: "briefings" as const, label: "Lead Briefings", pathPrefix: "/admin/leads/" },
];

export default function WorkspaceNav({ sessionId, activePage, rightContent, onDownloadPdf, onDownloadCsv }: WorkspaceNavProps) {
  const navigate = useNavigate();

  return (
    <div className="border-b bg-card px-4 py-0 flex items-center justify-between mb-6">
      <nav className="flex items-center gap-1">
        {navItems.map((item) => (
          <button
            key={item.key}
            onClick={() => item.key !== activePage && navigate(`${item.pathPrefix}${sessionId}`)}
            className={cn(
              "px-3 py-3 text-sm font-medium border-b-2 transition-colors",
              item.key === activePage
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            )}
          >
            {item.label}
          </button>
        ))}
        <button
          onClick={() => navigate(`/admin/present/${sessionId}`)}
          className="px-3 py-3 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 transition-colors inline-flex items-center gap-1.5"
        >
          <Monitor className="h-3.5 w-3.5" /> Present
        </button>
        {onDownloadPdf && (
          <button
            onClick={onDownloadPdf}
            className="px-3 py-3 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 transition-colors inline-flex items-center gap-1.5"
          >
            <Download className="h-3.5 w-3.5" /> PDF
          </button>
        )}
      </nav>
      {rightContent && <div className="flex gap-2">{rightContent}</div>}
    </div>
  );
}
