"use client";

import React, { useEffect, useRef } from "react";

interface TradingViewFullWidgetProps {
  symbol?: string;
  height?: number | string;
  theme?: "light" | "dark";
}

const TradingViewFullWidget: React.FC<TradingViewFullWidgetProps> = ({
  symbol = "NASDAQ:NDX",
  height = 400,
  theme = "light",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      // Clear any existing content
      containerRef.current.innerHTML = "";

      // Create script element
      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/tv.js";
      script.async = true;

      script.onload = () => {
        if (window.TradingView) {
          new window.TradingView.widget({
            container_id: containerRef.current?.id || "tradingview-widget",
            width: "100%",
            height: height,
            symbol: symbol,
            interval: "D",
            timezone: "Etc/UTC",
            theme: theme,
            style: "1",
            locale: "en",
            toolbar_bg: "#f1f3f6",
            enable_publishing: false,
            allow_symbol_change: true,
            details: false,
            hotlist: true,
            calendar: false,
            studies: [],
            show_popup_button: true,
            popup_width: "1000",
            popup_height: "650",
            hide_side_toolbar: false,
            hide_top_toolbar: false,
            hide_volume: true,
            hide_legend: true,
            withdateranges: false,
            hide_symbol_search: true,
            save_image: false,
          });
        }
      };

      // Generate unique ID for container
      const uniqueId = `tradingview-full-widget-${Date.now()}`;
      containerRef.current.id = uniqueId;

      document.head.appendChild(script);

      return () => {
        // Cleanup
        document.head.removeChild(script);
      };
    }
  }, [symbol, height, theme]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: `${height}px`,
        backgroundColor: "#ffffff",
        border: "1px solid #e1e1e1",
        borderRadius: "4px",
      }}
    />
  );
};

// Declare TradingView on window object
declare global {
  interface Window {
    TradingView: any;
  }
}

export default TradingViewFullWidget;
