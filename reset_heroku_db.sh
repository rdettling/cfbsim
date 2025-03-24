#!/bin/bash

# Colors
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

APP_NAME="cfbsim"
DB_COLOR="CYAN"

echo -e "${YELLOW}Resetting Heroku database...${NC}"

# Confirm
read -p "Delete ALL data? (y/n) " -n 1 -r
echo
[[ ! $REPLY =~ ^[Yy]$ ]] && echo "Cancelled." && exit 1

# Drop all tables
echo -e "${YELLOW}Dropping tables...${NC}"
DROP_SQL="DO \$\$ DECLARE r RECORD; BEGIN FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE'; END LOOP; END \$\$;"
echo "$DROP_SQL" | heroku pg:psql HEROKU_POSTGRESQL_${DB_COLOR} -a $APP_NAME

# Run migrations from backend directory
echo -e "${YELLOW}Running migrations...${NC}"
heroku run "cd backend && python manage.py migrate" -a $APP_NAME

# Verify
echo -e "${GREEN}Verifying database...${NC}"
heroku pg:psql HEROKU_POSTGRESQL_${DB_COLOR} -a $APP_NAME -c "\dt"

echo -e "${GREEN}Database reset complete!${NC}"