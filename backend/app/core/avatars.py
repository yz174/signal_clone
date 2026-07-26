from hashlib import sha256

AVATAR_COLORS = (
    "A100",
    "A110",
    "A120",
    "A130",
    "A140",
    "A150",
    "A160",
    "A170",
    "A180",
    "A190",
    "A200",
    "A210",
)


def pick_avatar_color(seed: str) -> str:
    """Assign a stable colour from a user's identity.

    Deterministic so the same person keeps the same colour across restarts and across
    processes — Python's built-in str hash is randomised per interpreter and would not.
    """
    digest = sha256(seed.encode()).digest()
    return AVATAR_COLORS[digest[0] % len(AVATAR_COLORS)]
