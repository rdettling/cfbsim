from django.conf import settings
import json
import os


DEFAULT_ODDS_FILENAME = "betting_odds.json"


def _default_odds_path():
    base_dir = getattr(settings, "BASE_DIR", None)
    if base_dir is None:
        return None
    return os.path.join(base_dir, "data", DEFAULT_ODDS_FILENAME)


def load_precomputed_odds(max_diff=None, odds_path=None):
    """Load precomputed odds from JSON, optionally validating range."""
    odds_path = odds_path or _default_odds_path()
    if not odds_path or not os.path.exists(odds_path):
        raise FileNotFoundError("Precomputed odds file not found.")

    with open(odds_path, "r", encoding="utf-8") as odds_file:
        payload = json.load(odds_file)

    odds = payload.get("odds", payload)
    if not isinstance(odds, dict):
        raise ValueError("Odds JSON format is invalid.")

    max_available = max(int(diff) for diff in odds.keys()) if odds else -1
    if max_diff is not None and max_available < max_diff:
        raise ValueError(
            f"Precomputed odds only cover diff {max_available}, need {max_diff}."
        )

    return {int(diff): data for diff, data in odds.items()}
