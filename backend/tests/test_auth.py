from app.auth import get_password_hash, verify_password


def test_password_hash_round_trip():
    password = "secure-test-password"

    hashed_password = get_password_hash(password)

    assert hashed_password != password
    assert verify_password(password, hashed_password)
    assert not verify_password("incorrect-password", hashed_password)
