"""freightid -- validate and explain logistics identifiers.

AI agents can look up every port on Earth. Not one can check a container
number. Now they can.

freightid verifies math and format, never registration. Every result
carries registration: "not_checked" -- a mathematically valid identifier
is not evidence that the thing it names exists.
"""

from .container import validate_container, explain_container
from .imo import validate_imo, explain_imo
from .scac import validate_scac
from .unlocode import validate_unlocode
from .usdot import validate_usdot, validate_mc

__version__ = "0.1.0"

__all__ = [
    "validate_container", "explain_container",
    "validate_imo", "explain_imo",
    "validate_scac",
    "validate_unlocode",
    "validate_usdot", "validate_mc",
    "__version__",
]
