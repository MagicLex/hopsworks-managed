import React from 'react';
import Head from 'next/head';
import { Box, Title, Text } from 'tailwind-quartz';
import Layout from '@/components/Layout';

export default function AcceptableUsePolicy() {
  return (
    <>
      <Head>
        <title>Acceptable Use Policy - Hopsworks Managed</title>
        <meta name="description" content="Acceptable Use Policy for Hopsworks Managed platform" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      
      <Layout className="py-10 px-5">
        <Box className="max-w-4xl mx-auto">
          <Title className="text-3xl font-bold mb-8">Acceptable Use Policy</Title>
          <Text className="text-sm text-gray-600 mb-8">Last updated: September 2025</Text>
          
          <Box className="prose prose-gray max-w-none space-y-6">
            <Box>
              <Title className="text-xl font-semibold mb-4">1. Purpose</Title>
              <Text className="text-gray-700 leading-relaxed">
                This Acceptable Use Policy ("AUP") governs your use of the Hopsworks Managed platform 
                and services provided by Hopsworks AB. This policy is designed to ensure the security, 
                availability, and integrity of our services for all users.
              </Text>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">2. Prohibited Activities</Title>
              <Text className="text-gray-700 leading-relaxed mb-4">
                You may not use our Service to:
              </Text>

              <Box className="space-y-4">
                <Box>
                  <Text className="font-medium text-gray-900 mb-2">Illegal Activities:</Text>
                  <Box className="ml-4">
                    <Text className="text-gray-700 leading-relaxed">• Violate any applicable laws, regulations, or legal requirements</Text>
                    <Text className="text-gray-700 leading-relaxed">• Infringe on intellectual property rights of others</Text>
                    <Text className="text-gray-700 leading-relaxed">• Engage in fraudulent, deceptive, or misleading activities</Text>
                    <Text className="text-gray-700 leading-relaxed">• Facilitate money laundering or terrorist financing</Text>
                  </Box>
                </Box>

                <Box>
                  <Text className="font-medium text-gray-900 mb-2">Security Violations:</Text>
                  <Box className="ml-4">
                    <Text className="text-gray-700 leading-relaxed">• Attempt unauthorized access to accounts, systems, or networks</Text>
                    <Text className="text-gray-700 leading-relaxed">• Probe, scan, or test the vulnerability of our systems</Text>
                    <Text className="text-gray-700 leading-relaxed">• Circumvent authentication or security measures</Text>
                    <Text className="text-gray-700 leading-relaxed">• Introduce malware, viruses, or malicious code</Text>
                    <Text className="text-gray-700 leading-relaxed">• Attempt to decrypt or reverse engineer our services</Text>
                  </Box>
                </Box>

                <Box>
                  <Text className="font-medium text-gray-900 mb-2">Abuse and Misuse:</Text>
                  <Box className="ml-4">
                    <Text className="text-gray-700 leading-relaxed">• Send spam, unsolicited communications, or phishing attempts</Text>
                    <Text className="text-gray-700 leading-relaxed">• Host or distribute harmful, offensive, or illegal content</Text>
                    <Text className="text-gray-700 leading-relaxed">• Impersonate others or misrepresent your identity</Text>
                    <Text className="text-gray-700 leading-relaxed">• Harass, threaten, or abuse other users or our staff</Text>
                    <Text className="text-gray-700 leading-relaxed">• Use excessive resources that impact service performance</Text>
                  </Box>
                </Box>

                <Box>
                  <Text className="font-medium text-gray-900 mb-2">Commercial Restrictions:</Text>
                  <Box className="ml-4">
                    <Text className="text-gray-700 leading-relaxed">• Resell or redistribute our services without authorization</Text>
                    <Text className="text-gray-700 leading-relaxed">• Use our services to compete directly with Hopsworks offerings</Text>
                    <Text className="text-gray-700 leading-relaxed">• Create derivative works based on our proprietary technology</Text>
                    <Text className="text-gray-700 leading-relaxed">• Use our services for cryptocurrency mining without approval</Text>
                  </Box>
                </Box>
              </Box>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">3. Data and Content Restrictions</Title>
              <Text className="text-gray-700 leading-relaxed mb-4">
                The following types of data are prohibited unless explicitly authorized:
              </Text>
              <Box className="ml-6">
                <Text className="text-gray-700 leading-relaxed">• Personal Health Information (PHI) without HIPAA compliance</Text>
                <Text className="text-gray-700 leading-relaxed">• Payment Card Industry (PCI) data without proper authorization</Text>
                <Text className="text-gray-700 leading-relaxed">• Classified or export-controlled information</Text>
                <Text className="text-gray-700 leading-relaxed">• Biometric data without explicit consent and safeguards</Text>
                <Text className="text-gray-700 leading-relaxed">• Data obtained through unauthorized means</Text>
                <Text className="text-gray-700 leading-relaxed">• Content that violates third-party privacy rights</Text>
              </Box>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">4. Resource Usage</Title>
              <Text className="text-gray-700 leading-relaxed mb-4">
                You agree to use resources responsibly:
              </Text>
              <Box className="ml-6">
                <Text className="text-gray-700 leading-relaxed">• Monitor and optimize your resource consumption</Text>
                <Text className="text-gray-700 leading-relaxed">• Avoid activities that could degrade service performance for other users</Text>
                <Text className="text-gray-700 leading-relaxed">• Implement appropriate safeguards for long-running processes</Text>
                <Text className="text-gray-700 leading-relaxed">• Clean up unused resources and data promptly</Text>
                <Text className="text-gray-700 leading-relaxed">• Report any suspicious resource usage patterns</Text>
              </Box>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">5. Compliance Requirements</Title>
              <Text className="text-gray-700 leading-relaxed">
                If your use case involves regulated data or industries, you must ensure compliance with 
                relevant regulations including GDPR, CCPA, HIPAA, PCI-DSS, SOC 2, and industry-specific 
                requirements. You are responsible for implementing appropriate controls and obtaining 
                necessary certifications.
              </Text>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">6. Monitoring and Enforcement</Title>
              <Text className="text-gray-700 leading-relaxed">
                We monitor our services for compliance with this AUP and may investigate suspected 
                violations. We reserve the right to suspend or terminate accounts that violate this 
                policy, remove violating content, and cooperate with law enforcement when required.
              </Text>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">7. Reporting Violations</Title>
              <Text className="text-gray-700 leading-relaxed mb-4">
                If you become aware of activities that violate this AUP, please report them immediately:
              </Text>
              <Box className="ml-6">
                <Text className="text-gray-700">Email: info@hopsworks.ai</Text>
                <Text className="text-gray-700">Subject: AUP Violation Report</Text>
                <Text className="text-gray-700">Include: Detailed description, evidence, and your contact information</Text>
              </Box>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">8. Consequences of Violations</Title>
              <Text className="text-gray-700 leading-relaxed mb-4">
                Violations may result in:
              </Text>
              <Box className="ml-6">
                <Text className="text-gray-700 leading-relaxed">• Warning and required corrective action</Text>
                <Text className="text-gray-700 leading-relaxed">• Temporary suspension of service access</Text>
                <Text className="text-gray-700 leading-relaxed">• Permanent account termination</Text>
                <Text className="text-gray-700 leading-relaxed">• Legal action where appropriate</Text>
                <Text className="text-gray-700 leading-relaxed">• Cooperation with law enforcement investigations</Text>
              </Box>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">9. Appeals Process</Title>
              <Text className="text-gray-700 leading-relaxed">
                If you believe your account was suspended or terminated in error, you may appeal by 
                contacting us at info@hopsworks.ai with "AUP Appeal" in the subject line. Include 
                your account information and explanation of why you believe the action was taken in error.
              </Text>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">10. Changes to This Policy</Title>
              <Text className="text-gray-700 leading-relaxed">
                We may update this AUP as needed to address new threats or requirements. We will notify 
                users of material changes via email or service notifications. Continued use of our services 
                constitutes acceptance of policy updates.
              </Text>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">11. Contact Information</Title>
              <Text className="text-gray-700 leading-relaxed mb-4">
                For questions about this policy:
              </Text>
              <Box className="ml-6">
                <Text className="text-gray-700">Hopsworks AB</Text>
                <Text className="text-gray-700">Åsögatan 119</Text>
                <Text className="text-gray-700">116 24 Stockholm, Sweden</Text>
                <Text className="text-gray-700">Email: info@hopsworks.ai</Text>
              </Box>
            </Box>

            <Box className="mt-12 pt-8 border-t border-gray-200">
              <Text className="text-sm text-gray-500">
                This Acceptable Use Policy is part of and incorporated into our Terms of Service. 
                Violation of this AUP constitutes a material breach of the Terms of Service.
              </Text>
            </Box>
          </Box>
        </Box>
      </Layout>
    </>
  );
}