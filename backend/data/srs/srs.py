import sys
import requests
from bs4 import BeautifulSoup
import pandas as pd


def get_srs_for_year(year):
    # Function to scrape the SRS data for a given year
    url = f"https://www.sports-reference.com/cfb/years/{year}-ratings.html"
    response = requests.get(url)
    soup = BeautifulSoup(response.text, "html.parser")

    srs_data = {}

    # Find all table rows in the standings table
    for row in soup.find_all("tr"):
        # Check if the row contains data (skipping header rows)
        if row.find("td", {"data-stat": "school_name"}):
            team_name = row.find("td", {"data-stat": "school_name"}).text.strip()
            srs_value = row.find("td", {"data-stat": "srs"}).text.strip()

            # Convert SRS value to float, handle empty strings
            try:
                srs_value = float(srs_value)
            except ValueError:
                srs_value = 0.0

            srs_data[team_name] = srs_value

    return srs_data


def main(year):
    year = int(year)
    num_years = 5
    years = [year - i for i in range(num_years)]

    all_data = {}
    for y in years:
        srs_data = get_srs_for_year(y)
        for team, srs in srs_data.items():
            if team not in all_data:
                all_data[team] = []
            all_data[team].append(srs)

    # Calculate averages and round to 2 decimal places
    for team in all_data:
        all_data[team] = round(sum(all_data[team]) / len(all_data[team]), 2)

    # Save to CSV, sorting by Average SRS in descending order
    df = pd.DataFrame(all_data.items(), columns=["Team", "Average SRS"])
    df = df.sort_values(by="Average SRS", ascending=False)
    df.to_csv(f"{year}.csv", index=False)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python program.py [year]")
    else:
        main(sys.argv[1])
