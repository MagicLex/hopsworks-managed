import React from 'react';
import Head from 'next/head';
import { Box, Title, Text } from 'tailwind-quartz';
import Layout from '@/components/Layout';

export default function Privacy() {
  return (
    <>
      <Head>
        <title>Privacy Policy - Hopsworks Managed</title>
        <meta name="description" content="Privacy Policy for Hopsworks Managed platform" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      
      <Layout className="py-10 px-5">
        <Box className="max-w-4xl mx-auto">
          <Title className="text-3xl font-bold mb-8">Privacy Policy</Title>
          <Text className="text-sm text-gray-600 mb-8">Last updated: September 2025</Text>
          
          <Box className="prose prose-gray max-w-none space-y-6">
            <Box>
              <Title className="text-xl font-semibold mb-4">1. Introduction</Title>
              <Text className="text-gray-700 leading-relaxed">
                Hopsworks AB (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) respects your privacy and is committed to protecting 
                your personal data. This Privacy Policy explains how we collect, use, and protect your 
                information when you use the Hopsworks Managed platform (&ldquo;Service&rdquo;).
              </Text>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">2. Information We Collect</Title>
              <Box className="space-y-4">
                <Box>
                  <Text className="font-medium text-gray-900 mb-2">Account Information:</Text>
                  <Text className="text-gray-700 leading-relaxed">
                    Name, email address, company information, and authentication data provided during registration.
                  </Text>
                </Box>
                <Box>
                  <Text className="font-medium text-gray-900 mb-2">Usage Data:</Text>
                  <Text className="text-gray-700 leading-relaxed">
                    Information about how you use our Service, including cluster resources, feature usage, 
                    API calls, and performance metrics.
                  </Text>
                </Box>
                <Box>
                  <Text className="font-medium text-gray-900 mb-2">Technical Data:</Text>
                  <Text className="text-gray-700 leading-relaxed">
                    IP addresses, browser type, device information, log files, and cookies for service operation.
                  </Text>
                </Box>
                <Box>
                  <Text className="font-medium text-gray-900 mb-2">Customer Data:</Text>
                  <Text className="text-gray-700 leading-relaxed">
                    Data you upload, process, or store using our Service. We process this data solely to provide 
                    the Service and do not access it for any other purposes.
                  </Text>
                </Box>
              </Box>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">3. How We Use Your Information</Title>
              <Text className="text-gray-700 leading-relaxed mb-4">We use your information to:</Text>
              <Box className="ml-6">
                <Text className="text-gray-700 leading-relaxed">• Provide and maintain our Service</Text>
                <Text className="text-gray-700 leading-relaxed">• Process billing and payments</Text>
                <Text className="text-gray-700 leading-relaxed">• Communicate with you about your account and service updates</Text>
                <Text className="text-gray-700 leading-relaxed">• Provide customer support</Text>
                <Text className="text-gray-700 leading-relaxed">• Improve our Service and develop new features</Text>
                <Text className="text-gray-700 leading-relaxed">• Comply with legal obligations</Text>
                <Text className="text-gray-700 leading-relaxed">• Ensure security and prevent fraud</Text>
              </Box>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">4. Information Sharing</Title>
              <Text className="text-gray-700 leading-relaxed mb-4">
                We do not sell your personal information. We may share information in these limited circumstances:
              </Text>
              <Box className="ml-6">
                <Text className="text-gray-700 leading-relaxed">• With service providers who assist in operating our Service (Stripe, Auth0, AWS)</Text>
                <Text className="text-gray-700 leading-relaxed">• When required by law or to protect our rights</Text>
                <Text className="text-gray-700 leading-relaxed">• In connection with a merger, sale, or transfer of assets</Text>
                <Text className="text-gray-700 leading-relaxed">• With your explicit consent</Text>
              </Box>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">5. Data Security</Title>
              <Text className="text-gray-700 leading-relaxed">
                We implement industry-standard security measures to protect your data, including encryption 
                in transit and at rest, access controls, regular security assessments, and compliance with 
                relevant security frameworks. However, no internet transmission is completely secure.
              </Text>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">6. Data Retention</Title>
              <Text className="text-gray-700 leading-relaxed">
                We retain your personal information for as long as necessary to provide the Service and comply 
                with legal obligations. Customer data is retained according to your account settings and service 
                usage. You can delete your data through the Service or by contacting us.
              </Text>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">7. International Data Transfers</Title>
              <Text className="text-gray-700 leading-relaxed">
                Your data may be transferred to and processed in countries outside the European Economic Area. 
                We ensure appropriate safeguards are in place, including Standard Contractual Clauses where 
                applicable. See our Data Processing Agreement for details.
              </Text>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">8. Your Rights</Title>
              <Text className="text-gray-700 leading-relaxed mb-4">
                Under applicable data protection laws, you have the right to:
              </Text>
              <Box className="ml-6">
                <Text className="text-gray-700 leading-relaxed">• Access your personal information</Text>
                <Text className="text-gray-700 leading-relaxed">• Correct inaccurate data</Text>
                <Text className="text-gray-700 leading-relaxed">• Delete your personal information</Text>
                <Text className="text-gray-700 leading-relaxed">• Restrict processing of your data</Text>
                <Text className="text-gray-700 leading-relaxed">• Data portability</Text>
                <Text className="text-gray-700 leading-relaxed">• Object to processing</Text>
                <Text className="text-gray-700 leading-relaxed">• Withdraw consent where applicable</Text>
              </Box>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">9. Cookies and Tracking</Title>
              <Text className="text-gray-700 leading-relaxed">
                We use cookies and similar technologies to provide and improve our Service. These include 
                essential cookies for authentication and service functionality, as well as analytics cookies 
                to understand usage patterns. You can control cookie preferences through your browser settings.
              </Text>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">10. Children&apos;s Privacy</Title>
              <Text className="text-gray-700 leading-relaxed">
                Our Service is not intended for children under 16 years of age. We do not knowingly collect 
                personal information from children under 16. If we become aware of such data, we will delete 
                it promptly.
              </Text>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">11. Changes to This Policy</Title>
              <Text className="text-gray-700 leading-relaxed">
                We may update this Privacy Policy periodically. We will notify you of material changes via 
                email or through the Service. Your continued use of the Service after changes become effective 
                constitutes acceptance of the updated policy.
              </Text>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">12. Contact Us</Title>
              <Text className="text-gray-700 leading-relaxed mb-4">
                For privacy-related questions or to exercise your rights, contact us at:
              </Text>
              <Box className="ml-6">
                <Text className="text-gray-700">Hopsworks AB</Text>
                <Text className="text-gray-700">Data Protection Officer</Text>
                <Text className="text-gray-700">Åsögatan 119</Text>
                <Text className="text-gray-700">116 24 Stockholm, Sweden</Text>
                <Text className="text-gray-700">Email: info@hopsworks.ai</Text>
                <Text className="text-gray-700">Subject: Privacy Policy Inquiry</Text>
              </Box>
            </Box>

            <Box className="mt-12 pt-8 border-t border-gray-200">
              <Text className="text-sm text-gray-500">
                This Privacy Policy is governed by Swedish data protection law and the General Data Protection 
                Regulation (GDPR) where applicable.
              </Text>
            </Box>
          </Box>
        </Box>
      </Layout>
    </>
  );
}