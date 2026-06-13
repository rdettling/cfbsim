import { Button } from '../../ui/Button';

type StatsNavProps = {
  current: 'team' | 'individual' | 'ratings';
};

export const StatsNav = ({ current }: StatsNavProps) => (
  <div className="ui-action-row">
    <Button to="/stats/team" variant={current === 'team' ? 'primary' : 'secondary'}>
      Team Stats
    </Button>
    <Button to="/stats/individual" variant={current === 'individual' ? 'primary' : 'secondary'}>
      Individual Stats
    </Button>
    <Button to="/stats/ratings" variant={current === 'ratings' ? 'primary' : 'secondary'}>
      Ratings Stats
    </Button>
  </div>
);
