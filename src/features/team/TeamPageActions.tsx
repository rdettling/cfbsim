import { Button } from '../../ui/Button';

type TeamPageActionsProps = {
  current: 'history' | 'roster' | 'schedule';
  teamName: string;
};

export const TeamPageActions = ({ current, teamName }: TeamPageActionsProps) => (
  <div className="ui-action-row">
    <Button to={`/${teamName}/history`} variant={current === 'history' ? 'primary' : 'secondary'}>
      History
    </Button>
    <Button to={`/${teamName}/roster`} variant={current === 'roster' ? 'primary' : 'secondary'}>
      Roster
    </Button>
    <Button to={`/${teamName}/schedule`} variant={current === 'schedule' ? 'primary' : 'secondary'}>
      Schedule
    </Button>
  </div>
);
