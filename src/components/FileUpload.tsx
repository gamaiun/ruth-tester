"use client";

import React, { useState, useRef } from "react";
import "./FileUpload.css";

interface FileUploadProps {
  onFileUploaded: (data: any, file?: File) => void;
  prevCloseTime?: string;
  currentOpenTime?: string;
}

export default function FileUpload({
  onFileUploaded,
  prevCloseTime,
  currentOpenTime,
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setUploadStatus("Please select a CSV file");
      return;
    }

    setIsUploading(true);
    setUploadStatus("Uploading and processing...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Add time parameters if they are provided
      if (prevCloseTime) {
        formData.append("prev_close_time", prevCloseTime);
      }
      if (currentOpenTime) {
        formData.append("current_open_time", currentOpenTime);
      }

      const response = await fetch(
        "https://ruth-tester-backend.onrender.com/upload-csv",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      setUploadStatus("File uploaded successfully!");
      onFileUploaded(result, file);

      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Upload error:", error);
      setUploadStatus(
        `Upload failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsUploading(false);
    }
  };

  const openFileSelector = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="file-upload-container">
      <div
        className={`file-upload-area ${isDragOver ? "drag-over" : ""} ${
          isUploading ? "uploading" : ""
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openFileSelector}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          style={{ display: "none" }}
        />

        <div className="upload-icon">{isUploading ? "⏳" : "📁"}</div>

        <div className="upload-text">
          {isUploading ? (
            <span>Processing your CSV file...</span>
          ) : (
            <>
              <span className="primary-text">Drop your CSV file here</span>
              <span className="secondary-text">or click to browse</span>
            </>
          )}
        </div>
      </div>

      {uploadStatus && (
        <div
          className={`upload-status ${
            uploadStatus.includes("failed") || uploadStatus.includes("Please")
              ? "error"
              : "success"
          }`}
        >
          {uploadStatus}
        </div>
      )}
    </div>
  );
}
