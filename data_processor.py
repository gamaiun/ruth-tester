import pandas as pd
import numpy as np
import io
from datetime import datetime
import pytz
from typing import Dict, List, Any, Optional
import logging

logger = logging.getLogger(__name__)

class DataProcessor:
    """Handles CSV data processing and transformation for trading charts"""
    
    def __init__(self):
        self.blkvol_columns = {
            'open': 'BLKVOL.ASK.US-BLKVOL.BID.US · USI: open',
            'high': 'BLKVOL.ASK.US-BLKVOL.BID.US · USI: high', 
            'low': 'BLKVOL.ASK.US-BLKVOL.BID.US · USI: low',
            'close': 'BLKVOL.ASK.US-BLKVOL.BID.US · USI: close'
        }
    
    def validate_csv_format(self, df: pd.DataFrame) -> bool:
        """Validate that CSV has required columns"""
        required_columns = ['time'] + list(self.blkvol_columns.values())
        
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            logger.error(f"Missing required columns: {missing_columns}")
            return False
        
        return True
    
    def process_csv_data(self, csv_content: bytes) -> Dict[str, Any]:
        """Process uploaded CSV data and extract BLKVOL columns"""
        try:
            # Read CSV from bytes
            df = pd.read_csv(io.BytesIO(csv_content))
            logger.info(f"CSV loaded with {len(df)} rows and {len(df.columns)} columns")
            
            # Validate format
            if not self.validate_csv_format(df):
                raise ValueError("Invalid CSV format - missing required columns")
            
            # Extract only the columns we need
            processed_df = pd.DataFrame()
            processed_df['time'] = df['time']
            
            # Extract BLKVOL columns and rename them
            for key, col_name in self.blkvol_columns.items():
                if col_name in df.columns:
                    processed_df[key] = df[col_name]
                else:
                    logger.warning(f"Column {col_name} not found")
                    processed_df[key] = 0  # Default to 0 if missing
            
            # Convert timestamp to NY timezone properly for chart display
            # The key insight: we need to create timestamps that when interpreted as UTC by the chart
            # will actually display the NY time
            processed_df['time'] = pd.to_datetime(processed_df['time'], unit='s', utc=True)
            ny_tz = pytz.timezone('America/New_York')
            
            # Convert to NY time
            processed_df['time_ny'] = processed_df['time'].dt.tz_convert(ny_tz)
            
            # Create a "fake" UTC timestamp that displays as NY time
            # We do this by removing timezone info from NY time and treating it as UTC
            processed_df['time_display'] = processed_df['time_ny'].dt.tz_localize(None)
            processed_df['timestamp'] = processed_df['time_display'].astype('int64') // 10**9
            
            # Log some sample times for debugging
            if len(processed_df) > 0:
                sample_orig = processed_df['time'].iloc[0]
                sample_ny = processed_df['time_ny'].iloc[0] 
                sample_display = processed_df['time_display'].iloc[0]
                sample_ts = processed_df['timestamp'].iloc[0]
                logger.info(f"Time conversion - Original UTC: {sample_orig}")
                logger.info(f"                  NY Time: {sample_ny}")
                logger.info(f"                  Display Time: {sample_display}")
                logger.info(f"                  Final Timestamp: {sample_ts}")
            
            # Use the display time for summary
            processed_df['time'] = processed_df['time_display']
            
            # Sort by timestamp
            processed_df = processed_df.sort_values('timestamp')
            
            # Remove any rows with all NaN values in OHLC
            ohlc_cols = ['open', 'high', 'low', 'close']
            processed_df = processed_df.dropna(subset=ohlc_cols, how='all')
            
            logger.info(f"Processed data: {len(processed_df)} rows")
            
            return {
                'success': True,
                'data': processed_df.to_dict('records'),
                'summary': {
                    'total_rows': len(processed_df),
                    'date_range': {
                        'start': processed_df['time'].min().isoformat(),
                        'end': processed_df['time'].max().isoformat()
                    },
                    'columns': ohlc_cols
                }
            }
            
        except Exception as e:
            logger.error(f"Error processing CSV: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'data': []
            }
    
    def format_for_tradingview(self, processed_data: List[Dict], prev_close_time: Optional[str] = None, current_open_time: Optional[str] = None) -> List[Dict]:
        """Format data specifically for TradingView chart with market hours classification and gap adjustment"""
        try:
            formatted_data = []
            
            # First pass: create initial formatted data with market hours classification
            for row in processed_data:
                # Get the NY time (already converted) to determine market hours
                ny_time = row['time']  # This is already in NY timezone from processing
                
                # Extract hour and minute from the NY time
                hour = ny_time.hour
                minute = ny_time.minute
                time_in_minutes = hour * 60 + minute
                
                # Log first few candles for debugging
                if len(formatted_data) < 5:
                    logger.info(f"Sample candle {len(formatted_data)}: {ny_time} (hour={hour}, minute={minute})")
                
                # Determine if this is regular market hours (7:00 AM - 3:59 PM NY time)
                is_regular_hours = 420 <= time_in_minutes < 960  # 7:00 AM to 3:59 PM
                
                formatted_row = {
                    'time': row['timestamp'],
                    'open': float(row['open']) if row['open'] is not None else 0,
                    'high': float(row['high']) if row['high'] is not None else 0,
                    'low': float(row['low']) if row['low'] is not None else 0,
                    'close': float(row['close']) if row['close'] is not None else 0,
                    'is_regular_hours': is_regular_hours,
                    'hour': hour,
                    'minute': minute,
                    'ny_time': ny_time,
                }
                
                # Validate price values are reasonable
                price_values = [formatted_row['open'], formatted_row['high'], formatted_row['low'], formatted_row['close']]
                if any(abs(v) > 1000000000 for v in price_values):  # Sanity check for extreme values
                    logger.warning(f"Extreme price values detected at {ny_time}, skipping: {price_values}")
                    continue
                
                formatted_data.append(formatted_row)
            
            # Second pass: adjust for gaps between trading sessions
            if len(formatted_data) > 1 and (prev_close_time or current_open_time):
                logger.info(f"Calling gap adjustment function with prev_close_time={prev_close_time}, current_open_time={current_open_time}")
                formatted_data = self._adjust_session_gaps(formatted_data, prev_close_time, current_open_time)
                logger.info("Gap adjustment function completed")
            else:
                logger.info("Skipping gap adjustment - no time parameters provided or insufficient data")
            
            # Remove temporary fields
            for row in formatted_data:
                row.pop('hour', None)
                row.pop('minute', None) 
                row.pop('ny_time', None)
            
            logger.info(f"Formatted {len(formatted_data)} data points for TradingView")
            regular_hours_count = sum(1 for item in formatted_data if item['is_regular_hours'])
            after_hours_count = len(formatted_data) - regular_hours_count
            logger.info(f"Regular hours: {regular_hours_count}, After hours: {after_hours_count}")
            
            return formatted_data
            
        except Exception as e:
            logger.error(f"Error formatting data for TradingView: {str(e)}")
            return []
    
    def _adjust_session_gaps(self, data: List[Dict], prev_close_time: Optional[str] = None, current_open_time: Optional[str] = None) -> List[Dict]:
        """Adjust price gaps between trading sessions by shifting entire days"""
        try:
            adjusted_data = data.copy()
            
            # Parse time parameters (format: "HH:MM")
            prev_hour, prev_minute = None, None
            curr_hour, curr_minute = None, None
            
            if prev_close_time:
                try:
                    prev_hour, prev_minute = map(int, prev_close_time.split(':'))
                    logger.info(f"Using custom prev close time: {prev_hour:02d}:{prev_minute:02d}")
                except:
                    logger.warning(f"Invalid prev_close_time format: {prev_close_time}")
            
            if current_open_time:
                try:
                    curr_hour, curr_minute = map(int, current_open_time.split(':'))
                    logger.info(f"Using custom current open time: {curr_hour:02d}:{curr_minute:02d}")
                except:
                    logger.warning(f"Invalid current_open_time format: {current_open_time}")
            
            # Default to original logic if no custom times provided
            if not prev_close_time and not current_open_time:
                curr_hour, curr_minute = 7, 0  # Default: 7:00 AM
                logger.info("Using default gap adjustment: 7:00 AM open to previous candle close")
            
            logger.info(f"Starting gap adjustment for {len(data)} candles")
            
            for i in range(1, len(adjusted_data)):
                current = adjusted_data[i]
                
                # Check if current candle matches the target open time
                if current_open_time and curr_hour is not None and curr_minute is not None:
                    is_target_open = (current['hour'] == curr_hour and 
                                    current['minute'] == curr_minute and 
                                    current['is_regular_hours'])
                else:
                    # Default behavior: 7:00 AM regular hours
                    is_target_open = (current['hour'] == 7 and 
                                    current['minute'] == 0 and 
                                    current['is_regular_hours'])
                
                if is_target_open:
                    if prev_close_time and prev_hour is not None and prev_minute is not None:
                        # Find specific previous close time
                        prev_close = None
                        for j in range(i-1, max(0, i-100), -1):  # Look back up to 100 candles
                            check_candle = adjusted_data[j]
                            if (check_candle['hour'] == prev_hour and 
                                check_candle['minute'] == prev_minute):
                                prev_close = check_candle['close']
                                logger.info(f"Found target prev close at index {j}: {prev_hour:02d}:{prev_minute:02d}, close={prev_close:.4f}")
                                break
                        
                        if prev_close is None:
                            logger.warning(f"Could not find {prev_hour:02d}:{prev_minute:02d} candle, using previous candle")
                            prev_close = adjusted_data[i-1]['close']
                    else:
                        # Default: use immediately previous candle
                        prev_close = adjusted_data[i-1]['close']
                    
                    current_open = current['open']
                    gap = prev_close - current_open
                    
                    logger.info(f"Gap at index {i}: prev_close={prev_close:.4f}, current_open={current_open:.4f}, gap={gap:.4f}")
                    
                    # Apply adjustment to all remaining candles from this point forward
                    if abs(gap) > 0.01:  # Only adjust if gap is significant
                        for j in range(i, len(adjusted_data)):
                            adjusted_data[j]['open'] += gap
                            adjusted_data[j]['high'] += gap
                            adjusted_data[j]['low'] += gap
                            adjusted_data[j]['close'] += gap
                        
                        logger.info(f"Applied gap adjustment of {gap:.4f} to {len(adjusted_data) - i} candles")
            
            return adjusted_data
            
        except Exception as e:
            logger.error(f"Error adjusting session gaps: {str(e)}")
            return data