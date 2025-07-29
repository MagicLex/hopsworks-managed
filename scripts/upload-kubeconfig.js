#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const API_URL = 'http://localhost:3000/api/admin/clusters/update-kubeconfig';
const ADMIN_COOKIE = process.env.ADMIN_COOKIE || ''; // Set your admin auth cookie
const CLUSTER_ID = process.argv[2];
const KUBECONFIG_PATH = process.argv[3];

if (!CLUSTER_ID || !KUBECONFIG_PATH) {
  console.error('Usage: node upload-kubeconfig.js <cluster-id> <kubeconfig-path>');
  console.error('Example: node upload-kubeconfig.js 24453db3-7c9b-4d01-871f-5b43e349b95f /path/to/kubeconfig.yml');
  process.exit(1);
}

// Read kubeconfig file
let kubeconfig;
try {
  kubeconfig = fs.readFileSync(KUBECONFIG_PATH, 'utf8');
} catch (error) {
  console.error('Error reading kubeconfig file:', error.message);
  process.exit(1);
}

// Upload to API
async function uploadKubeconfig() {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': ADMIN_COOKIE
      },
      body: JSON.stringify({
        clusterId: CLUSTER_ID,
        kubeconfig: kubeconfig
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✓ Kubeconfig uploaded successfully');
      console.log('Cluster:', result.cluster.name);
    } else {
      console.error('✗ Failed to upload kubeconfig:', result.error);
      if (result.details) {
        console.error('Details:', result.details);
      }
    }
  } catch (error) {
    console.error('✗ Error uploading kubeconfig:', error.message);
  }
}

uploadKubeconfig();