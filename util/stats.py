def adjusted_pass_yards_per_attempt(
    passing_yards, touchdown_passes, interceptions, pass_attempts
):
    """
    Calculate the Adjusted Yards per Pass Attempt (AY/A).

    :param passing_yards: Total passing yards
    :param touchdown_passes: Number of touchdown passes
    :param interceptions: Number of interceptions
    :param pass_attempts: Number of pass attempts
    :return: Adjusted Yards per Pass Attempt
    """
    if pass_attempts == 0:
        return 0  # To avoid division by zero

    aya = (passing_yards + 20 * touchdown_passes - 45 * interceptions) / pass_attempts
    return round(aya, 1)


def passer_rating(completions, attempts, yards, touchdowns, interceptions):
    """
    Calculate the NFL Passer Rating.

    :param completions: Number of completions
    :param attempts: Number of pass attempts
    :param yards: Total passing yards
    :param touchdowns: Number of touchdown passes
    :param interceptions: Number of interceptions
    :return: NFL Passer Rating
    """
    if attempts == 0:
        return 0  # To avoid division by zero

    # Component calculations
    a = max(0, min(((completions / attempts) - 0.3) * 5, 2.375))
    b = max(0, min(((yards / attempts) - 3) * 0.25, 2.375))
    c = max(0, min((touchdowns / attempts) * 20, 2.375))
    d = max(0, min(2.375 - ((interceptions / attempts) * 25), 2.375))

    # Passer rating
    passer_rating = ((a + b + c + d) / 6) * 100
    return round(passer_rating, 1)


def percentage(completions, attempts):
    """
    Calculate the completion percentage and round it to one decimal place.

    :param completions: Number of completed passes
    :param attempts: Number of pass attempts
    :return: Completion percentage rounded to one decimal
    """
    if attempts == 0:
        return 0.0  # To avoid division by zero

    completion_percentage = (completions / attempts) * 100
    return round(completion_percentage, 1)


def average(total, attempts, decimals=1):
    if attempts == 0:
        return 0.0  # To avoid division by zero

    return round(total / attempts, decimals)
