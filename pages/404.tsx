import Layout from '@/components/Layout'; // Assuming you have a Layout component
import Link from 'next/link';
import React from 'react';

const NotFoundPage: React.FC = () => {
  return (
    <Layout title="Page Not Found" glassy={false}>
      <div className="flex flex-col items-center justify-center text-center px-4 h-[80vh]">
        <h1 className="text-6xl font-bold text-[#471803] mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-[rgb(71,24,3)] mb-6">Oops! Page Not Found.</h2>
        <p className="text-gray-600 mb-8">
          The page you are looking for might have been removed, had its name changed,
          or is temporarily unavailable.
        </p>
        <Link href="/" className="px-6 py-3 bg-[#471803] text-white font-semibold rounded-md hover:bg-opacity-80 transition-colors">
          Go to Homepage
        </Link>
      </div>
    </Layout>
  );
};

export default NotFoundPage; 