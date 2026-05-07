import React from "react";
import type { AssetCategory, AssetTemplate } from "../types/assets";
import { fileToAsset } from "../storage/assetStorage";

interface FileUploadButtonProps {
  label: string;
  title?: string;
  category: AssetCategory;
  multiple?: boolean;
  onAssets: (assets: AssetTemplate[]) => void;
  onError: (message: string) => void;
}

export function FileUploadButton({ label, title, category, multiple = true, onAssets, onError }: FileUploadButtonProps) {
  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    if (!files.length) return;
    try {
      const assets = await Promise.all(files.map((file) => fileToAsset(file, category)));
      const large = files.find((file) => file.size > 2_500_000);
      if (large) onError("Large images may use significant browser storage and can sync slowly in multiplayer.");
      onAssets(assets);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Image upload failed.");
    }
  };

  return (
    <label className="button file-button" title={title ?? label}>
      {label}
      <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple={multiple} onChange={handleChange} />
    </label>
  );
}
