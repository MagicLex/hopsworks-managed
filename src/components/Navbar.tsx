import React from 'react';
import Image from 'next/image';
import { Box, Flex } from 'tailwind-quartz';

const Navbar: React.FC = () => {
  return (
    <Box as="nav" className="border-b border-grayShade2 bg-white">
      <Box className="max-w-7xl mx-auto px-4">
        <Flex align="center" className="h-14">
          <Image 
            src="/logo_hopsworks.svg" 
            alt="Hopsworks" 
            width={140} 
            height={32}
          />
        </Flex>
      </Box>
    </Box>
  );
};

export default Navbar;