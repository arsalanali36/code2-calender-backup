import sqlite3
from werkzeug.security import generate_password_hash
import sys
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(BASE_DIR, 'data', 'users.db')

def update_password(email, new_password):
    if not os.path.exists(DB_FILE):
        print(f"Error: Database file not found at {DB_FILE}")
        return False
        
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        
        # Check if user exists
        cursor.execute("SELECT id FROM user WHERE email = ?", (email,))
        user = cursor.fetchone()
        
        if not user:
            print(f"Error: User with email '{email}' not found.")
            return False
            
        # Generate new hash
        new_hash = generate_password_hash(new_password)
        
        # Update database
        cursor.execute("UPDATE user SET password_hash = ? WHERE email = ?", (new_hash, email))
        conn.commit()
        
        print(f"Success! Password for '{email}' has been reset.")
        return True
    except Exception as e:
        print(f"Error updating password: {e}")
        return False
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: python reset_password.py <email> <new_password>")
        sys.exit(1)
        
    email = sys.argv[1]
    new_password = sys.argv[2]
    
    update_password(email, new_password)
