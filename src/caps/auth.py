"""
CAPS Authentication Module

JWT-based authentication with bcrypt password hashing.
"""

import os
import logging
from datetime import datetime, timedelta, UTC
from typing import Optional, Dict, Any

import bcrypt
import jwt
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field

from caps.database import (
    create_user,
    get_user_by_username,
    get_user_by_email,
    get_user_by_id,
)

logger = logging.getLogger(__name__)

# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "caps-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24

# Security scheme
security = HTTPBearer()


# Request/Response Models
class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=30)
    email: EmailStr
    password: str = Field(..., min_length=6)


class LoginRequest(BaseModel):
    username: str
    password: str


class AuthResponse(BaseModel):
    token: str
    user: Dict[str, Any]
    message: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    balance: float
    created_at: str


# Password hashing
def hash_password(password: str) -> str:
    """Hash password using bcrypt."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hash."""
    return bcrypt.checkpw(password.encode(), hashed.encode())


# JWT operations
def create_token(user_id: int, username: str) -> str:
    """Create JWT token for user."""
    payload = {
        "user_id": user_id,
        "username": username,
        "exp": datetime.now(UTC) + timedelta(hours=JWT_EXPIRY_HOURS),
        "iat": datetime.now(UTC),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and verify JWT token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("Token expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid token: {e}")
        return None


# FastAPI dependency for protected routes
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, Any]:
    """
    FastAPI dependency to get current authenticated user.
    Use in route: user = Depends(get_current_user)
    """
    token = credentials.credentials
    payload = decode_token(token)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = get_user_by_id(payload["user_id"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    
    return user


# Auth operations
def register_user(username: str, email: str, password: str) -> Dict[str, Any]:
    """Register a new user."""
    # Check if username exists
    if get_user_by_username(username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
    
    # Check if email exists
    if get_user_by_email(email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Hash password and create user
    password_hash = hash_password(password)
    user_id = create_user(username, email, password_hash)
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user"
        )
    
    user = get_user_by_id(user_id)
    token = create_token(user_id, username)
    
    logger.info(f"User registered: {username}")
    
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "balance": user["balance"],
        },
        "message": "Registration successful"
    }


def login_user(username: str, password: str) -> Dict[str, Any]:
    """Login user and return token."""
    user = get_user_by_username(username)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    if not verify_password(password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    token = create_token(user["id"], user["username"])
    
    logger.info(f"User logged in: {username}")
    
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "balance": user["balance"],
        },
        "message": "Login successful"
    }
