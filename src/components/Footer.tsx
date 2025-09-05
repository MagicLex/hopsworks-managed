import React from 'react';
import Link from 'next/link';
import { Box, Flex, Text } from 'tailwind-quartz';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <Box as="footer" className="border-t border-gray-200 mt-auto">
      <Box className="max-w-6xl mx-auto px-5 py-3">
        <Flex align="center" justify="between" className="flex-col gap-2 sm:flex-row">
          <Text className="text-xs text-gray-500">
            © {currentYear} Hopsworks AB
          </Text>
          <Flex gap={16} className="text-xs">
            <Link href="/terms" className="text-gray-500 hover:text-gray-700">
              Terms
            </Link>
            <Link href="/privacy" className="text-gray-500 hover:text-gray-700">
              Privacy
            </Link>
            <a 
              href="https://docs.hopsworks.ai" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-700"
            >
              Docs
            </a>
            <a 
              href="https://www.hopsworks.ai/contact/main" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-700"
            >
              Support
            </a>
          </Flex>
        </Flex>
      </Box>
    </Box>
  );
};

export default Footer;