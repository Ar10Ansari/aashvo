import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PropertyCard } from '../components/property/PropertyCard';
import { SEED_PROPERTIES } from '../data/seedData';
import { AppProvider } from '../context/AppContext';

describe('PropertyCard UI Component', () => {
  const property = SEED_PROPERTIES[0];

  it('renders property title, locality, rent, and verified freshness badge', () => {
    const handleSelect = vi.fn();
    render(
      <AppProvider>
        <PropertyCard property={property} onSelect={handleSelect} />
      </AppProvider>,
    );

    expect(screen.getByText(property.title)).toBeDefined();
    expect(screen.getAllByText(new RegExp(property.locality, 'i'))[0]).toBeDefined();
    expect(screen.getByText('₹23,500')).toBeDefined();
    expect(screen.getByText('Direct Owner (₹0 Brokerage)')).toBeDefined();
  });

  it('triggers onSelect callback when clicked or activated with Enter key', () => {
    const handleSelect = vi.fn();
    render(
      <AppProvider>
        <PropertyCard property={property} onSelect={handleSelect} />
      </AppProvider>,
    );

    const article = screen.getByRole('article');
    fireEvent.click(article);
    expect(handleSelect).toHaveBeenCalledWith(property);

    handleSelect.mockClear();
    fireEvent.keyDown(article, { key: 'Enter', code: 'Enter' });
    expect(handleSelect).toHaveBeenCalledWith(property);
  });
});
