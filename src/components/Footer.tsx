import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Box, Flex, Text } from 'tailwind-quartz';
import { Slack, Linkedin, Twitter } from 'lucide-react';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [isNonUS, setIsNonUS] = useState(false);

  useEffect(() => {
    // Check if user is outside the US
    fetch('https://ipapi.co/json/')
      .then(res => res.json())
      .then(data => {
        if (data.country_code && data.country_code !== 'US') {
          setIsNonUS(true);
        }
      })
      .catch(() => {
        // Don't show if we can't determine location
        setIsNonUS(false);
      });
  }, []);

  return (
    <Box as="footer" className="border-t border-gray-200 mt-auto bg-white">
      <Box className="max-w-6xl mx-auto px-5 py-3">
        <Flex align="center" justify="between" className="flex-col gap-2 sm:flex-row">
          <Flex align="center" gap={8}>
            <Text className="text-xs text-gray-500">
              © {currentYear} Hopsworks AB
            </Text>
            {isNonUS && (
              <Flex align="center" gap={6}>
                <Text className="text-xs text-gray-500">• Crafted in</Text>
                <span className="text-base" title="European Union">🇪🇺</span>
                <span className="text-base" title="Sweden">🇸🇪</span>
              </Flex>
            )}
          </Flex>
          <Flex align="center" gap={12}>
            <a
              href="https://join.slack.com/t/public-hopsworks/shared_invite/zt-1uf21vitz-rhHKNdIf8GEiOf1EJ6Wzsw"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-[#4A154B] transition-colors"
              title="Join our Slack community"
            >
              <Slack size={18} />
            </a>
            <a
              href="https://www.linkedin.com/company/hopsworks/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-[#0A66C2] transition-colors"
              title="Follow us on LinkedIn"
            >
              <Linkedin size={18} />
            </a>
            <a
              href="https://twitter.com/hopsworks"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-gray-900 transition-colors"
              title="Follow us on X"
            >
              <Twitter size={18} />
            </a>
          </Flex>
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