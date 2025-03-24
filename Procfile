release: cd backend && python manage.py collectstatic --noinput
web: cd backend && gunicorn cfbsim.wsgi --log-file -