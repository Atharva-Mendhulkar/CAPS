"""
CAPS Database Module

SQLite-based storage for users and transactions.
Replaces mock data with persistent storage.
"""

import sqlite3
import os
import logging
from datetime import datetime, UTC
from typing import Optional, List, Dict, Any
from contextlib import contextmanager

logger = logging.getLogger(__name__)

# Database file location
DB_PATH = os.path.join(os.path.dirname(__file__), "caps.db")


@contextmanager
def get_db():
    """Context manager for database connections."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def init_db():
    """Initialize database tables."""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                balance REAL DEFAULT 1000.0,
                trust_score REAL DEFAULT 0.5,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                is_active INTEGER DEFAULT 1
            )
        """)
        
        # Transactions table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                transaction_id TEXT UNIQUE NOT NULL,
                sender_id INTEGER NOT NULL,
                receiver_id INTEGER NOT NULL,
                sender_username TEXT NOT NULL,
                receiver_username TEXT NOT NULL,
                amount REAL NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                completed_at TEXT,
                FOREIGN KEY (sender_id) REFERENCES users(id),
                FOREIGN KEY (receiver_id) REFERENCES users(id)
            )
        """)
        
        logger.info(f"Database initialized at {DB_PATH}")


# User operations
def create_user(username: str, email: str, password_hash: str, initial_balance: float = 1000.0) -> Optional[int]:
    """Create a new user. Returns user ID or None if failed."""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO users (username, email, password_hash, balance) VALUES (?, ?, ?, ?)",
                (username.lower(), email.lower(), password_hash, initial_balance)
            )
            user_id = cursor.lastrowid
            logger.info(f"Created user: {username} (ID: {user_id})")
            return user_id
    except sqlite3.IntegrityError as e:
        logger.warning(f"User creation failed: {e}")
        return None


def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    """Get user by username."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE username = ?", (username.lower(),))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    """Get user by ID."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Get user by email."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = ?", (email.lower(),))
        row = cursor.fetchone()
        return dict(row) if row else None


def update_balance(user_id: int, new_balance: float) -> bool:
    """Update user's balance."""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE users SET balance = ? WHERE id = ?",
                (new_balance, user_id)
            )
            return cursor.rowcount > 0
    except Exception as e:
        logger.error(f"Balance update failed: {e}")
        return False


def transfer_money(sender_id: int, receiver_id: int, amount: float) -> Optional[str]:
    """
    Transfer money between users atomically.
    Returns transaction_id on success, None on failure.
    """
    import uuid
    transaction_id = str(uuid.uuid4())
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Get sender
            cursor.execute("SELECT id, username, balance FROM users WHERE id = ?", (sender_id,))
            sender = cursor.fetchone()
            if not sender:
                logger.error(f"Sender not found: {sender_id}")
                return None
            
            # Get receiver
            cursor.execute("SELECT id, username, balance FROM users WHERE id = ?", (receiver_id,))
            receiver = cursor.fetchone()
            if not receiver:
                logger.error(f"Receiver not found: {receiver_id}")
                return None
            
            # Check balance
            if sender["balance"] < amount:
                logger.warning(f"Insufficient balance: {sender['balance']} < {amount}")
                return None
            
            # Deduct from sender
            cursor.execute(
                "UPDATE users SET balance = balance - ? WHERE id = ?",
                (amount, sender_id)
            )
            
            # Add to receiver
            cursor.execute(
                "UPDATE users SET balance = balance + ? WHERE id = ?",
                (amount, receiver_id)
            )
            
            # Record transaction
            cursor.execute("""
                INSERT INTO transactions 
                (transaction_id, sender_id, receiver_id, sender_username, receiver_username, amount, status, completed_at)
                VALUES (?, ?, ?, ?, ?, ?, 'completed', ?)
            """, (
                transaction_id,
                sender_id,
                receiver_id,
                sender["username"],
                receiver["username"],
                amount,
                datetime.now(UTC).isoformat()
            ))
            
            logger.info(f"Transfer complete: {sender['username']} -> {receiver['username']}: ₹{amount}")
            return transaction_id
            
    except Exception as e:
        logger.error(f"Transfer failed: {e}")
        return None


def get_user_transactions(user_id: int, limit: int = 50) -> List[Dict[str, Any]]:
    """Get transaction history for a user."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM transactions 
            WHERE sender_id = ? OR receiver_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        """, (user_id, user_id, limit))
        return [dict(row) for row in cursor.fetchall()]


def get_all_users(exclude_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """Get all users (for recipient selection). Excludes passwords."""
    with get_db() as conn:
        cursor = conn.cursor()
        if exclude_id:
            cursor.execute(
                "SELECT id, username, email, created_at FROM users WHERE id != ? AND is_active = 1",
                (exclude_id,)
            )
        else:
            cursor.execute(
                "SELECT id, username, email, created_at FROM users WHERE is_active = 1"
            )
        return [dict(row) for row in cursor.fetchall()]


# Initialize database on module import
init_db()
