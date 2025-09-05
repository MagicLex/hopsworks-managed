import React from 'react';
import Head from 'next/head';
import { Box, Title, Text } from 'tailwind-quartz';
import Layout from '@/components/Layout';

export default function DataProcessingAgreement() {
  return (
    <>
      <Head>
        <title>Data Processing Agreement - Hopsworks Managed</title>
        <meta name="description" content="Data Processing Agreement for Hopsworks Managed platform" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      
      <Layout className="py-10 px-5">
        <Box className="max-w-4xl mx-auto">
          <Title className="text-3xl font-bold mb-8">Data Processing Agreement</Title>
          <Text className="text-sm text-gray-600 mb-8">Last updated: September 2025</Text>
          
          <Box className="prose prose-gray max-w-none space-y-6">
            <Box>
              <Title className="text-xl font-semibold mb-4">1. Introduction and Scope</Title>
              <Text className="text-gray-700 leading-relaxed">
                This Data Processing Agreement ("DPA") forms part of the Terms of Service between you ("Controller") 
                and Hopsworks AB ("Processor") and governs the processing of personal data in connection with the 
                Hopsworks Managed platform. This DPA applies where and only to the extent that Hopsworks processes 
                personal data on behalf of the Controller.
              </Text>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">2. Definitions</Title>
              <Box className="space-y-2">
                <Text className="text-gray-700 leading-relaxed">
                  <strong>Controller:</strong> The entity that determines the purposes and means of processing personal data.
                </Text>
                <Text className="text-gray-700 leading-relaxed">
                  <strong>Processor:</strong> The entity that processes personal data on behalf of the Controller.
                </Text>
                <Text className="text-gray-700 leading-relaxed">
                  <strong>Personal Data:</strong> Any information relating to an identified or identifiable natural person.
                </Text>
                <Text className="text-gray-700 leading-relaxed">
                  <strong>Processing:</strong> Any operation performed on personal data.
                </Text>
                <Text className="text-gray-700 leading-relaxed">
                  <strong>Sub-processor:</strong> Any third party appointed by the Processor to process personal data.
                </Text>
              </Box>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">3. Processing Details</Title>
              <Box className="space-y-4">
                <Box>
                  <Text className="font-medium text-gray-900 mb-2">Subject Matter:</Text>
                  <Text className="text-gray-700 leading-relaxed">
                    Provision of machine learning platform services including feature store, model training, 
                    and deployment capabilities.
                  </Text>
                </Box>
                <Box>
                  <Text className="font-medium text-gray-900 mb-2">Duration:</Text>
                  <Text className="text-gray-700 leading-relaxed">
                    For the duration of the service agreement and as necessary for compliance with legal obligations.
                  </Text>
                </Box>
                <Box>
                  <Text className="font-medium text-gray-900 mb-2">Purpose:</Text>
                  <Text className="text-gray-700 leading-relaxed">
                    To provide the Hopsworks Managed platform services as specified in the Terms of Service.
                  </Text>
                </Box>
                <Box>
                  <Text className="font-medium text-gray-900 mb-2">Categories of Data Subjects:</Text>
                  <Text className="text-gray-700 leading-relaxed">
                    End users of Controller's systems, employees, customers, and other individuals whose 
                    personal data is processed through the platform.
                  </Text>
                </Box>
                <Box>
                  <Text className="font-medium text-gray-900 mb-2">Types of Personal Data:</Text>
                  <Text className="text-gray-700 leading-relaxed">
                    The personal data may include identifiers, professional information, usage data, 
                    technical data, and any other personal data uploaded by the Controller.
                  </Text>
                </Box>
              </Box>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">4. Processor Obligations</Title>
              <Text className="text-gray-700 leading-relaxed mb-4">Hopsworks will:</Text>
              <Box className="ml-6">
                <Text className="text-gray-700 leading-relaxed">• Process personal data only on documented instructions from the Controller</Text>
                <Text className="text-gray-700 leading-relaxed">• Ensure confidentiality of personal data</Text>
                <Text className="text-gray-700 leading-relaxed">• Implement appropriate technical and organizational security measures</Text>
                <Text className="text-gray-700 leading-relaxed">• Only engage sub-processors with appropriate contractual guarantees</Text>
                <Text className="text-gray-700 leading-relaxed">• Assist the Controller in responding to data subject requests</Text>
                <Text className="text-gray-700 leading-relaxed">• Assist with compliance, including impact assessments and consultations</Text>
                <Text className="text-gray-700 leading-relaxed">• Delete or return personal data upon termination</Text>
                <Text className="text-gray-700 leading-relaxed">• Notify the Controller of any personal data breaches</Text>
              </Box>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">5. Controller Obligations</Title>
              <Text className="text-gray-700 leading-relaxed mb-4">The Controller will:</Text>
              <Box className="ml-6">
                <Text className="text-gray-700 leading-relaxed">• Ensure it has legal basis for processing personal data</Text>
                <Text className="text-gray-700 leading-relaxed">• Provide clear instructions for personal data processing</Text>
                <Text className="text-gray-700 leading-relaxed">• Ensure personal data is accurate and up to date</Text>
                <Text className="text-gray-700 leading-relaxed">• Comply with data subject rights and requests</Text>
                <Text className="text-gray-700 leading-relaxed">• Maintain appropriate privacy notices</Text>
                <Text className="text-gray-700 leading-relaxed">• Not transfer personal data to countries without adequate protection</Text>
              </Box>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">6. Security Measures</Title>
              <Text className="text-gray-700 leading-relaxed">
                Hopsworks implements industry-standard technical and organizational measures including 
                encryption, access controls, employee training, regular security assessments, incident 
                response procedures, and compliance with relevant security frameworks such as SOC 2.
              </Text>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">7. Sub-processing</Title>
              <Text className="text-gray-700 leading-relaxed mb-4">
                Current sub-processors include:
              </Text>
              <Box className="ml-6">
                <Text className="text-gray-700 leading-relaxed">• Amazon Web Services (cloud infrastructure)</Text>
                <Text className="text-gray-700 leading-relaxed">• Auth0 (authentication services)</Text>
                <Text className="text-gray-700 leading-relaxed">• Stripe (payment processing)</Text>
                <Text className="text-gray-700 leading-relaxed">• Supabase (database services)</Text>
              </Box>
              <Text className="text-gray-700 leading-relaxed mt-4">
                We will notify you of any changes to sub-processors and provide opportunity to object to such changes.
              </Text>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">8. International Transfers</Title>
              <Text className="text-gray-700 leading-relaxed">
                Personal data may be transferred to countries outside the EEA. Where such transfers occur, 
                Hopsworks ensures appropriate safeguards are in place, including Standard Contractual Clauses 
                approved by the European Commission or adequacy decisions where available.
              </Text>
            </Box>

            <Box>
              <Title className="text-xl font-semibent mb-4">9. Data Subject Rights</Title>
              <Text className="text-gray-700 leading-relaxed">
                Hopsworks will assist the Controller in fulfilling data subject requests including access, 
                rectification, erasure, restriction of processing, data portability, and objection to processing. 
                Such requests should be directed to the Controller in the first instance.
              </Text>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">10. Data Breach Notification</Title>
              <Text className="text-gray-700 leading-relaxed">
                Hopsworks will notify the Controller without undue delay and no later than 72 hours after 
                becoming aware of any personal data breach. The notification will include available information 
                about the breach, its likely consequences, and measures taken to address it.
              </Text>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">11. Data Return and Deletion</Title>
              <Text className="text-gray-700 leading-relaxed">
                Upon termination of services, Hopsworks will delete or return all personal data to the 
                Controller as instructed, unless retention is required by applicable law. The Controller 
                has 30 days to request data return before automatic deletion occurs.
              </Text>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">12. Audits and Compliance</Title>
              <Text className="text-gray-700 leading-relaxed">
                Hopsworks will provide reasonable assistance for Controller audits or inspections by 
                regulators. Hopsworks maintains relevant certifications and compliance reports which 
                may be provided in lieu of audits where appropriate.
              </Text>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">13. Liability and Indemnification</Title>
              <Text className="text-gray-700 leading-relaxed">
                Each party is liable for damages caused by its infringement of applicable data protection 
                laws. The Controller will indemnify Hopsworks against claims arising from the Controller's 
                violation of data protection laws or processing instructions.
              </Text>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">14. Contact Information</Title>
              <Text className="text-gray-700 leading-relaxed mb-4">
                For questions about data processing:
              </Text>
              <Box className="ml-6">
                <Text className="text-gray-700">Hopsworks AB</Text>
                <Text className="text-gray-700">Data Protection Officer</Text>
                <Text className="text-gray-700">Åsögatan 119</Text>
                <Text className="text-gray-700">116 24 Stockholm, Sweden</Text>
                <Text className="text-gray-700">Email: info@hopsworks.ai</Text>
              </Box>
            </Box>

            <Box className="mt-12 pt-8 border-t border-gray-200">
              <Text className="text-sm text-gray-500">
                This DPA is governed by Swedish law and shall be interpreted in accordance with applicable 
                EU data protection law including the General Data Protection Regulation (GDPR).
              </Text>
            </Box>
          </Box>
        </Box>
      </Layout>
    </>
  );
}