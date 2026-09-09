import React from "react";
import logoSrc from "../assets/logo.png";

interface CompanyLogoProps {
  variant?: "full" | "icon" | "horizontal";
  className?: string;
  iconSize?: number;
}

// Official SyncAI Consultancy Pvt. Ltd. logo (single source image, used everywhere)
export const CompanyLogo: React.FC<CompanyLogoProps> = ({
  variant = "full",
  className = "",
  iconSize = 48,
}) => {
  // Logo artwork's intrinsic aspect ratio (width / height) so sizing scales cleanly.
  const ASPECT_RATIO = 500 / 214;

  if (variant === "icon") {
    return (
      <div className={`relative inline-block ${className}`}>
        <img
          src={logoSrc}
          alt="SyncAI Consultancy Pvt. Ltd."
          style={{ height: iconSize, width: iconSize * ASPECT_RATIO }}
          className="object-contain select-none"
          draggable={false}
        />
      </div>
    );
  }

  if (variant === "horizontal") {
    return (
      <div className={`flex items-center select-none ${className}`}>
        <img
          src={logoSrc}
          alt="SyncAI Consultancy Pvt. Ltd."
          style={{ height: iconSize, width: iconSize * ASPECT_RATIO }}
          className="object-contain"
          draggable={false}
        />
      </div>
    );
  }

  // Full Stack Majestic Branding View (Default)
  const fullHeight = Math.round(iconSize * 1.6);
  return (
    <div className={`flex flex-col items-center text-center select-none ${className}`}>
      <img
        src={logoSrc}
        alt="SyncAI Consultancy Pvt. Ltd."
        style={{ height: fullHeight, width: fullHeight * ASPECT_RATIO }}
        className="object-contain"
        draggable={false}
      />
    </div>
  );
};
