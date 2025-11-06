"use client";

import React, { useState, useEffect, useRef } from "react";
import TradingViewWidget from "./TradingViewWidget";
import TradingViewFullWidget from "./TradingViewFullWidget";
import CustomTradingChart from "./CustomTradingChart";

interface TradingChartsContainerProps {
  customData?: any;
}

const TradingChartsContainer: React.FC<TradingChartsContainerProps> = ({
  customData,
}) => {
  const [containerHeight, setContainerHeight] = useState(600);
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const height = containerRef.current.clientHeight;
        setContainerHeight(height);
      }
    };

    // Initial height calculation
    setTimeout(updateHeight, 100);

    // Update on resize
    window.addEventListener("resize", updateHeight);

    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  // Each chart gets half the container height minus padding and gap
  const chartHeight = Math.floor((containerHeight - 16 - 8) / 2); // 16px padding, 8px gap

  return (
    <section ref={containerRef} className="trading-charts">
      {/* Full TradingView Widget - NASDAQ 100 */}
      <div className="full-widget-container">
        <TradingViewFullWidget
          symbol="NASDAQ:NDX"
          height={chartHeight}
          theme="light"
        />
      </div>

      {/* Custom Chart or Light Widget */}
      <div className="single-chart-container">
        {customData && customData.chart_data ? (
          <CustomTradingChart
            data={customData.chart_data}
            height={chartHeight}
            filename={customData.filename}
          />
        ) : (
          <TradingViewWidget
            symbol="NASDAQ:NDX"
            height={chartHeight}
            theme="light"
            allow_symbol_change={false}
          />
        )}
      </div>
    </section>
  );
};

export default TradingChartsContainer;
