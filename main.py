from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import pandas as pd
import io
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
import logging

from data_processor import DataProcessor

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Trading Data API", version="1.0.0")

# Initialize data processor
data_processor = DataProcessor()

# Add CORS middleware to allow requests from Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Local development
        "https://ruth-tester-l3lauxn9s-tapak217gmailcoms-projects.vercel.app",  # Original Vercel URL
        "https://ruth-tester-1aftuj3kg-tapak217gmailcoms-projects.vercel.app",  # New production Vercel URL
        "https://ruth-tester.vercel.app",  # Short URL if assigned
        "*"  # Allow all origins for testing (can be restricted later)
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Trading Data API is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.post("/upload-csv")
async def upload_csv(
    file: UploadFile = File(...),
    prev_close_time: Optional[str] = Form(None),
    current_open_time: Optional[str] = Form(None)
):
    """Upload and process CSV file with trading data and optional gap adjustment"""
    try:
        # Validate file type
        if not file.filename.endswith('.csv'):
            raise HTTPException(status_code=400, detail="File must be a CSV")
        
        # Read file content
        content = await file.read()
        logger.info(f"Received file: {file.filename}, size: {len(content)} bytes")
        logger.info(f"Gap adjustment params - Prev close: {prev_close_time}, Current open: {current_open_time}")
        
        # Process the CSV data
        result = data_processor.process_csv_data(content)
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result['error'])
        
        # Format data for TradingView with gap adjustment parameters
        formatted_data = data_processor.format_for_tradingview(
            result['data'], 
            prev_close_time=prev_close_time,
            current_open_time=current_open_time
        )
        
        return {
            "success": True,
            "filename": file.filename,
            "summary": result['summary'],
            "chart_data": formatted_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing upload: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@app.get("/sample-data")
async def get_sample_data():
    """Get sample data for testing chart functionality"""
    # Generate some sample OHLC data
    import random
    from datetime import datetime, timedelta
    
    base_time = int(datetime.now().timestamp())
    sample_data = []
    
    for i in range(100):
        timestamp = base_time - (i * 900)  # 15-minute intervals
        open_price = 100 + random.uniform(-10, 10)
        close_price = open_price + random.uniform(-5, 5)
        high_price = max(open_price, close_price) + random.uniform(0, 3)
        low_price = min(open_price, close_price) - random.uniform(0, 3)
        
        sample_data.append({
            "time": timestamp,
            "open": round(open_price, 2),
            "high": round(high_price, 2),
            "low": round(low_price, 2),
            "close": round(close_price, 2)
        })
    
    return {"chart_data": list(reversed(sample_data))}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
    