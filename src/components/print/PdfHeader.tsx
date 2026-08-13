import appLogo from "../../assets/cineflow-app-icon.png";

interface PdfHeaderProps {
  projectName: string;
  dateStr: string;
  logoSrc?: string;
  appVersion: string;
}

export function PdfHeader({ projectName, dateStr, logoSrc, appVersion }: PdfHeaderProps) {
  const headerLogo = logoSrc || appLogo;

  return (
    <div className="print-header">
      <div className="print-header-left">
        <div className="print-logo-custom">
          <img src={headerLogo} alt="Logo" style={{ height: "32px" }} />
        </div>
      </div>
      <div className="print-header-center">
        <div className="print-project-name">{projectName}</div>
        <div className="print-date">{dateStr}</div>
      </div>
      <div className="print-header-right">
        <div className="print-subtitle">CineFlow Suite v{appVersion}</div>
      </div>
      <div className="print-smart-copy">
        Generated with CineFlow Suite v{appVersion} — an offline, professional media control tool built for creative teams. Designed to verify, review, organize, and deliver production footage with confidence.
      </div>
    </div>
  );
}
