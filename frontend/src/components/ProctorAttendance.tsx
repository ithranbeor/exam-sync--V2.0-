import React from 'react';
import '../styles/ProctorAttendance.css';

interface UserProps {
  user: {
    user_id: number;
    email: string;
    first_name?: string;
    last_name?: string;
  } | null;
}

const ProctorAttendance: React.FC<UserProps> = ({ user }) => {
  // user will be used for future functionality
  return (
    <div className="proctor-attendance-container">
      <div className="proctor-attendance-header">
        <h2 className="proctor-attendance-title">Proctor Attendance</h2>
      </div>
      
      <div className="proctor-attendance-table-container">
        <table className="proctor-attendance-table">
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

export default ProctorAttendance;

