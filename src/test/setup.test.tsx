import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('jsdom project', () => {
  it('renders React into a DOM and has the jest-dom matchers', () => {
    render(<p>foundation</p>);
    expect(screen.getByText('foundation')).toBeInTheDocument();
  });
});
