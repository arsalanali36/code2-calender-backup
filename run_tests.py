import unittest
import os
import json
from config import DATA_FILE, UPLOADS_DIR, BASE_DIR

class TestProjectHealth(unittest.TestCase):
    def test_data_file_exists(self):
        """Check if the main trades.json file exists."""
        # Using .tmp_api_trades.json as it seems to be the active one in this env
        active_file = os.path.join(BASE_DIR, '.tmp_api_trades.json')
        if not os.path.exists(active_file):
            active_file = DATA_FILE
            
        self.assertTrue(os.path.exists(active_file), f"Data file not found at {active_file}")

    def test_json_integrity(self):
        """Check if the trades data is valid JSON and has required keys."""
        active_file = os.path.join(BASE_DIR, '.tmp_api_trades.json')
        if not os.path.exists(active_file):
            active_file = DATA_FILE
            
        with open(active_file, 'r', encoding='utf-8-sig') as f:
            data = json.load(f)
            
        required_keys = ['allTags', 'columns', 'trades', 'dayData']
        for key in required_keys:
            self.assertIn(key, data, f"Required root key '{key}' missing from data file.")

    def test_uploads_dir(self):
        """Check if uploads directory exists."""
        self.assertTrue(os.path.isdir(UPLOADS_DIR), "Uploads directory is missing.")

if __name__ == '__main__':
    print("Running Project Health Tests...")
    unittest.main()

