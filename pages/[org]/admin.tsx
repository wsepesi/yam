import React from 'react';
import { withAuth } from '@/components/withAuth';

const AdminPage: React.FC = () => {
  return (
    <div>
      <h1>Admin Page</h1>
      {/* Admin controls will go here */}
    </div>
  );
};

// Wrap the component with withAuth, requiring 'admin' role for access
export default withAuth(AdminPage, 'admin'); 