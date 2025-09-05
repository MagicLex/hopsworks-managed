import React from 'react';
import { Box } from 'tailwind-quartz';
import Navbar from './Navbar';
import Footer from './Footer';

interface LayoutProps {
  children: React.ReactNode;
  className?: string;
}

const Layout: React.FC<LayoutProps> = ({ children, className }) => {
  return (
    <Box className="min-h-screen flex flex-col">
      <Navbar />
      <Box as="main" className={`flex-1 ${className || ''}`}>
        {children}
      </Box>
      <Footer />
    </Box>
  );
};

export default Layout;