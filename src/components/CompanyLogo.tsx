import React from "react";

interface CompanyLogoProps {
  variant?: "full" | "icon" | "horizontal";
  className?: string;
  iconSize?: number;
}

export const CompanyLogo: React.FC<CompanyLogoProps> = ({
  variant = "full",
  className = "",
  iconSize = 48,
}) => {
  if (variant === "icon") {
    return (
      <div className={`relative inline-block ${className}`}>
        <img src="/logo.png" alt="SyncAI Consultancy Pvt. Ltd." width={iconSize} height={iconSize} className="object-contain" />
      </div>
    );
  }

  if (variant === "horizontal") {
    return (
      <div className={`flex items-center select-none ${className}`}>
        <img src="/logo.png" alt="SyncAI Consultancy Pvt. Ltd." style={{ height: iconSize, width: "auto" }} className="object-contain" />
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center text-center select-none ${className}`}>
      <img src="/logo.png" alt="SyncAI Consultancy Pvt. Ltd." style={{ height: iconSize * 1.5, width: "auto" }} className="object-contain" />
    </div>
  );
};
