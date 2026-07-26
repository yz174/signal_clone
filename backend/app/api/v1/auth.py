from fastapi import APIRouter, Request, Response, status

from app.core.deps import SessionDep
from app.core.ratelimit import OTP_RATE_LIMIT, limiter
from app.core.security import create_registration_token
from app.schemas.auth import (
    AuthenticatedOut,
    LogoutIn,
    RefreshIn,
    RegisterIn,
    RegistrationRequiredOut,
    RequestOtpIn,
    RequestOtpOut,
    TokenPair,
    VerifyOtpIn,
    VerifyOtpOut,
)
from app.schemas.user import UserOut
from app.services.auth_service import AuthService, SessionTokens

router = APIRouter(prefix="/auth", tags=["auth"])


def _token_pair(tokens: SessionTokens) -> TokenPair:
    return TokenPair(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        expires_in=tokens.expires_in,
    )


@router.post("/request-otp", response_model=RequestOtpOut)
@limiter.limit(OTP_RATE_LIMIT)
async def request_otp(
    request: Request,
    payload: RequestOtpIn,
    session: SessionDep,
) -> RequestOtpOut:
    expires_at = await AuthService(session).request_otp(payload.phone_e164)
    return RequestOtpOut(expires_at=expires_at)


@router.post("/verify-otp", response_model=VerifyOtpOut)
async def verify_otp(
    request: Request,
    payload: VerifyOtpIn,
    session: SessionDep,
) -> AuthenticatedOut | RegistrationRequiredOut:
    service = AuthService(session)
    user = await service.verify_otp(payload.phone_e164, payload.code)

    if user is None:
        return RegistrationRequiredOut(
            registration_token=create_registration_token(payload.phone_e164)
        )

    tokens = await service.start_session(user, request.headers.get("user-agent"))
    return AuthenticatedOut(tokens=_token_pair(tokens), user=UserOut.model_validate(user))


@router.post("/register", response_model=AuthenticatedOut, status_code=status.HTTP_201_CREATED)
async def register(request: Request, payload: RegisterIn, session: SessionDep) -> AuthenticatedOut:
    service = AuthService(session)
    user = await service.register(
        payload.registration_token, payload.display_name, payload.username, payload.avatar_url
    )
    tokens = await service.start_session(user, request.headers.get("user-agent"))
    return AuthenticatedOut(tokens=_token_pair(tokens), user=UserOut.model_validate(user))


@router.post("/refresh", response_model=AuthenticatedOut)
async def refresh(request: Request, payload: RefreshIn, session: SessionDep) -> AuthenticatedOut:
    user, tokens = await AuthService(session).refresh(
        payload.refresh_token, request.headers.get("user-agent")
    )
    return AuthenticatedOut(tokens=_token_pair(tokens), user=UserOut.model_validate(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(payload: LogoutIn, session: SessionDep) -> Response:
    await AuthService(session).logout(payload.refresh_token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
