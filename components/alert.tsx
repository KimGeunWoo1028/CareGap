type AlertProps = {
  tone?: "error" | "info" | "success" | "warning";
  title?: string;
  children: React.ReactNode;
  live?: boolean;
};

export function Alert({
  tone = "info",
  title,
  children,
  live = false,
}: AlertProps) {
  return (
    <div
      className={`alert alert--${tone}`}
      role={tone === "error" ? "alert" : "region"}
      aria-label={title ?? (tone === "error" ? "오류" : "안내")}
      aria-live={live || tone === "error" ? "assertive" : "polite"}
    >
      {title ? <strong className="alert__title">{title}</strong> : null}
      <div className="alert__body">{children}</div>
    </div>
  );
}
