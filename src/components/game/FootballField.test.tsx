import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import FootballField, { calculateEndZoneWordmarkFontSize } from './FootballField';

const baseProps = {
  currentYardLine: 27,
  homeTeam: { name: 'Home' },
  awayTeam: { name: 'Away' },
  neutralSite: false,
  isOffenseLeftToRight: true,
  down: 2,
  yardsToGo: 8,
};

describe('FootballField', () => {
  it('shows a green range for yards gained on the previous play', () => {
    const markup = renderToStaticMarkup(
      <FootballField {...baseProps} previousPlayYards={2} />,
    );

    expect(markup).toContain('aria-label="Previous play: 2-yard gain"');
    expect(markup).toContain('clip-path:polygon(0 0, 100% 50%, 0 100%)');
    expect(markup).not.toContain('>+2</span>');
  });

  it('shows a red range for yards lost on the previous play', () => {
    const markup = renderToStaticMarkup(
      <FootballField {...baseProps} previousPlayYards={-3} />,
    );

    expect(markup).toContain('aria-label="Previous play: 3-yard loss"');
    expect(markup).toContain('clip-path:polygon(100% 0, 0 50%, 100% 100%)');
    expect(markup).not.toContain('>-3</span>');
  });

  it('points a gain toward the opposite end zone when the offense is reversed', () => {
    const markup = renderToStaticMarkup(
      <FootballField
        {...baseProps}
        isOffenseLeftToRight={false}
        previousPlayYards={2}
      />,
    );

    expect(markup).toContain('clip-path:polygon(100% 0, 0 50%, 100% 100%)');
  });

  it('does not show a previous-play range before a play or after no gain', () => {
    const markup = renderToStaticMarkup(<FootballField {...baseProps} />);

    expect(markup).not.toContain('Previous play:');
  });

  it('shows down and distance above the ball', () => {
    const markup = renderToStaticMarkup(<FootballField {...baseProps} />);

    expect(markup).toContain('top:25%');
    expect(markup).toContain('>2nd &amp; 8</span>');
  });

  it('keeps full team names available for dynamic fitting', () => {
    const markup = renderToStaticMarkup(
      <FootballField
        {...baseProps}
        homeTeam={{ name: 'Kennesaw State' }}
      />,
    );

    expect(markup).toContain('>Kennesaw State</span>');
    expect(markup).not.toContain('text-overflow:ellipsis');
    expect(markup).toContain('font-size:16px');
  });

  it('renders painted block wordmarks for the school and mascot', () => {
    const markup = renderToStaticMarkup(
      <FootballField
        {...baseProps}
        homeTeam={{
          name: 'Oregon',
          mascot: 'Ducks',
          colorPrimary: '#154733',
          colorSecondary: '#fee123',
        }}
      />,
    );

    expect(markup).toContain('>Oregon</span>');
    expect(markup).toContain('>Ducks</span>');
    expect(markup).toContain('font-weight:900');
    expect(markup).toContain('line-height:1');
    expect(markup).toContain('letter-spacing:0.055em');
    expect(markup).toContain('text-transform:uppercase');
    expect(markup).toContain('-webkit-text-stroke:0.75px');
    expect(markup).toContain('paint-order:stroke fill');
    expect(markup).toContain('text-shadow:');
    expect(markup).toContain('position:absolute');
    expect(markup).toContain('top:50%');
    expect(markup).toContain('left:50%');
    expect(markup).toContain('transform:translate(-50%, -50%) rotate(-90deg)');
    expect(markup).toContain('transform:translate(-50%, -50%) rotate(90deg)');
  });

  it('uses one program wordmark per end zone at neutral sites', () => {
    const markup = renderToStaticMarkup(
      <FootballField
        {...baseProps}
        neutralSite
        homeTeam={{ name: 'Home Program', mascot: 'Home Mascot' }}
        awayTeam={{ name: 'Away Program', mascot: 'Away Mascot' }}
      />,
    );

    expect(markup).toContain('>Away Program</span>');
    expect(markup).toContain('>Home Program</span>');
    expect(markup).not.toContain('Home Mascot');
    expect(markup).not.toContain('Away Mascot');
  });

  it('preserves the field ratio while centering and width-capping wide fields', () => {
    const markup = renderToStaticMarkup(<FootballField {...baseProps} />);

    expect(markup).toContain('width:100%');
    expect(markup).toContain('max-width:815px');
    expect(markup).toContain('margin-left:auto');
    expect(markup).toContain('margin-right:auto');
    expect(markup).toContain('align-self:center');
    expect(markup).toContain('aspect-ratio:120/53');
    expect(markup).not.toContain('min-height:150px');
    expect(markup).not.toContain('max-height:310px');
    expect(markup).not.toContain('max-height:360px');
  });
});

describe('end-zone wordmark sizing', () => {
  it('uses the cross-axis limit for short labels', () => {
    expect(calculateEndZoneWordmarkFontSize({
      endZoneWidth: 60,
      endZoneHeight: 300,
      measuredFontSize: 16,
      measuredTextWidth: 80,
    })).toBe(42);
  });

  it('shrinks long labels to the inline-axis limit', () => {
    expect(calculateEndZoneWordmarkFontSize({
      endZoneWidth: 60,
      endZoneHeight: 300,
      measuredFontSize: 16,
      measuredTextWidth: 200,
    })).toBe(19.7);
  });

  it('scales proportionally when the end zone grows', () => {
    const baseMetrics = {
      endZoneWidth: 60,
      endZoneHeight: 300,
      measuredFontSize: 16,
      measuredTextWidth: 200,
    };

    expect(calculateEndZoneWordmarkFontSize({
      ...baseMetrics,
      endZoneWidth: 120,
      endZoneHeight: 600,
    })).toBe(39.4);
  });

  it('ignores incomplete or invalid measurements', () => {
    expect(calculateEndZoneWordmarkFontSize({
      endZoneWidth: 0,
      endZoneHeight: 300,
      measuredFontSize: 16,
      measuredTextWidth: 80,
    })).toBeNull();
    expect(calculateEndZoneWordmarkFontSize({
      endZoneWidth: 60,
      endZoneHeight: Number.NaN,
      measuredFontSize: 16,
      measuredTextWidth: 80,
    })).toBeNull();
  });
});
