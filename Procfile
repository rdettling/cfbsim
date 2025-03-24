release: cd backend && python manage.py migrate --noinput
web: cd backend && gunicorn cfbsim.wsgi --log-file -