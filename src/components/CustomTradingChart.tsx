"use client";

import React, { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  IChartApi,
  ISeriesApi,
} from "lightweight-charts";

interface CustomTradingChartProps {
  data: any[];
  height: number;
  filename?: string;
}

export default function CustomTradingChart({
  data,
  height,
  filename = "Custom Data",
}: CustomTradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || !data || data.length === 0) return;

    // Create the chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      layout: {
        background: { color: "#ffffff" },
        textColor: "#333333",
        fontSize: 14,
      },
      grid: {
        vertLines: { color: "#f0f0f0" },
        horzLines: { color: "#f0f0f0" },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: "#cccccc",
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
        visible: true,
      },
      timeScale: {
        borderColor: "#cccccc",
        timeVisible: true,
        secondsVisible: false,
        visible: true,
        fixLeftEdge: false,
        fixRightEdge: false,
        lockVisibleTimeRangeOnResize: false,
        rightBarStaysOnScroll: true,
        shiftVisibleRangeOnNewBar: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    chartRef.current = chart;

    // Add candlestick series for regular hours (solid colors)
    const regularHoursSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#808080", // Grey for green/up candles
      downColor: "#000000", // Black for red/down candles
      borderVisible: false,
      wickUpColor: "#808080", // Grey wicks for up candles
      wickDownColor: "#000000", // Black wicks for down candles
      priceLineVisible: false, // Remove horizontal price line
    });

    // Add candlestick series for after hours (same colors as regular hours)
    const afterHoursSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#808080", // Grey for green/up candles
      downColor: "#000000", // Black for red/down candles
      borderVisible: false,
      wickUpColor: "#808080", // Grey wicks for up candles
      wickDownColor: "#000000", // Black wicks for down candles
      priceLineVisible: false, // Remove horizontal price line
    });

    seriesRef.current = regularHoursSeries;

    // Format data for TradingView Lightweight Charts (backend handles NY timezone and market hours)
    const allFormattedData = data
      .filter(
        (item) => item.open && item.high && item.low && item.close && item.time
      )
      .map((item) => ({
        time: item.time as any, // TradingView expects Unix timestamp (already in NY time from backend)
        open: parseFloat(item.open),
        high: parseFloat(item.high),
        low: parseFloat(item.low),
        close: parseFloat(item.close),
        is_regular_hours: item.is_regular_hours, // Backend provides market hours classification
      }))
      .sort((a, b) => a.time - b.time);

    // Debug: Log first few data points to check timestamp format
    console.log("Chart data sample:", allFormattedData.slice(0, 3));
    console.log("Chart data timestamp type:", typeof allFormattedData[0]?.time);
    console.log("Chart data timestamp value:", allFormattedData[0]?.time);

    // Split data into regular hours and after hours using backend classification
    const regularHoursData = allFormattedData.filter(
      (item) => item.is_regular_hours
    );
    const afterHoursData = allFormattedData.filter(
      (item) => !item.is_regular_hours
    );

    // Set the data for both series
    regularHoursSeries.setData(regularHoursData);
    afterHoursSeries.setData(afterHoursData);

    // Fit content to show all data
    chart.timeScale().fitContent();

    // Handle resize with ResizeObserver for better responsiveness
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        const newWidth = chartContainerRef.current.clientWidth;
        const newHeight = chartContainerRef.current.clientHeight;
        chartRef.current.applyOptions({
          width: newWidth,
          height: newHeight,
        });
      }
    };

    // Use ResizeObserver for more accurate resize detection
    const resizeObserver = new ResizeObserver(handleResize);
    if (chartContainerRef.current) {
      resizeObserver.observe(chartContainerRef.current);
    }

    window.addEventListener("resize", handleResize);

    // Initial resize to ensure proper sizing
    setTimeout(handleResize, 100);

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, [data, height]);

  if (!data || data.length === 0) {
    return (
      <div className="chart-error">
        <p>No data available to display</p>
      </div>
    );
  }

  return (
    <div className="custom-trading-chart" style={{ height: `${height}px` }}>
      <div
        ref={chartContainerRef}
        className="chart-container"
        style={{
          width: "100%",
          position: "relative",
          minHeight: "300px",
        }}
      />
    </div>
  );
}
