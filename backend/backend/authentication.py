# backend/authentication.py
import os
import jwt
from jwt import ExpiredSignatureError, InvalidTokenError
from rest_framework import authentication, exceptions
from django.contrib.auth.models import AnonymousUser

# ⚙️ Supabase JWT secret (you can store it in .env)
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "sM0MvNBS0LoqmSAOmz+hr9Pc0WZs48e/vbhIBfpMEXt/0sZWx6mvu1wYJgbLphqITYv8kWnYjsqiD+zmtMeW5A==")


class SupabaseJWTAuthentication(authentication.BaseAuthentication):
    """
    Custom authentication class that validates Supabase-issued JWTs
    and returns an AnonymousUser with the JWT claims.
    """

    def authenticate(self, request):
        # Check for the Authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return None  # No authentication attempted

        token = auth_header.split(" ")[1]

        try:
            # Decode the JWT using Supabase's secret
            payload = jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"])
        except ExpiredSignatureError:
            raise exceptions.AuthenticationFailed("Token has expired.")
        except InvalidTokenError:
            raise exceptions.AuthenticationFailed("Invalid token.")

        # Create a pseudo-user object with the claims from the token
        user = AnonymousUser()
        user.id = payload.get("sub")
        user.email = payload.get("email")
        user.role = payload.get("role", "authenticated")

        return (user, None)
