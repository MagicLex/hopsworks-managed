import React from 'react';
import Image from 'next/image';

const Navbar: React.FC = () => {
  return (
    <nav className="border-b border-gray-300 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center h-14">
          <Image 
            src="/logo_hopsworks.svg" 
            alt="Hopsworks" 
            width={140} 
            height={32}
          />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;