import json
import random
from ..models import *
from django.db.models import Count


ROSTER = {
    "qb": 1,
    "rb": 1,
    "wr": 3,
    "te": 1,
    "ol": 5,
    "dl": 4,
    "lb": 3,
    "cb": 2,
    "s": 2,
    "k": 1,
    "p": 1,
}

variance = 15


with open("start/static/states.json", "r") as file:
    STATE_FREQUENCIES = json.load(file)

states_list = [state for state, freq in STATE_FREQUENCIES.items() for _ in range(freq)]

positions_list = [pos for pos, freq in ROSTER.items() for _ in range(freq)]


def getProgression():
    return random.randint(1, 5)


def update_rosters(players):
    leaving_seniors = list(players.filter(year="sr"))
    players.filter(year="sr").delete()

    to_update = []
    rating_increases = {}

    for player in players:
        increase = getProgression()
        player.rating += increase
        player.rating_increase = increase

        # Progress the year for the player
        if player.year == "fr":
            player.year = "so"
        elif player.year == "so":
            player.year = "jr"
        elif player.year == "jr":
            player.year = "sr"

        to_update.append(player)
        rating_increases[player.id] = increase

    Players.objects.bulk_update(to_update, ["rating", "rating_increase", "year"])

    progressed_players = list(players.filter(year__in=["so", "jr", "sr"]))

    return {
        "leaving_seniors": leaving_seniors,
        "progressed_players": progressed_players,
        "rating_increases": rating_increases,
    }


def aiRecruitOffers(info):
    # Get all AI teams related to this info
    ai_teams = info.teams.all().exclude(pk=info.team.pk)

    # Get all recruits related to this info
    recruits = info.recruits.all().order_by("overall_rank")

    offers_to_create = []

    for team in ai_teams:
        # Here, we'll find the top recruit (by overall_rank) without an offer.
        recruit_without_offer = (
            recruits.annotate(offer_count=Count("offers")).filter(offer_count=0).first()
        )

        if recruit_without_offer:
            offers_to_create.append(
                Offers(
                    info=info,
                    recruit=recruit_without_offer,
                    team=team,
                )
            )

            # Remove this recruit from the recruits QuerySet to avoid offering him again
            recruits = recruits.exclude(pk=recruit_without_offer.pk)

    # Bulk create all the offers
    Offers.objects.bulk_create(offers_to_create)


def generateName(position):
    positions = {
        "qb": 15,
        "rb": 70,
        "wr": 70,
        "te": 30,
        "ol": 20,
        "dl": 70,
        "lb": 50,
        "cb": 90,
        "s": 70,
        "k": 0,
        "p": 0,
    }

    with open("start/static/names.json") as f:
        names = json.load(f)

    if random.random() <= positions[position] / 100:
        race = "black"
    else:
        race = "white"

    first_names = names[race]["first"]
    last_names = names[race]["last"]

    first = random.choices(
        first_names, weights=[name["weight"] for name in first_names]
    )[0]["name"]
    last = random.choices(last_names, weights=[name["weight"] for name in last_names])[
        0
    ]["name"]

    return (first, last)


def get_ratings(info):
    offense_weight = 0.60
    defense_weight = 0.40

    offensive_weights = {"qb": 40, "rb": 10, "wr": 25, "te": 5, "ol": 20}
    defensive_weights = {"dl": 35, "lb": 20, "cb": 30, "s": 15}

    # Fetch all players across all teams
    all_players = info.players.all()

    for team in info.teams.all():
        # Filter players for the current team
        players = all_players.filter(team=team)

        offense_rating = 0.0
        defense_rating = 0.0
        total_offensive_weight = 0
        total_defensive_weight = 0

        for position, count in ROSTER.items():
            position_players = players.filter(pos=position).order_by("-rating")

            for _, player in enumerate(position_players[:count], start=1):
                player.starter = True
                player.save()

            position_players.exclude(
                pk__in=[player.pk for player in position_players[:count]]
            ).update(starter=False)

            if position in offensive_weights:
                offense_rating += (
                    sum(player.rating for player in position_players[:count])
                    * offensive_weights[position]
                )
                total_offensive_weight += count * offensive_weights[position]
            elif position in defensive_weights:
                defense_rating += (
                    sum(player.rating for player in position_players[:count])
                    * defensive_weights[position]
                )
                total_defensive_weight += count * defensive_weights[position]

        if total_offensive_weight > 0:
            offense_rating /= total_offensive_weight
        if total_defensive_weight > 0:
            defense_rating /= total_defensive_weight

        overall_rating = (offense_rating * offense_weight) + (
            defense_rating * defense_weight
        )

        team.offense = offense_rating
        team.defense = defense_rating
        team.rating = overall_rating

        team.save()


def fill_roster(team, players_to_create):
    for position, count in ROSTER.items():
        current_players = team.players.filter(pos=position)
        current_count = current_players.count()

        if current_count < (2 * count + 1):
            needed = (2 * count + 1) - current_count

            for i in range(needed):
                first, last = generateName(position)

                rating = team.prestige - random.randint(0, variance) - 5

                player = Players(
                    info=team.info,
                    team=team,
                    first=first,
                    last=last,
                    year="fr",
                    pos=position,
                    rating=rating,
                    starter=False,
                )
                players_to_create.append(player)


def init_roster(team, players_to_create):
    years = ["fr", "so", "jr", "sr"]

    for position, count in ROSTER.items():
        for i in range(2 * count + 1):
            first, last = generateName(position)
            year = random.choice(years)

            rating = team.prestige - random.randint(0, variance) - 5
            for _ in range(years.index(year)):
                rating += getProgression()

            player = Players(
                info=team.info,
                team=team,
                first=first,
                last=last,
                year=year,
                pos=position,
                rating=rating,
                starter=False,
            )
            players_to_create.append(player)


def generate_recruit(stars, info, overall_rank, state_ranks, position_ranks):
    position = random.choice(positions_list)
    first, last = generateName(position)
    state = random.choice(states_list)

    # Get the current state rank for the selected state and update it
    current_state_rank = state_ranks.get(state, 1)
    state_ranks[state] = current_state_rank + 1

    # Get the current position rank for the selected position and update it
    current_position_rank = position_ranks.get(position, 1)
    position_ranks[position] = current_position_rank + 1

    if stars == 5:
        min_prestige = 90
    elif stars == 4:
        min_prestige = 80
    else:
        min_prestige = 0

    return Recruits(
        info=info,
        first=first,
        last=last,
        pos=position,
        stars=stars,
        state=state,
        overall_rank=overall_rank,
        min_prestige=min_prestige,
        state_rank=current_state_rank,
        position_rank=current_position_rank,
    )


def generate_recruits(info, recruits_to_create):
    stars_distribution = {5: 30, 4: 300, 3: 1000}

    # Overall rank starts at 1
    current_overall_rank = 1

    # Dictionaries to keep track of state ranks and position ranks
    state_ranks = {}
    position_ranks = {}

    for stars, count in stars_distribution.items():
        for _ in range(count):
            recruits_to_create.append(
                generate_recruit(
                    stars, info, current_overall_rank, state_ranks, position_ranks
                )
            )
            current_overall_rank += 1
