import type { JSX } from "react";
import { useRef, useState } from "react";

import "./Input.css";

type Props = Readonly<{
  "data-test-id"?: string;
  accept?: string;
  label: string;
  onChange: (files: FileList | null) => void;
}>;

export default function FileInput({
  accept,
  label,
  onChange,
  "data-test-id": dataTestId,
}: Props): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<string>("");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    setSelectedFile(files && files.length > 0 ? files[0].name : "");
    onChange(files);
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="Input__wrapper">
      <label className="Input__label">{label}</label>
      <div className="Input__input FileInput__container">
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          className="FileInput__hidden"
          onChange={handleFileSelect}
          data-test-id={dataTestId}
        />
        <button
          type="button"
          className="FileInput__button"
          onClick={handleButtonClick}
        >
          Choose File
        </button>
        <span className="FileInput__filename">
          {selectedFile || "No file chosen"}
        </span>
      </div>
    </div>
  );
}
