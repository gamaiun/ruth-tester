"use client";

import React, { useState } from "react";
import TradingChartsContainer from "../components/TradingChartsContainer";
import FileUpload from "../components/FileUpload";

export default function Home() {
  const [uploadedData, setUploadedData] = useState<any>(null);
  const [showUpload, setShowUpload] = useState(true);
  const [prevCloseTime, setPrevCloseTime] = useState<string>("16:00"); // 4:00 PM in 24-hour format
  const [currentOpenTime, setCurrentOpenTime] = useState<string>("07:00"); // 7:00 AM in 24-hour format

  const handleFileUploaded = (data: any, file?: File) => {
    setUploadedData(data);
    setShowUpload(false);
  };

  return (
    <div className="fullscreen-container">
      {showUpload ? (
        <div className="upload-view">
          <h1 className="app-title">Trading Data Visualizer</h1>
          <p className="app-description">
            Upload your CSV file with trading data to visualize it on
            interactive charts
          </p>
          <FileUpload
            onFileUploaded={handleFileUploaded}
            prevCloseTime={prevCloseTime}
            currentOpenTime={currentOpenTime}
          />
        </div>
      ) : (
        <div className="chart-view">
          {/* Charts take full space */}
          <TradingChartsContainer customData={uploadedData} />
        </div>
      )}
    </div>
  );
}
