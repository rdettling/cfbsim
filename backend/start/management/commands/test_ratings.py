from django.core.management.base import BaseCommand
from tests.test_ratings import run_rating_tests

class Command(BaseCommand):
    help = 'Test the rating system'

    def handle(self, *args, **options):
        run_rating_tests() 