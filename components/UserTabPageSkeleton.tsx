import React from "react";

const SkeletonSidebar = () => (
  <div className="w-full md:w-48 bg-[#ffeedd] p-4 pt-20 md:h-full overflow-y-auto animate-pulse">
    <div className="mb-6">
      <div className="h-3 bg-[#471803]/20 rounded w-1/4 mb-3" />
      <div className="space-y-2">
        <div className="h-4 bg-[#471803]/20 rounded w-3/4" />
        <div className="h-4 bg-[#471803]/20 rounded w-1/2" />
        <div className="h-4 bg-[#471803]/20 rounded w-2/3" />
      </div>
    </div>
    <div className="mb-6">
      <div className="h-3 bg-[#471803]/20 rounded w-1/3 mb-3" />
      <div className="space-y-2">
        <div className="h-4 bg-[#471803]/20 rounded w-3/4" />
        <div className="h-4 bg-[#471803]/20 rounded w-1/2" />
      </div>
    </div>
  </div>
);

const SkeletonMainContent = () => (
  <div className="flex-1 px-12 animate-pulse">
    <div className="flex justify-between items-center mb-4 pt-6">
      <div>
        <div className="h-8 bg-[#471803]/20 rounded w-48 mb-1" />
        <div className="h-4 bg-[#471803]/20 rounded w-64" />
      </div>
      <div className="h-6 bg-[#471803]/20 rounded w-32" />
    </div>
    <div className="h-px bg-[#471803]/20 mb-6" />
    <div className="space-y-4">
      <div className="h-16 bg-[#471803]/10 rounded" />
      <div className="h-32 bg-[#471803]/10 rounded" />
      <div className="h-24 bg-[#471803]/10 rounded" />
    </div>
  </div>
);

const UserTabPageSkeleton = () => {
  return (
    <div className="flex flex-col md:flex-row flex-1 h-full">
      <SkeletonSidebar />
      <SkeletonMainContent />
    </div>
  );
};

export default UserTabPageSkeleton;
