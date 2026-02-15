from django.core.management.base import BaseCommand
from tests.test_sim import run_sim_tests


class Command(BaseCommand):
    help = "Test the simulation system"

    def handle(self, *args, **options):
        run_sim_tests()
