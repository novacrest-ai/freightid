"""Property tests (Hypothesis). pip install freightid[dev] to run.

These pin the true boundaries of the standards, including their documented
weaknesses — asserting a weakness exists is how the algorithm stays honest.
"""

import string
import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))

from hypothesis import given, settings, strategies as st  # noqa: E402

from freightid import validate_container, validate_imo  # noqa: E402
from freightid.container import LETTER_VALUES, compute_check_digit  # noqa: E402
from freightid.imo import compute_check_digit as imo_check  # noqa: E402

LETTERS = string.ascii_uppercase

owner = st.text(alphabet=LETTERS, min_size=3, max_size=3)
category = st.sampled_from("UJZ")
serial = st.integers(min_value=0, max_value=999999)


def make_container(o, c, s):
    body = f"{o}{c}{s:06d}"
    return body + str(compute_check_digit(body))


@settings(max_examples=2000)
@given(owner, category, serial)
def test_container_round_trip(o, c, s):
    assert validate_container(make_container(o, c, s))["valid"] is True


def _remainder(first_ten):
    from freightid.container import _char_value
    return sum(_char_value(ch) * (2 ** i) for i, ch in enumerate(first_ten)) % 11


@settings(max_examples=2000)
@given(owner, category, serial, st.integers(4, 9), st.integers(1, 9))
def test_container_digit_mutation_boundary(o, c, s, pos, delta):
    """Digit mutations are caught UNLESS the remainder moves between 0 and 10.

    Remainders 0 and 10 both fold to check digit 0 -- the documented
    ambiguity behind the standard's advice to avoid remainder-10 serials.
    """
    good = make_container(o, c, s)
    old = int(good[pos])
    new = (old + delta) % 10
    if new == old:
        return
    mutated = good[:pos] + str(new) + good[pos + 1:]
    r0, r1 = _remainder(good[:10]), _remainder(mutated[:10])
    undetectable = (r0 % 10) == (r1 % 10)  # i.e. {r0, r1} == {0, 10}
    assert validate_container(mutated)["valid"] is undetectable


@settings(max_examples=2000)
@given(owner, category, serial, st.integers(0, 3), st.sampled_from(LETTERS))
def test_container_letter_mutation_boundary(o, c, s, pos, newch):
    """Letter substitutions are caught IFF value delta is not a multiple of 11.

    A<->K, B<->L, ... (delta 11) are undetectable BY DESIGN of ISO 6346.
    Position 3 mutations may also trip the category rule; both count as caught.
    """
    good = make_container(o, c, s)
    oldch = good[pos]
    if newch == oldch:
        return
    mutated = good[:pos] + newch + good[pos + 1:]
    delta = LETTER_VALUES[newch] - LETTER_VALUES[oldch]
    result = validate_container(mutated)["valid"]
    if pos == 3 and newch not in "UJZ":
        assert result is False  # category rule fires regardless of checksum
        return
    if delta % 11 == 0:
        assert result is True  # designed blindness: sum unchanged mod 11
        return
    r0, r1 = _remainder(good[:10]), _remainder(mutated[:10])
    undetectable = (r0 % 10) == (r1 % 10)  # the 0/10 fold, again
    assert result is undetectable


imo_body = st.integers(min_value=0, max_value=999999)


@settings(max_examples=2000)
@given(imo_body)
def test_imo_round_trip(n):
    body = f"{n:06d}"
    assert validate_imo(body + str(imo_check(body)))["valid"] is True


@settings(max_examples=2000)
@given(imo_body, st.integers(0, 5), st.integers(1, 9))
def test_imo_mutation_boundary(n, pos, delta):
    """Caught IFF delta * weight is not a multiple of 10.

    Weights 7..2 are not all coprime to 10: delta 5 at even-weight positions
    and delta 2/4/6/8 at the weight-5 position slip through by design.
    """
    body = f"{n:06d}"
    good = body + str(imo_check(body))
    old = int(good[pos])
    new = (old + delta) % 10
    if new == old:
        return
    mutated = good[:pos] + str(new) + good[pos + 1:]
    weight = (7, 6, 5, 4, 3, 2)[pos]
    real_delta = new - old
    detectable = (real_delta * weight) % 10 != 0
    assert validate_imo(mutated)["valid"] is (not detectable)


@settings(max_examples=1000)
@given(st.text(max_size=30))
def test_never_raises_on_garbage(s):
    for fn in (validate_container, validate_imo):
        out = fn(s)
        assert isinstance(out, dict)
        assert out["registration"] == "not_checked"
