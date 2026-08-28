import type { ReactNode } from "react";

export function Panel({
  id,
  title,
  icon,
  right,
  children,
}: {
  /** anchor target so other pages can deep-link straight to this panel */
  id?: string;
  title: string;
  icon?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="fg-panel scroll-mt-24">
      <div className="fg-panel-header">
        <div className="fg-panel-title">
          {icon}
          {title}
        </div>
        {right}
      </div>
      <div className="fg-panel-body">{children}</div>
    </section>
  );
}
