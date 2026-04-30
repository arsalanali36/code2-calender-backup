"""
services/debug_service.py
-------------------------
Utility for logging events and errors specifically for AI assistants.
Helps AI understand what went wrong without manual debugging steps.
"""
import os
import json
import traceback
from datetime import datetime
from config import AI_DEBUG_LOG

def _rotate_log(path: str, max_lines: int = 200):
    """Trim log to last max_lines if it exceeds that count."""
    if not os.path.exists(path):
        return
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    if len(lines) >= max_lines:
        with open(path, 'w', encoding='utf-8') as f:
            f.writelines(lines[-(max_lines - 1):])  # leave room for new entry


def log_ai_event(event_type: str, message: str, data: dict = None):
    """
    Logs an event to ai_debug.log in JSONL format for easy parsing by AI.
    """
    try:
        log_entry = {
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "type": event_type,
            "message": message,
            "data": data or {}
        }
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(AI_DEBUG_LOG), exist_ok=True)
        
        # Rotate: keep last 200 lines to prevent unbounded growth
        _rotate_log(AI_DEBUG_LOG, max_lines=200)

        with open(AI_DEBUG_LOG, 'a', encoding='utf-8') as f:
            f.write(json.dumps(log_entry) + "\n")
            
    except Exception as e:
        print(f"[debug_service] Failed to log AI event: {e}")

def log_ai_error(message: str, error: Exception = None):
    """Logs a detailed error message with traceback."""
    data = {
        "traceback": traceback.format_exc() if error else None,
        "error_class": error.__class__.__name__ if error else None
    }
    log_ai_event("ERROR", message, data)
