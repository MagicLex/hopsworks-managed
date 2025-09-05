import React from 'react';
import Link from 'next/link';
import { Box, Flex, Text, Title } from 'tailwind-quartz';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <Box as="footer" className="bg-[#1eb182] border-t border-[#1eb182] mt-auto">
      <Box className="max-w-6xl mx-auto px-5 py-8">
        <Flex direction="column" gap={32} justify="between" className="md:flex-row">
          {/* Legal */}
          <Box className="flex-1">
            <Title className="text-sm font-semibold text-white mb-4">Legal</Title>
            <Box className="space-y-2">
              <Text className="text-sm">
                <Link href="/terms" className="text-green-100 hover:text-white">
                  Terms of Service
                </Link>
              </Text>
              <Text className="text-sm">
                <Link href="/privacy" className="text-green-100 hover:text-white">
                  Privacy Policy
                </Link>
              </Text>
              <Text className="text-sm">
                <Link href="/aup" className="text-green-100 hover:text-white">
                  Acceptable Use Policy
                </Link>
              </Text>
              <Text className="text-sm">
                <Link href="/dpa" className="text-green-100 hover:text-white">
                  Data Processing Agreement
                </Link>
              </Text>
            </Box>
          </Box>

          {/* Resources */}
          <Box className="flex-1">
            <Title className="text-sm font-semibold text-white mb-4">Resources</Title>
            <Box className="space-y-2">
              <Text className="text-sm">
                <a 
                  href="https://docs.hopsworks.ai" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-green-100 hover:text-white"
                >
                  Documentation
                </a>
              </Text>
              <Text className="text-sm">
                <a 
                  href="https://www.hopsworks.ai/contact/main" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-green-100 hover:text-white"
                >
                  Support
                </a>
              </Text>
              <Text className="text-sm">
                <a 
                  href="https://www.hopsworks.ai" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-green-100 hover:text-white"
                >
                  Main Website
                </a>
              </Text>
              <Text className="text-sm">
                <a href="mailto:info@hopsworks.ai" className="text-green-100 hover:text-white">
                  Contact Us
                </a>
              </Text>
            </Box>
          </Box>
        </Flex>

        {/* Copyright */}
        <Box className="mt-8 pt-8 border-t border-green-400">
          <Text className="text-sm text-green-100 text-center">
            © {currentYear} Hopsworks AB. All rights reserved.
          </Text>
        </Box>
      </Box>
    </Box>
  );
};

export default Footer;