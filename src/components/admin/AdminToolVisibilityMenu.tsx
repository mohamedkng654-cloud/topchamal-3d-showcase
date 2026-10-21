import { useState } from "react";
import { Settings } from "lucide-react";
import type { AdminToolOption } from "@/lib/admin-tool-preferences";

type AdminToolVisibilityMenuProps = {
  section: string;
  sectionLabel: string;
  tools: readonly AdminToolOption[];
  hiddenTools: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
};

export function AdminToolVisibilityMenu({
  section,
  sectionLabel,
  tools,
  hiddenTools,
  onToggle,
  onShowAll,
  onHideAll,
}: AdminToolVisibilityMenuProps) {
  const [open, setOpen] = useState(false);
  const panelId = `admin-tool-visibility-${section}`;

  return (
    <div className="admin-tool-visibility-anchor">
      <button
        type="button"
        className="admin-tool-visibility-button"
        onClick={() => setOpen((current) => !current)}
        aria-label={`تخصيص أدوات ${sectionLabel}`}
        aria-controls={panelId}
        aria-expanded={open}
        title={`تخصيص أدوات ${sectionLabel}`}
      >
        <Settings size={15} />
        <span>تخصيص الأدوات</span>
      </button>
      {open && (
        <div
          className="admin-tool-visibility-panel"
          id={panelId}
          role="dialog"
          aria-label={`أدوات ${sectionLabel}`}
        >
          <div className="admin-tool-visibility-heading">
            <strong>أدوات {sectionLabel}</strong>
            <div className="admin-tool-visibility-actions">
              <button type="button" onClick={onShowAll}>
                إظهار الكل
              </button>
              <button type="button" onClick={onHideAll}>
                إخفاء الكل
              </button>
            </div>
          </div>
          <p>أخفِ الأدوات التي لا تحتاجها الآن. يمكنك إظهارها مجدداً في أي وقت.</p>
          <div className="admin-tool-visibility-list">
            {tools.map((tool) => (
              <label key={tool.id} className="admin-tool-visibility-option">
                <input
                  type="checkbox"
                  checked={!hiddenTools.has(tool.id)}
                  onChange={() => onToggle(tool.id)}
                />
                <span>{tool.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
