import Layout from '@/components/Layout';
// pages/index.tsx
import { NextPage } from 'next';

const About: NextPage = () => {
  return (
    <Layout title="Yam | About" glassy={false}>
      <div className="flex flex-1 justify-center items-center">
        <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
          <h1 className="text-xl font-normal leading-relaxed tracking-tight mb-2">
            Yam [🍠] is a bespoke mailroom management and data platform. 
          </h1>
          <h2 className="text-base font-normal leading-relaxed tracking-tight">
            Contact sales@useyam.com for more information.
          </h2>
        </div>
      </div>
    </Layout>
  );
};

export default About;