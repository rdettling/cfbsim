import json
import os
import sys
import time

import django


MAX_DIFF = 100
TAX_FACTOR = 0.05


def create_test_team(rating=0):
    """Create a test Teams instance for betting calculations (in-memory only)."""
    from api.models import Info, Teams

    info = Info(
        user_id="test_betting",
        currentWeek=1,
        currentYear=2024,
        startYear=2024,
        lastWeek=15,
    )

    return Teams(
        info=info,
        name=f"Test Team {rating}",
        abbreviation="TST",
        prestige=50,
        rating=rating,
        offense=rating,
        defense=rating,
        mascot="Testers",
        colorPrimary="#000000",
        colorSecondary="#FFFFFF",
        confGames=0,
        confLimit=8,
        confWins=0,
        confLosses=0,
        nonConfGames=0,
        nonConfLimit=4,
        nonConfWins=0,
        nonConfLosses=0,
        gamesPlayed=0,
        totalWins=0,
        totalLosses=0,
        strength_of_record=0.0,
        poll_score=0.0,
        ranking=1,
        last_rank=1,
        offers=0,
        recruiting_points=0,
    )


def test_game(team_a, team_b):
    """Test game simulation between two teams (in-memory only)."""
    from api.models import Games
    from logic.sim.sim import simGame
    from logic.constants.sim_constants import TEST_SIMULATIONS

    score_a = score_b = 0
    win_a = win_b = 0

    for _ in range(TEST_SIMULATIONS):
        game = Games(
            info=team_a.info,
            teamA=team_a,
            teamB=team_b,
            base_label="Test Game",
            name="Test Game",
            spreadA="0",
            spreadB="0",
            moneylineA="0",
            moneylineB="0",
            winProbA=0.5,
            winProbB=0.5,
            weekPlayed=1,
            year=2024,
            rankATOG=1,
            rankBTOG=1,
            resultA=None,
            resultB=None,
            overtime=0,
            scoreA=None,
            scoreB=None,
            headline=None,
            watchability=0.0,
        )

        simGame(game, None, None, None, None)

        score_a += game.scoreA or 0
        score_b += game.scoreB or 0

        if game.winner == team_a:
            win_a += 1
        elif game.winner == team_b:
            win_b += 1

    score_a = round(score_a / TEST_SIMULATIONS, 1)
    score_b = round(score_b / TEST_SIMULATIONS, 1)
    win_a = round(win_a / TEST_SIMULATIONS, 3)
    win_b = round(win_b / TEST_SIMULATIONS, 3)

    return {
        "scoreA": score_a,
        "scoreB": score_b,
        "winA": win_a,
        "winB": win_b,
    }


def compute_odds(gap, tax_factor=TAX_FACTOR):
    """Generate spread and odds data for different rating gaps."""
    from logic.constants.sim_constants import TEST_SIMULATIONS

    odds = {}

    for diff in range(gap + 1):
        team_a = create_test_team(rating=diff)
        team_b = create_test_team(rating=0)
        results = test_game(team_a, team_b)

        spread = round((results["scoreA"] - results["scoreB"]) * 2) / 2

        if spread > 0:
            spread_a = "-" + (str(int(spread)) if spread.is_integer() else str(spread))
            spread_b = "+" + (str(int(spread)) if spread.is_integer() else str(spread))
        elif spread < 0:
            spread_a = "+" + (
                str(abs(int(spread)))
                if spread.is_integer()
                else str(abs(spread))
            )
            spread_b = "-" + (
                str(abs(int(spread)))
                if spread.is_integer()
                else str(abs(spread))
            )
        else:
            spread_a = "Even"
            spread_b = "Even"

        implied_prob_a = round(results["winA"] + (tax_factor / 2), 2)
        implied_prob_b = round(results["winB"] + (tax_factor / 2), 2)

        if implied_prob_a >= 1:
            implied_prob_a = 0.99
        elif implied_prob_a <= 0:
            implied_prob_a = 0.01
        if implied_prob_b >= 1:
            implied_prob_b = 0.99
        elif implied_prob_b <= 0:
            implied_prob_b = 0.01

        if implied_prob_a > 0.5:
            moneyline_a = round(implied_prob_a / (1 - implied_prob_a) * 100)
            moneyline_a = f"-{moneyline_a}"
        else:
            moneyline_a = round(((1 / implied_prob_a) - 1) * 100)
            moneyline_a = f"+{moneyline_a}"

        if implied_prob_b > 0.5:
            moneyline_b = round(implied_prob_b / (1 - implied_prob_b) * 100)
            moneyline_b = f"-{moneyline_b}"
        else:
            moneyline_b = round(((1 / implied_prob_b) - 1) * 100)
            moneyline_b = f"+{moneyline_b}"

        odds[diff] = {
            "favSpread": spread_a,
            "udSpread": spread_b,
            "favWinProb": results["winA"],
            "udWinProb": results["winB"],
            "favMoneyline": moneyline_a,
            "udMoneyline": moneyline_b,
        }

    return {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "test_simulations": TEST_SIMULATIONS,
        "max_diff": gap,
        "odds": odds,
    }


def write_odds_json(payload, output_path):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as odds_file:
        json.dump(payload, odds_file, indent=2, sort_keys=True)


def print_sample_odds(odds):
    samples = [0, 5, 10, 20, 30, 40, 50, 75, 100]
    print("Sample odds:")
    for diff in samples:
        data = odds.get(diff)
        if not data:
            continue
        print(
            f"diff {diff:>3}: spread {data['favSpread']}/{data['udSpread']}, "
            f"win {data['favWinProb']}/{data['udWinProb']}, "
            f"ml {data['favMoneyline']}/{data['udMoneyline']}"
        )


def main():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    if base_dir not in sys.path:
        sys.path.insert(0, base_dir)
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "cfbsim.settings")
    django.setup()

    from django.conf import settings

    output_path = os.path.join(settings.BASE_DIR, "data", "betting_odds.json")
    payload = compute_odds(MAX_DIFF)
    write_odds_json(payload, output_path)

    print(f"Wrote betting odds to {output_path}")
    print_sample_odds(payload["odds"])


if __name__ == "__main__":
    main()
