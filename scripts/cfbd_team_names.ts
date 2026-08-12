const CFBD_TEAM_ALIASES: Readonly<Record<string, string>> = {
  'App State': 'Appalachian State',
  FIU: 'Florida International',
  "Hawai'i": 'Hawaii',
  'Louisiana-Monroe': 'Louisiana Monroe',
  'Miami (OH)': 'Miami Ohio',
  'Middle Tennessee': 'Middle Tennessee State',
  'Nevada-Las Vegas': 'UNLV',
  'North Carolina State': 'NC State',
  Pitt: 'Pittsburgh',
  'San José State': 'San Jose State',
  'Sam Houston': 'Sam Houston State',
  SMU: 'Southern Methodist',
  'Southern Mississippi': 'Southern Miss',
  TCU: 'Texas Christian',
  UAB: 'Alabama Birmingham',
  UCF: 'Central Florida',
  UConn: 'Connecticut',
  'UL Monroe': 'Louisiana Monroe',
  UMass: 'Massachusetts',
  UTEP: 'Texas El Paso',
  UTSA: 'Texas San Antonio',
};

export const canonicalCfbdTeamName = (name: string) =>
  CFBD_TEAM_ALIASES[name] ?? name;
