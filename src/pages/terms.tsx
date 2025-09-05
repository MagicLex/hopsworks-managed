import React from 'react';
import Head from 'next/head';
import { Box, Title, Text } from 'tailwind-quartz';
import Layout from '@/components/Layout';

export default function Terms() {
  return (
    <>
      <Head>
        <title>Terms of Service - Hopsworks Managed</title>
        <meta name="description" content="Terms of Service for Hopsworks Managed platform-as-a-service" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      
      <Layout className="py-10 px-5">
        <Box className="max-w-4xl mx-auto">
          <Title className="text-3xl font-bold mb-8">Terms of Service</Title>
          <Text className="text-sm text-gray-600 mb-8">Last updated: September 2025</Text>
          
          <Box className="prose prose-gray max-w-none space-y-6">
            <Box>
              <Title className="text-xl font-semibold mb-4">1. Agreement Overview</Title>
              <Text className="text-gray-700 leading-relaxed">
                This Terms of Service agreement ("Agreement") governs your use of the Hopsworks Managed 
                platform-as-a-service ("Service") provided by Hopsworks AB ("Company", "we", "us", or "our").
                By accessing or using our Service, you ("Customer", "you", or "your") agree to be bound by these terms.
              </Text>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">2. Service Description</Title>
              <Text className="text-gray-700 leading-relaxed mb-4">
                Hopsworks Managed provides a cloud-based machine learning platform that includes:
              </Text>
              <Box className="ml-6">
                <Text className="text-gray-700 leading-relaxed">• Feature store and data management capabilities</Text>
                <Text className="text-gray-700 leading-relaxed">• ML pipeline orchestration and model training</Text>
                <Text className="text-gray-700 leading-relaxed">• Model deployment and serving infrastructure</Text>
                <Text className="text-gray-700 leading-relaxed">• Jupyter notebooks and development environment</Text>
                <Text className="text-gray-700 leading-relaxed">• Real-time feature serving and data processing</Text>
              </Box>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">3. Account Registration and Use</Title>
              <Text className="text-gray-700 leading-relaxed mb-4">
                To use our Service, you must:
              </Text>
              <Box className="ml-6">
                <Text className="text-gray-700 leading-relaxed">• Provide accurate and complete registration information</Text>
                <Text className="text-gray-700 leading-relaxed">• Maintain the security of your account credentials</Text>
                <Text className="text-gray-700 leading-relaxed">• Be responsible for all activities under your account</Text>
                <Text className="text-gray-700 leading-relaxed">• Comply with our Acceptable Use Policy</Text>
              </Box>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">4. Billing and Payment</Title>
              <Text className="text-gray-700 leading-relaxed">
                Our Service operates on a pay-as-you-go model based on actual resource consumption. 
                Charges are calculated using OpenCost metrics from your cluster usage. Payment is 
                processed monthly through Stripe, and you must maintain a valid payment method on file.
                Prepaid credit options are also available.
              </Text>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">5. Data and Privacy</Title>
              <Text className="text-gray-700 leading-relaxed">
                You retain ownership of all data you upload to the Service ("Customer Data"). 
                We process your data solely to provide the Service and in accordance with our 
                Privacy Policy and Data Processing Agreement. We implement industry-standard 
                security measures to protect your data.
              </Text>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">6. Acceptable Use</Title>
              <Text className="text-gray-700 leading-relaxed mb-4">
                You agree not to:
              </Text>
              <Box className="ml-6">
                <Text className="text-gray-700 leading-relaxed">• Use the Service for illegal activities or violate applicable laws</Text>
                <Text className="text-gray-700 leading-relaxed">• Attempt to gain unauthorized access to our systems or other users' data</Text>
                <Text className="text-gray-700 leading-relaxed">• Use the Service to develop competing products or services</Text>
                <Text className="text-gray-700 leading-relaxed">• Reverse engineer, decompile, or disassemble any part of the Service</Text>
                <Text className="text-gray-700 leading-relaxed">• Process sensitive data (PHI, PCI data) without explicit authorization</Text>
              </Box>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">7. Service Availability</Title>
              <Text className="text-gray-700 leading-relaxed">
                We strive to maintain high service availability but do not guarantee uninterrupted service. 
                Scheduled maintenance will be announced in advance when possible. Our Service Level Agreement 
                details specific uptime commitments and remedies.
              </Text>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">8. Limitation of Liability</Title>
              <Text className="text-gray-700 leading-relaxed">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, HOPSWORKS AB SHALL NOT BE LIABLE FOR ANY 
                INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF 
                PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, 
                USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
              </Text>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">9. Termination</Title>
              <Text className="text-gray-700 leading-relaxed">
                Either party may terminate this Agreement with 30 days' notice. We may terminate 
                immediately for material breach of these terms. Upon termination, you will retain 
                access to export your data for a reasonable period.
              </Text>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">10. Governing Law</Title>
              <Text className="text-gray-700 leading-relaxed">
                These Terms are governed by the laws of Sweden. Any disputes will be subject to 
                the jurisdiction of Swedish courts.
              </Text>
            </Box>

            <Box>
              <Title className="text-xl font-semibold mb-4">11. Contact Information</Title>
              <Text className="text-gray-700 leading-relaxed">
                If you have questions about these Terms, please contact us at:
              </Text>
              <Box className="mt-4 ml-6">
                <Text className="text-gray-700">Hopsworks AB</Text>
                <Text className="text-gray-700">Åsögatan 119</Text>
                <Text className="text-gray-700">116 24 Stockholm, Sweden</Text>
                <Text className="text-gray-700">Email: info@hopsworks.ai</Text>
              </Box>
            </Box>

            <Box className="mt-12 pt-8 border-t border-gray-200">
              <Text className="text-sm text-gray-500">
                These Terms of Service are effective as of the date you first access the Service and 
                remain in effect until terminated in accordance with the provisions herein.
              </Text>
            </Box>
          </Box>
        </Box>
      </Layout>
    </>
  );
}