import React from 'react';
import '../styles/ProctorMonitoring.css';

interface UserProps {
  user: {
    user_id: number;
    email: string;
    first_name?: string;
    last_name?: string;
  } | null;
}

const ProctorMonitoring: React.FC<UserProps> = ({ user }) => {
  // user will be used for future functionality
  return (
    <div className="proctor-monitoring-container">
      <div className="proctor-monitoring-header">
        <h2 className="proctor-monitoring-title">Proctor Monitoring</h2>
      </div>
      
      <div className="proctor-monitoring-table-container">
        <table className="proctor-monitoring-table">
          <thead>
            <tr>
              <th>
                {/* Table headers will be added later */}
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Table content will be added later */}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProctorMonitoring;

