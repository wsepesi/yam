import React from 'react';
import { withAuth } from '@/components/withAuth';

const OrgIndexPage: React.FC = () => {
  return (
    <div>
      <h1>Organization Page</h1>
      {/* Your org page content here */}
    </div>
  );
};

// Wrap the component with withAuth to ensure authenticated access
export default withAuth(OrgIndexPage, 'admin'); 