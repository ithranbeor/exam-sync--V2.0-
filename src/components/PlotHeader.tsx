// PlotHeader.tsx
import React from 'react';
import { FaSearch } from 'react-icons/fa';

interface PlotHeaderProps {
  showPlot: boolean;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  onAddNew: () => void;
}

const PlotHeader: React.FC<PlotHeaderProps> = ({
  showPlot,
  searchTerm,
  setSearchTerm,
  onAddNew,
}) => {
  if (showPlot) return null; // nothing if plotting

  return (
    <>
      <div className="colleges-header">
        <h2 className="colleges-title">Manage Schedule</h2>
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search for Schedule"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button type="button" className="search-button">
            <FaSearch />
          </button>
        </div>
      </div>

      <div className="colleges-actions">
        <button
          type="button"
          className="action-button add-new"
          onClick={onAddNew}
        >
          Add New Schedule
        </button>
      </div>
    </>
  );
};

export default PlotHeader;
