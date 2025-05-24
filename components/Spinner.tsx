import React from "react";

const Spinner: React.FC = () => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#ffeedd]/70 z-50">
      <div className="w-16 h-16 border-4 border-[#471803] border-t-transparent rounded-full animate-spin" />
      {/* Optional: Add text like 'Loading...' below or inside the spinner if desired */}
      {/* <p className="text-center text-lg text-[#471803] mt-4">Loading...</p> */}
    </div>
  );
};

export default Spinner;
