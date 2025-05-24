import Image from 'next/image';
import Layout from '@/components/Layout';
// pages/index.tsx
import { NextPage } from 'next';
import portrait from '../public/portrait.png';

const Home: NextPage = () => {
  return (
    <Layout title="Yam | Home" glassy={false}>
      <div className="flex justify-center items-center ">
        <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
          <Image 
            src={portrait} 
            alt="Yam logo"
            className="w-[60vw] pb-4"
            priority
          />
          <h1 className="text-xl font-normal leading-relaxed tracking-tight mb-2">
            🍠 is a bespoke mailroom management and data platform. 
          </h1>
          <h2 className="text-base font-normal leading-relaxed tracking-tight">
            Contact sales@useyam.com for more information.
          </h2>
        </div>
      </div>
    </Layout>
  );
};

export default Home;